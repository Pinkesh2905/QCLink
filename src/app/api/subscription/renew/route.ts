// ============================================================================
// POST /api/subscription/renew — dummy checkout: pay for one more 3-month
// QCLink period for the caller's company. Deliberately NOT write-guarded:
// renewing is exactly what a user on a lapsed (read-only) plan needs to do.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { withTransaction } from '@/lib/db';
import { requireCompanyId } from '@/lib/tenant';
import { extendSubscription, recordDummyPayment } from '@/lib/subscriptions';
import { writeCreateAudit } from '@/lib/audit';
import { errorResponse } from '@/lib/errors';

export const POST = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);

    const result = await withTransaction(async (conn) => {
      const period = await extendSubscription(conn, {
        companyId,
        source: 'Payment',
        userId: ctx.user.userId,
      });
      const payment = await recordDummyPayment(conn, {
        subscriptionId: period.subscriptionId,
        companyId,
        userId: ctx.user.userId,
      });
      await writeCreateAudit(conn, companyId, 'Subscriptions', String(period.subscriptionId), ctx.user.userId);
      return { ...period, ...payment };
    });

    return NextResponse.json({
      message: 'Payment successful. Your plan has been extended.',
      startDate: result.startDate,
      endDate: result.endDate,
      paymentReference: result.reference,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
