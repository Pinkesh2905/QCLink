// ============================================================================
// QCLink — Lightweight In-Memory Rate Limiter
//
// Fixed-window counter keyed by an arbitrary string (e.g. "login:<email>").
// Caveat: state lives in process memory, so it resets on restart and is NOT
// shared across multiple server instances (a multi-instance/serverless
// production deployment would need a shared store — e.g. Redis — instead).
// Good enough as a first line of defense against single-instance brute force;
// treat it as a mitigation, not a guarantee.
// ============================================================================

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically forget old buckets so this Map doesn't grow unbounded.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * Returns true if `key` is currently allowed to proceed, and records the
 * attempt. Once `limit` attempts have been recorded within `windowMs`,
 * further calls return false until the window rolls over.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  sweep(now, windowMs);

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

/** Clears a key's counter — call on a successful login to forgive prior failures. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
