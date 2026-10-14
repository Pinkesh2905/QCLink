// ============================================================================
// QCLink — "the database is not reachable" detection
// Used to answer API calls with a clear 503 and to show a friendly "temporarily
// unavailable" screen instead of a generic server error when MySQL is down,
// restarting, out of connections or unreachable from Vercel.
// ============================================================================

const UNAVAILABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'POOL_CLOSED',
  'POOL_ENQUEUELIMIT',
  'ER_CON_COUNT_ERROR', // too many connections
  'ER_SERVER_SHUTDOWN',
  'ER_NET_READ_ERROR',
  'ER_NET_ERROR_ON_WRITE',
  'ER_CONNECTION_KILLED',
  'ER_QUERY_TIMEOUT',
  'ER_LOCK_WAIT_TIMEOUT',
]);

export const DB_UNAVAILABLE_MESSAGE =
  'QCLink cannot reach its database right now. This is usually temporary. Please try again in a minute — your data is safe.';

/** True when the error means MySQL could not be reached or did not answer (as opposed to a bug or bad data). */
export function isDbUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; fatal?: unknown; message?: unknown; cause?: unknown };

  if (typeof e.code === 'string' && UNAVAILABLE_CODES.has(e.code)) return true;
  // mysql2 marks connection-level failures as fatal
  if (e.fatal === true && typeof e.code === 'string' && !e.code.startsWith('ER_')) return true;
  if (typeof e.message === 'string' && /connect (ETIMEDOUT|ECONNREFUSED)|Connection lost|Pool is closed|Too many connections/i.test(e.message)) {
    return true;
  }
  return e.cause ? isDbUnavailable(e.cause) : false;
}
