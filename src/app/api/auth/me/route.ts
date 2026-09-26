// ============================================================================
// GET /api/auth/me
// Return the current authenticated user's profile, company, and plan state.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { toClientSessionUser } from '@/types/auth';

export const GET = withAuth(async (_req: NextRequest, ctx) => {
  return NextResponse.json({ user: toClientSessionUser(ctx.user) });
});
