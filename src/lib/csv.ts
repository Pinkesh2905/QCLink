// ============================================================================
// QCLink — RFC 4180 Compliant CSV Parser & Generator
// Handles quotes, escaped double quotes (""), commas, and newlines in values.
// ============================================================================

/**
 * Parses raw CSV string into headers and an array of row objects.
 */
export function parseCSV(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = tokenizeCSV(text);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // First non-empty row is headers
  const rawHeaders = lines[0].map((h) => h.trim().replace(/^\uFEFF/, '')); // strip UTF-8 BOM if present
  const headers = rawHeaders.filter((h) => h.length > 0);

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawRow = lines[i];

    // Skip trailing blank rows
    if (rawRow.length === 1 && rawRow[0].trim() === '') {
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const headerName = headers[j];
      rowObj[headerName] = (rawRow[j] !== undefined ? rawRow[j] : '').trim();
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Tokenizes CSV string into a 2D array of strings per RFC 4180.
 */
export function tokenizeCSV(text: string): string[][] {
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        // Starting quote
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        // End of field
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        // CRLF or standalone CR
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        // LF
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push last field & row if not empty
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    result.push(currentRow);
  }

  return result;
}

/**
 * Formats a single CSV field, escaping quotes and wrapping in quotes if needed.
 */
export function formatCSVField(value: unknown): string {
  if (value == null) {
    return '';
  }

  const str = String(value);
  const needsQuotes =
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.startsWith(' ') ||
    str.endsWith(' ');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates a full RFC 4180 CSV string from headers and rows.
 */
export function generateCSV(
  headers: string[],
  rows: (Record<string, unknown> | unknown[])[]
): string {
  const headerLine = headers.map(formatCSVField).join(',');
  const rowLines = rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(formatCSVField).join(',');
    }
    return headers.map((h) => formatCSVField(row[h])).join(',');
  });

  return [headerLine, ...rowLines].join('\r\n');
}
