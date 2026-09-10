// ============================================================================
// QCLink — Google Sheets Client
// Minimal REST wrapper around the Sheets v4 API, authenticated as a service
// account (JWT bearer flow via `jose`, no googleapis SDK dependency).
// Optional integration: every export here no-ops quietly when unconfigured.
// ============================================================================

import { SignJWT, importPKCS8 } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export interface SheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export function isSheetsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY
  );
}

function getConfig(): SheetsConfig | null {
  if (!isSheetsConfigured()) return null;
  return {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL!,
    // .env stores the PEM with literal "\n" escapes — restore real newlines.
    privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  };
}

// ---------------------------------------------------------------------------
// Auth — exchange a self-signed JWT for a short-lived access token.
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: SheetsConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }

  const key = await importPKCS8(config.privateKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(config.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

// ---------------------------------------------------------------------------
// Low-level request helper (one retry on rate limit / transient failure)
// ---------------------------------------------------------------------------

async function sheetsFetch(
  config: SheetsConfig,
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const token = await getAccessToken(config);
  const url = `${SHEETS_API}/${config.spreadsheetId}${path}`;

  const doFetch = () =>
    fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

  let res = await doFetch();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await doFetch();
  }

  if (!res.ok) {
    throw new Error(`Sheets API ${path} failed (${res.status}): ${await res.text()}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Tab bookkeeping — create the tab + header row on first use, cache sheetId.
// ---------------------------------------------------------------------------

const tabIdCache = new Map<string, number>();

export function colLetter(index0Based: number): string {
  let n = index0Based + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function ensureTab(
  config: SheetsConfig,
  tabName: string,
  headers: string[]
): Promise<number> {
  const cached = tabIdCache.get(tabName);
  if (cached !== undefined) return cached;

  const meta = (await sheetsFetch(config, '?fields=sheets.properties')) as {
    sheets: { properties: { sheetId: number; title: string } }[];
  };

  const existing = meta.sheets.find((s) => s.properties.title === tabName);
  if (existing) {
    tabIdCache.set(tabName, existing.properties.sheetId);
    return existing.properties.sheetId;
  }

  const addResult = (await sheetsFetch(config, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tabName } } }],
    }),
  })) as { replies: { addSheet: { properties: { sheetId: number } } }[] };

  const sheetId = addResult.replies[0].addSheet.properties.sheetId;
  tabIdCache.set(tabName, sheetId);

  const lastCol = colLetter(headers.length - 1);
  await sheetsFetch(
    config,
    `/values/${encodeURIComponent(tabName)}!A1:${lastCol}1?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [headers] }) }
  );

  return sheetId;
}

// ---------------------------------------------------------------------------
// Row operations
// ---------------------------------------------------------------------------

/** Reads column A of a tab (row 1 is the header). Returns raw string values, row 2 onward. */
async function getKeyColumn(config: SheetsConfig, tabName: string): Promise<string[]> {
  const result = (await sheetsFetch(
    config,
    `/values/${encodeURIComponent(tabName)}!A2:A`
  )) as { values?: string[][] };
  return (result.values ?? []).map((row) => row[0] ?? '');
}

/**
 * Insert or overwrite the single row whose column-A value equals `key`.
 * Appends a new row if no match is found.
 */
export async function upsertRow(
  tabName: string,
  headers: string[],
  key: string,
  rowValues: unknown[]
): Promise<void> {
  const config = getConfig();
  if (!config) return;

  await ensureTab(config, tabName, headers);
  const keys = await getKeyColumn(config, tabName);
  const idx = keys.indexOf(key); // 0-based within data rows (row 2 = idx 0)

  const lastCol = colLetter(headers.length - 1);

  if (idx === -1) {
    await sheetsFetch(
      config,
      `/values/${encodeURIComponent(tabName)}!A:${lastCol}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [rowValues] }) }
    );
  } else {
    const rowNum = idx + 2;
    await sheetsFetch(
      config,
      `/values/${encodeURIComponent(tabName)}!A${rowNum}:${lastCol}${rowNum}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [rowValues] }) }
    );
  }
}

/** Appends one or more rows unconditionally (for append-only logs). */
export async function appendRows(
  tabName: string,
  headers: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const config = getConfig();
  if (!config) return;

  await ensureTab(config, tabName, headers);
  const lastCol = colLetter(headers.length - 1);

  await sheetsFetch(
    config,
    `/values/${encodeURIComponent(tabName)}!A:${lastCol}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: rows }) }
  );
}

/**
 * Deletes every row whose column-A value equals `key`, then appends `rows`
 * in its place. Used for child-row tables (spec/result grids) where the
 * whole set for a parent record is replaced on every save.
 */
export async function replaceChildRows(
  tabName: string,
  headers: string[],
  key: string,
  rows: unknown[][]
): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const sheetId = await ensureTab(config, tabName, headers);
  const keys = await getKeyColumn(config, tabName);

  const matchingRowIndexes = keys
    .map((k, i) => (k === key ? i + 1 : -1)) // +1: 0-based row within A2:A → 0-based sheet row (row 2 = index 1)
    .filter((i) => i !== -1)
    .sort((a, b) => b - a); // descending, so deletes don't shift earlier indexes

  if (matchingRowIndexes.length > 0) {
    await sheetsFetch(config, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: matchingRowIndexes.map((rowIndex) => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        })),
      }),
    });
  }

  if (rows.length > 0) {
    await appendRows(tabName, headers, rows);
  }
}

/** Runs a sync step without ever letting a Sheets failure fail the caller's request. */
export async function safeSync(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`[sheets-sync] ${label} failed:`, error);
  }
}
