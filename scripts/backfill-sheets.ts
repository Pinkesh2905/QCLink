// ============================================================================
// QCLink — One-Time Backfill: MySQL → Google Sheets
//
// Usage: npx tsx scripts/backfill-sheets.ts [companyId]
//
// The live sync in src/lib/sheets-sync.ts only pushes rows going forward
// (on create/update). Run this after setting a company's Google Sheet ID (and
// the GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY env vars) to copy
// its existing Items, QC Masters, and Inspection Reports into that sheet.
// With no companyId, every company that has a sheet configured is backfilled.
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
      'GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY are not set. Configure them in .env.local first.'
    );
    process.exit(1);
  }

  const { query, getPool } = await import('../src/lib/db');
  const { syncItemToSheet, syncQCMasterToSheet, syncInspectionReportToSheet } =
    await import('../src/lib/sheets-sync');

  const onlyCompanyId = process.argv[2] ? Number(process.argv[2]) : null;
  const companies = await query<{ CompanyID: number; CompanyName: string }>(
    `SELECT CompanyID, CompanyName FROM Companies
     WHERE GoogleSheetID IS NOT NULL AND GoogleSheetID != ''
       ${onlyCompanyId ? 'AND CompanyID = ?' : ''}
     ORDER BY CompanyID`,
    onlyCompanyId ? [onlyCompanyId] : []
  );

  if (companies.length === 0) {
    console.log('No matching company has a Google Sheet ID configured.');
  }

  for (const company of companies) {
    const id = company.CompanyID;
    console.log(`\n== ${company.CompanyName} (#${id}) ==`);

    const items = await query<{ ItemUID: string }>(
      'SELECT ItemUID FROM Items WHERE CompanyID = ? ORDER BY CreatedAt ASC',
      [id]
    );
    console.log(`Syncing ${items.length} items...`);
    for (const [i, row] of items.entries()) {
      await syncItemToSheet(id, row.ItemUID);
      process.stdout.write(`\r  ${i + 1}/${items.length}`);
    }
    console.log();

    const qcMasters = await query<{ QCUID: string }>(
      'SELECT QCUID FROM QCMaster WHERE CompanyID = ? ORDER BY CreatedAt ASC',
      [id]
    );
    console.log(`Syncing ${qcMasters.length} QC Master records...`);
    for (const [i, row] of qcMasters.entries()) {
      await syncQCMasterToSheet(id, row.QCUID);
      process.stdout.write(`\r  ${i + 1}/${qcMasters.length}`);
    }
    console.log();

    const reports = await query<{ IIRUID: string }>(
      'SELECT IIRUID FROM InspectionReports WHERE CompanyID = ? ORDER BY CreatedAt ASC',
      [id]
    );
    console.log(`Syncing ${reports.length} inspection reports...`);
    for (const [i, row] of reports.entries()) {
      await syncInspectionReportToSheet(id, row.IIRUID);
      process.stdout.write(`\r  ${i + 1}/${reports.length}`);
    }
    console.log();
  }

  console.log('\nBackfill complete. (AuditLog history is not backfilled — only new entries sync.)');
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
