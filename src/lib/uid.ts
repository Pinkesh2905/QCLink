// ============================================================================
// QCLink — UID Generation & Batch Reservation
// Generates string UIDs like "Item07", "QC01", "IIR12". Each company has its
// own sequence (CompanyUIDCounters), so every company starts at Item01.
// Must be called within a transaction — uses SELECT ... FOR UPDATE.
// ============================================================================

import type { PoolConnection } from 'mysql2/promise';
import type { UIDCounter } from '@/types/db';

export type UIDPrefix = 'Item' | 'QC' | 'IIR';

const DEFAULT_PAD_WIDTH = 2;

/**
 * Generate the next single UID for a company's entity prefix.
 */
export async function generateUID(
  conn: PoolConnection,
  companyId: number,
  prefix: UIDPrefix
): Promise<string> {
  const uids = await reserveUIDs(conn, companyId, prefix, 1);
  return uids[0];
}

/**
 * Reserve a contiguous block of N UIDs for a company in a single
 * lock/read/update cycle.
 */
export async function reserveUIDs(
  conn: PoolConnection,
  companyId: number,
  prefix: UIDPrefix,
  count: number
): Promise<string[]> {
  if (count <= 0) {
    return [];
  }

  // A company's first record of this type creates its counter row. A
  // concurrent first insert blocks on the duplicate key until this
  // transaction commits, then finds the row and locks it below.
  await conn.execute(
    'INSERT IGNORE INTO CompanyUIDCounters (CompanyID, EntityPrefix, CurrentValue, PadWidth) VALUES (?, ?, 0, ?)',
    [companyId, prefix, DEFAULT_PAD_WIDTH]
  );

  const [rows] = await conn.execute(
    'SELECT CurrentValue, PadWidth FROM CompanyUIDCounters WHERE CompanyID = ? AND EntityPrefix = ? FOR UPDATE',
    [companyId, prefix]
  );

  const counters = rows as UIDCounter[];
  if (counters.length === 0) {
    throw new Error(`No UID counter for company ${companyId}, prefix "${prefix}"`);
  }

  const { CurrentValue, PadWidth } = counters[0];
  const uids: string[] = [];

  for (let i = 1; i <= count; i++) {
    uids.push(`${prefix}${String(CurrentValue + i).padStart(PadWidth, '0')}`);
  }

  await conn.execute(
    'UPDATE CompanyUIDCounters SET CurrentValue = ? WHERE CompanyID = ? AND EntityPrefix = ?',
    [CurrentValue + count, companyId, prefix]
  );

  return uids;
}
