// ============================================================================
// GET /api/audit-log
// Filterable, paginated audit log query.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { errorResponse, AppError } from '@/lib/errors';

// Tables whose per-record history a regular User is allowed to view (matches
// the History modal on the 3 core module detail pages). Anything broader —
// no recordId, or a table outside this set (e.g. Users, master-data tables) —
// is Admin-only, since it can expose other users' role/status change history
// or system-wide activity, not just "my record's" history.
const USER_VISIBLE_TABLES = new Set([
  'Items', 'QCMaster', 'QCSpecifications', 'InspectionReports', 'InspectionResults',
]);

export const GET = withAuth(async (req: NextRequest, ctx) => {
  try {
    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '25', 10), 100);
    const tableName = url.searchParams.get('tableName');
    const recordId = url.searchParams.get('recordId');
    const userId = url.searchParams.get('userId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (ctx.user.role !== 'Admin') {
      const tables = tableName ? tableName.split(',').map((t) => t.trim()) : [];
      const scopedToOwnRecord =
        !!recordId && tables.length > 0 && tables.every((t) => USER_VISIBLE_TABLES.has(t));

      if (!scopedToOwnRecord) {
        throw new AppError('Admin role required to view this audit data.', 403);
      }
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (tableName) {
      // Support comma-separated table names for child rows (e.g. "QCMaster,QCSpecifications")
      const tables = tableName.split(',').map(t => t.trim());
      conditions.push(`a.TableName IN (${tables.map(() => '?').join(', ')})`);
      params.push(...tables);
    }
    if (recordId) {
      conditions.push('a.RecordID = ?');
      params.push(recordId);
    }
    if (userId) {
      conditions.push('a.ChangedByUserID = ?');
      params.push(parseInt(userId, 10));
    }
    if (startDate) {
      conditions.push('a.ChangedAt >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('a.ChangedAt <= ?');
      params.push(endDate + ' 23:59:59');
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const offset = (page - 1) * pageSize;

    const rows = await query(
      `SELECT a.*, u.Name AS ChangedByName
       FROM AuditLog a
       LEFT JOIN Users u ON a.ChangedByUserID = u.UserID
       ${whereClause}
       ORDER BY a.ChangedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM AuditLog a ${whereClause}`,
      params
    );

    return NextResponse.json({
      data: rows,
      total: countRow.total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow.total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
