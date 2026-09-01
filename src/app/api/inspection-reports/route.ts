// ============================================================================
// GET /api/inspection-reports — paginated list
// POST /api/inspection-reports — create report + snapshot results
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { generateUID } from '@/lib/uid';
import { writeCreateAudit } from '@/lib/audit';
import { createInspectionReportSchema } from '@/validators/inspection-report';
import { errorResponse, validationErrorResponse } from '@/lib/errors';
import type { InspectionReportWithLookups } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — List Inspection Reports
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '15', 10), 100);
    const search = url.searchParams.get('search') || '';
    const sortBy = url.searchParams.get('sortBy') || 'CreatedAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const sortableColumns: Record<string, string> = {
      IIRUID: 'r.IIRUID',
      ItemName: 'r.ItemName',
      InspectionDate: 'r.InspectionDate',
      GRNNo: 'r.GRNNo',
      StatusName: 'rs.StatusName',
      CreatedAt: 'r.CreatedAt',
      UpdatedAt: 'r.UpdatedAt',
    };
    const orderCol = sortableColumns[sortBy] || 'r.CreatedAt';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(r.ItemName LIKE ? OR r.IIRUID LIKE ? OR r.GRNNo LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const rows = await query<InspectionReportWithLookups>(
      `SELECT r.*,
              rs.ResultStatusName AS InspectionStatusName,
              usr.Name AS OwnerName
       FROM InspectionReports r
       LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
       LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY ${orderCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM InspectionReports r ${whereClause}`,
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
// POST — Create Inspection Report + Snapshot Results
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const parsed = createInspectionReportSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const iirUID = await withTransaction(async (conn) => {
      const uid = await generateUID(conn, 'IIR');

      // Format inspection date for MySQL DATE column
      const formattedDate = data.InspectionDate.split('T')[0];

      await conn.execute(
        `INSERT INTO InspectionReports (
          IIRUID, InspectionDate, ItemUID, ItemName, QCUID, GRNNo,
          InvoicePath, InspectionStatusID, OwnerUserID, CreatedAt, UpdatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          uid,
          formattedDate,
          data.ItemUID,
          data.ItemName,
          data.QCUID,
          data.GRNNo,
          data.InvoicePath ?? null,
          data.InspectionStatusID,
          ctx.user.userId,
        ]
      );

      await writeCreateAudit(conn, 'InspectionReports', uid, ctx.user.userId);

      // Snapshot results into InspectionResults (one-time copy for audit integrity)
      for (let i = 0; i < data.Results.length; i++) {
        const r = data.Results[i];
        const srNo = i + 1;

        await conn.execute(
          `INSERT INTO InspectionResults (
            IIRUID, SrNo, Parameter, CriteriaID, MinVal, MaxVal, OtherValue,
            MethodID, FrequencyID, ResponsibilityID, ReactionPlanID,
            Specification, Actual, ResultStatusID, CreatedAt, UpdatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            uid,
            srNo,
            r.Parameter,
            r.CriteriaID,
            r.MinVal ?? null,
            r.MaxVal ?? null,
            r.OtherValue ?? null,
            r.MethodID,
            r.FrequencyID,
            r.ResponsibilityID,
            r.ReactionPlanID,
            r.Specification,
            r.Actual ?? null,
            r.ResultStatusID ?? null,
          ]
        );
      }

      return uid;
    });

    return NextResponse.json(
      { message: 'Inspection Report created successfully', IIRUID: iirUID },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
