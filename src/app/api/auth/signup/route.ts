// ============================================================================
// POST /api/auth/signup
// Create a new user with Status='Pending', Role='User'.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendSignupNotificationToAdmins } from '@/lib/email';
import { signupSchema } from '@/validators/auth';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { User } from '@/types/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { name, email, password } = parsed.data;

    // Check if email already exists
    const existing = await query<User>(
      'SELECT UserID FROM Users WHERE Email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      throw new AppError('An account with this email already exists', 409, 'email');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    await query(
      `INSERT INTO Users (Name, Email, PasswordHash, Role, Status, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, 'User', 'Pending', NOW(), NOW())`,
      [name, email, passwordHash]
    );

    // Email notification to all Admins
    try {
      await sendSignupNotificationToAdmins(name, email);
    } catch (err) {
      console.error('Background admin notification error:', err);
    }

    return NextResponse.json(
      { message: 'Account created. Awaiting admin approval.' },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
