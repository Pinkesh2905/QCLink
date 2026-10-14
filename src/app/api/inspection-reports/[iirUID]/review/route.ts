// ============================================================================
// POST /api/inspection-reports/[iirUID]/review
// The assigned reviewer marks the report Review Done / Review Rejected (or back
// to Review Pending), with a Reviewer Remark. Nobody else may call this.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withWriteAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { writeAuditLog, type AuditEntry } from '@/lib/audit';
import { requireCompanyId } from '@/lib/tenant';
import { isReportReviewer, REVIEW_PENDING } from '@/lib/inspection-report';
import { reviewReportSchema } from '@/validators/inspection-report';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { InspectionReport } from '@/types/db';

export const POST = withWriteAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { iirUID } = await ctx.params;

    const body = await req.json();
    const parsed = reviewReportSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }
    const { ReviewStatus, ReviewerRemark } = parsed.data;

    const [report] = await query<InspectionReport>(
      'SELECT * FROM InspectionReports WHERE CompanyID = ? AND IIRUID = ?',
      [companyId, iirUID]
    );
    if (!report) {
      throw new AppError('Inspection Report not found', 404);
    }
    if (!isReportReviewer(ctx.user.email, report)) {
      throw new AppError('Only the reviewer assigned to this report can review it.', 403);
    }

    const statusChanged = report.ReviewStatus !== ReviewStatus;
    const remarkChanged = (report.ReviewerRemark ?? null) !== (ReviewerRemark ?? null);
    if (!statusChanged && !remarkChanged) {
      return NextResponse.json({ message: 'No changes detected', ReviewStatus });
    }

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE InspectionReports
         SET ReviewStatus = ?, ReviewerRemark = ?, ReviewedAt = ${ReviewStatus === REVIEW_PENDING ? 'NULL' : 'NOW()'}, UpdatedAt = NOW()
         WHERE CompanyID = ? AND IIRUID = ?`,
        [ReviewStatus, ReviewerRemark, companyId, iirUID]
      );

      // The remark text is for the reviewer only, so the shared history just records that it changed.
      const audit: AuditEntry[] = [];
      if (statusChanged) {
        audit.push({
          companyId,
          tableName: 'InspectionReports',
          recordId: iirUID,
          actionType: 'UPDATE',
          fieldName: 'ReviewStatus',
          oldValue: report.ReviewStatus,
          newValue: ReviewStatus,
          changedByUserID: ctx.user.userId,
        });
      }
      if (remarkChanged) {
        audit.push({
          companyId,
          tableName: 'InspectionReports',
          recordId: iirUID,
          actionType: 'UPDATE',
          fieldName: 'ReviewerRemark',
          oldValue: report.ReviewerRemark ? '(reviewer only)' : null,
          newValue: ReviewerRemark ? '(reviewer only)' : null,
          changedByUserID: ctx.user.userId,
        });
      }
      await writeAuditLog(conn, audit);
    });

    return NextResponse.json({ message: 'Review saved', ReviewStatus });
  } catch (error) {
    return errorResponse(error);
  }
});
