import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { validateSession } from '@/lib/session';
import { PrintActions } from '@/components/print/print-actions';
import type {
  InspectionReportWithLookups,
  InspectionResultWithLookups,
} from '@/types/db';

interface IRPrintPageProps {
  params: Promise<{ iirUID: string }>;
}

export async function generateMetadata({ params }: IRPrintPageProps): Promise<Metadata> {
  const { iirUID } = await params;
  return {
    title: `Inspection Report - ${iirUID}`,
  };
}

function renderOutcomeBadge(statusName?: string | null) {
  const s = (statusName || '').toLowerCase();
  if (s.includes('deviation')) {
    return (
      <span className="font-semibold text-amber-800 text-[10px] sm:text-[11px]">
        Accept (Dev.)
      </span>
    );
  }
  if (s.includes('reject') || s.includes('fail')) {
    return (
      <span className="font-semibold text-rose-800 text-[10px] sm:text-[11px]">
        Reject
      </span>
    );
  }
  return (
    <span className="font-semibold text-emerald-800 text-[10px] sm:text-[11px]">
      Accept
    </span>
  );
}

function renderHeaderStamp(statusName?: string | null) {
  const s = (statusName || '').toLowerCase();
  if (s.includes('deviation')) {
    return (
      <div className="border border-amber-700 bg-amber-50/60 text-amber-900 px-2.5 py-0.5 text-center font-bold text-[11px] uppercase tracking-wider">
        STATUS: ACCEPT UNDER DEVIATION
      </div>
    );
  }
  if (s.includes('reject') || s.includes('fail')) {
    return (
      <div className="border border-rose-700 bg-rose-50/60 text-rose-900 px-2.5 py-0.5 text-center font-bold text-[11px] uppercase tracking-wider">
        STATUS: REJECTED
      </div>
    );
  }
  return (
    <div className="border border-emerald-700 bg-emerald-50/60 text-emerald-900 px-2.5 py-0.5 text-center font-bold text-[11px] uppercase tracking-wider">
      STATUS: ACCEPTED
    </div>
  );
}

export default async function IRPrintPage({ params }: IRPrintPageProps) {
  const { iirUID } = await params;
  await validateSession();

  const headers = await query<InspectionReportWithLookups>(
    `SELECT r.*,
            rs.ResultStatusName AS InspectionStatusName,
            usr.Name AS OwnerName
     FROM InspectionReports r
     LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
     LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
     WHERE r.IIRUID = ?`,
    [iirUID]
  );

  if (headers.length === 0) {
    notFound();
  }

  const ir = headers[0];

  const results = await query<InspectionResultWithLookups>(
    `SELECT res.*,
            c.CriteriaName,
            m.MethodName,
            f.FrequencyName,
            resp.ResponsibilityName,
            rp.ReactionPlanName,
            rs.ResultStatusName AS ResultStatusName
     FROM InspectionResults res
     LEFT JOIN SpecificationCriteria c ON res.CriteriaID = c.CriteriaID
     LEFT JOIN MethodOfInspection m ON res.MethodID = m.MethodID
     LEFT JOIN InspectionFrequency f ON res.FrequencyID = f.FrequencyID
     LEFT JOIN Responsibility resp ON res.ResponsibilityID = resp.ResponsibilityID
     LEFT JOIN ReactionPlan rp ON res.ReactionPlanID = rp.ReactionPlanID
     LEFT JOIN ResultStatus rs ON res.ResultStatusID = rs.ResultStatusID
     WHERE res.IIRUID = ?
     ORDER BY res.SrNo ASC`,
    [iirUID]
  );

  const rowCount = results.length;

  // Single-page fit row density configuration
  let densityClass = 'text-[10px] sm:text-[11px]';
  let cellPadding = 'py-1 px-1.5 sm:py-1.5 sm:px-2';
  let headerPadding = 'py-1.5 px-1.5 sm:py-2 sm:px-2';

  if (rowCount > 20) {
    densityClass = 'text-[9px] leading-tight';
    cellPadding = 'py-0.5 px-1';
    headerPadding = 'py-1 px-1';
  } else if (rowCount > 10) {
    densityClass = 'text-[9.5px] leading-snug';
    cellPadding = 'py-0.5 px-1.5 sm:py-1 sm:px-1.5';
    headerPadding = 'py-1 px-1.5 sm:py-1.5 sm:px-1.5';
  }

  const formattedInspectionDate = ir.InspectionDate
    ? new Date(ir.InspectionDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="w-full">
      <PrintActions backUrl={`/app/inspection-report/${iirUID}`} documentTitle={`Inspection Report - ${iirUID}`} />

      {/* A4 Strict Single-Page Printable Document */}
      <main className="print-container w-full max-w-[210mm] mx-auto bg-white p-4 sm:p-6 sm:shadow-md border sm:border border-slate-300 print:border-none print:shadow-none print:p-0 flex flex-col justify-between box-border font-sans text-slate-900">
        <div className="space-y-2.5 sm:space-y-3">
          {/* Header Block */}
          <div className="border-b-2 border-slate-900 pb-2 flex items-end justify-between gap-2">
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-slate-950">QCLink</div>
              <div className="text-[9px] sm:text-[10px] tracking-wider text-slate-600 uppercase font-medium">
                Quality Assurance & Control Department
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-sm sm:text-base font-bold uppercase tracking-tight text-slate-950">
                Incoming Inspection Report
              </h1>
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-600 mt-0.5">
                Report No: <span className="font-bold text-slate-900">{ir.IIRUID}</span>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] sm:text-xs text-slate-600 font-mono">
              Form Ref: QCL-IR-{ir.IIRUID}
            </div>
            <div>{renderHeaderStamp(ir.InspectionStatusName)}</div>
          </div>

          {/* Structured Information Table */}
          <table className="w-full table-fixed border-collapse border border-slate-400 text-[10px] sm:text-xs">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 w-[20%] border-r border-slate-300">
                  Item UID
                </td>
                <td className="font-mono font-bold text-slate-900 px-2 py-1 w-[30%] border-r border-slate-300 truncate">
                  {ir.ItemUID}
                </td>
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 w-[22%] border-r border-slate-300">
                  Inspection Date
                </td>
                <td className="text-slate-900 px-2 py-1 w-[28%]">
                  {formattedInspectionDate}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 border-r border-slate-300">
                  Item Description
                </td>
                <td className="font-medium text-slate-900 px-2 py-1 border-r border-slate-300 break-words" colSpan={3}>
                  {ir.ItemName}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 border-r border-slate-300">
                  GRN Number
                </td>
                <td className="font-mono font-medium text-slate-900 px-2 py-1 border-r border-slate-300 truncate">
                  {ir.GRNNo}
                </td>
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 border-r border-slate-300">
                  QC Spec Ref
                </td>
                <td className="font-mono text-slate-900 px-2 py-1 truncate">
                  {ir.QCUID}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 border-r border-slate-300">
                  Inspected By
                </td>
                <td className="text-slate-900 px-2 py-1 truncate" colSpan={3}>
                  {ir.OwnerName || 'System'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Test Results Table */}
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-1">
              Inspection Parameters & Test Results
            </div>
            <table className={`w-full table-fixed border-collapse border border-slate-400 text-left ${densityClass}`}>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800 text-[9px] sm:text-[10px] uppercase tracking-wider">
                  <th className={`${headerPadding} w-[7%] text-center border-r border-slate-300`}>#</th>
                  <th className={`${headerPadding} w-[28%] border-r border-slate-300`}>Parameter</th>
                  <th className={`${headerPadding} w-[30%] border-r border-slate-300`}>Specification</th>
                  <th className={`${headerPadding} w-[18%] border-r border-slate-300`}>Actual</th>
                  <th className={`${headerPadding} w-[17%] text-center`}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {results.map((res) => (
                  <tr key={res.ResultID || res.SrNo} className="hover:bg-slate-50/40">
                    <td className={`${cellPadding} text-center font-mono text-slate-500 border-r border-slate-300`}>
                      {res.SrNo}
                    </td>
                    <td className={`${cellPadding} font-medium text-slate-900 border-r border-slate-300 break-words`}>
                      {res.Parameter}
                    </td>
                    <td className={`${cellPadding} font-mono text-slate-800 border-r border-slate-300 break-words`}>
                      {res.Specification || '—'}
                    </td>
                    <td className={`${cellPadding} font-mono font-semibold text-slate-950 border-r border-slate-300 truncate`}>
                      {res.Actual != null ? res.Actual : '—'}
                    </td>
                    <td className={`${cellPadding} text-center`}>
                      {renderOutcomeBadge(res.ResultStatusName)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sign-off Block */}
        <div className="mt-4 pt-3 border-t border-slate-300">
          <div className="grid grid-cols-2 gap-6 sm:gap-10 pt-1">
            <div>
              <div className="text-[11px] sm:text-xs font-semibold text-slate-800 mb-4 sm:mb-5">Inspected & Prepared By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-600 font-mono">
                <span className="truncate">Name: {ir.OwnerName || 'QA Inspector'}</span>
                <span className="shrink-0">Date: ___/___/20__</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-semibold text-slate-800 mb-4 sm:mb-5">Reviewed & Approved By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-600 font-mono">
                <span className="truncate">Name: QA Manager</span>
                <span className="shrink-0">Date: ___/___/20__</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
