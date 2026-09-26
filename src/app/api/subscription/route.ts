// ============================================================================
// GET /api/subscription — the caller's company QCLink plan, history, payments
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { requireCompanyId } from '@/lib/tenant';
import { getSubscriptionSummary } from '@/lib/subscriptions';
import { QUARTERLY_PLAN } from '@/lib/plans';
import { errorResponse } from '@/lib/errors';

export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const summary = await getSubscriptionSummary(companyId);
    return NextResponse.json({
      companyName: ctx.user.companyName,
      plan: QUARTERLY_PLAN,
      ...summary,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
