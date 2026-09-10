// ============================================================================
// POST /api/auth/login
// Validate credentials, check Status='Active', issue JWT + session row.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePasswordTimingSafe, signJWT, hashToken } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { loginSchema } from '@/validators/auth';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { User } from '@/types/db';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { email, password } = parsed.data;
    const rateLimitKey = `login:${email.toLowerCase()}`;

    if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
      throw new AppError(
        'Too many login attempts. Please wait 15 minutes and try again.',
        429
      );
    }

    // 1. Find user by email
    const users = await query<User>(
      'SELECT * FROM Users WHERE Email = ? LIMIT 1',
      [email]
    );

    const user = users[0] ?? null;

    // 2. Verify password. Always runs a bcrypt comparison — even when no user
    // was found — so a nonexistent email takes the same time as a wrong
    // password, closing the timing side-channel that would otherwise let an
    // attacker enumerate valid emails.
    const valid = await comparePasswordTimingSafe(password, user?.PasswordHash ?? null);
    if (!user || !valid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Successful credential check — forgive prior failed attempts for this email.
    resetRateLimit(rateLimitKey);

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
