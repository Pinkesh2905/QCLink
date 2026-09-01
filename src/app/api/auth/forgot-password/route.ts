// ============================================================================
// POST /api/auth/forgot-password
// Request password reset link. Rate-limited per user via PasswordResetTokens.
// Always returns generic success response to avoid email enumeration.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { hashToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/validators/auth';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { User } from '@/types/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { email } = parsed.data;

    // Look up user by email
    const [user] = await query<User>(
      'SELECT * FROM Users WHERE Email = ? LIMIT 1',
      [email]
    );

    // Only proceed with token generation if user exists and is Active
    if (user && user.Status === 'Active') {
      // 1. Database-backed rate limiting (max 3 requests per 15 minutes per UserID)
      const [rateLimitCheck] = await query<{ recentCount: number }>(
        `SELECT COUNT(*) AS recentCount
         FROM PasswordResetTokens
         WHERE UserID = ?
           AND CreatedAt > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
        [user.UserID]
      );

      if (rateLimitCheck && rateLimitCheck.recentCount >= 3) {
        throw new AppError(
          'Too many password reset attempts. Please wait 15 minutes before requesting again.',
          429
        );
      }

      // 2. Generate cryptographically secure raw token (32 random bytes -> 64 hex chars)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = await hashToken(rawToken);

      // 3. Store token hash in PasswordResetTokens with 30-minute expiration
      await query(
        `INSERT INTO PasswordResetTokens (UserID, TokenHash, CreatedAt, ExpiresAt)
         VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
        [user.UserID, tokenHash]
      );

      // 4. Send password reset email with the raw token
      try {
        await sendPasswordResetEmail(user.Email, user.Name, rawToken);
      } catch (err) {
        console.error('Failed to send password reset email:', err);
      }
    }

    // Always return the exact same success response regardless of email existence
    return NextResponse.json({
      message:
        'If an account with this email exists and is active, a password reset link has been sent.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
