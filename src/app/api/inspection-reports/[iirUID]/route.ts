// ============================================================================
// GET /api/inspection-reports/[iirUID] — report detail + snapshot results
// PUT /api/inspection-reports/[iirUID] — update report + results
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs, writeAuditLog } from '@/lib/audit';
import { enforceFieldPermissions } from '@/lib/field-permissions';
import { updateInspectionReportSchema } from '@/validators/inspection-report';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type {
  InspectionReport,
  InspectionReportWithLookups,
  InspectionResult,
  InspectionResultWithLookups,
} from '@/types/db';

// ---------------------------------------------------------------------------
// GET — Inspection Report Detail
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const iirUID = params.iirUID;

    const headers = await query<InspectionReportWithLookups>(
      `SELECT r.*,
              rs.ResultStatusName AS InspectionStatusName,
              usr.Name AS OwnerName
       FROM InspectionReports r
       LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
       LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
       WHERE r.IIRUID = ?`,
      [iirUID]
    );

    if (headers.length === 0) {
      throw new AppError('Inspection Report not found', 404);
    }

    const results = await query<InspectionResultWithLookups>(
      `SELECT res.*,
              c.CriteriaName,
              m.MethodName,
              f.FrequencyName,
              resp.ResponsibilityName,
              rp.ReactionPlanName,
              rs.ResultStatusName AS ResultStatusName
       FROM InspectionResults res
       LEFT JOIN SpecificationCriteria c ON res.CriteriaID = c.CriteriaID
       LEFT JOIN MethodOfInspection m ON res.MethodID = m.MethodID
       LEFT JOIN InspectionFrequency f ON res.FrequencyID = f.FrequencyID
       LEFT JOIN Responsibility resp ON res.ResponsibilityID = resp.ResponsibilityID
       LEFT JOIN ReactionPlan rp ON res.ReactionPlanID = rp.ReactionPlanID
       LEFT JOIN ResultStatus rs ON res.ResultStatusID = rs.ResultStatusID
       WHERE res.IIRUID = ?
       ORDER BY res.SrNo ASC`,
      [iirUID]
    );

    return NextResponse.json({
      ...headers[0],
      Results: results,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// PUT — Update Inspection Report
// ---------------------------------------------------------------------------
export const PUT = withAuth(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const iirUID = params.iirUID;

    const body = await req.json();
    const parsed = updateInspectionReportSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const [currentIR] = await query<InspectionReport>(
      'SELECT * FROM InspectionReports WHERE IIRUID = ?',
      [iirUID]
    );

    if (!currentIR) {
      throw new AppError('Inspection Report not found', 404);
    }

    // 1. Header updates diff & permission check
    const editableHeaderFields = ['InspectionDate', 'GRNNo', 'InvoicePath', 'InspectionStatusID'];
    const newHeaderRow: Record<string, unknown> = { ...currentIR };

    if (data.InspectionDate) {
      newHeaderRow.InspectionDate = data.InspectionDate.split('T')[0];
    }
    if (data.GRNNo !== undefined) newHeaderRow.GRNNo = data.GRNNo;
    if (data.InvoicePath !== undefined) newHeaderRow.InvoicePath = data.InvoicePath;
    if (data.InspectionStatusID !== undefined) newHeaderRow.InspectionStatusID = data.InspectionStatusID;

    const headerDiffs = diffFields(
      currentIR as unknown as Record<string, unknown>,
      newHeaderRow,
      editableHeaderFields
    );

    if (headerDiffs.length > 0) {
      const changedHeaderFields = headerDiffs.map((d) => d.field);
      await enforceFieldPermissions('InspectionReports', changedHeaderFields, ctx.user.role);
    }

    // 2. Results updates diff & permission check
    let resultsChanged = false;
    if (data.Results && data.Results.length > 0) {
      const existingResults = await query<InspectionResult>(
        'SELECT SrNo, Actual, ResultStatusID FROM InspectionResults WHERE IIRUID = ? ORDER BY SrNo ASC',
        [iirUID]
      );

      const existingMap = new Map<number, InspectionResult>();
      for (const er of existingResults) {
        existingMap.set(er.SrNo, er);
      }

      const changedResultFields = new Set<string>();

      for (const res of data.Results) {
        const existing = existingMap.get(res.SrNo);
        if (existing) {
          const oldActual = existing.Actual == null ? null : String(existing.Actual);
          const newActual = res.Actual == null ? null : String(res.Actual);
          if (oldActual !== newActual) {
            changedResultFields.add('Actual');
            resultsChanged = true;
          }

          const oldStatus = existing.ResultStatusID == null ? null : String(existing.ResultStatusID);
          const newStatus = res.ResultStatusID == null ? null : String(res.ResultStatusID);
          if (oldStatus !== newStatus) {
            changedResultFields.add('ResultStatusID');
            resultsChanged = true;
          }
        }
      }

      if (changedResultFields.size > 0) {
        await enforceFieldPermissions(
          'InspectionResults',
          Array.from(changedResultFields),
          ctx.user.role
        );
      }
    }

    if (headerDiffs.length === 0 && !resultsChanged) {
      return NextResponse.json({ message: 'No changes detected' });
    }

    await withTransaction(async (conn) => {
      // 1. Header updates
      if (headerDiffs.length > 0) {
        await conn.execute(
          `UPDATE InspectionReports
           SET InspectionDate = ?, GRNNo = ?, InvoicePath = ?, InspectionStatusID = ?, UpdatedAt = NOW()
           WHERE IIRUID = ?`,
          [
            newHeaderRow.InspectionDate,
            newHeaderRow.GRNNo,
            newHeaderRow.InvoicePath ?? null,
            newHeaderRow.InspectionStatusID,
            iirUID,
          ] as any
        );

        await writeAuditDiffs(conn, 'InspectionReports', iirUID, headerDiffs, ctx.user.userId);
      }

      // 2. Results updates (Actual, ResultStatusID)
      if (data.Results && resultsChanged) {
        for (const res of data.Results) {
          await conn.execute(
            `UPDATE InspectionResults
             SET Actual = ?, ResultStatusID = ?, UpdatedAt = NOW()
             WHERE IIRUID = ? AND SrNo = ?`,
            [res.Actual ?? null, res.ResultStatusID ?? null, iirUID, res.SrNo]
          );
        }

        await writeAuditLog(conn, [
          {
            tableName: 'InspectionResults',
            recordId: iirUID,
            actionType: 'UPDATE',
            fieldName: 'InspectionResults',
            oldValue: 'Previous test results',
            newValue: 'Updated actuals & statuses',
            changedByUserID: ctx.user.userId,
          },
        ]);
      }
    });

    return NextResponse.json({ message: 'Inspection Report updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
