// ============================================================================
// GET /api/admin/master-data/[table] — list all options (active & inactive)
// POST /api/admin/master-data/[table] — add new option to lookup table
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeCreateAudit } from '@/lib/audit';
import { createMasterDataSchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { ResultSetHeader } from 'mysql2';

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

// ---------------------------------------------------------------------------
// GET — All options
// ---------------------------------------------------------------------------
export const GET = withAdmin(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const tableSlug = params.table;
    const config = LOOKUP_TABLES[tableSlug];

    if (!config) {
      throw new AppError(`Unknown master data table: ${tableSlug}`, 404);
    }

    let sql = `SELECT ${config.idCol} as id, ${config.nameCol} as name`;
    if (config.hasIsActive) {
      sql += ', IsActive as isActive';
    } else {
      sql += ', 1 as isActive';
    }
    sql += ` FROM ${config.table} ORDER BY ${config.nameCol} ASC`;

    const rows = await query(sql);
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST — Add new option
// ---------------------------------------------------------------------------
export const POST = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const tableSlug = params.table;
    const config = LOOKUP_TABLES[tableSlug];

    if (!config) {
      throw new AppError(`Unknown master data table: ${tableSlug}`, 404);
    }

    const body = await req.json();
    const parsed = createMasterDataSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { name } = parsed.data;

    // Check for duplicate name
    const existing = await query(
      `SELECT ${config.idCol} FROM ${config.table} WHERE LOWER(${config.nameCol}) = LOWER(?) LIMIT 1`,
      [name]
    );

    if (existing.length > 0) {
      throw new AppError(`An option with the name "${name}" already exists`, 409, 'name');
    }

    const insertId = await withTransaction(async (conn) => {
      // Re-check immediately before inserting — the check above ran outside
      // this transaction, so a concurrent request could have raced in between.
      const [dupeRecheck] = await conn.execute(
        `SELECT ${config.idCol} FROM ${config.table} WHERE LOWER(${config.nameCol}) = LOWER(?) LIMIT 1`,
        [name]
      ) as [Array<Record<string, unknown>>, unknown];

      if (dupeRecheck.length > 0) {
        throw new AppError(`An option with the name "${name}" already exists`, 409, 'name');
      }

      let insertSql = `INSERT INTO ${config.table} (${config.nameCol}`;
      let valuesSql = 'VALUES (?';
      const values: unknown[] = [name];

      if (config.hasIsActive) {
        insertSql += ', IsActive)';
        valuesSql += ', 1)';
      } else {
        insertSql += ')';
        valuesSql += ')';
      }

      const [res] = await conn.execute<ResultSetHeader>(`${insertSql} ${valuesSql}`, values as any);
      const newId = String(res.insertId);

      await writeCreateAudit(conn, config.table, newId, ctx.user.userId);
      return newId;
    });

    return NextResponse.json(
      { message: 'Option added successfully', id: insertId },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
