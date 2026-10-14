// ============================================================================
// QCLink — Error Handling Utilities
// ============================================================================

import { NextResponse } from 'next/server';
import type { ApiError } from '@/types/api';
import { DB_UNAVAILABLE_MESSAGE, isDbUnavailable } from './db-errors';

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly field?: string;

  constructor(message: string, statusCode: number = 400, field?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.field = field;
  }
}

/**
 * Return a JSON error response. Handles AppError with its status code,
 * or defaults to 500 for unexpected errors.
 */
export function errorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, field: error.field },
      { status: error.statusCode }
    );
  }

  // MySQL unique-constraint violation — surface as a clean conflict instead of a 500.
  // (Belt-and-suspenders: application code should already pre-check uniqueness, but
  // only a real DB constraint fully closes the race between concurrent requests.)
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  ) {
    return NextResponse.json(
      { error: 'This record already exists.' },
      { status: 409 }
    );
  }

  // MySQL could not be reached (down, restarting, out of connections): say so, with a 503
  // that the screens and the browser can recognise, instead of a vague 500.
  if (isDbUnavailable(error)) {
    console.error('Database unavailable:', (error as { code?: string }).code ?? error);
    return NextResponse.json(
      { error: DB_UNAVAILABLE_MESSAGE, code: 'DB_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
  }

  // Log unexpected errors in development
  console.error('Unexpected error:', error);

  return NextResponse.json(
    { error: 'An unexpected error occurred. Please try again.' },
    { status: 500 }
  );
}

/**
 * Return a Zod validation error response with field-level details.
 */
export function validationErrorResponse(
  issues: { path: (string | number | symbol)[]; message: string }[]
): NextResponse<ApiError> {
  const details: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    if (!details[key]) details[key] = [];
    details[key].push(issue.message);
  }

  return NextResponse.json(
    { error: 'Validation failed', details },
    { status: 422 }
  );
}
