// ============================================================================
// QCLink — Google Sheets Connection Check
//
// Usage: npx tsx scripts/check-sheets-connection.ts
//
// Verifies GOOGLE_SHEETS_* env vars are present and well-formed, exchanges
// them for an access token, and fetches the spreadsheet's title as proof the
// service account can actually reach it. Read-only — writes nothing.
// ============================================================================

import fs from 'fs';
import path from 'path';

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
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  console.log('--- Env var presence ---');
  console.log('GOOGLE_SHEETS_SPREADSHEET_ID:', id ? `set (${id})` : 'MISSING');
  console.log('GOOGLE_SHEETS_CLIENT_EMAIL:  ', email ? `set (${email})` : 'MISSING');
  console.log(
    'GOOGLE_SHEETS_PRIVATE_KEY:   ',
    key
      ? `set (${key.length} chars, starts "${key.slice(0, 27)}...", ends "...${key.slice(-25)}")`
      : 'MISSING'
  );

  if (!id || !email || !key) {
    console.error('\nOne or more env vars are missing — check .env.local.');
    process.exit(1);
  }

  if (!key.includes('BEGIN PRIVATE KEY') || !key.includes('END PRIVATE KEY')) {
    console.error(
      '\nGOOGLE_SHEETS_PRIVATE_KEY does not contain the BEGIN/END markers — ' +
      'looks truncated or malformed.'
    );
    process.exit(1);
  }

  console.log('\n--- Attempting to authenticate and reach the spreadsheet ---');
  const { SignJWT, importPKCS8 } = await import('jose');

  const normalizedKey = key.replace(/\\n/g, '\n');
  const cryptoKey = await importPKCS8(normalizedKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(cryptoKey);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    console.error(`Token exchange failed (${tokenRes.status}):`, await tokenRes.text());
    console.error(
      '\nThis usually means the private key is malformed/truncated, or the ' +
      'client email is wrong. Re-copy both from the downloaded JSON key file.'
    );
    process.exit(1);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };
  console.log('Authenticated with Google. Fetching spreadsheet metadata...');

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!metaRes.ok) {
    console.error(`Spreadsheet fetch failed (${metaRes.status}):`, await metaRes.text());
    if (metaRes.status === 403) {
      console.error(
        `\nThe service account authenticated fine, but can't access this spreadsheet.` +
        `\nOpen the sheet → Share → add ${email} as an Editor.`
      );
    } else if (metaRes.status === 404) {
      console.error(
        '\nSpreadsheet not found — double check GOOGLE_SHEETS_SPREADSHEET_ID against the ' +
        'ID in the sheet\'s URL (the part between /d/ and /edit).'
      );
    }
    process.exit(1);
  }

  const meta = (await metaRes.json()) as { properties: { title: string } };
  console.log(`\nSuccess. Connected to spreadsheet: "${meta.properties.title}"`);
  console.log('You can now run: npx tsx scripts/backfill-sheets.ts');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
