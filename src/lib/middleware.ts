// ============================================================================
// QCLink — API Route Middleware
// withAuth / withAdmin higher-order functions for route protection.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from './session';
import { READ_ONLY_MESSAGE } from './tenant';
import type { SessionUser } from '@/types/auth';

type RouteContext<T> = {
  params: Promise<T>;
  user: SessionUser;
};

type RouteHandler<T = any> = (
  req: NextRequest,
  ctx: RouteContext<T>
) => Promise<NextResponse>;

/**
 * Wrap an API route handler to require a valid session.
 * Injects `ctx.user` with the validated session user.
 */
export function withAuth<T = any>(handler: RouteHandler<T>) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<T> }
  ): Promise<NextResponse> => {
    const user = await validateSession();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return handler(req, { ...ctx, user });
  };
}

/**
 * Wrap a create/update/upload route: requires a valid session, a company, and
 * a current (non-lapsed) QCLink plan. This is the real enforcement of the
 * read-only state — the UI hiding buttons is only a convenience.
 */
export function withWriteAuth<T = any>(handler: RouteHandler<T>) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<T> }
  ): Promise<NextResponse> => {
    const user = await validateSession();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.companyId) {
      return NextResponse.json(
        { error: 'No company is assigned to your account.' },
        { status: 403 }
      );
    }

    if (user.readOnly) {
      return NextResponse.json({ error: READ_ONLY_MESSAGE }, { status: 402 });
    }

    return handler(req, { ...ctx, user });
  };
}

/**
 * Wrap an API route handler to require Admin role.
 * Also validates the session (inherits withAuth behavior).
 */
export function withAdmin<T = any>(handler: RouteHandler<T>) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<T> }
  ): Promise<NextResponse> => {
    const user = await validateSession();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'Admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return handler(req, { ...ctx, user });
  };
}
