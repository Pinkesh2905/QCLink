// ============================================================================
// PUT /api/admin/master-data/[table]/[id] — update option or toggle IsActive
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeAuditDiffs, diffFields } from '@/lib/audit';
import { updateMasterDataSchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';

const LOOKUP_TABLES: Record<
  string,
  { table: string; idCol: string; nameCol: string; hasIsActive: boolean }
> = {
  categories: { table: 'Categories', idCol: 'CategoryID', nameCol: 'CategoryName', hasIsActive: true },
  'unit-of-stock': { table: 'UnitOfStock', idCol: 'UOMID', nameCol: 'UOMName', hasIsActive: true },
  'sub-categories': { table: 'SubCategories', idCol: 'SubCategoryID', nameCol: 'SubCategoryName', hasIsActive: true },
  'specification-criteria': { table: 'SpecificationCriteria', idCol: 'CriteriaID', nameCol: 'CriteriaName', hasIsActive: true },
  'method-of-inspection': { table: 'MethodOfInspection', idCol: 'MethodID', nameCol: 'MethodName', hasIsActive: true },
  'inspection-frequency': { table: 'InspectionFrequency', idCol: 'FrequencyID', nameCol: 'FrequencyName', hasIsActive: true },
  responsibility: { table: 'Responsibility', idCol: 'ResponsibilityID', nameCol: 'ResponsibilityName', hasIsActive: true },
  'reaction-plan': { table: 'ReactionPlan', idCol: 'ReactionPlanID', nameCol: 'ReactionPlanName', hasIsActive: true },
  'result-status': { table: 'ResultStatus', idCol: 'ResultStatusID', nameCol: 'ResultStatusName', hasIsActive: false },
};

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const tableSlug = params.table;
    const id = Number(params.id);
    const config = LOOKUP_TABLES[tableSlug];

    if (!config) {
      throw new AppError(`Unknown master data table: ${tableSlug}`, 404);
    }

    if (isNaN(id)) {
      throw new AppError('Invalid record ID', 400);
    }

    const body = await req.json();
    const parsed = updateMasterDataSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    // Fetch existing row
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM ${config.table} WHERE ${config.idCol} = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Option not found', 404);
    }

    const currentRow = rows[0];

    // Check uniqueness if name changed
    if (data.name && data.name.toLowerCase() !== String(currentRow[config.nameCol]).toLowerCase()) {
      const existing = await query(
        `SELECT ${config.idCol} FROM ${config.table}
         WHERE LOWER(${config.nameCol}) = LOWER(?) AND ${config.idCol} != ? LIMIT 1`,
        [data.name, id]
      );
      if (existing.length > 0) {
        throw new AppError(`An option with the name "${data.name}" already exists`, 409, 'name');
      }
    }

    await withTransaction(async (conn) => {
      // Re-check immediately before writing — the check above ran outside
      // this transaction, so a concurrent rename could have raced in between.
      if (data.name && data.name.toLowerCase() !== String(currentRow[config.nameCol]).toLowerCase()) {
        const [dupeRecheck] = await conn.execute(
          `SELECT ${config.idCol} FROM ${config.table}
           WHERE LOWER(${config.nameCol}) = LOWER(?) AND ${config.idCol} != ? LIMIT 1`,
          [data.name, id]
        ) as [Array<Record<string, unknown>>, unknown];
        if (dupeRecheck.length > 0) {
          throw new AppError(`An option with the name "${data.name}" already exists`, 409, 'name');
        }
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
      await writeAuditDiffs(conn, config.table, String(id), diffs, ctx.user.userId);
    });

    return NextResponse.json({ message: 'Option updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
