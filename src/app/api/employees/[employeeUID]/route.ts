// ============================================================================
// GET /api/employees/[employeeUID] — employee detail (caller's company only)
// PUT /api/employees/[employeeUID] — update employee
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withWriteAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs } from '@/lib/audit';
import { requireCompanyId } from '@/lib/tenant';
import { HAS_LOGIN_SQL } from '@/lib/employees';
import { enforceFieldPermissions } from '@/lib/field-permissions';
import { updateEmployeeSchema } from '@/validators/employee';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { Employee, EmployeeWithOwner } from '@/types/db';

export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { employeeUID } = await ctx.params;

    const rows = await query<EmployeeWithOwner & { HasLogin: number }>(
      `SELECT e.*, usr.Name AS OwnerName, ${HAS_LOGIN_SQL}
       FROM Employees e
       LEFT JOIN Users usr ON e.OwnerUserID = usr.UserID
       WHERE e.CompanyID = ? AND e.EmployeeUID = ?`,
      [companyId, employeeUID]
    );

    if (rows.length === 0) {
      throw new AppError('Employee not found', 404);
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PUT = withWriteAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { employeeUID } = await ctx.params;

    const body = await req.json();
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }
    const data = parsed.data;

    const [current] = await query<Employee>(
      'SELECT * FROM Employees WHERE CompanyID = ? AND EmployeeUID = ?',
      [companyId, employeeUID]
    );
    if (!current) {
      throw new AppError('Employee not found', 404);
    }

    const editableFields = ['EmployeeName', 'Email', 'Department', 'Designation', 'Phone', 'IsActive'];
    const newRow: Record<string, unknown> = { ...current };
    for (const field of editableFields) {
      if (field in data) {
        const value = (data as Record<string, unknown>)[field];
        newRow[field] = field === 'IsActive' ? (value ? 1 : 0) : value ?? null;
      }
    }

    const diffs = diffFields(current as unknown as Record<string, unknown>, newRow, editableFields);
    if (diffs.length === 0) {
      return NextResponse.json({ message: 'No changes detected' });
    }
    await enforceFieldPermissions('Employees', diffs.map((d) => d.field), ctx.user.role);

    const emailTaken = new AppError('An employee with this email already exists.', 409, 'Email');

    await withTransaction(async (conn) => {
      if (diffs.some((d) => d.field === 'Email')) {
        const [dupes] = (await conn.execute(
          'SELECT EmployeeUID FROM Employees WHERE CompanyID = ? AND LOWER(Email) = ? AND EmployeeUID <> ? LIMIT 1',
          [companyId, String(newRow.Email).toLowerCase(), employeeUID]
        )) as [Array<{ EmployeeUID: string }>, unknown];
        if (dupes.length > 0) throw emailTaken;
      }

      const sets = diffs.map((d) => `${d.field} = ?`);
      const values = diffs.map((d) => newRow[d.field] ?? null);
      await conn.execute(
        `UPDATE Employees SET ${sets.join(', ')}, UpdatedAt = NOW() WHERE CompanyID = ? AND EmployeeUID = ?`,
        [...values, companyId, employeeUID] as (string | number | null)[]
      );

      // A reviewer's name and email are copied onto the reports they were picked for,
      // so an edit here never rewrites old reports; new picks see the new values.
      await writeAuditDiffs(conn, companyId, 'Employees', employeeUID, diffs, ctx.user.userId);
    });

    return NextResponse.json({ message: 'Employee updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
