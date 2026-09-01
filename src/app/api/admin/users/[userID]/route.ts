// ============================================================================
// PUT /api/admin/users/[userID] — change user status or role
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeAuditDiffs, diffFields } from '@/lib/audit';
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/email';
import { updateUserStatusRoleSchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { User } from '@/types/db';

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const targetUserID = Number(params.userID);

    if (isNaN(targetUserID)) {
      throw new AppError('Invalid User ID', 400);
    }

    const body = await req.json();
    const parsed = updateUserStatusRoleSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    // Check target user
    const [targetUser] = await query<User>(
      'SELECT * FROM Users WHERE UserID = ?',
      [targetUserID]
    );

    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    // Prevent admin from deactivating or demoting themselves
    if (targetUserID === ctx.user.userId) {
      if (data.Status && data.Status !== 'Active') {
        throw new AppError('You cannot deactivate your own administrative account', 400);
      }
      if (data.Role && data.Role !== 'Admin') {
        throw new AppError('You cannot remove admin privileges from yourself', 400);
      }
    }

    await withTransaction(async (conn) => {
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      const newRow: Record<string, unknown> = { ...targetUser };

      if (data.Status) {
        updateFields.push('Status = ?');
        updateValues.push(data.Status);
        newRow.Status = data.Status;

        // If rejected or deactivated, revoke all active sessions for this user
        if (data.Status === 'Rejected' || data.Status === 'Deactivated') {
          await conn.execute(
            'UPDATE UserSessions SET RevokedAt = NOW() WHERE UserID = ? AND RevokedAt IS NULL',
            [targetUserID]
          );
        }
      }

      if (data.Role) {
        updateFields.push('Role = ?');
        updateValues.push(data.Role);
        newRow.Role = data.Role;
      }

      if (updateFields.length === 0) {
        return;
      }

      updateFields.push('UpdatedAt = NOW()');
      updateValues.push(targetUserID);

      await conn.execute(
        `UPDATE Users SET ${updateFields.join(', ')} WHERE UserID = ?`,
        updateValues as any
      );

      const diffs = diffFields(
        targetUser as unknown as Record<string, unknown>,
        newRow,
        ['Status', 'Role']
      );

      await writeAuditDiffs(conn, 'Users', String(targetUserID), diffs, ctx.user.userId);
    });

    // Status notification emails
    if (data.Status && targetUser.Status === 'Pending') {
      try {
        if (data.Status === 'Active') {
          await sendApprovalEmail(targetUser.Email, targetUser.Name);
        } else if (data.Status === 'Rejected') {
          await sendRejectionEmail(targetUser.Email, targetUser.Name);
        }
      } catch (err) {
        console.error('Background user status notification email error:', err);
      }
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
