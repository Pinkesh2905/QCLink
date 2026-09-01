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
      <span className="font-semibold text-amber-800 text-[11px]">
        Accept (Dev.)
      </span>
    );
  }
  if (s.includes('reject') || s.includes('fail')) {
    return (
      <span className="font-semibold text-rose-800 text-[11px]">
        Reject
      </span>
    );
  }
  return (
    <span className="font-semibold text-emerald-800 text-[11px]">
      Accept
    </span>
  );
}

function renderHeaderStamp(statusName?: string | null) {
  const s = (statusName || '').toLowerCase();
  if (s.includes('deviation')) {
    return (
      <div className="border border-amber-700 bg-amber-50/60 text-amber-900 px-2.5 py-1 text-center font-bold text-xs uppercase tracking-wider">
        STATUS: ACCEPT UNDER DEVIATION
      </div>
    );
  }
  if (s.includes('reject') || s.includes('fail')) {
    return (
      <div className="border border-rose-700 bg-rose-50/60 text-rose-900 px-2.5 py-1 text-center font-bold text-xs uppercase tracking-wider">
        STATUS: REJECTED
      </div>
    );
  }
  return (
    <div className="border border-emerald-700 bg-emerald-50/60 text-emerald-900 px-2.5 py-1 text-center font-bold text-xs uppercase tracking-wider">
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

  // Single page fit calibrated row density
  let densityClass = 'text-[11px]';
  let cellPadding = 'py-1.5 px-2.5';
  let headerPadding = 'py-2 px-2.5';

  if (rowCount > 20) {
    densityClass = 'text-[9px] leading-tight';
    cellPadding = 'py-0.5 px-2';
    headerPadding = 'py-1 px-2';
  } else if (rowCount > 10) {
    densityClass = 'text-[10px] leading-snug';
    cellPadding = 'py-1 px-2';
    headerPadding = 'py-1.5 px-2';
  }

  const formattedInspectionDate = ir.InspectionDate
    ? new Date(ir.InspectionDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="w-full max-w-full overflow-hidden">
      <PrintActions backUrl={`/app/inspection-report/${iirUID}`} documentTitle={`Inspection Report - ${iirUID}`} />

      {/* A4 Formal Engineering Document */}
      <main className="print-container w-full max-w-full sm:max-w-[210mm] min-h-auto sm:min-h-[297mm] mx-auto bg-white p-4 sm:p-8 sm:shadow-md border-y sm:border border-slate-300 print:border-none print:shadow-none print:p-0 flex flex-col justify-between box-border font-sans text-slate-900">
        <div className="space-y-3.5 sm:space-y-4">
          {/* Header Block */}
          <div className="border-b-2 border-slate-900 pb-2.5 sm:pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4">
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-slate-950">QCLink</div>
              <div className="text-[9px] sm:text-[10px] tracking-wider text-slate-600 uppercase font-medium">
                Quality Assurance & Control Department
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h1 className="text-sm sm:text-base font-bold uppercase tracking-tight text-slate-950">
                Incoming Inspection Report
              </h1>
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-600 mt-0.5">
                Report No: <span className="font-bold text-slate-900">{ir.IIRUID}</span>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[11px] sm:text-xs text-slate-600 font-mono">
              Form Ref: QCL-IR-{ir.IIRUID}
            </div>
            <div className="self-start sm:self-auto">{renderHeaderStamp(ir.InspectionStatusName)}</div>
          </div>

          {/* Structured Information Table */}
          <div className="w-full overflow-x-auto print-table-container">
            <table className="w-full min-w-[500px] sm:min-w-0 print-table border-collapse border border-slate-400 text-xs">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 w-[18%] border-r border-slate-300">
                    Item UID
                  </td>
                  <td className="font-mono font-bold text-slate-900 px-2.5 sm:px-3 py-1.5 w-[32%] border-r border-slate-300">
                    {ir.ItemUID}
                  </td>
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 w-[18%] border-r border-slate-300">
                    Inspection Date
                  </td>
                  <td className="text-slate-900 px-2.5 sm:px-3 py-1.5 w-[32%]">
                    {formattedInspectionDate}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    Item Description
                  </td>
                  <td className="font-medium text-slate-900 px-2.5 sm:px-3 py-1.5" colSpan={3}>
                    {ir.ItemName}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    GRN Number
                  </td>
                  <td className="font-mono font-medium text-slate-900 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    {ir.GRNNo}
                  </td>
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    QC Spec Reference
                  </td>
                  <td className="font-mono text-slate-900 px-2.5 sm:px-3 py-1.5">
                    {ir.QCUID}
                  </td>
                </tr>
                <tr>
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    Inspected By
                  </td>
                  <td className="text-slate-900 px-2.5 sm:px-3 py-1.5" colSpan={3}>
                    {ir.OwnerName || 'System'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Test Results Table */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-1">
              Inspection Parameters & Test Results
            </div>
            <div className="w-full overflow-x-auto print-table-container -mx-1 sm:mx-0">
              <table className={`w-full min-w-[520px] sm:min-w-0 print-table border-collapse border border-slate-400 text-left ${densityClass}`}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800 text-[10px] uppercase tracking-wider">
                    <th className={`${headerPadding} w-[6%] text-center border-r border-slate-300`}>Sr.</th>
                    <th className={`${headerPadding} w-[28%] border-r border-slate-300`}>Testing Parameter</th>
                    <th className={`${headerPadding} w-[30%] border-r border-slate-300`}>Specified Requirement</th>
                    <th className={`${headerPadding} w-[18%] border-r border-slate-300`}>Observed / Actual</th>
                    <th className={`${headerPadding} w-[18%] text-center`}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {results.map((res) => (
                    <tr key={res.ResultID || res.SrNo} className="hover:bg-slate-50/40">
                      <td className={`${cellPadding} text-center font-mono text-slate-500 border-r border-slate-300`}>
                        {res.SrNo}
                      </td>
                      <td className={`${cellPadding} font-medium text-slate-900 border-r border-slate-300`}>
                        {res.Parameter}
                      </td>
                      <td className={`${cellPadding} font-mono text-slate-800 border-r border-slate-300`}>
                        {res.Specification || '—'}
                      </td>
                      <td className={`${cellPadding} font-mono font-semibold text-slate-950 border-r border-slate-300`}>
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
        </div>

        {/* Sign-off Block */}
        <div className="mt-8 pt-4 border-t border-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 print-grid gap-6 sm:gap-12 pt-2">
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-6 sm:mb-8">Inspected & Prepared By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                <span>Name: {ir.OwnerName || 'QA Inspector'}</span>
                <span>Date: ____/____/20__</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-6 sm:mb-8">Reviewed & Approved By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                <span>Name: QA Manager / Quality Lead</span>
                <span>Date: ____/____/20__</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
