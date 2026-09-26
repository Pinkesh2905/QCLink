// ============================================================================
// GET /api/files/[...key]
// Authenticated route that redirects to a temporary presigned S3 download URL
// or to local /uploads/ in development fallback mode. Only serves files that
// belong to the caller's company.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { isS3Configured, getPresignedDownloadUrl, companyKeyPrefix } from '@/lib/upload';
import { errorResponse, AppError } from '@/lib/errors';
import type { SessionUser } from '@/types/auth';

/**
 * New uploads carry a "c{CompanyID}/" prefix. Files uploaded before
 * multitenancy have no prefix, so those are allowed only when a record of the
 * caller's company actually references them.
 */
async function canAccessFile(user: SessionUser, fileKey: string): Promise<boolean> {
  if (user.role === 'Admin') return true;
  if (!user.companyId) return false;
  if (fileKey.startsWith(companyKeyPrefix(user.companyId))) return true;
  if (/^c\d+\//.test(fileKey)) return false;

  const [ref] = await query<{ found: number }>(
    `SELECT 1 AS found FROM QCMaster WHERE CompanyID = ? AND ImagePath = ?
     UNION ALL
     SELECT 1 FROM InspectionReports WHERE CompanyID = ? AND InvoicePath = ?
     LIMIT 1`,
    [user.companyId, fileKey, user.companyId, fileKey]
  );
  return !!ref;
}

export const GET = withAuth<{ key: string[] }>(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const rawKey = params.key;

    if (!rawKey) {
      throw new AppError('File key is required', 400);
    }

    const fileKey = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!fileKey || fileKey.includes('..')) {
      throw new AppError('Invalid file key', 400);
    }

    if (!(await canAccessFile(ctx.user, fileKey))) {
      throw new AppError('File not found', 404);
    }

    if (isS3Configured()) {
      // Generate signed URL expiring in 5 minutes (300 seconds)
      const presignedUrl = await getPresignedDownloadUrl(fileKey, 300);
      return NextResponse.redirect(presignedUrl, 302);
    } else {
      // Local development fallback: redirect directly to statically served /uploads/{key}
      const localUrl = new URL(`/uploads/${fileKey}`, req.url);
      return NextResponse.redirect(localUrl, 302);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
