// ============================================================================
// QCLink — IST Date/Time Formatting
//
// The MySQL connection returns naive "YYYY-MM-DD HH:mm:ss" strings (no
// timezone marker — see src/lib/db.ts's dateStrings:true) and every NOW()
// call in this database evaluates to true UTC (verified empirically: a
// fresh AuditLog.ChangedAt matched the HTTP response's own Date header to
// the second). The native `Date` constructor treats a marker-less string as
// *local* time, so every naive call site was silently reinterpreting a UTC
// instant as if it were already IST — shifting every displayed timestamp
// back by 5.5 hours (and, near midnight, sometimes onto the wrong calendar
// day). Every date/time shown to a user must go through the helpers below
// instead of `new Date(x).toLocaleString(...)` directly.
// ============================================================================

import { formatDistanceToNow } from 'date-fns';

const IST_TIME_ZONE = 'Asia/Kolkata';

/**
 * Parses a database timestamp, correctly treating a naive
 * "YYYY-MM-DD HH:mm:ss" string as UTC. A string that already carries an
 * explicit offset or "Z" is trusted as-is. A plain calendar date
 * ("YYYY-MM-DD", no time component) is left alone — it has no time-of-day
 * to misinterpret, so no timezone conversion is needed or safe to apply.
 */
export function parseDBTimestamp(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const hasExplicitOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const iso = hasExplicitOffset ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** e.g. "10 Sept 2026" — always rendered in IST regardless of viewer/server timezone. */
export function formatDateIST(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDBTimestamp(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/** e.g. "10 Sept 2026, 04:20 pm" — always rendered in IST. */
export function formatDateTimeIST(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDBTimestamp(value);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * "5 minutes ago" / "3 hours ago" — timezone-agnostic once the underlying
 * instant is parsed correctly, since it's only a difference against "now".
 */
export function formatRelativeIST(value: string | Date | null | undefined): string {
  const d = parseDBTimestamp(value);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

/** "YYYY-MM-DD HH:mm:ss IST" — machine-sortable-ish, for CSV/Sheets exports. */
export function formatISTForExport(value: string | Date | null | undefined): string {
  const d = parseDBTimestamp(value);
  if (!d) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} IST`;
}
