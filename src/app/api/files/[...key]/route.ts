// ============================================================================
// GET /api/files/[...key]
// Authenticated route that redirects to a temporary presigned S3 download URL
// or to local /uploads/ in development fallback mode.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { isS3Configured, getPresignedDownloadUrl } from '@/lib/upload';
import { errorResponse, AppError } from '@/lib/errors';

export const GET = withAuth<{ key: string[] }>(async (_req: NextRequest, ctx) => {
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

    if (isS3Configured()) {
      // Generate signed URL expiring in 5 minutes (300 seconds)
      const presignedUrl = await getPresignedDownloadUrl(fileKey, 300);
      return NextResponse.redirect(presignedUrl, 302);
    } else {
      // Local development fallback: redirect directly to statically served /uploads/{key}
      const localUrl = new URL(`/uploads/${fileKey}`, _req.url);
      return NextResponse.redirect(localUrl, 302);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
