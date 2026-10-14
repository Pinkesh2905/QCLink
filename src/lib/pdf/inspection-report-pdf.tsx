// ============================================================================
// QCLink — Inspection Report PDF
// One A4 document layout used for the "Download PDF" button and for the file
// attached to the reviewer's email. Server-side only.
//
// Shows the review status and the inspected / reviewed dates. The Reviewer Remark is NOT part of
// this document: it stays inside the app, visible only to the reviewer.
// ============================================================================

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { formatDateIST } from '@/lib/datetime';
import type { InspectionReportWithLookups, InspectionResultWithLookups } from '@/types/db';

export interface InspectionReportPdfData {
  companyName: string | null;
  report: InspectionReportWithLookups;
  results: InspectionResultWithLookups[];
}

// The built-in PDF fonts only cover Latin-1 (plus a few typographic marks). Map the common
// characters outside it to readable text and replace anything else, so a stray symbol in a
// parameter name can never break the file.
const REPLACEMENTS: Record<string, string> = {
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '→': '->', '←': '<-', '×': 'x', '−': '-',
  'Ω': 'ohm', 'Ω': 'ohm', 'μ': 'µ', '₹': 'Rs', '℃': '°C', '₂': '2', '₃': '3', '²': '²', '³': '³',
};
const WIN_ANSI_EXTRA = new Set(['€', '‘', '’', '‚', '“', '”', '„', '•', '–', '—', '…', '™', '†', '‡', '‰', '‹', '›', 'Œ', 'œ', 'Š', 'š', 'Ž', 'ž', 'Ÿ', 'ƒ', 'ˆ', '˜']);

export function pdfText(value: unknown): string {
  if (value === null || value === undefined) return '';
  let out = '';
  for (const ch of String(value).normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0a || code === 0x09 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
    } else if (code === 0x0d) {
      // ignore carriage returns
    } else if (REPLACEMENTS[ch] !== undefined) {
      out += REPLACEMENTS[ch];
    } else if (WIN_ANSI_EXTRA.has(ch)) {
      out += ch;
    } else {
      out += '?';
    }
  }
  return out;
}

/** The database keeps four decimals ("3.9000"); show the number the inspector typed ("3.9"). */
export function pdfNumber(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return pdfText(value);
  return n.toFixed(6).replace(/\.?0+$/, '');
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return pdfText(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** Review status as printed, with the colour to print it in. Reports made before reviews existed have none. */
function reviewLabel(status: string | null | undefined): { text: string; color: string } {
  if (status === 'Review Done') return { text: 'Review Done', color: '#166534' };
  if (status === 'Review Rejected') return { text: 'Review Rejected', color: '#9f1239' };
  if (status === 'Review Pending') return { text: 'Review Pending', color: '#92400e' };
  return { text: 'Not sent for review', color: '#475569' };
}

type Tone = 'accept' | 'deviation' | 'reject';
function toneOf(statusName?: string | null): Tone {
  const s = (statusName || '').toLowerCase();
  if (s.includes('deviation')) return 'deviation';
  if (s.includes('reject') || s.includes('fail')) return 'reject';
  return 'accept';
}

const COLORS = {
  ink: '#0f172a',
  muted: '#475569',
  line: '#94a3b8',
  lightLine: '#cbd5e1',
  panel: '#f1f5f9',
  accept: '#166534',
  deviation: '#92400e',
  reject: '#9f1239',
};

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 44, paddingHorizontal: 30, fontFamily: 'Helvetica', fontSize: 9, color: COLORS.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: COLORS.ink, paddingBottom: 6 },
  company: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  dept: { fontSize: 7, color: COLORS.muted, marginTop: 2, letterSpacing: 0.6 },
  title: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', textTransform: 'uppercase' },
  reportNo: { fontSize: 8.5, color: COLORS.muted, textAlign: 'right', marginTop: 2 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  formRef: { fontSize: 8, color: COLORS.muted },
  stamp: { borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  infoTable: { borderWidth: 1, borderColor: COLORS.line },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightLine },
  infoLabel: { backgroundColor: COLORS.panel, color: COLORS.muted, padding: 4, borderRightWidth: 1, borderRightColor: COLORS.lightLine },
  infoValue: { padding: 4 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginTop: 10, marginBottom: 3 },
  remarkBox: { borderWidth: 1, borderColor: COLORS.line, padding: 5, minHeight: 20 },
  table: { borderWidth: 1, borderColor: COLORS.line },
  tHead: { flexDirection: 'row', backgroundColor: COLORS.panel, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.lightLine },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', padding: 4, borderRightWidth: 1, borderRightColor: COLORS.lightLine },
  td: { padding: 4, borderRightWidth: 1, borderRightColor: COLORS.lightLine },
  signBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 28 },
  signBox: { flex: 1 },
  signTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 22 },
  signLine: { borderBottomWidth: 1, borderBottomColor: COLORS.ink, marginBottom: 3 },
  signMeta: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: COLORS.muted },
  footer: { position: 'absolute', bottom: 18, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: COLORS.muted },
});

// Column widths (percent of the table) — widened Parameter/Remark columns for text
const COL = { sr: '5%', param: '22%', spec: '17%', actual: '13%', status: '13%', remark: '30%' };

export function InspectionReportDocument({ companyName, report, results }: InspectionReportPdfData) {
  const tone = toneOf(report.InspectionStatusName);
  const toneColor = COLORS[tone];
  const stampText = tone === 'deviation' ? 'STATUS: ACCEPT UNDER DEVIATION' : tone === 'reject' ? 'STATUS: REJECTED' : 'STATUS: ACCEPTED';
  const rowCount = results.length;
  const review = reviewLabel(report.ReviewStatus);
  // A date only exists once the reviewer has acted (Done or Rejected); a pending report has none yet
  const reviewedOn =
    report.ReviewedAt && (report.ReviewStatus === 'Review Done' || report.ReviewStatus === 'Review Rejected')
      ? formatDateIST(report.ReviewedAt as unknown as string)
      : '—';
  const fontSize = rowCount > 20 ? 8 : rowCount > 10 ? 8.5 : 9;

  return (
    <Document title={`Inspection Report ${pdfText(report.IIRUID)}`} author="QCLink" creator="QCLink" producer="QCLink">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{pdfText(companyName) || 'QCLink'}</Text>
            <Text style={styles.dept}>QUALITY ASSURANCE & CONTROL DEPARTMENT</Text>
          </View>
          <View>
            <Text style={styles.title}>Incoming Inspection Report</Text>
            <Text style={styles.reportNo}>Report No: {pdfText(report.IIRUID)}</Text>
          </View>
        </View>

        <View style={styles.banner}>
          <Text style={styles.formRef}>Form Ref: QCL-IR-{pdfText(report.IIRUID)}</Text>
          <Text style={[styles.stamp, { color: toneColor, borderColor: toneColor }]}>{stampText}</Text>
        </View>

        <View style={styles.infoTable}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { width: '20%' }]}>Item UID</Text>
            <Text style={[styles.infoValue, { width: '30%', borderRightWidth: 1, borderRightColor: COLORS.lightLine, fontFamily: 'Helvetica-Bold' }]}>{pdfText(report.ItemUID)}</Text>
            <Text style={[styles.infoLabel, { width: '22%' }]}>Inspection Date</Text>
            <Text style={[styles.infoValue, { width: '28%' }]}>{formatDate(report.InspectionDate)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { width: '20%' }]}>Item Description</Text>
            <Text style={[styles.infoValue, { width: '80%', fontFamily: 'Helvetica-Bold' }]}>{pdfText(report.ItemName)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { width: '20%' }]}>GRN Number</Text>
            <Text style={[styles.infoValue, { width: '30%', borderRightWidth: 1, borderRightColor: COLORS.lightLine }]}>{pdfText(report.GRNNo)}</Text>
            <Text style={[styles.infoLabel, { width: '22%' }]}>QC Spec Ref</Text>
            <Text style={[styles.infoValue, { width: '28%' }]}>{pdfText(report.QCUID)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { width: '20%' }]}>Inspected By</Text>
            <Text style={[styles.infoValue, { width: '30%', borderRightWidth: 1, borderRightColor: COLORS.lightLine }]}>{pdfText(report.OwnerName) || 'System'}</Text>
            <Text style={[styles.infoLabel, { width: '22%' }]}>Reviewer</Text>
            <Text style={[styles.infoValue, { width: '28%' }]}>{pdfText(report.ReviewerName) || '—'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoLabel, { width: '20%' }]}>Review Status</Text>
            <Text style={[styles.infoValue, { width: '30%', borderRightWidth: 1, borderRightColor: COLORS.lightLine, fontFamily: 'Helvetica-Bold', color: review.color }]}>{review.text}</Text>
            <Text style={[styles.infoLabel, { width: '22%' }]}>Reviewed On</Text>
            <Text style={[styles.infoValue, { width: '28%' }]}>{reviewedOn}</Text>
          </View>
        </View>

        {report.InspectionRemark ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Inspection Remark</Text>
            <View style={styles.remarkBox}>
              <Text>{pdfText(report.InspectionRemark)}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Inspection Parameters & Test Results</Text>
        <View style={styles.table}>
          <View style={styles.tHead} fixed>
            <Text style={[styles.th, { width: COL.sr, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.th, { width: COL.param }]}>Parameter</Text>
            <Text style={[styles.th, { width: COL.spec }]}>Specification</Text>
            <Text style={[styles.th, { width: COL.actual }]}>Actual</Text>
            <Text style={[styles.th, { width: COL.status, textAlign: 'center' }]}>Status</Text>
            <Text style={[styles.th, { width: COL.remark, borderRightWidth: 0 }]}>Observed Remark</Text>
          </View>
          {results.map((res) => {
            const rowTone = toneOf(res.ResultStatusName);
            const rowLabel = rowTone === 'deviation' ? 'Accept (Dev.)' : rowTone === 'reject' ? 'Reject' : 'Accept';
            return (
              <View key={res.ResultID ?? res.SrNo} style={styles.tRow} wrap={false}>
                <Text style={[styles.td, { width: COL.sr, textAlign: 'center', color: COLORS.muted, fontSize }]}>{res.SrNo}</Text>
                <Text style={[styles.td, { width: COL.param, fontFamily: 'Helvetica-Bold', fontSize }]}>{pdfText(res.Parameter)}</Text>
                <Text style={[styles.td, { width: COL.spec, fontSize }]}>{pdfText(res.Specification) || '—'}</Text>
                <Text style={[styles.td, { width: COL.actual, fontFamily: 'Helvetica-Bold', fontSize }]}>{res.Actual != null ? pdfNumber(res.Actual) : '—'}</Text>
                <Text style={[styles.td, { width: COL.status, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: COLORS[rowTone], fontSize }]}>
                  {res.ResultStatusName ? rowLabel : '—'}
                </Text>
                <Text style={[styles.td, { width: COL.remark, borderRightWidth: 0, fontSize }]}>{pdfText(res.ObservedRemark) || ''}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.signBlock} wrap={false}>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Inspected & Prepared By:</Text>
            <View style={styles.signLine} />
            <View style={styles.signMeta}>
              <Text>Name: {pdfText(report.OwnerName) || 'QA Inspector'}</Text>
              <Text>Date: {formatDate(report.InspectionDate)}</Text>
            </View>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>Reviewed & Approved By:</Text>
            <View style={styles.signLine} />
            <View style={styles.signMeta}>
              <Text>Name: {pdfText(report.ReviewerName) || 'QA Manager'}</Text>
              <Text>Date: {reviewedOn === '—' ? '___/___/20__' : reviewedOn}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{pdfText(report.IIRUID)} · {pdfText(report.ItemName)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Renders the report to PDF bytes. */
export async function renderInspectionReportPdf(data: InspectionReportPdfData): Promise<Buffer> {
  return renderToBuffer(<InspectionReportDocument {...data} />);
}
