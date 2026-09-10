// ============================================================================
// QCLink — Auth Utilities
// Password hashing (bcryptjs) and JWT sign/verify (jose).
// ============================================================================

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from '@/types/auth';

const BCRYPT_COST = 12;

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A precomputed bcrypt hash with no known matching password, used to keep
// login's timing constant when the email isn't found — see comparePasswordTimingSafe.
const DUMMY_BCRYPT_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO2Q4E4H4Qz4X4Z4X4Z4X4Z4X4Z4X4Z4X.';

/**
 * Always runs a bcrypt comparison, even when `hash` is null — so that a
 * login attempt against a nonexistent email takes the same time as one
 * against a real email with the wrong password, closing the timing
 * side-channel an attacker could otherwise use to enumerate valid emails.
 */
export async function comparePasswordTimingSafe(
  password: string,
  hash: string | null
): Promise<boolean> {
  const matched = await bcrypt.compare(password, hash ?? DUMMY_BCRYPT_HASH);
  return hash !== null && matched;
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

function getSessionTTLDays(): number {
  return parseInt(process.env.SESSION_TTL_DAYS || '60', 10);
}

/**
 * Sign a JWT with userId, role, and sessionId.
 */
export async function signJWT(payload: {
  userId: number;
  role: 'Admin' | 'User';
  sessionId: number;
}): Promise<string> {
  const ttlDays = getSessionTTLDays();

  return new SignJWT({
    userId: payload.userId,
    role: payload.role,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(getJWTSecret());
}

/**
 * Verify a JWT and return the decoded payload.
 * Returns null if the token is invalid or expired.
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Create a sha256 hex hash of a token (for storing in UserSessions.TokenHash).
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
