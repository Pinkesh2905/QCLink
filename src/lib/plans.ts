// ============================================================================
// QCLink — Subscription plans (shared by the admin panel and the dummy
// checkout). Subscriptions rows carry an AppCode so plans stay per app.
// ============================================================================

export const APP_CODE = 'QCLink';

export interface SubscriptionPlan {
  code: string;
  label: string;
  months: number;
  priceINR: number;
}

// Placeholder price for the dummy checkout — set the real figure once a
// payment gateway is wired up.
export const QUARTERLY_PLAN: SubscriptionPlan = {
  code: 'QUARTERLY',
  label: '3-Month Plan',
  months: 3,
  priceINR: 4999,
};

export const EXPIRY_WARNING_DAYS = 14;

/** Today's calendar date in IST as "YYYY-MM-DD". */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = parseYMD(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatYMD(d);
}

/**
 * Inclusive end date of a plan starting on `startYMD`: a 3-month plan from
 * 2026-01-15 runs through 2026-04-14. Month overflow is clamped, so a plan
 * starting Nov 30 ends Feb 27/28 rather than rolling into March.
 */
export function planEndDate(startYMD: string, months: number): string {
  const start = parseYMD(startYMD);
  const targetMonth = start.getUTCMonth() + months;
  const end = new Date(Date.UTC(start.getUTCFullYear(), targetMonth, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)
  ).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDayOfTargetMonth));
  return addDays(formatYMD(end), -1);
}

/** Whole days from `fromYMD` to `toYMD` (negative if `toYMD` is earlier). */
export function daysBetween(fromYMD: string, toYMD: string): number {
  return Math.round((parseYMD(toYMD).getTime() - parseYMD(fromYMD).getTime()) / 86_400_000);
}
