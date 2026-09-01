// ============================================================================
// QCLink — Migration Script: Local Uploads to AWS S3
//
// Usage: npx tsx scripts/migrate-uploads-to-s3.ts
//
// 1. Reads existing local files in public/uploads/qc-images/ and public/uploads/invoices/
// 2. Uploads them to AWS S3 under the same key prefix (e.g. qc-images/filename)
// 3. Updates QCMaster.ImagePath and InspectionReports.InvoicePath in MySQL database
// ============================================================================

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables from .env.local if present
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  console.warn('Could not read .env.local, using existing process.env variables');
}

const REGION = process.env.AWS_REGION;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET = process.env.AWS_S3_BUCKET;

const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || 'Vezapp';

async function runMigration() {
  console.log('--- Starting AWS S3 Uploads Migration ---');

  if (!REGION || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET) {
    console.error('ERROR: Missing required AWS S3 environment variables.');
    console.error('Please configure AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET.');
    process.exit(1);
  }

  const s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const types: ('qc-images' | 'invoices')[] = ['qc-images', 'invoices'];

  let totalFilesMigrated = 0;

  for (const type of types) {
    const dir = path.join(uploadsDir, type);
    if (!fs.existsSync(dir)) {
      console.log(`Directory ${dir} does not exist, skipping.`);
      continue;
    }

    const files = fs.readdirSync(dir);
    console.log(`Found ${files.length} file(s) in public/uploads/${type}`);

    for (const filename of files) {
      const filePath = path.join(dir, filename);
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;

      const fileBuffer = fs.readFileSync(filePath);
      const s3Key = `${type}/${filename}`;

      console.log(`Uploading ${s3Key} (${fileBuffer.length} bytes) to S3 bucket "${BUCKET}"...`);
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            Body: fileBuffer,
          })
        );
        totalFilesMigrated++;
        console.log(`✓ Successfully uploaded ${s3Key}`);
      } catch (err: any) {
        console.error(`✗ Failed to upload ${s3Key}:`, err?.message || err);
      }
    }
  }

  console.log(`\nUploaded ${totalFilesMigrated} files to S3.`);
  console.log('Updating database file paths in MySQL...');

  if (!DB_HOST || !DB_USER || !DB_PASSWORD) {
    console.error('ERROR: Missing database environment variables. Skipping database update.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    // Update QCMaster.ImagePath from /uploads/qc-images/... to qc-images/...
    const [qcResult]: any = await connection.execute(
      `UPDATE QCMaster 
       SET ImagePath = TRIM(LEADING '/' FROM REPLACE(ImagePath, '/uploads/', ''))
       WHERE ImagePath LIKE '/uploads/%'`
    );
    console.log(`✓ Updated ${qcResult.affectedRows || 0} rows in QCMaster.`);

    // Update InspectionReports.InvoicePath from /uploads/invoices/... to invoices/...
    const [irResult]: any = await connection.execute(
      `UPDATE InspectionReports 
       SET InvoicePath = TRIM(LEADING '/' FROM REPLACE(InvoicePath, '/uploads/', ''))
       WHERE InvoicePath LIKE '/uploads/%'`
    );
    console.log(`✓ Updated ${irResult.affectedRows || 0} rows in InspectionReports.`);

    console.log('\n--- Migration Completed Successfully! ---');
  } catch (dbErr: any) {
    console.error('Database update error:', dbErr?.message || dbErr);
  } finally {
    await connection.end();
  }
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
