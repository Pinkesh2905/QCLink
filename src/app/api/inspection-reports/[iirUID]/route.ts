// ============================================================================
// GET /api/inspection-reports/[iirUID] — report detail + snapshot results
// PUT /api/inspection-reports/[iirUID] — update report + results
//
// Review rules enforced here (the review itself is POST .../review):
//  - the Reviewer Remark is only ever returned to the reviewer;
//  - a report whose review is "Done" is locked until the reviewer reopens it;
//  - editing a rejected report sends it back for review (status Pending + a new email);
//  - changing the reviewer sends it to the new person, with the old remark cleared.
// ============================================================================

import { NextRequest, NextResponse, after } from 'next/server';
import { withAuth, withWriteAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs, writeAuditLog, type AuditEntry } from '@/lib/audit';
import { requireCompanyId } from '@/lib/tenant';
import { assertOwnFileKey } from '@/lib/upload';
import { syncInspectionReportToSheet, appendAuditLogToSheet, type SheetAuditEntry } from '@/lib/sheets-sync';
import { enforceFieldPermissions } from '@/lib/field-permissions';
import { loadReport, presentReport, REVIEW_DONE, REVIEW_PENDING, REVIEW_REJECTED } from '@/lib/inspection-report';
import { sendReviewRequestForReport } from '@/lib/review-notify';
import { updateInspectionReportSchema } from '@/validators/inspection-report';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { InspectionReport, InspectionResult } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — Inspection Report Detail
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { iirUID } = await ctx.params;

    const loaded = await loadReport(companyId, iirUID);
    if (!loaded) {
      throw new AppError('Inspection Report not found', 404);
    }

    return NextResponse.json({
      ...presentReport(loaded.header, ctx.user.email),
      Results: loaded.results,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// PUT — Update Inspection Report
// ---------------------------------------------------------------------------
export const PUT = withWriteAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { iirUID } = await ctx.params;

    const body = await req.json();
    const parsed = updateInspectionReportSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const [currentIR] = await query<InspectionReport>(
      'SELECT * FROM InspectionReports WHERE CompanyID = ? AND IIRUID = ?',
      [companyId, iirUID]
    );

    if (!currentIR) {
      throw new AppError('Inspection Report not found', 404);
    }

    if (currentIR.ReviewStatus === REVIEW_DONE) {
      throw new AppError(
        'This report has been reviewed and is locked. Ask the reviewer to reopen the review if it needs a change.',
        409
      );
    }

    // 1. Header updates diff & permission check
    const editableHeaderFields = ['InspectionDate', 'GRNNo', 'InvoicePath', 'InspectionRemark', 'InspectionStatusID'];
    const newHeaderRow: Record<string, unknown> = { ...currentIR };

    if (data.InspectionDate) {
      newHeaderRow.InspectionDate = data.InspectionDate.split('T')[0];
    }
    if (data.GRNNo !== undefined) newHeaderRow.GRNNo = data.GRNNo;
    if (data.InvoicePath !== undefined) {
      assertOwnFileKey(data.InvoicePath, companyId, currentIR.InvoicePath);
      newHeaderRow.InvoicePath = data.InvoicePath;
    }
    if (data.InspectionRemark !== undefined) newHeaderRow.InspectionRemark = data.InspectionRemark;
    if (data.InspectionStatusID !== undefined) newHeaderRow.InspectionStatusID = data.InspectionStatusID;

    // Changing the reviewer: must be an active employee; name and email are copied onto the report.
    const reviewerChanged =
      data.ReviewerEmployeeUID !== undefined && data.ReviewerEmployeeUID !== currentIR.ReviewerEmployeeUID;
    if (reviewerChanged) {
      const [reviewer] = await query<{ EmployeeUID: string; EmployeeName: string; Email: string }>(
        'SELECT EmployeeUID, EmployeeName, Email FROM Employees WHERE CompanyID = ? AND EmployeeUID = ? AND IsActive = 1',
        [companyId, data.ReviewerEmployeeUID]
      );
      if (!reviewer) {
        throw new AppError('The selected reviewer is not an active employee.', 400, 'ReviewerEmployeeUID');
      }
      newHeaderRow.ReviewerEmployeeUID = reviewer.EmployeeUID;
      newHeaderRow.ReviewerName = reviewer.EmployeeName;
      newHeaderRow.ReviewerEmail = reviewer.Email;
    }

    const headerDiffs = diffFields(
      currentIR as unknown as Record<string, unknown>,
      newHeaderRow,
      [...editableHeaderFields, ...(reviewerChanged ? ['ReviewerEmployeeUID', 'ReviewerName'] : [])]
    );

    if (headerDiffs.length > 0) {
      await enforceFieldPermissions('InspectionReports', headerDiffs.map((d) => d.field), ctx.user.role);
    }

    // 2. Results updates diff & permission check
    let resultsChanged = false;
    if (data.Results && data.Results.length > 0) {
      const existingResults = await query<InspectionResult>(
        `SELECT SrNo, Actual, ResultStatusID, ObservedRemark FROM InspectionResults
         WHERE CompanyID = ? AND IIRUID = ? ORDER BY SrNo ASC`,
        [companyId, iirUID]
      );

      const existingMap = new Map<number, InspectionResult>();
      for (const er of existingResults) {
        existingMap.set(er.SrNo, er);
      }

      const changedResultFields = new Set<string>();

      for (const res of data.Results) {
        const existing = existingMap.get(res.SrNo);
        if (!existing) {
          // A posted SrNo with no matching row would otherwise update 0 rows
          // silently (the UPDATE's WHERE clause just wouldn't match) while the
          // client is told the save succeeded — fail loudly instead.
          throw new AppError(
            `Inspection result row SrNo ${res.SrNo} does not exist on this report.`,
            400
          );
        }

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

        if ((existing.ObservedRemark ?? null) !== (res.ObservedRemark ?? null)) {
          changedResultFields.add('ObservedRemark');
          resultsChanged = true;
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

    // 3. Review consequences of the edit
    const resubmitted = currentIR.ReviewStatus === REVIEW_REJECTED; // fixed after a rejection
    const sendBackForReview = reviewerChanged || resubmitted;
    const nextReviewStatus = sendBackForReview ? REVIEW_PENDING : currentIR.ReviewStatus;
    const clearReviewerRemark = reviewerChanged && !!currentIR.ReviewerRemark;

    await withTransaction(async (conn) => {
      // 1. Header updates (the Reviewer Remark is never touched here, except cleared when the reviewer changes)
      if (headerDiffs.length > 0 || sendBackForReview) {
        await conn.execute(
          `UPDATE InspectionReports
           SET InspectionDate = ?, GRNNo = ?, InvoicePath = ?, InspectionRemark = ?, InspectionStatusID = ?,
               ReviewerEmployeeUID = ?, ReviewerName = ?, ReviewerEmail = ?,
               ReviewStatus = ?, ReviewedAt = ?, ReviewerRemark = ?, ReviewEmailSentAt = ?,
               UpdatedAt = NOW()
           WHERE CompanyID = ? AND IIRUID = ?`,
          [
            newHeaderRow.InspectionDate,
            newHeaderRow.GRNNo,
            newHeaderRow.InvoicePath ?? null,
            newHeaderRow.InspectionRemark ?? null,
            newHeaderRow.InspectionStatusID,
            newHeaderRow.ReviewerEmployeeUID ?? null,
            newHeaderRow.ReviewerName ?? null,
            newHeaderRow.ReviewerEmail ?? null,
            nextReviewStatus ?? null,
            sendBackForReview ? null : currentIR.ReviewedAt ?? null,
            clearReviewerRemark ? null : currentIR.ReviewerRemark ?? null,
            sendBackForReview ? null : currentIR.ReviewEmailSentAt ?? null,
            companyId,
            iirUID,
          ] as any
        );

        const audit: AuditEntry[] = [];
        if (sendBackForReview && currentIR.ReviewStatus !== nextReviewStatus) {
          audit.push({
            companyId,
            tableName: 'InspectionReports',
            recordId: iirUID,
            actionType: 'UPDATE',
            fieldName: 'ReviewStatus',
            oldValue: currentIR.ReviewStatus,
            newValue: nextReviewStatus,
            changedByUserID: ctx.user.userId,
          });
        }
        if (clearReviewerRemark) {
          // The remark text itself is reviewer-only, so the history only records that it was cleared.
          audit.push({
            companyId,
            tableName: 'InspectionReports',
            recordId: iirUID,
            actionType: 'UPDATE',
            fieldName: 'ReviewerRemark',
            oldValue: '(reviewer only)',
            newValue: '(cleared: reviewer changed)',
            changedByUserID: ctx.user.userId,
          });
        }
        await writeAuditDiffs(conn, companyId, 'InspectionReports', iirUID, headerDiffs, ctx.user.userId);
        await writeAuditLog(conn, audit);
      }

      // 2. Results updates (Actual, ResultStatusID, ObservedRemark)
      if (data.Results && resultsChanged) {
        for (const res of data.Results) {
          await conn.execute(
            `UPDATE InspectionResults
             SET Actual = ?, ResultStatusID = ?, ObservedRemark = ?, UpdatedAt = NOW()
             WHERE CompanyID = ? AND IIRUID = ? AND SrNo = ?`,
            [res.Actual ?? null, res.ResultStatusID ?? null, res.ObservedRemark ?? null, companyId, iirUID, res.SrNo]
          );
        }

        await writeAuditLog(conn, [
          {
            companyId,
            tableName: 'InspectionResults',
            recordId: iirUID,
            actionType: 'UPDATE',
            fieldName: 'InspectionResults',
            oldValue: 'Previous test results',
            newValue: 'Updated actuals, statuses & remarks',
            changedByUserID: ctx.user.userId,
          },
        ]);
      }
    });

    await syncInspectionReportToSheet(companyId, iirUID);

    const sheetAuditEntries: SheetAuditEntry[] = headerDiffs.map((d) => ({
      tableName: 'InspectionReports',
      recordId: iirUID,
      actionType: 'UPDATE',
      fieldName: d.field,
      oldValue: d.oldValue,
      newValue: d.newValue,
      changedByUserID: ctx.user.userId,
    }));

    if (data.Results && resultsChanged) {
      sheetAuditEntries.push({
        tableName: 'InspectionResults',
        recordId: iirUID,
        actionType: 'UPDATE',
        fieldName: 'InspectionResults',
        oldValue: 'Previous test results',
        newValue: 'Updated actuals, statuses & remarks',
        changedByUserID: ctx.user.userId,
      });
    }

    await appendAuditLogToSheet(companyId, sheetAuditEntries);

    if (sendBackForReview) {
      after(async () => {
        await sendReviewRequestForReport(companyId, iirUID, { isResubmission: resubmitted && !reviewerChanged });
      });
    }

    return NextResponse.json({
      message: sendBackForReview
        ? 'Inspection Report updated and sent to the reviewer'
        : 'Inspection Report updated successfully',
    });
  } catch (error) {
    return errorResponse(error);
  }
});
