// ============================================================================
// QCLink — Review request email
// Builds the report PDF and emails it to the report's reviewer. Never throws:
// a mail or PDF problem must not undo saving the report. The report remembers
// when the email went out (ReviewEmailSentAt) so the author can resend it.
// ============================================================================

import { query } from './db';
import { loadReport, withoutReviewerOnlyParts } from './inspection-report';
import { sendReviewRequestEmail } from './email';
import { renderInspectionReportPdf } from './pdf/inspection-report-pdf';

export async function sendReviewRequestForReport(
  companyId: number,
  iirUID: string,
  options: { isResubmission?: boolean } = {}
): Promise<boolean> {
  try {
    const loaded = await loadReport(companyId, iirUID);
    if (!loaded) return false;
    const header = withoutReviewerOnlyParts(loaded.header);
    if (!header.ReviewerEmail || !header.ReviewerName) return false;

    const [company] = await query<{ CompanyName: string }>(
      'SELECT CompanyName FROM Companies WHERE CompanyID = ?',
      [companyId]
    );

    let pdf: Buffer | null = null;
    try {
      pdf = await renderInspectionReportPdf({
        companyName: company?.CompanyName ?? null,
        report: header,
        results: loaded.results,
      });
    } catch (error) {
      // Send the request without the attachment rather than not at all — the link still works.
      console.error(`Could not build the PDF for ${iirUID}:`, error);
    }

    const inspectionDate = header.InspectionDate
      ? new Date(header.InspectionDate as unknown as string).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        })
      : '';

    const sent = await sendReviewRequestEmail({
      to: header.ReviewerEmail,
      reviewerName: header.ReviewerName,
      companyName: company?.CompanyName ?? null,
      iirUID: header.IIRUID,
      itemName: header.ItemName,
      grnNo: header.GRNNo,
      inspectionDate,
      inspectorName: header.OwnerName || 'QCLink user',
      statusName: header.InspectionStatusName || null,
      isResubmission: options.isResubmission === true,
      pdf,
    });

    if (sent) {
      await query(
        'UPDATE InspectionReports SET ReviewEmailSentAt = NOW() WHERE CompanyID = ? AND IIRUID = ?',
        [companyId, iirUID]
      );
    }
    return sent;
  } catch (error) {
    console.error(`Review request for ${iirUID} failed:`, error);
    return false;
  }
}
