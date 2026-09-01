// ============================================================================
// GET /api/qc-master — paginated list of QC Master records
// POST /api/qc-master — create QC Master record + specification child rows
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { generateUID } from '@/lib/uid';
import { writeCreateAudit } from '@/lib/audit';
import { createQCMasterSchema, computeSpecification } from '@/validators/qc-master';
import { errorResponse, validationErrorResponse } from '@/lib/errors';
import type { QCMasterWithLookups, SpecificationCriteria } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — List QC Master records
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
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

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (itemUID) {
      conditions.push('q.ItemUID = ?');
      params.push(itemUID);
    }

    if (search) {
      conditions.push('(q.ItemName LIKE ? OR q.QCUID LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const rows = await query<QCMasterWithLookups>(
      `SELECT q.*, usr.Name AS OwnerName,
              (SELECT COUNT(*) FROM QCSpecifications s WHERE s.QCUID = q.QCUID) AS SpecCount
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
export const POST = withAuth(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const parsed = createQCMasterSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const { ItemUID, ItemName, ImagePath, Specifications } = parsed.data;

    // Load specification criteria lookup map to compute Specification text server-side
    const criteriaRows = await query<SpecificationCriteria>(
      'SELECT CriteriaID, CriteriaName FROM SpecificationCriteria'
    );
    const criteriaMap = new Map<number, string>();
    for (const c of criteriaRows) {
      criteriaMap.set(c.CriteriaID, c.CriteriaName);
    }

    const qcUID = await withTransaction(async (conn) => {
      const uid = await generateUID(conn, 'QC');

      // Insert QC Master Header
      await conn.execute(
        `INSERT INTO QCMaster (QCUID, ItemUID, ItemName, ImagePath, OwnerUserID, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [uid, ItemUID, ItemName, ImagePath ?? null, ctx.user.userId]
      );

      await writeCreateAudit(conn, 'QCMaster', uid, ctx.user.userId);

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
            QCUID, SrNo, Parameter, CriteriaID, MinVal, MaxVal, OtherValue,
            MethodID, FrequencyID, ResponsibilityID, ReactionPlanID,
            Specification, CreatedAt, UpdatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
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

    return NextResponse.json(
      { message: 'QC Master created successfully', QCUID: qcUID },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
