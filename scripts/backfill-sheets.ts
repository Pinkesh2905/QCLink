// ============================================================================
// QCLink — One-Time Backfill: MySQL → Google Sheets
//
// Usage: npx tsx scripts/backfill-sheets.ts
//
// The live sync in src/lib/sheets-sync.ts only pushes rows going forward
// (on create/update). Run this once after configuring GOOGLE_SHEETS_* env
// vars to copy every existing Item, QC Master, and Inspection Report into
// the sheet so it isn't missing everything created before sync was turned on.
// Safe to re-run — every sync call is an upsert keyed by UID.
// ============================================================================

import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local if present (same convention as
// scripts/migrate-uploads-to-s3.ts).
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
        let val = trimmed.substring(idx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {
  console.warn('Could not read .env.local, using existing process.env variables');
}

async function main() {
  const { isSheetsConfigured } = await import('../src/lib/sheets');
  if (!isSheetsConfigured()) {
    console.error(
      'GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY ' +
      'are not all set. Configure them in .env.local first.'
    );
    process.exit(1);
  }

  const { query, getPool } = await import('../src/lib/db');
  const { syncItemToSheet, syncQCMasterToSheet, syncInspectionReportToSheet } =
    await import('../src/lib/sheets-sync');

  const items = await query<{ ItemUID: string }>('SELECT ItemUID FROM Items ORDER BY CreatedAt ASC');
  console.log(`Syncing ${items.length} items...`);
  for (const [i, row] of items.entries()) {
    await syncItemToSheet(row.ItemUID);
    process.stdout.write(`\r  ${i + 1}/${items.length}`);
  }
  console.log();

  const qcMasters = await query<{ QCUID: string }>('SELECT QCUID FROM QCMaster ORDER BY CreatedAt ASC');
  console.log(`Syncing ${qcMasters.length} QC Master records...`);
  for (const [i, row] of qcMasters.entries()) {
    await syncQCMasterToSheet(row.QCUID);
    process.stdout.write(`\r  ${i + 1}/${qcMasters.length}`);
  }
  console.log();

  const reports = await query<{ IIRUID: string }>(
    'SELECT IIRUID FROM InspectionReports ORDER BY CreatedAt ASC'
  );
  console.log(`Syncing ${reports.length} inspection reports...`);
  for (const [i, row] of reports.entries()) {
    await syncInspectionReportToSheet(row.IIRUID);
    process.stdout.write(`\r  ${i + 1}/${reports.length}`);
  }
  console.log();

  console.log('Backfill complete. (AuditLog history is not backfilled — only new entries sync.)');
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
