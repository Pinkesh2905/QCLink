// ============================================================================
// PUT /api/admin/field-permissions/[id]
// Updates the MinimumRole ('User' | 'Admin') for a specific field permission row.
// Admin only.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { errorResponse, AppError } from '@/lib/errors';
import type { FieldPermission } from '@/types/db';

export const PUT = withAdmin<{ id: string }>(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const permissionId = parseInt(params.id, 10);

    if (isNaN(permissionId) || permissionId <= 0) {
      throw new AppError('Invalid permission ID', 400);
    }

    const body = await req.json();
    const roleInput = body.minimumRole || body.MinimumRole;

    if (roleInput !== 'User' && roleInput !== 'Admin') {
      throw new AppError('MinimumRole must be either "User" or "Admin"', 400);
    }

    const [current] = await query<FieldPermission>(
      'SELECT * FROM FieldPermissions WHERE FieldPermissionID = ?',
      [permissionId]
    );

    if (!current) {
      throw new AppError('Field permission not found', 404);
    }

    if (current.MinimumRole !== roleInput) {
      await withTransaction(async (conn) => {
        await conn.execute(
          'UPDATE FieldPermissions SET MinimumRole = ?, UpdatedAt = NOW() WHERE FieldPermissionID = ?',
          [roleInput, permissionId]
        );

        await writeAuditLog(conn, [
          {
            tableName: 'FieldPermissions',
            recordId: String(permissionId),
            actionType: 'UPDATE',
            fieldName: `${current.ModuleName}.${current.FieldName}`,
            oldValue: current.MinimumRole,
            newValue: roleInput,
            changedByUserID: ctx.user.userId,
          },
        ]);
      });
    }

    return NextResponse.json({
      message: 'Field permission updated successfully',
      permissionId,
      minimumRole: roleInput,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
