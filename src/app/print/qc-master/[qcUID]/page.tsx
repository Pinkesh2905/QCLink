import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { validateSession } from '@/lib/session';
import { PrintActions } from '@/components/print/print-actions';
import type {
  QCMasterWithLookups,
  QCSpecificationWithLookups,
} from '@/types/db';

interface QCPrintPageProps {
  params: Promise<{ qcUID: string }>;
}

export async function generateMetadata({ params }: QCPrintPageProps): Promise<Metadata> {
  const { qcUID } = await params;
  return {
    title: `QC Specification Sheet - ${qcUID}`,
  };
}

export default async function QCPrintPage({ params }: QCPrintPageProps) {
  const { qcUID } = await params;
  await validateSession();

  const headers = await query<QCMasterWithLookups>(
    `SELECT q.*, usr.Name AS OwnerName
     FROM QCMaster q
     LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
     WHERE q.QCUID = ?`,
    [qcUID]
  );

  if (headers.length === 0) {
    notFound();
  }

  const qc = headers[0];

  const specs = await query<QCSpecificationWithLookups>(
    `SELECT s.*,
            c.CriteriaName,
            m.MethodName,
            f.FrequencyName,
            r.ResponsibilityName,
            rp.ReactionPlanName
     FROM QCSpecifications s
     LEFT JOIN SpecificationCriteria c ON s.CriteriaID = c.CriteriaID
     LEFT JOIN MethodOfInspection m ON s.MethodID = m.MethodID
     LEFT JOIN InspectionFrequency f ON s.FrequencyID = f.FrequencyID
     LEFT JOIN Responsibility r ON s.ResponsibilityID = r.ResponsibilityID
     LEFT JOIN ReactionPlan rp ON s.ReactionPlanID = rp.ReactionPlanID
     WHERE s.QCUID = ?
     ORDER BY s.SrNo ASC`,
    [qcUID]
  );

  const rowCount = specs.length;

  // Single page fit calibrated row density
  let densityClass = 'text-[10px] sm:text-[11px]';
  let cellPadding = 'py-1 px-1 sm:py-1.5 sm:px-1.5';
  let headerPadding = 'py-1.5 px-1 sm:py-2 sm:px-1.5';

  if (rowCount > 20) {
    densityClass = 'text-[8.5px] sm:text-[9px] leading-tight';
    cellPadding = 'py-0.5 px-1';
    headerPadding = 'py-1 px-1';
  } else if (rowCount > 10) {
    densityClass = 'text-[9.5px] leading-snug';
    cellPadding = 'py-0.5 px-1 sm:py-1 sm:px-1.5';
    headerPadding = 'py-1 px-1 sm:py-1.5 sm:px-1.5';
  }

  const formattedCreatedDate = qc.CreatedAt
    ? new Date(qc.CreatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="w-full">
      <PrintActions backUrl={`/app/qc-master/${qcUID}`} documentTitle={`QC Specification - ${qcUID}`} />

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
                QC Specification Sheet
              </h1>
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-600 mt-0.5">
                Template No: <span className="font-bold text-slate-900">{qc.QCUID}</span>
              </div>
            </div>
          </div>

          {/* Form Ref Bar */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-600 font-mono">
            <span>Form Ref: QCL-QC-{qc.QCUID}</span>
            <span>Total Parameters: {rowCount}</span>
          </div>

          {/* Structured Information Table */}
          <table className="w-full table-fixed border-collapse border border-slate-400 text-[10px] sm:text-xs">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 w-[20%] border-r border-slate-300">
                  Item UID
                </td>
                <td className="font-mono font-bold text-slate-900 px-2 py-1 w-[30%] border-r border-slate-300 truncate">
                  {qc.ItemUID}
                </td>
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 w-[22%] border-r border-slate-300">
                  Created Date
                </td>
                <td className="text-slate-900 px-2 py-1 w-[28%]">
                  {formattedCreatedDate}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 border-r border-slate-300">
                  Item Description
                </td>
                <td className="font-medium text-slate-900 px-2 py-1 border-r border-slate-300 break-words" colSpan={3}>
                  {qc.ItemName}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 font-medium text-slate-600 px-2 py-1 border-r border-slate-300">
                  Prepared By
                </td>
                <td className="text-slate-900 px-2 py-1 truncate" colSpan={3}>
                  {qc.OwnerName || 'System'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Specifications Table */}
          <div>
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-1">
              Inspection Specifications & Control Parameters
            </div>
            <table className={`w-full table-fixed border-collapse border border-slate-400 text-left ${densityClass}`}>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800 text-[8.5px] sm:text-[10px] uppercase tracking-wider">
                  <th className={`${headerPadding} w-[6%] text-center border-r border-slate-300`}>#</th>
                  <th className={`${headerPadding} w-[24%] border-r border-slate-300`}>Parameter</th>
                  <th className={`${headerPadding} w-[24%] border-r border-slate-300`}>Specification</th>
                  <th className={`${headerPadding} w-[16%] border-r border-slate-300`}>Method</th>
                  <th className={`${headerPadding} w-[11%] border-r border-slate-300`}>Frequency</th>
                  <th className={`${headerPadding} w-[10%] border-r border-slate-300`}>Resp.</th>
                  <th className={`${headerPadding} w-[9%]`}>Reaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {specs.map((spec) => (
                  <tr key={spec.SpecID || spec.SrNo} className="hover:bg-slate-50/40">
                    <td className={`${cellPadding} text-center font-mono text-slate-500 border-r border-slate-300`}>
                      {spec.SrNo}
                    </td>
                    <td className={`${cellPadding} font-medium text-slate-900 border-r border-slate-300 break-words`}>
                      {spec.Parameter}
                    </td>
                    <td className={`${cellPadding} font-mono font-semibold text-slate-950 border-r border-slate-300 break-words`}>
                      {spec.Specification || '—'}
                    </td>
                    <td className={`${cellPadding} text-slate-700 border-r border-slate-300 break-words`}>
                      {spec.MethodName || '—'}
                    </td>
                    <td className={`${cellPadding} text-slate-700 border-r border-slate-300 truncate`}>
                      {spec.FrequencyName || '—'}
                    </td>
                    <td className={`${cellPadding} text-slate-700 border-r border-slate-300 truncate`}>
                      {spec.ResponsibilityName || '—'}
                    </td>
                    <td className={`${cellPadding} text-slate-700 truncate`}>
                      {spec.ReactionPlanName || '—'}
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
              <div className="text-[11px] sm:text-xs font-semibold text-slate-800 mb-4 sm:mb-5">Prepared By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-600 font-mono">
                <span className="truncate">Name: {qc.OwnerName || 'QA Engineer'}</span>
                <span className="shrink-0">Date: ___/___/20__</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-semibold text-slate-800 mb-4 sm:mb-5">Approved By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-600 font-mono">
                <span className="truncate">Name: QA Head</span>
                <span className="shrink-0">Date: ___/___/20__</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
