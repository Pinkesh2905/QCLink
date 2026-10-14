// ============================================================================
// QCLink — Inspection Report loading and reviewer visibility
// One place that reads a report with its lookups and decides who may see the
// reviewer-only parts (the Reviewer Remark and the review controls).
// ============================================================================

import { query } from './db';
import type {
  InspectionReportWithLookups,
  InspectionResultWithLookups,
  ReviewStatus,
} from '@/types/db';

export const REVIEW_PENDING: ReviewStatus = 'Review Pending';
export const REVIEW_DONE: ReviewStatus = 'Review Done';
export const REVIEW_REJECTED: ReviewStatus = 'Review Rejected';

export interface LoadedReport {
  header: InspectionReportWithLookups;
  results: InspectionResultWithLookups[];
}

/** Report header + result rows for one company. Callers must run the header through presentReport() before sending it to a browser. */
export async function loadReport(companyId: number, iirUID: string): Promise<LoadedReport | null> {
  const headers = await query<InspectionReportWithLookups>(
    `SELECT r.*,
            rs.ResultStatusName AS InspectionStatusName,
            usr.Name AS OwnerName
     FROM InspectionReports r
     LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
     LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
     WHERE r.CompanyID = ? AND r.IIRUID = ?`,
    [companyId, iirUID]
  );
  if (headers.length === 0) return null;

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
     WHERE res.CompanyID = ? AND res.IIRUID = ?
     ORDER BY res.SrNo ASC`,
    [companyId, iirUID]
  );

  return { header: headers[0], results };
}

/** True when `email` is the email of the reviewer chosen on this report (case-insensitive). */
export function isReportReviewer(
  email: string | null | undefined,
  report: { ReviewerEmail: string | null }
): boolean {
  if (!email || !report.ReviewerEmail) return false;
  return email.trim().toLowerCase() === report.ReviewerEmail.trim().toLowerCase();
}

/**
 * The version of a report that may be sent to this user: the Reviewer Remark is removed for
 * everyone except the reviewer, who also gets IsReviewer = true so the screen can show the
 * review controls. The review status itself stays visible (as a read-only badge).
 */
export function presentReport<T extends { ReviewerEmail: string | null; ReviewerRemark: string | null }>(
  report: T,
  userEmail: string
): Omit<T, 'ReviewerRemark'> & { ReviewerRemark: string | null; IsReviewer: boolean } {
  const reviewer = isReportReviewer(userEmail, report);
  return {
    ...report,
    ReviewerRemark: reviewer ? report.ReviewerRemark : null,
    IsReviewer: reviewer,
  };
}

/** The same report with the reviewer-only parts removed — for the PDF, the print page and the email. */
export function withoutReviewerOnlyParts<T extends { ReviewerRemark: string | null }>(report: T): T {
  return { ...report, ReviewerRemark: null };
}
