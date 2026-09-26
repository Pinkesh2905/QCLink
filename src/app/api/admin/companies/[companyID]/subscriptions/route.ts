// ============================================================================
// POST /api/admin/companies/[companyID]/subscriptions — grant one more
// 3-month period (starts today if lapsed, else continues from the current end
// date). No payment is recorded for admin grants.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { extendSubscription } from '@/lib/subscriptions';
import { writeCreateAudit } from '@/lib/audit';
import { errorResponse, AppError } from '@/lib/errors';

export const POST = withAdmin(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const companyId = Number(params.companyID);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new AppError('Invalid company ID', 400);
    }

    const [company] = await query<{ CompanyID: number }>(
      'SELECT CompanyID FROM Companies WHERE CompanyID = ?',
      [companyId]
    );
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    const period = await withTransaction(async (conn) => {
      const result = await extendSubscription(conn, { companyId, source: 'Admin', userId: ctx.user.userId });
      await writeCreateAudit(conn, companyId, 'Subscriptions', String(result.subscriptionId), ctx.user.userId);
      return result;
    });

    return NextResponse.json({
      message: `Plan extended through ${period.endDate}`,
      startDate: period.startDate,
      endDate: period.endDate,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
