// ============================================================================
// GET /api/lookup/[table]
// Dropdown options for the caller's company: every shared option plus any
// options added specifically for that company.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { getLookupConfig } from '@/lib/lookups';
import { requireCompanyId } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const config = getLookupConfig(params.table);
    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (config.companyScoped) {
      conditions.push('(CompanyID IS NULL OR CompanyID = ?)');
      values.push(requireCompanyId(ctx.user));
    }
    if (config.hasIsActive && !includeInactive) {
      conditions.push('IsActive = 1');
    }

    const rows = await query(
      `SELECT ${config.idCol} as id, ${config.nameCol} as name
              ${config.hasIsActive ? ', IsActive as isActive' : ''}
       FROM ${config.table}
       ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY ${config.nameCol} ASC`,
      values
    );
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});
