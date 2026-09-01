// ============================================================================
// QCLink — Audit Log Utilities
// Diff helper and AuditLog insert function.
// ============================================================================

import type { PoolConnection } from 'mysql2/promise';
import type { AuditActionType } from '@/types/db';
import { query } from './db';

interface FieldDiff {
  field: string;
  oldValue: string | null;
  newValue: string | null;
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
  entries: {
    tableName: string;
    recordId: string;
    actionType: AuditActionType;
    fieldName: string | null;
    oldValue: string | null;
    newValue: string | null;
    changedByUserID: number;
  }[]
): Promise<void> {
  if (entries.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (const entry of entries) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, NOW())');
    values.push(
      entry.tableName,
      entry.recordId,
      entry.actionType,
      entry.fieldName,
      entry.oldValue,
      entry.newValue,
      entry.changedByUserID
    );
  }

  await conn.execute(
    `INSERT INTO AuditLog (TableName, RecordID, ActionType, FieldName, OldValue, NewValue, ChangedByUserID, ChangedAt)
     VALUES ${placeholders.join(', ')}`,
    values as any
  );
}

/**
 * Write audit log entries for a diff (UPDATE action).
 */
export async function writeAuditDiffs(
  conn: PoolConnection,
  tableName: string,
  recordId: string,
  diffs: FieldDiff[],
  changedByUserID: number
): Promise<void> {
  if (diffs.length === 0) return;

  await writeAuditLog(
    conn,
    diffs.map((d) => ({
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
  tableName: string,
  recordId: string,
  changedByUserID: number
): Promise<void> {
  await writeAuditLog(conn, [
    {
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

/**
 * Fetch audit log entries for a specific record, with user names.
 * Used by the History modal.
 */
export async function getAuditHistory(
  tableName: string | string[],
  recordId: string,
  page: number = 1,
  pageSize: number = 50
) {
  const tables = Array.isArray(tableName) ? tableName : [tableName];
  const placeholders = tables.map(() => '?').join(', ');
  const offset = (page - 1) * pageSize;

  const rows = await query(
    `SELECT a.*, u.Name AS ChangedByName
     FROM AuditLog a
     LEFT JOIN Users u ON a.ChangedByUserID = u.UserID
     WHERE a.TableName IN (${placeholders}) AND a.RecordID = ?
     ORDER BY a.ChangedAt DESC
     LIMIT ? OFFSET ?`,
    [...tables, recordId, pageSize, offset]
  );

  const [countRow] = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM AuditLog
     WHERE TableName IN (${placeholders}) AND RecordID = ?`,
    [...tables, recordId]
  );

  return {
    data: rows,
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize),
  };
}
