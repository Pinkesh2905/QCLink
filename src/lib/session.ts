// ============================================================================
// QCLink — Session Management
// Cookie get/set/clear and server-side session validation with sliding expiry.
// ============================================================================

import { cookies } from 'next/headers';
import { query } from './db';
import { verifyJWT, hashToken } from './auth';
import type { SessionUser } from '@/types/auth';
import type { User, UserSession } from '@/types/db';

function getCookieName(): string {
  return process.env.SESSION_COOKIE_NAME || 'qclink_session';
}

function getSessionTTLDays(): number {
  return parseInt(process.env.SESSION_TTL_DAYS || '60', 10);
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const ttlDays = getSessionTTLDays();

  cookieStore.set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ttlDays * 24 * 60 * 60, // seconds
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(getCookieName())?.value ?? null;
}

// ---------------------------------------------------------------------------
// Session validation
// ---------------------------------------------------------------------------

/**
 * Validate the current session from the cookie.
 * Checks JWT signature, then verifies the UserSessions row is valid
 * (not revoked, not expired). Slides the expiry forward on success.
 *
 * Returns the session user info, or null if invalid.
 */
export async function validateSession(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  // 1. Verify JWT signature and extract payload
  const payload = await verifyJWT(token);
  if (!payload) return null;

  // 2. Hash the token and check the session row
  const tokenHash = await hashToken(token);
  const ttlDays = getSessionTTLDays();

  const sessions = await query<UserSession>(
    `SELECT * FROM UserSessions
     WHERE TokenHash = ? AND RevokedAt IS NULL AND ExpiresAt > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (sessions.length === 0) return null;

  // 3. Fetch the user to get current name/email/role
  const users = await query<User>(
    `SELECT * FROM Users WHERE UserID = ? AND Status = 'Active' LIMIT 1`,
    [payload.userId]
  );

  if (users.length === 0) return null;

  const user = users[0];

  // 4. Slide the expiry forward (fire and forget — don't block the response)
  query(
    `UPDATE UserSessions SET ExpiresAt = DATE_ADD(NOW(), INTERVAL ? DAY)
     WHERE SessionID = ?`,
    [ttlDays, sessions[0].SessionID]
  ).catch((err) => {
    console.error('Failed to slide session expiry:', err);
  });

  return {
    userId: user.UserID,
    name: user.Name,
    email: user.Email,
    role: user.Role,
    sessionId: sessions[0].SessionID,
  };
}
