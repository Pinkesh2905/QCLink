// ============================================================================
// POST /api/auth/login
// Validate credentials, check Status='Active', issue JWT + session row.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, signJWT, hashToken } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { loginSchema } from '@/validators/auth';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { User } from '@/types/db';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { email, password } = parsed.data;

    // 1. Find user by email
    const users = await query<User>(
      'SELECT * FROM Users WHERE Email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = users[0];

    // 2. Verify password
    const valid = await comparePassword(password, user.PasswordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    // 3. Check status — distinct messages per status
    if (user.Status === 'Pending') {
      throw new AppError(
        'Your account is awaiting admin approval. Please check back later.',
        403
      );
    }
    if (user.Status === 'Rejected') {
      throw new AppError(
        'Your account registration was not approved. Please contact an administrator.',
        403
      );
    }
    if (user.Status === 'Deactivated') {
      throw new AppError(
        'Your account has been deactivated. Please contact an administrator.',
        403
      );
    }

    // 4. Create session row
    const ttlDays = parseInt(process.env.SESSION_TTL_DAYS || '60', 10);

    // First create a placeholder session to get the SessionID
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO UserSessions (UserID, TokenHash, CreatedAt, ExpiresAt)
       VALUES (?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [user.UserID, ttlDays]
    );

    const sessionId = result.insertId;

    // 5. Sign JWT with the session ID
    const token = await signJWT({
      userId: user.UserID,
      role: user.Role,
      sessionId,
    });

    // 6. Update the session row with the real token hash
    const tokenHashValue = await hashToken(token);
    await pool.execute(
      'UPDATE UserSessions SET TokenHash = ? WHERE SessionID = ?',
      [tokenHashValue, sessionId]
    );

    // 7. Set the cookie
    await setSessionCookie(token);

    return NextResponse.json({
      message: 'Login successful',
      user: {
        UserID: user.UserID,
        Name: user.Name,
        Email: user.Email,
        Role: user.Role,
        Status: user.Status,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
