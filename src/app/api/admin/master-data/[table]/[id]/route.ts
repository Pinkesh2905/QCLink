// ============================================================================
// PUT /api/admin/master-data/[table]/[id] — rename an option or toggle IsActive
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeAuditDiffs, diffFields } from '@/lib/audit';
import { getLookupConfig, findConflictingOption } from '@/lib/lookups';
import { updateMasterDataSchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const config = getLookupConfig(params.table);
    const id = Number(params.id);

    if (isNaN(id)) {
      throw new AppError('Invalid record ID', 400);
    }

    const body = await req.json();
    const parsed = updateMasterDataSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM ${config.table} WHERE ${config.idCol} = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Option not found', 404);
    }

    const currentRow = rows[0];
    const optionCompanyId = config.companyScoped ? (currentRow.CompanyID as number | null) : null;
    const nameChanged =
      data.name !== undefined &&
      data.name.toLowerCase() !== String(currentRow[config.nameCol]).toLowerCase();

    await withTransaction(async (conn) => {
      if (nameChanged && (await findConflictingOption(conn, config, data.name!, optionCompanyId, id))) {
        throw new AppError(`An option with the name "${data.name}" already exists`, 409, 'name');
      }

      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      const newRow: Record<string, unknown> = { ...currentRow };

      if (data.name !== undefined) {
        updateFields.push(`${config.nameCol} = ?`);
        updateValues.push(data.name);
        newRow[config.nameCol] = data.name;
      }

      if (data.isActive !== undefined && config.hasIsActive) {
        updateFields.push('IsActive = ?');
        updateValues.push(data.isActive);
        newRow.IsActive = data.isActive;
      }

      if (updateFields.length === 0) return;

      updateValues.push(id);

      await conn.execute(
        `UPDATE ${config.table} SET ${updateFields.join(', ')} WHERE ${config.idCol} = ?`,
        updateValues as any
      );

      const trackedCols = [config.nameCol];
      if (config.hasIsActive) trackedCols.push('IsActive');

      const diffs = diffFields(currentRow, newRow, trackedCols);
      await writeAuditDiffs(conn, optionCompanyId, config.table, String(id), diffs, ctx.user.userId);
    });

    return NextResponse.json({ message: 'Option updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
