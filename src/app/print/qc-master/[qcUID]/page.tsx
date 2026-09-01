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
  let densityClass = 'text-[11px]';
  let cellPadding = 'py-1.5 px-2';
  let headerPadding = 'py-2 px-2';

  if (rowCount > 20) {
    densityClass = 'text-[9px] leading-tight';
    cellPadding = 'py-0.5 px-1.5';
    headerPadding = 'py-1 px-1.5';
  } else if (rowCount > 10) {
    densityClass = 'text-[10px] leading-snug';
    cellPadding = 'py-1 px-2';
    headerPadding = 'py-1.5 px-2';
  }

  const formattedCreatedDate = qc.CreatedAt
    ? new Date(qc.CreatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="w-full max-w-full overflow-hidden">
      <PrintActions backUrl={`/app/qc-master/${qcUID}`} documentTitle={`QC Specification - ${qcUID}`} />

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
                Quality Control Specification Sheet
              </h1>
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-600 mt-0.5">
                Template No: <span className="font-bold text-slate-900">{qc.QCUID}</span>
              </div>
            </div>
          </div>

          {/* Form Ref Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs text-slate-600 font-mono gap-1">
            <span>Form Ref: QCL-QC-{qc.QCUID}</span>
            <span>Total Parameters: {rowCount}</span>
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
                    {qc.ItemUID}
                  </td>
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 w-[18%] border-r border-slate-300">
                    Created Date
                  </td>
                  <td className="text-slate-900 px-2.5 sm:px-3 py-1.5 w-[32%]">
                    {formattedCreatedDate}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    Item Description
                  </td>
                  <td className="font-medium text-slate-900 px-2.5 sm:px-3 py-1.5" colSpan={3}>
                    {qc.ItemName}
                  </td>
                </tr>
                <tr>
                  <td className="bg-slate-50 font-medium text-slate-600 px-2.5 sm:px-3 py-1.5 border-r border-slate-300">
                    Prepared By
                  </td>
                  <td className="text-slate-900 px-2.5 sm:px-3 py-1.5" colSpan={3}>
                    {qc.OwnerName || 'System'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Specifications Table */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-1">
              Inspection Specifications & Control Parameters
            </div>
            <div className="w-full overflow-x-auto print-table-container -mx-1 sm:mx-0">
              <table className={`w-full min-w-[550px] sm:min-w-0 print-table border-collapse border border-slate-400 text-left ${densityClass}`}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-800 text-[10px] uppercase tracking-wider">
                    <th className={`${headerPadding} w-[5%] text-center border-r border-slate-300`}>Sr.</th>
                    <th className={`${headerPadding} w-[24%] border-r border-slate-300`}>Testing Parameter</th>
                    <th className={`${headerPadding} w-[25%] border-r border-slate-300`}>Specified Requirement</th>
                    <th className={`${headerPadding} w-[16%] border-r border-slate-300`}>Inspection Method</th>
                    <th className={`${headerPadding} w-[11%] border-r border-slate-300`}>Frequency</th>
                    <th className={`${headerPadding} w-[10%] border-r border-slate-300`}>Responsibility</th>
                    <th className={`${headerPadding} w-[9%]`}>Reaction Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {specs.map((spec) => (
                    <tr key={spec.SpecID || spec.SrNo} className="hover:bg-slate-50/40">
                      <td className={`${cellPadding} text-center font-mono text-slate-500 border-r border-slate-300`}>
                        {spec.SrNo}
                      </td>
                      <td className={`${cellPadding} font-medium text-slate-900 border-r border-slate-300`}>
                        {spec.Parameter}
                      </td>
                      <td className={`${cellPadding} font-mono font-semibold text-slate-950 border-r border-slate-300`}>
                        {spec.Specification || '—'}
                      </td>
                      <td className={`${cellPadding} text-slate-700 border-r border-slate-300`}>
                        {spec.MethodName || '—'}
                      </td>
                      <td className={`${cellPadding} text-slate-700 border-r border-slate-300`}>
                        {spec.FrequencyName || '—'}
                      </td>
                      <td className={`${cellPadding} text-slate-700 border-r border-slate-300`}>
                        {spec.ResponsibilityName || '—'}
                      </td>
                      <td className={`${cellPadding} text-slate-700`}>
                        {spec.ReactionPlanName || '—'}
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
              <div className="text-xs font-semibold text-slate-800 mb-6 sm:mb-8">Prepared By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                <span>Name: {qc.OwnerName || 'QA Engineer'}</span>
                <span>Date: ____/____/20__</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-6 sm:mb-8">Approved By:</div>
              <div className="border-b border-slate-900 w-full mb-1" />
              <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                <span>Name: QA Head / Manager</span>
                <span>Date: ____/____/20__</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
