// ============================================================================
// POST /api/auth/logout
// Revoke session row, clear cookie.
// ============================================================================

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashToken } from '@/lib/auth';
import { getSessionToken, clearSessionCookie } from '@/lib/session';
import { errorResponse } from '@/lib/errors';

export async function POST() {
  try {
    const token = await getSessionToken();

    if (token) {
      // Revoke the session in the database
      const tokenHashValue = await hashToken(token);
      await query(
        'UPDATE UserSessions SET RevokedAt = NOW() WHERE TokenHash = ? AND RevokedAt IS NULL',
        [tokenHashValue]
      );
    }

    // Clear the cookie regardless
    await clearSessionCookie();

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    return errorResponse(error);
  }
}
