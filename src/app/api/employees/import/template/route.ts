// ============================================================================
// GET /api/employees/import/template
// Downloads the standard CSV template for bulk employee importing.
// Admin only.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { generateCSV } from '@/lib/csv';

export const GET = withAdmin(async (_req: NextRequest) => {
  const headers = ['EmployeeName', 'Email', 'Department', 'Designation', 'Phone', 'Active'];

  const sampleRows = [
    {
      EmployeeName: 'Anita Sharma',
      Email: 'anita.sharma@yourcompany.com',
      Department: 'Quality',
      Designation: 'QA Manager',
      Phone: '+91 98765 43210',
      Active: 'Yes',
    },
  ];

  return new NextResponse(generateCSV(headers, sampleRows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="qclink_employees_template.csv"',
    },
  });
});
