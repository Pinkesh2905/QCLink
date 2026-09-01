// ============================================================================
// QCLink — UID Generation & Batch Reservation
// Generates string UIDs like "Item07", "QC01", "IIR12" using UIDCounters.
// Must be called within a transaction — uses SELECT ... FOR UPDATE.
// ============================================================================

import type { PoolConnection } from 'mysql2/promise';
import type { UIDCounter } from '@/types/db';

/**
 * Generate the next single UID for a given entity prefix within a transaction.
 * Uses SELECT ... FOR UPDATE to lock the counter row.
 *
 * @param conn - A mysql2 PoolConnection within an active transaction
 * @param prefix - Entity prefix: 'Item', 'QC', or 'IIR'
 * @returns The formatted UID string (e.g. "Item07")
 */
export async function generateUID(
  conn: PoolConnection,
  prefix: string
): Promise<string> {
  const uids = await reserveUIDs(conn, prefix, 1);
  return uids[0];
}

/**
 * Reserve a contiguous block of N UIDs within a single lock/read/update cycle.
 *
 * @param conn - A mysql2 PoolConnection within an active transaction
 * @param prefix - Entity prefix: 'Item', 'QC', or 'IIR'
 * @param count - Number of contiguous UIDs to reserve
 * @returns Array of formatted UID strings
 */
export async function reserveUIDs(
  conn: PoolConnection,
  prefix: string,
  count: number
): Promise<string[]> {
  if (count <= 0) {
    return [];
  }

  // Lock the counter row once
  const [rows] = await conn.execute(
    'SELECT CurrentValue, PadWidth FROM UIDCounters WHERE EntityPrefix = ? FOR UPDATE',
    [prefix]
  );

  const counters = rows as UIDCounter[];
  if (counters.length === 0) {
    throw new Error(`No UIDCounter row found for prefix "${prefix}"`);
  }

  const { CurrentValue, PadWidth } = counters[0];
  const uids: string[] = [];

  for (let i = 1; i <= count; i++) {
    const val = CurrentValue + i;
    const valStr = String(val);
    const padded =
      valStr.length >= PadWidth ? valStr : valStr.padStart(PadWidth, '0');
    uids.push(`${prefix}${padded}`);
  }

  const finalValue = CurrentValue + count;

  // Update the counter once
  await conn.execute(
    'UPDATE UIDCounters SET CurrentValue = ? WHERE EntityPrefix = ?',
    [finalValue, prefix]
  );

  return uids;
}
