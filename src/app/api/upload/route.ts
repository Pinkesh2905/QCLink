// ============================================================================
// POST /api/upload
// Multipart file upload handler.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { saveUploadedFile, type UploadType } from '@/lib/upload';
import { errorResponse, AppError } from '@/lib/errors';

const VALID_TYPES: UploadType[] = ['qc-images', 'invoices'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      throw new AppError('No file provided', 400);
    }

    if (!type || !VALID_TYPES.includes(type as UploadType)) {
      throw new AppError(
        `Invalid upload type. Must be one of: ${VALID_TYPES.join(', ')}`,
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('File size exceeds 10MB limit', 400);
    }

    const path = await saveUploadedFile(file, type as UploadType);

    return NextResponse.json({ path });
  } catch (error) {
    return errorResponse(error);
  }
});
