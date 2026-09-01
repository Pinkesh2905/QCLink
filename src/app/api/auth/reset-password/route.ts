// ============================================================================
// POST /api/auth/reset-password
// Resets user password using a valid token and revokes all active sessions.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
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

    // 1. Hash incoming token and find valid unused token row
    const tokenHash = await hashToken(token);

    const [tokenRecord] = await query<PasswordResetToken>(
      `SELECT * FROM PasswordResetTokens
       WHERE TokenHash = ? AND UsedAt IS NULL AND ExpiresAt > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!tokenRecord) {
      throw new AppError(
        'This password reset link is invalid or has expired. Please request a new one.',
        400
      );
    }

    const userId = tokenRecord.UserID;
    const newPasswordHash = await hashPassword(password);

    // 2. Perform password update, token invalidation, and session revocation atomically
    await withTransaction(async (conn) => {
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
