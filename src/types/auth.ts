// ============================================================================
// QCLink — Auth Types
// ============================================================================

export interface JWTPayload {
  userId: number;
  role: 'Admin' | 'User';
  sessionId: number;
  iat: number;
  exp: number;
}

export interface SessionUser {
  userId: number;
  name: string;
  email: string;
  role: 'Admin' | 'User';
  sessionId: number;
}
