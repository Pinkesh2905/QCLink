// ============================================================================
// GET /api/qc-master/export
// Exports QC Master specifications to flattened CSV (one row per specification).
// Available to all authenticated users.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { generateCSV } from '@/lib/csv';
import { formatISTForExport } from '@/lib/datetime';
import { errorResponse } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const exportAll = url.searchParams.get('exportAll') === 'true';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search && !exportAll) {
      conditions.push('(q.ItemName LIKE ? OR q.QCUID LIKE ? OR q.ItemUID LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<{
      QCUID: string;
      ItemUID: string;
      ItemName: string;
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
      OwnerName: string | null;
      CreatedAt: Date;
      UpdatedAt: Date;
    }>(
      `SELECT 
         q.QCUID,
         q.ItemUID,
         q.ItemName,
         s.SrNo,
         s.Parameter,
         c.CriteriaName,
         s.MinVal,
         s.MaxVal,
         s.OtherValue,
         m.MethodName,
         f.FrequencyName,
         r.ResponsibilityName,
         rp.ReactionPlanName,
         s.Specification,
         usr.Name AS OwnerName,
         q.CreatedAt,
         q.UpdatedAt
       FROM QCMaster q
       LEFT JOIN QCSpecifications s ON q.QCUID = s.QCUID
       LEFT JOIN SpecificationCriteria c ON s.CriteriaID = c.CriteriaID
       LEFT JOIN MethodOfInspection m ON s.MethodID = m.MethodID
       LEFT JOIN InspectionFrequency f ON s.FrequencyID = f.FrequencyID
       LEFT JOIN Responsibility r ON s.ResponsibilityID = r.ResponsibilityID
       LEFT JOIN ReactionPlan rp ON s.ReactionPlanID = rp.ReactionPlanID
       LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY q.QCUID ASC, s.SrNo ASC`,
      params
    );

    const headers = [
      'QCUID',
      'ItemUID',
      'ItemName',
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
      'Owner',
      'CreatedAt',
      'UpdatedAt',
    ];

    const exportRows = rows.map((r) => ({
      QCUID: r.QCUID,
      ItemUID: r.ItemUID,
      ItemName: r.ItemName,
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
      Owner: r.OwnerName || '',
      CreatedAt: formatISTForExport(r.CreatedAt),
      UpdatedAt: formatISTForExport(r.UpdatedAt),
    }));

    const csvContent = generateCSV(headers, exportRows);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qclink_qc_master_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
