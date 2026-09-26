// ============================================================================
// GET /api/admin/companies — all companies with user count + plan end date
// POST /api/admin/companies — create a company; it starts on a 3-month plan
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeCreateAudit } from '@/lib/audit';
import { extendSubscription } from '@/lib/subscriptions';
import { APP_CODE } from '@/lib/plans';
import { createCompanySchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { CompanyWithStats } from '@/types/db';

export const GET = withAdmin(async () => {
  try {
    const rows = await query<CompanyWithStats>(
      `SELECT c.*,
              (SELECT COUNT(*) FROM Users u WHERE u.CompanyID = c.CompanyID) AS UserCount,
              (SELECT MAX(s.EndDate) FROM Subscriptions s
               WHERE s.CompanyID = c.CompanyID AND s.AppCode = ?) AS PlanEndDate
       FROM Companies c
       ORDER BY c.CompanyName ASC`,
      [APP_CODE]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const parsed = createCompanySchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const existing = await query<{ CompanyID: number }>(
      'SELECT CompanyID FROM Companies WHERE CompanyName = ? LIMIT 1',
      [data.CompanyName]
    );
    if (existing.length > 0) {
      throw new AppError('A company with this name already exists', 409, 'CompanyName');
    }

    const companyId = await withTransaction(async (conn) => {
      const [res] = await conn.execute<ResultSetHeader>(
        `INSERT INTO Companies (CompanyName, ContactName, ContactEmail, ContactPhone, Address)
         VALUES (?, ?, ?, ?, ?)`,
        [data.CompanyName, data.ContactName, data.ContactEmail, data.ContactPhone, data.Address]
      );
      const newId = res.insertId;

      await writeCreateAudit(conn, newId, 'Companies', String(newId), ctx.user.userId);
      await extendSubscription(conn, { companyId: newId, source: 'Admin', userId: ctx.user.userId });

      return newId;
    });

    return NextResponse.json(
      { message: 'Company created successfully', CompanyID: companyId },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
