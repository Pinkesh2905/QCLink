// ============================================================================
// GET /api/inspection-reports/export
// Exports Inspection Reports to flattened CSV (one row per result).
// Available to all authenticated users.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { generateCSV } from '@/lib/csv';
import { errorResponse } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const exportAll = url.searchParams.get('exportAll') === 'true';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search && !exportAll) {
      conditions.push('(r.ItemName LIKE ? OR r.IIRUID LIKE ? OR r.GRNNo LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<{
      IIRUID: string;
      InspectionDate: Date;
      ItemUID: string;
      ItemName: string;
      QCUID: string;
      GRNNo: string;
      InvoicePath: string | null;
      InspectionStatus: string | null;
      SrNo: number | null;
      Parameter: string | null;
      CriteriaName: string | null;
      MinVal: number | null;
      MaxVal: number | null;
      OtherValue: string | null;
      MethodName: string | null;
      FrequencyName: string | null;
      ResponsibilityName: string | null;
      ReactionPlanName: string | null;
      Specification: string | null;
      Actual: number | null;
      RowResultStatus: string | null;
      InspectorName: string | null;
      CreatedAt: Date;
      UpdatedAt: Date;
    }>(
      `SELECT 
         r.IIRUID,
         r.InspectionDate,
         r.ItemUID,
         r.ItemName,
         r.QCUID,
         r.GRNNo,
         r.InvoicePath,
         rsHeader.ResultStatusName AS InspectionStatus,
         res.SrNo,
         res.Parameter,
         c.CriteriaName,
         res.MinVal,
         res.MaxVal,
         res.OtherValue,
         m.MethodName,
         f.FrequencyName,
         resp.ResponsibilityName,
         rp.ReactionPlanName,
         res.Specification,
         res.Actual,
         rsRow.ResultStatusName AS RowResultStatus,
         usr.Name AS InspectorName,
         r.CreatedAt,
         r.UpdatedAt
       FROM InspectionReports r
       LEFT JOIN ResultStatus rsHeader ON r.InspectionStatusID = rsHeader.ResultStatusID
       LEFT JOIN InspectionResults res ON r.IIRUID = res.IIRUID
       LEFT JOIN SpecificationCriteria c ON res.CriteriaID = c.CriteriaID
       LEFT JOIN MethodOfInspection m ON res.MethodID = m.MethodID
       LEFT JOIN InspectionFrequency f ON res.FrequencyID = f.FrequencyID
       LEFT JOIN Responsibility resp ON res.ResponsibilityID = resp.ResponsibilityID
       LEFT JOIN ReactionPlan rp ON res.ReactionPlanID = rp.ReactionPlanID
       LEFT JOIN ResultStatus rsRow ON res.ResultStatusID = rsRow.ResultStatusID
       LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY r.IIRUID ASC, res.SrNo ASC`,
      params
    );

    const headers = [
      'IIRUID',
      'InspectionDate',
      'ItemUID',
      'ItemName',
      'QCUID',
      'GRNNo',
      'InspectionStatus',
      'SrNo',
      'Parameter',
      'Criteria',
      'MinVal',
      'MaxVal',
      'OtherValue',
      'Method',
      'Frequency',
      'Responsibility',
      'ReactionPlan',
      'Specification',
      'Actual',
      'ResultStatus',
      'Inspector',
      'CreatedAt',
      'UpdatedAt',
    ];

    const exportRows = rows.map((r) => ({
      IIRUID: r.IIRUID,
      InspectionDate: new Date(r.InspectionDate).toISOString().split('T')[0],
      ItemUID: r.ItemUID,
      ItemName: r.ItemName,
      QCUID: r.QCUID,
      GRNNo: r.GRNNo,
      InspectionStatus: r.InspectionStatus || '',
      SrNo: r.SrNo != null ? r.SrNo : '',
      Parameter: r.Parameter || '',
      Criteria: r.CriteriaName || '',
      MinVal: r.MinVal != null ? r.MinVal : '',
      MaxVal: r.MaxVal != null ? r.MaxVal : '',
      OtherValue: r.OtherValue || '',
      Method: r.MethodName || '',
      Frequency: r.FrequencyName || '',
      Responsibility: r.ResponsibilityName || '',
      ReactionPlan: r.ReactionPlanName || '',
      Specification: r.Specification || '',
      Actual: r.Actual != null ? r.Actual : '',
      ResultStatus: r.RowResultStatus || '',
      Inspector: r.InspectorName || '',
      CreatedAt: new Date(r.CreatedAt).toISOString(),
      UpdatedAt: new Date(r.UpdatedAt).toISOString(),
    }));

    const csvContent = generateCSV(headers, exportRows);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qclink_inspection_reports_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
