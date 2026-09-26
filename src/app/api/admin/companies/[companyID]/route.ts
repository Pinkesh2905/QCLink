// ============================================================================
// GET /api/admin/companies/[companyID] — company details, plan, users
// PUT /api/admin/companies/[companyID] — edit details or suspend/reactivate
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs } from '@/lib/audit';
import { getSubscriptionSummary } from '@/lib/subscriptions';
import { updateCompanySchema } from '@/validators/admin';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { Company, UserWithCompany } from '@/types/db';

function parseCompanyId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Invalid company ID', 400);
  }
  return id;
}

export const GET = withAdmin(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const companyId = parseCompanyId(params.companyID);

    const [company] = await query<Company>('SELECT * FROM Companies WHERE CompanyID = ?', [companyId]);
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    const subscription = await getSubscriptionSummary(companyId);

    const users = await query<UserWithCompany>(
      `SELECT UserID, Name, Email, Role, CompanyID, Status, CreatedAt, UpdatedAt, NULL AS CompanyName
       FROM Users WHERE CompanyID = ? ORDER BY Name ASC`,
      [companyId]
    );

    return NextResponse.json({ company, subscription, users });
  } catch (error) {
    return errorResponse(error);
  }
});

const EDITABLE_FIELDS = [
  'CompanyName', 'ContactName', 'ContactEmail', 'ContactPhone', 'Address', 'IsActive',
];

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const companyId = parseCompanyId(params.companyID);

    const body = await req.json();
    const parsed = updateCompanySchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data as Record<string, unknown>;

    const [current] = await query<Company>('SELECT * FROM Companies WHERE CompanyID = ?', [companyId]);
    if (!current) {
      throw new AppError('Company not found', 404);
    }

    if (data.CompanyName !== undefined && data.CompanyName !== current.CompanyName) {
      const dupes = await query<{ CompanyID: number }>(
        'SELECT CompanyID FROM Companies WHERE CompanyName = ? AND CompanyID != ? LIMIT 1',
        [data.CompanyName, companyId]
      );
      if (dupes.length > 0) {
        throw new AppError('A company with this name already exists', 409, 'CompanyName');
      }
    }

    // Suspending the admins' own company would lock them out of their data
    // pages, so it's blocked here rather than discovered afterwards.
    if (data.IsActive === 0 && ctx.user.companyId === companyId) {
      throw new AppError('You cannot suspend the company your own account belongs to', 400);
    }

    const fieldsToUpdate = EDITABLE_FIELDS.filter((f) => f in body && data[f] !== undefined);
    const newRow: Record<string, unknown> = { ...current };
    for (const field of fieldsToUpdate) {
      newRow[field] = data[field];
    }

    const diffs = diffFields(current as unknown as Record<string, unknown>, newRow, fieldsToUpdate);
    if (diffs.length === 0) {
      return NextResponse.json({ message: 'No changes detected' });
    }

    await withTransaction(async (conn) => {
      const changed = diffs.map((d) => d.field);
      await conn.execute(
        `UPDATE Companies SET ${changed.map((f) => `${f} = ?`).join(', ')} WHERE CompanyID = ?`,
        [...changed.map((f) => newRow[f]), companyId] as any
      );
      await writeAuditDiffs(conn, companyId, 'Companies', String(companyId), diffs, ctx.user.userId);
    });

    return NextResponse.json({ message: 'Company updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
