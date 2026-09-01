// ============================================================================
// GET /api/admin/users — list users with optional status/search filters
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import type { SafeUser } from '@/types/db';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search') || '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      conditions.push('Status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(Name LIKE ? OR Email LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<SafeUser>(
      `SELECT UserID, Name, Email, Role, Status, CreatedAt, UpdatedAt
       FROM Users
       ${whereClause}
       ORDER BY CreatedAt DESC`,
      params
    );

    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});
