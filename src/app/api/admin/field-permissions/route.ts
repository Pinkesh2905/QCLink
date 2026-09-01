// ============================================================================
// GET /api/admin/field-permissions
// Returns full list of field permission rows for the admin management UI.
// Admin only.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { getAllFieldPermissions } from '@/lib/field-permissions';
import { errorResponse } from '@/lib/errors';

export const GET = withAdmin(async (_req: NextRequest) => {
  try {
    const rows = await getAllFieldPermissions();
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});
