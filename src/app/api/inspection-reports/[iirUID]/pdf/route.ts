// ============================================================================
// GET /api/inspection-reports/[iirUID]/pdf — the report as a PDF download
// Same document that is attached to the reviewer's email. The reviewer's remark
// and review result are not part of it.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { requireCompanyId } from '@/lib/tenant';
import { loadReport, withoutReviewerOnlyParts } from '@/lib/inspection-report';
import { renderInspectionReportPdf } from '@/lib/pdf/inspection-report-pdf';
import { errorResponse, AppError } from '@/lib/errors';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const { iirUID } = await ctx.params;

    const loaded = await loadReport(companyId, iirUID);
    if (!loaded) {
      throw new AppError('Inspection Report not found', 404);
    }

    const [company] = await query<{ CompanyName: string }>(
      'SELECT CompanyName FROM Companies WHERE CompanyID = ?',
      [companyId]
    );

    const pdf = await renderInspectionReportPdf({
      companyName: company?.CompanyName ?? null,
      report: withoutReviewerOnlyParts(loaded.header),
      results: loaded.results,
    });

    const safeName = loaded.header.IIRUID.replace(/[^A-Za-z0-9._-]/g, '_');
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Inspection-Report-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
