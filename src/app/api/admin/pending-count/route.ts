// ============================================================================
// GET /api/admin/pending-count
// Returns count of users with Status='Pending' for the sidebar badge.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query } from '@/lib/db';
import { errorResponse } from '@/lib/errors';

export const GET = withAdmin(async (_req: NextRequest) => {
  try {
    const rows = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM Users WHERE Status = 'Pending'"
    );
    return NextResponse.json({ count: rows[0].count });
  } catch (error) {
    return errorResponse(error);
  }
});
