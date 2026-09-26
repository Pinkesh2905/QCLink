// ============================================================================
// QCLink — Audit Log Utilities
// Diff helper and AuditLog insert function.
// ============================================================================

import type { PoolConnection } from 'mysql2/promise';
import type { AuditActionType } from '@/types/db';

export interface FieldDiff {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditEntry {
  /** Owning company; null for platform-level records (users, shared options). */
  companyId: number | null;
  tableName: string;
  recordId: string;
  actionType: AuditActionType;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedByUserID: number;
}

/**
 * Compare old and new row objects and return an array of changed fields.
 * Only checks the specified list of field names.
 */
export function diffFields(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
  fields: string[]
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const field of fields) {
    const oldVal = oldRow[field];
    const newVal = newRow[field];

    // Normalize both values to strings for comparison
    const oldStr = oldVal == null ? null : String(oldVal);
    const newStr = newVal == null ? null : String(newVal);

    if (oldStr !== newStr) {
      diffs.push({
        field,
        oldValue: oldStr,
        newValue: newStr,
      });
    }
  }

  return diffs;
}

/**
 * Write one or more AuditLog rows within a transaction.
 */
export async function writeAuditLog(
  conn: PoolConnection,
  entries: AuditEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (const entry of entries) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, NOW())');
    values.push(
      entry.tableName,
      entry.recordId,
      entry.companyId,
      entry.actionType,
      entry.fieldName,
      entry.oldValue,
      entry.newValue,
      entry.changedByUserID
    );
  }

  await conn.execute(
    `INSERT INTO AuditLog (TableName, RecordID, CompanyID, ActionType, FieldName, OldValue, NewValue, ChangedByUserID, ChangedAt)
     VALUES ${placeholders.join(', ')}`,
    values as any
  );
}

/**
 * Write audit log entries for a diff (UPDATE action).
 */
export async function writeAuditDiffs(
  conn: PoolConnection,
  companyId: number | null,
  tableName: string,
  recordId: string,
  diffs: FieldDiff[],
  changedByUserID: number
): Promise<void> {
  if (diffs.length === 0) return;

  await writeAuditLog(
    conn,
    diffs.map((d) => ({
      companyId,
      tableName,
      recordId,
      actionType: 'UPDATE' as AuditActionType,
      fieldName: d.field,
      oldValue: d.oldValue,
      newValue: d.newValue,
      changedByUserID,
    }))
  );
}

/**
 * Write a CREATE audit log entry.
 */
export async function writeCreateAudit(
  conn: PoolConnection,
  companyId: number | null,
  tableName: string,
  recordId: string,
  changedByUserID: number
): Promise<void> {
  await writeAuditLog(conn, [
    {
      companyId,
      tableName,
      recordId,
      actionType: 'CREATE',
      fieldName: null,
      oldValue: null,
      newValue: null,
      changedByUserID,
    },
  ]);
}
