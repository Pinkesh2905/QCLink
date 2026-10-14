// ============================================================================
// GET /api/employees/export — exports the Employee Master to CSV
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { generateCSV } from '@/lib/csv';
import { formatISTForExport } from '@/lib/datetime';
import { requireCompanyId } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';
import type { EmployeeWithOwner } from '@/types/db';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const exportAll = url.searchParams.get('exportAll') === 'true';

    const conditions: string[] = ['e.CompanyID = ?'];
    const params: unknown[] = [companyId];
    if (search && !exportAll) {
      conditions.push('(e.EmployeeName LIKE ? OR e.EmployeeUID LIKE ? OR e.Email LIKE ? OR e.Department LIKE ? OR e.Designation LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const rows = await query<EmployeeWithOwner>(
      `SELECT e.*, usr.Name AS OwnerName
       FROM Employees e
       LEFT JOIN Users usr ON e.OwnerUserID = usr.UserID
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.EmployeeUID ASC`,
      params
    );

    const headers = ['EmployeeUID', 'EmployeeName', 'Email', 'Department', 'Designation', 'Phone', 'Active', 'Owner', 'CreatedAt', 'UpdatedAt'];
    const exportRows = rows.map((r) => ({
      EmployeeUID: r.EmployeeUID,
      EmployeeName: r.EmployeeName,
      Email: r.Email,
      Department: r.Department ?? '',
      Designation: r.Designation ?? '',
      Phone: r.Phone ?? '',
      Active: r.IsActive ? 'Yes' : 'No',
      Owner: r.OwnerName ?? '',
      CreatedAt: formatISTForExport(r.CreatedAt),
      UpdatedAt: formatISTForExport(r.UpdatedAt),
    }));

    return new NextResponse(generateCSV(headers, exportRows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qclink_employees_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
