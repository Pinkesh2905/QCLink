// ============================================================================
// GET /api/admin/users — list users with optional status/company/search filters
// POST /api/admin/users — create a user under a company (no self-signup)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { writeCreateAudit } from '@/lib/audit';
import { sendAccountCreatedEmail } from '@/lib/email';
import { createUserSchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { UserWithCompany } from '@/types/db';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status');
    const companyId = url.searchParams.get('companyId');
    const search = url.searchParams.get('search') || '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      conditions.push('u.Status = ?');
      params.push(status);
    }

    if (companyId) {
      conditions.push('u.CompanyID = ?');
      params.push(parseInt(companyId, 10));
    }

    if (search) {
      conditions.push('(u.Name LIKE ? OR u.Email LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<UserWithCompany>(
      `SELECT u.UserID, u.Name, u.Email, u.Role, u.CompanyID, u.Status, u.CreatedAt, u.UpdatedAt,
              c.CompanyName
       FROM Users u
       LEFT JOIN Companies c ON c.CompanyID = u.CompanyID
       ${whereClause}
       ORDER BY u.CreatedAt DESC`,
      params
    );

    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const [company] = await query<{ CompanyName: string }>(
      'SELECT CompanyName FROM Companies WHERE CompanyID = ?',
      [data.CompanyID]
    );
    if (!company) {
      throw new AppError('Company not found', 404, 'CompanyID');
    }

    const existing = await query<{ UserID: number }>(
      'SELECT UserID FROM Users WHERE Email = ? LIMIT 1',
      [data.Email]
    );
    if (existing.length > 0) {
      throw new AppError('A user with this email already exists', 409, 'Email');
    }

    const passwordHash = await hashPassword(data.Password);

    const userId = await withTransaction(async (conn) => {
      const [res] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Users (Name, Email, PasswordHash, Role, CompanyID, Status, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, 'Active', NOW(), NOW())`,
        [data.Name, data.Email, passwordHash, data.Role, data.CompanyID]
      );

      await writeCreateAudit(conn, null, 'Users', String(res.insertId), ctx.user.userId);
      return res.insertId;
    });

    await sendAccountCreatedEmail(data.Email, data.Name, company.CompanyName);

    return NextResponse.json(
      { message: 'User created successfully', UserID: userId },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
