'use client';

import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { EXPIRY_WARNING_DAYS, daysBetween, todayIST } from '@/lib/plans';
import { formatDateIST } from '@/lib/datetime';
import { AlertTriangle, Clock } from 'lucide-react';

/**
 * Plan status strip above every page. Admins (Vezapp staff) never see it —
 * they're never read-only, and their own workspace isn't a customer plan.
 */
export function SubscriptionBanner() {
  const { user } = useSession();
  if (!user || user.Role === 'Admin' || !user.SubscriptionEndDate) return null;

  const endLabel = formatDateIST(user.SubscriptionEndDate);

  if (user.ReadOnly) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-b border-amber-300 bg-amber-50 px-3.5 sm:px-6 md:px-8 py-2.5 text-sm text-amber-900">
        <AlertTriangle className="hidden sm:block h-4 w-4 shrink-0" />
        <p className="flex-1">
          Your company&apos;s QCLink plan ended on <strong>{endLabel}</strong>. You can view your
          data, but adding and editing are turned off until the plan is renewed.
        </p>
        <Link
          href="/app/subscription"
          className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
        >
          Renew plan
        </Link>
      </div>
    );
  }

  const daysLeft = daysBetween(todayIST(), user.SubscriptionEndDate) + 1;
  if (daysLeft > EXPIRY_WARNING_DAYS) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-b bg-muted/60 px-3.5 sm:px-6 md:px-8 py-2 text-sm text-muted-foreground">
      <Clock className="hidden sm:block h-4 w-4 shrink-0" />
      <p className="flex-1">
        Your QCLink plan ends on <span className="font-medium text-foreground">{endLabel}</span>{' '}
        ({daysLeft === 1 ? 'last day today' : `${daysLeft} days left`}).
      </p>
      <Link
        href="/app/subscription"
        className="shrink-0 font-medium text-foreground underline underline-offset-2 hover:no-underline"
      >
        Renew
      </Link>
    </div>
  );
}
