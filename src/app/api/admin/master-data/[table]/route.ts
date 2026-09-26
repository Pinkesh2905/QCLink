// ============================================================================
// GET /api/admin/master-data/[table] — every option (shared + all companies')
// POST /api/admin/master-data/[table] — add a shared or company-specific option
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeCreateAudit } from '@/lib/audit';
import { getLookupConfig, findConflictingOption } from '@/lib/lookups';
import { createMasterDataSchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { ResultSetHeader } from 'mysql2';

// ---------------------------------------------------------------------------
// GET — All options
// ---------------------------------------------------------------------------
export const GET = withAdmin(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const config = getLookupConfig(params.table);

    const rows = await query(
      `SELECT t.${config.idCol} AS id,
              t.${config.nameCol} AS name,
              ${config.hasIsActive ? 't.IsActive' : '1'} AS isActive,
              ${config.companyScoped ? 't.CompanyID' : 'NULL'} AS companyId,
              ${config.companyScoped ? 'c.CompanyName' : 'NULL'} AS companyName
       FROM ${config.table} t
       ${config.companyScoped ? 'LEFT JOIN Companies c ON c.CompanyID = t.CompanyID' : ''}
       ORDER BY t.${config.nameCol} ASC`
    );
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
    const config = getLookupConfig(params.table);

    const body = await req.json();
    const parsed = createMasterDataSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { name } = parsed.data;
    const companyId = parsed.data.companyId ?? null;

    if (companyId !== null) {
      if (!config.companyScoped) {
        throw new AppError(`${config.label} options are shared by all companies.`, 400);
      }
      const [company] = await query<{ CompanyID: number }>(
        'SELECT CompanyID FROM Companies WHERE CompanyID = ?',
        [companyId]
      );
      if (!company) {
        throw new AppError('Company not found', 404);
      }
    }

    const insertId = await withTransaction(async (conn) => {
      if (await findConflictingOption(conn, config, name, companyId)) {
        throw new AppError(`An option with the name "${name}" already exists`, 409, 'name');
      }

      const columns = [config.nameCol];
      const values: unknown[] = [name];
      if (config.hasIsActive) {
        columns.push('IsActive');
        values.push(1);
      }
      if (config.companyScoped) {
        columns.push('CompanyID');
        values.push(companyId);
      }

      const [res] = await conn.execute<ResultSetHeader>(
        `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values as any
      );
      const newId = String(res.insertId);

      await writeCreateAudit(conn, companyId, config.table, newId, ctx.user.userId);
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
