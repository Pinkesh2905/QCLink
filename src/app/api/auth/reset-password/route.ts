// ============================================================================
// POST /api/auth/reset-password
// Resets user password using a valid token and revokes all active sessions.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { hashPassword, hashToken } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { resetPasswordSchema } from '@/validators/auth';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { PasswordResetToken } from '@/types/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { token, password } = parsed.data;

    // 1. Hash incoming token
    const tokenHash = await hashToken(token);
    const newPasswordHash = await hashPassword(password);

    // 2. Look up the token, update the password, and mark it consumed all inside
    // one transaction with a row lock (SELECT ... FOR UPDATE) on the token row.
    // This makes double-redemption impossible: if two requests replay the same
    // link concurrently, the second one's re-check (after acquiring the lock)
    // sees UsedAt already set and is rejected — a plain SELECT-then-UPDATE
    // outside a transaction could let both requests pass validation.
    await withTransaction(async (conn) => {
      const [tokenRows] = await conn.execute(
        `SELECT * FROM PasswordResetTokens
         WHERE TokenHash = ? AND UsedAt IS NULL AND ExpiresAt > NOW()
         LIMIT 1 FOR UPDATE`,
        [tokenHash]
      ) as [PasswordResetToken[], unknown];

      const tokenRecord = tokenRows[0];

      if (!tokenRecord) {
        throw new AppError(
          'This password reset link is invalid or has expired. Please request a new one.',
          400
        );
      }

      const userId = tokenRecord.UserID;

      // Update user password
      await conn.execute(
        'UPDATE Users SET PasswordHash = ?, UpdatedAt = NOW() WHERE UserID = ?',
        [newPasswordHash, userId]
      );

      // Mark token as consumed
      await conn.execute(
        'UPDATE PasswordResetTokens SET UsedAt = NOW() WHERE ResetID = ?',
        [tokenRecord.ResetID]
      );

      // Revoke all existing sessions for this user
      await conn.execute(
        'UPDATE UserSessions SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL',
        [userId]
      );

      // Log password change in audit log
      await writeAuditLog(conn, [
        {
          tableName: 'Users',
          recordId: String(userId),
          actionType: 'UPDATE',
          fieldName: 'PasswordHash',
          oldValue: null,
          newValue: '[RESET]',
          changedByUserID: userId,
        },
      ]);
    });

    return NextResponse.json({
      message: 'Your password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
