// ============================================================================
// POST /api/employees/import
// Two-phase bulk CSV import endpoint for the Employee Master.
// Phase 1 (confirm absent/false): validates all rows and returns a preview.
// Phase 2 (confirm=true): re-validates, batch-reserves UIDs, and inserts.
// Admin only (same as the Store Master import).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { reserveUIDs } from '@/lib/uid';
import { writeAuditLog } from '@/lib/audit';
import { requireCompanyId } from '@/lib/tenant';
import { parseCSV } from '@/lib/csv';
import { createEmployeeSchema } from '@/validators/employee';
import { errorResponse, AppError } from '@/lib/errors';

const MAX_ROWS = 2000;

interface ValidatedEmployee {
  rowNumber: number;
  EmployeeName: string;
  Email: string;
  Department: string | null;
  Designation: string | null;
  Phone: string | null;
  IsActive: boolean;
}

interface RowError {
  rowNumber: number;
  row: Record<string, string>;
  error: string;
}

/** Header names are matched ignoring case, spaces and underscores ("Employee Name" = "EmployeeName"). */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '');
}

function pick(row: Record<string, string>, ...names: string[]): string {
  const wanted = new Set(names.map(normaliseKey));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normaliseKey(key))) return (value || '').trim();
  }
  return '';
}

/** Yes/No style cell for the optional Active column. Blank means active. */
function parseActive(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === '') return true;
  if (['yes', 'y', 'true', '1', 'active'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'inactive'].includes(v)) return false;
  return null;
}

export const POST = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const isConfirm = req.nextUrl.searchParams.get('confirm') === 'true';

    // 1. Extract CSV string
    let csvText = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        throw new AppError('No CSV file provided in form data', 400);
      }
      csvText = await file.text();
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      csvText = json.csvContent || '';
    } else {
      csvText = await req.text();
    }

    if (!csvText.trim()) {
      throw new AppError('CSV content cannot be empty', 400);
    }

    // 2. Parse CSV
    const { rows } = parseCSV(csvText);

    if (rows.length === 0) {
      throw new AppError('No data rows found in uploaded CSV file', 400);
    }
    if (rows.length > MAX_ROWS) {
      throw new AppError(`A file can have at most ${MAX_ROWS} rows. Split it into smaller files.`, 400);
    }

    // 3. Emails already in the Employee Master (unique per company, case-insensitive)
    const existing = await query<{ email: string }>(
      'SELECT LOWER(Email) AS email FROM Employees WHERE CompanyID = ?',
      [companyId]
    );
    const existingEmails = new Set(existing.map((e) => e.email));

    // 4. Validate rows
    const validRows: ValidatedEmployee[] = [];
    const errorRows: RowError[] = [];
    const batchEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +1 for 1-based, +1 for header row

      const isActive = parseActive(pick(row, 'Active', 'Status', 'IsActive'));
      if (isActive === null) {
        errorRows.push({ rowNumber, row, error: 'Active must be Yes or No (or left blank)' });
        continue;
      }

      const parsed = createEmployeeSchema.safeParse({
        EmployeeName: pick(row, 'EmployeeName', 'Name'),
        Email: pick(row, 'Email', 'EmailAddress'),
        Department: pick(row, 'Department'),
        Designation: pick(row, 'Designation'),
        Phone: pick(row, 'Phone', 'PhoneNumber', 'Mobile'),
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = String(issue.path[0] ?? '');
        errorRows.push({ rowNumber, row, error: field ? `${field}: ${issue.message}` : issue.message });
        continue;
      }

      const data = parsed.data; // Email is already trimmed and lower-cased
      if (existingEmails.has(data.Email)) {
        errorRows.push({ rowNumber, row, error: `An employee with email "${data.Email}" already exists` });
        continue;
      }
      if (batchEmails.has(data.Email)) {
        errorRows.push({ rowNumber, row, error: `Email "${data.Email}" appears more than once in this file` });
        continue;
      }
      batchEmails.add(data.Email);

      validRows.push({
        rowNumber,
        EmployeeName: data.EmployeeName,
        Email: data.Email,
        Department: data.Department,
        Designation: data.Designation,
        Phone: data.Phone,
        IsActive: isActive,
      });
    }

    // Phase 1: Validation preview only
    if (!isConfirm) {
      return NextResponse.json({
        valid: validRows,
        errors: errorRows,
        validCount: validRows.length,
        errorCount: errorRows.length,
        totalRows: rows.length,
      });
    }

    // Phase 2: Commit confirmed valid rows
    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        insertedCount: 0,
        skippedCount: errorRows.length,
        errors: errorRows,
        message: 'No valid rows found to import.',
      });
    }

    const insertedUIDs = await withTransaction(async (conn) => {
      // Re-check emails inside the transaction: another import or edit may have added one since the preview.
      const [taken] = (await conn.execute(
        'SELECT LOWER(Email) AS email FROM Employees WHERE CompanyID = ?',
        [companyId]
      )) as [Array<{ email: string }>, unknown];
      const takenNow = new Set(taken.map((t) => t.email));
      const clash = validRows.find((v) => takenNow.has(v.Email));
      if (clash) {
        throw new AppError(
          `An employee with email "${clash.Email}" was added while you were importing. Please upload the file again.`,
          409
        );
      }

      // 1. Reserve contiguous UIDs in a single atomic operation
      const uids = await reserveUIDs(conn, companyId, 'Emp', validRows.length);

      // 2. Insert all valid employees
      for (let idx = 0; idx < validRows.length; idx++) {
        const emp = validRows[idx];
        await conn.execute(
          `INSERT INTO Employees (
            CompanyID, EmployeeUID, EmployeeName, Email, Department, Designation, Phone,
            IsActive, OwnerUserID, CreatedAt, UpdatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            companyId,
            uids[idx],
            emp.EmployeeName,
            emp.Email,
            emp.Department,
            emp.Designation,
            emp.Phone,
            emp.IsActive ? 1 : 0,
            ctx.user.userId,
          ]
        );
      }

      // 3. One AuditLog entry per created employee
      await writeAuditLog(
        conn,
        uids.map((uid) => ({
          companyId,
          tableName: 'Employees',
          recordId: uid,
          actionType: 'CREATE' as const,
          fieldName: null,
          oldValue: null,
          newValue: 'Bulk CSV Import',
          changedByUserID: ctx.user.userId,
        }))
      );

      return uids;
    });

    return NextResponse.json({
      success: true,
      insertedCount: validRows.length,
      skippedCount: errorRows.length,
      errors: errorRows,
      message: `Successfully imported ${validRows.length} employees (${errorRows.length} skipped due to errors).`,
      uids: insertedUIDs,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
