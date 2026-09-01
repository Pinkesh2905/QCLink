// ============================================================================
// GET /api/lookup/[table]
// Generic lookup fetcher for any reference/lookup table.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { errorResponse, AppError } from '@/lib/errors';

// Allowlist of valid lookup tables and their column mappings
const LOOKUP_TABLES: Record<string, { table: string; idCol: string; nameCol: string; hasIsActive: boolean }> = {
  'categories': { table: 'Categories', idCol: 'CategoryID', nameCol: 'CategoryName', hasIsActive: true },
  'unit-of-stock': { table: 'UnitOfStock', idCol: 'UOMID', nameCol: 'UOMName', hasIsActive: true },
  'sub-categories': { table: 'SubCategories', idCol: 'SubCategoryID', nameCol: 'SubCategoryName', hasIsActive: true },
  'specification-criteria': { table: 'SpecificationCriteria', idCol: 'CriteriaID', nameCol: 'CriteriaName', hasIsActive: true },
  'method-of-inspection': { table: 'MethodOfInspection', idCol: 'MethodID', nameCol: 'MethodName', hasIsActive: true },
  'inspection-frequency': { table: 'InspectionFrequency', idCol: 'FrequencyID', nameCol: 'FrequencyName', hasIsActive: true },
  'responsibility': { table: 'Responsibility', idCol: 'ResponsibilityID', nameCol: 'ResponsibilityName', hasIsActive: true },
  'reaction-plan': { table: 'ReactionPlan', idCol: 'ReactionPlanID', nameCol: 'ReactionPlanName', hasIsActive: true },
  'result-status': { table: 'ResultStatus', idCol: 'ResultStatusID', nameCol: 'ResultStatusName', hasIsActive: false },
};

export const GET = withAuth(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const tableSlug = params.table;
    const config = LOOKUP_TABLES[tableSlug];

    if (!config) {
      throw new AppError(`Unknown lookup table: ${tableSlug}`, 404);
    }

    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';

    let sql = `SELECT ${config.idCol} as id, ${config.nameCol} as name`;
    if (config.hasIsActive) {
      sql += ', IsActive as isActive';
    }
    sql += ` FROM ${config.table}`;

    if (config.hasIsActive && !includeInactive) {
      sql += ' WHERE IsActive = 1';
    }

    sql += ` ORDER BY ${config.nameCol} ASC`;

    const rows = await query(sql);
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});
