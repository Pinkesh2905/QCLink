// ============================================================================
// GET /api/auth/me
// Return the current authenticated user's profile from the session.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';

export const GET = withAuth(async (_req: NextRequest, ctx) => {
  return NextResponse.json({
    user: {
      UserID: ctx.user.userId,
      Name: ctx.user.name,
      Email: ctx.user.email,
      Role: ctx.user.role,
    },
  });
});
