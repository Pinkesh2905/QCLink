// ============================================================================
// POST /api/inspection-reports/[iirUID]/resend-review
// Sends the review request email (with the PDF) to the reviewer again — for when
// the first email did not go out or was lost. Only while the review is pending.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withWriteAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { requireCompanyId } from '@/lib/tenant';
import { checkRateLimit } from '@/lib/rate-limit';
import { REVIEW_PENDING } from '@/lib/inspection-report';
import { sendReviewRequestForReport } from '@/lib/review-notify';
import { errorResponse, AppError } from '@/lib/errors';
import type { InspectionReport } from '@/types/db';

const RESEND_LIMIT = 5;
const RESEND_WINDOW_MS = 10 * 60 * 1000;

export const POST = withWriteAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { iirUID } = await ctx.params;

    const [report] = await query<InspectionReport>(
      'SELECT IIRUID, ReviewerEmail, ReviewStatus FROM InspectionReports WHERE CompanyID = ? AND IIRUID = ?',
      [companyId, iirUID]
    );
    if (!report) {
      throw new AppError('Inspection Report not found', 404);
    }
    if (!report.ReviewerEmail) {
      throw new AppError('This report has no reviewer.', 400);
    }
    if (report.ReviewStatus !== REVIEW_PENDING) {
      throw new AppError('The review request can only be resent while the review is pending.', 409);
    }
    if (!checkRateLimit(`resend-review:${companyId}:${iirUID}`, RESEND_LIMIT, RESEND_WINDOW_MS)) {
      throw new AppError('The email was resent several times already. Please wait a few minutes.', 429);
    }

    const sent = await sendReviewRequestForReport(companyId, iirUID);
    if (!sent) {
      throw new AppError('The email could not be sent. Please check the email settings and try again.', 502);
    }
    return NextResponse.json({ message: 'Review request emailed to the reviewer' });
  } catch (error) {
    return errorResponse(error);
  }
});
