// ============================================================================
// QCLink — Subscription periods & dummy payments
// A company's QCLink access runs through the latest EndDate among its
// QCLink Subscriptions rows. Extending always continues from the current end
// date (or today, if already lapsed), so periods never overlap and renewing
// early never loses days.
// ============================================================================

import type { PoolConnection } from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2';
import crypto from 'crypto';
import { query } from './db';
import { APP_CODE, QUARTERLY_PLAN, addDays, daysBetween, planEndDate, todayIST } from './plans';
import type { Subscription, SubscriptionPayment } from '@/types/db';

export type SubscriptionStatus = 'active' | 'expired' | 'none';

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  endDate: string | null;
  /** Days left including today; negative once expired. */
  daysLeft: number | null;
  periods: Subscription[];
  payments: SubscriptionPayment[];
}

export function subscriptionStatus(endDate: string | null): SubscriptionStatus {
  if (!endDate) return 'none';
  return endDate >= todayIST() ? 'active' : 'expired';
}

export async function getSubscriptionSummary(companyId: number): Promise<SubscriptionSummary> {
  const periods = await query<Subscription>(
    `SELECT * FROM Subscriptions WHERE CompanyID = ? AND AppCode = ?
     ORDER BY EndDate DESC, SubscriptionID DESC`,
    [companyId, APP_CODE]
  );
  const payments = await query<SubscriptionPayment>(
    `SELECT * FROM SubscriptionPayments WHERE CompanyID = ? AND AppCode = ?
     ORDER BY PaidAt DESC`,
    [companyId, APP_CODE]
  );

  const endDate = periods[0]?.EndDate ?? null;
  return {
    status: subscriptionStatus(endDate),
    endDate,
    daysLeft: endDate ? daysBetween(todayIST(), endDate) + 1 : null,
    periods,
    payments,
  };
}

/**
 * Add one 3-month QCLink period for a company, inside the caller's
 * transaction. Locks the company row so two concurrent renewals queue instead
 * of both starting from the same end date.
 */
export async function extendSubscription(
  conn: PoolConnection,
  opts: { companyId: number; source: 'Admin' | 'Payment'; userId: number }
): Promise<{ subscriptionId: number; startDate: string; endDate: string }> {
  // Lock the company row: always exists, unlike the first Subscriptions row.
  await conn.execute('SELECT CompanyID FROM Companies WHERE CompanyID = ? FOR UPDATE', [
    opts.companyId,
  ]);

  const [rows] = (await conn.execute(
    'SELECT MAX(EndDate) AS EndDate FROM Subscriptions WHERE CompanyID = ? AND AppCode = ?',
    [opts.companyId, APP_CODE]
  )) as [Array<{ EndDate: string | null }>, unknown];

  const today = todayIST();
  const currentEnd = rows[0]?.EndDate ?? null;
  const startDate = currentEnd && currentEnd >= today ? addDays(currentEnd, 1) : today;
  const endDate = planEndDate(startDate, QUARTERLY_PLAN.months);

  const [res] = await conn.execute<ResultSetHeader>(
    `INSERT INTO Subscriptions (CompanyID, AppCode, PlanCode, StartDate, EndDate, Source, CreatedByUserID)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [opts.companyId, APP_CODE, QUARTERLY_PLAN.code, startDate, endDate, opts.source, opts.userId]
  );

  return { subscriptionId: res.insertId, startDate, endDate };
}

/**
 * Dummy checkout: always succeeds and records a payment tagged gateway
 * "DUMMY". Swap this for a real gateway call (create order → verify
 * signature/webhook → then extend) when one is available.
 */
export async function recordDummyPayment(
  conn: PoolConnection,
  opts: { subscriptionId: number; companyId: number; userId: number }
): Promise<{ paymentId: number; reference: string }> {
  const reference = `DUMMY-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const [res] = await conn.execute<ResultSetHeader>(
    `INSERT INTO SubscriptionPayments
       (SubscriptionID, CompanyID, AppCode, Amount, Currency, Gateway, GatewayReference, Status, PaidByUserID)
     VALUES (?, ?, ?, ?, 'INR', 'DUMMY', ?, 'Success', ?)`,
    [opts.subscriptionId, opts.companyId, APP_CODE, QUARTERLY_PLAN.priceINR, reference, opts.userId]
  );
  return { paymentId: res.insertId, reference };
}
