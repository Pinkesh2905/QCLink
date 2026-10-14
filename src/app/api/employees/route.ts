// ============================================================================
// GET /api/employees — paginated list with search/sort (caller's company only)
// POST /api/employees — create an employee with UID generation
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withWriteAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { generateUID } from '@/lib/uid';
import { writeCreateAudit } from '@/lib/audit';
import { requireCompanyId } from '@/lib/tenant';
import { HAS_LOGIN_SQL } from '@/lib/employees';
import { createEmployeeSchema } from '@/validators/employee';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { EmployeeWithOwner } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — List Employees
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get('pageSize') || '15', 10) || 15), 200);
    const search = url.searchParams.get('search') || '';
    const activeOnly = url.searchParams.get('active') === 'true';
    const sortBy = url.searchParams.get('sortBy') || 'CreatedAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const sortableColumns: Record<string, string> = {
      EmployeeUID: 'e.EmployeeUID',
      EmployeeName: 'e.EmployeeName',
      Email: 'e.Email',
      Department: 'e.Department',
      Designation: 'e.Designation',
      CreatedAt: 'e.CreatedAt',
      UpdatedAt: 'e.UpdatedAt',
    };
    const orderCol = sortableColumns[sortBy] || 'e.CreatedAt';

    const conditions: string[] = ['e.CompanyID = ?'];
    const params: unknown[] = [companyId];

    if (activeOnly) {
      conditions.push('e.IsActive = 1');
    }
    if (search) {
      conditions.push(
        '(e.EmployeeName LIKE ? OR e.EmployeeUID LIKE ? OR e.Email LIKE ? OR e.Department LIKE ? OR e.Designation LIKE ?)'
      );
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * pageSize;

    const rows = await query<EmployeeWithOwner & { HasLogin: number }>(
      `SELECT e.*, usr.Name AS OwnerName, ${HAS_LOGIN_SQL}
       FROM Employees e
       LEFT JOIN Users usr ON e.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY ${orderCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM Employees e ${whereClause}`,
      params
    );

    return NextResponse.json({
      data: rows,
      total: countRow.total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow.total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST — Create Employee
// ---------------------------------------------------------------------------
export const POST = withWriteAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const body = await req.json();
    const parsed = createEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;
    const emailTaken = new AppError('An employee with this email already exists.', 409, 'Email');

    const existing = await query<{ EmployeeUID: string }>(
      'SELECT EmployeeUID FROM Employees WHERE CompanyID = ? AND LOWER(Email) = ? LIMIT 1',
      [companyId, data.Email]
    );
    if (existing.length > 0) throw emailTaken;

    const employeeUID = await withTransaction(async (conn) => {
      // Re-check inside the transaction; the (CompanyID, Email) UNIQUE key is the final backstop.
      const [recheck] = (await conn.execute(
        'SELECT EmployeeUID FROM Employees WHERE CompanyID = ? AND LOWER(Email) = ? LIMIT 1',
        [companyId, data.Email]
      )) as [Array<{ EmployeeUID: string }>, unknown];
      if (recheck.length > 0) throw emailTaken;

      const uid = await generateUID(conn, companyId, 'Emp');

      await conn.execute(
        `INSERT INTO Employees (CompanyID, EmployeeUID, EmployeeName, Email, Department, Designation, Phone, IsActive, OwnerUserID, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          companyId,
          uid,
          data.EmployeeName,
          data.Email,
          data.Department,
          data.Designation,
          data.Phone,
          data.IsActive === undefined ? 1 : data.IsActive ? 1 : 0,
          ctx.user.userId,
        ]
      );

      await writeCreateAudit(conn, companyId, 'Employees', uid, ctx.user.userId);
      return uid;
    });

    return NextResponse.json(
      { message: 'Employee created successfully', EmployeeUID: employeeUID },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
