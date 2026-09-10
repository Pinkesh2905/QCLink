// ============================================================================
// QCLink — File Upload & Storage Utility (AWS S3 with Local Disk Fallback)
// Automatically uses S3 when configured; falls back to public/uploads/ in local dev.
// ============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { AppError } from './errors';

export type UploadType = 'qc-images' | 'invoices';

let s3Client: S3Client | null = null;
let hasWarnedS3Fallback = false;

/**
 * Check whether full AWS S3 credentials and bucket are configured.
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new AppError('AWS S3 credentials are not configured', 500);
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new AppError('AWS_S3_BUCKET environment variable is not configured', 500);
  }
  return bucket;
}

/**
 * Validate MIME type and file extension based on upload type.
 */
export function validateUploadFile(file: File, type: UploadType): void {
  const mime = file.type?.toLowerCase() || '';
  const ext = path.extname(file.name || '').toLowerCase();

  // SVG is deliberately excluded: unlike raster formats, an SVG file can carry
  // an inline <script>, and files served from the local-disk fallback (no S3
  // configured) are returned same-origin — a malicious SVG would execute in
  // the app's own origin if opened directly.
  const isImageMime = mime.startsWith('image/') && mime !== 'image/svg+xml';
  const isImageExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  const isPdfMime = mime === 'application/pdf';
  const isPdfExt = ext === '.pdf';

  if (type === 'qc-images') {
    if (!isImageMime && !isImageExt) {
      throw new AppError('QC Master images must be valid image files (JPG, PNG, WebP, GIF)', 400);
    }
  } else if (type === 'invoices') {
    if (!isImageMime && !isImageExt && !isPdfMime && !isPdfExt) {
      throw new AppError('Invoices must be valid image files or PDF documents', 400);
    }
  }
}

/**
 * Save an uploaded file to S3 or local disk (if S3 is unconfigured).
 * Returns the object key (e.g. "qc-images/1725170000-a1b2c3.jpg").
 */
export async function saveUploadedFile(
  file: File,
  type: UploadType
): Promise<string> {
  validateUploadFile(file, type);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || '.bin';
  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const objectKey = `${type}/${uniqueName}`;

  if (isS3Configured()) {
    const client = getS3Client();
    const bucket = getS3Bucket();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );
  } else {
    // Local development fallback
    if (!hasWarnedS3Fallback) {
      console.warn(
        '[QCLink] AWS S3 not configured — using local disk storage. This should only happen in local development.'
      );
      hasWarnedS3Fallback = true;
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', type);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, uniqueName), buffer);
  }

  return objectKey;
}

/**
 * Generate a temporary signed GET URL (valid for 5 minutes by default).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const client = getS3Client();
  const bucket = getS3Bucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
