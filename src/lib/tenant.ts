// ============================================================================
// QCLink — Tenant access rules
// Who may use QCLink, and whether they can write. Applied at login and on
// every session validation, so suspending a company or letting its plan
// lapse takes effect on the user's next request.
// ============================================================================

import { AppError } from './errors';
import { APP_CODE, todayIST } from './plans';
import type { SessionUser } from '@/types/auth';

export interface TenantRow {
  Role: 'Admin' | 'User';
  CompanyID: number | null;
  CompanyName: string | null;
  CompanyIsActive: number | null;
  SubscriptionEndDate: string | null;
}

export type TenantAccess =
  | { allowed: true; readOnly: boolean }
  | { allowed: false; reason: string };

/**
 * Admins are Vezapp platform staff: never blocked, never read-only. Everyone
 * else needs an active company with a QCLink subscription; once the latest
 * plan's end date has passed they can still sign in and view, but not write.
 */
export function evaluateTenantAccess(row: TenantRow): TenantAccess {
  if (row.Role === 'Admin') {
    return { allowed: true, readOnly: false };
  }
  if (!row.CompanyID) {
    return {
      allowed: false,
      reason: 'Your account is not linked to a company yet. Please contact Vezapp support.',
    };
  }
  if (!row.CompanyIsActive) {
    return {
      allowed: false,
      reason: "Your company's access has been suspended. Please contact Vezapp support.",
    };
  }
  if (!row.SubscriptionEndDate) {
    return {
      allowed: false,
      reason: `Your company does not have a ${APP_CODE} subscription. Please contact Vezapp support.`,
    };
  }
  return { allowed: true, readOnly: row.SubscriptionEndDate < todayIST() };
}

/**
 * SQL fragment selecting a user together with their company and the end date
 * of their company's latest QCLink plan. Bind: [APP_CODE, ...your WHERE params].
 */
export const USER_WITH_TENANT_SELECT = `
  SELECT u.*,
         c.CompanyName,
         c.IsActive AS CompanyIsActive,
         (SELECT MAX(s.EndDate) FROM Subscriptions s
          WHERE s.CompanyID = u.CompanyID AND s.AppCode = ?) AS SubscriptionEndDate
  FROM Users u
  LEFT JOIN Companies c ON c.CompanyID = u.CompanyID
`;

/** The caller's company, or a 403 if their account has none. */
export function requireCompanyId(user: SessionUser): number {
  if (!user.companyId) {
    throw new AppError('No company is assigned to your account.', 403);
  }
  return user.companyId;
}

export const READ_ONLY_MESSAGE = `Your company's ${APP_CODE} plan has expired. Renew your subscription to add or edit data.`;
