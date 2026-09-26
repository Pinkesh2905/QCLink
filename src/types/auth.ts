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
  companyId: number | null;
  companyName: string | null;
  /** Last day of the company's latest QCLink plan (YYYY-MM-DD), if any. */
  subscriptionEndDate: string | null;
  /** True once the plan has lapsed: the user may view but not write. */
  readOnly: boolean;
}

/** Shape of the signed-in user sent to client components. */
export interface ClientSessionUser {
  UserID: number;
  Name: string;
  Email: string;
  Role: 'Admin' | 'User';
  CompanyID: number | null;
  CompanyName: string | null;
  SubscriptionEndDate: string | null;
  ReadOnly: boolean;
}

export function toClientSessionUser(user: SessionUser): ClientSessionUser {
  return {
    UserID: user.userId,
    Name: user.name,
    Email: user.email,
    Role: user.role,
    CompanyID: user.companyId,
    CompanyName: user.companyName,
    SubscriptionEndDate: user.subscriptionEndDate,
    ReadOnly: user.readOnly,
  };
}
