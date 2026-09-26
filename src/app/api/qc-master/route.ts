// ============================================================================
// GET /api/qc-master — paginated list of QC Master records (caller's company)
// POST /api/qc-master — create QC Master record + specification child rows
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withWriteAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { generateUID } from '@/lib/uid';
import { writeCreateAudit } from '@/lib/audit';
import { assertLookupIdsVisible } from '@/lib/lookups';
import { requireCompanyId } from '@/lib/tenant';
import { assertOwnFileKey } from '@/lib/upload';
import { syncQCMasterToSheet, appendAuditLogToSheet } from '@/lib/sheets-sync';
import { createQCMasterSchema, computeSpecification } from '@/validators/qc-master';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { QCMasterWithLookups, SpecificationCriteria } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — List QC Master records
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '15', 10), 100);
    const search = url.searchParams.get('search') || '';
    const itemUID = url.searchParams.get('itemUID') || '';
    const sortBy = url.searchParams.get('sortBy') || 'CreatedAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const sortableColumns: Record<string, string> = {
      QCUID: 'q.QCUID',
      ItemName: 'q.ItemName',
      SpecCount: 'SpecCount',
      CreatedAt: 'q.CreatedAt',
      UpdatedAt: 'q.UpdatedAt',
    };
    const orderCol = sortableColumns[sortBy] || 'q.CreatedAt';

    const conditions: string[] = ['q.CompanyID = ?'];
    const params: unknown[] = [companyId];

    if (itemUID) {
      conditions.push('q.ItemUID = ?');
      params.push(itemUID);
    }

    if (search) {
      conditions.push('(q.ItemName LIKE ? OR q.QCUID LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * pageSize;

    const rows = await query<QCMasterWithLookups>(
      `SELECT q.*, usr.Name AS OwnerName,
              (SELECT COUNT(*) FROM QCSpecifications s
               WHERE s.CompanyID = q.CompanyID AND s.QCUID = q.QCUID) AS SpecCount
       FROM QCMaster q
       LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY ${orderCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM QCMaster q ${whereClause}`,
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
// POST — Create QC Master record + Specifications
// ---------------------------------------------------------------------------
export const POST = withWriteAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const body = await req.json();
    const parsed = createQCMasterSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { ItemUID, ItemName, ImagePath, Specifications } = parsed.data;

    // The item must exist in this company (the composite FK would also
    // reject it, but with an opaque 500 instead of a clear message).
    const [item] = await query<{ ItemUID: string }>(
      'SELECT ItemUID FROM Items WHERE CompanyID = ? AND ItemUID = ?',
      [companyId, ItemUID]
    );
    if (!item) {
      throw new AppError('Selected item not found.', 400, 'ItemUID');
    }

    assertOwnFileKey(ImagePath, companyId);

    await assertLookupIdsVisible(companyId, [
      { slug: 'specification-criteria', ids: Specifications.map((s) => s.CriteriaID) },
      { slug: 'method-of-inspection', ids: Specifications.map((s) => s.MethodID) },
      { slug: 'inspection-frequency', ids: Specifications.map((s) => s.FrequencyID) },
      { slug: 'responsibility', ids: Specifications.map((s) => s.ResponsibilityID) },
      { slug: 'reaction-plan', ids: Specifications.map((s) => s.ReactionPlanID) },
    ]);

    // Load specification criteria lookup map to compute Specification text server-side
    const criteriaRows = await query<SpecificationCriteria>(
      'SELECT CriteriaID, CriteriaName FROM SpecificationCriteria'
    );
    const criteriaMap = new Map<number, string>();
    for (const c of criteriaRows) {
      criteriaMap.set(c.CriteriaID, c.CriteriaName);
    }

    const qcUID = await withTransaction(async (conn) => {
      const uid = await generateUID(conn, companyId, 'QC');

      // Insert QC Master Header
      await conn.execute(
        `INSERT INTO QCMaster (CompanyID, QCUID, ItemUID, ItemName, ImagePath, OwnerUserID, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [companyId, uid, ItemUID, ItemName, ImagePath ?? null, ctx.user.userId]
      );

      await writeCreateAudit(conn, companyId, 'QCMaster', uid, ctx.user.userId);

      // Insert QCSpecifications rows with computed Specification
      for (let i = 0; i < Specifications.length; i++) {
        const spec = Specifications[i];
        const srNo = i + 1; // Auto-assign 1..N in order
        const criteriaName = criteriaMap.get(spec.CriteriaID) || '';
        const computedSpec = computeSpecification(
          criteriaName,
          spec.MinVal,
          spec.MaxVal,
          spec.OtherValue
        );

        await conn.execute(
          `INSERT INTO QCSpecifications (
            CompanyID, QCUID, SrNo, Parameter, CriteriaID, MinVal, MaxVal, OtherValue,
            MethodID, FrequencyID, ResponsibilityID, ReactionPlanID,
            Specification, CreatedAt, UpdatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            companyId,
            uid,
            srNo,
            spec.Parameter,
            spec.CriteriaID,
            spec.MinVal ?? null,
            spec.MaxVal ?? null,
            spec.OtherValue ?? null,
            spec.MethodID,
            spec.FrequencyID,
            spec.ResponsibilityID,
            spec.ReactionPlanID,
            computedSpec,
          ]
        );
      }

      return uid;
    });

    await syncQCMasterToSheet(companyId, qcUID);
    await appendAuditLogToSheet(companyId, [
      {
        tableName: 'QCMaster',
        recordId: qcUID,
        actionType: 'CREATE',
        fieldName: null,
        oldValue: null,
        newValue: null,
        changedByUserID: ctx.user.userId,
      },
    ]);

    return NextResponse.json(
      { message: 'QC Master created successfully', QCUID: qcUID },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
