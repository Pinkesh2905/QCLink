import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { QCForm } from '@/components/qc-master/qc-form';
import type {
  QCMasterWithLookups,
  QCSpecificationWithLookups,
} from '@/types/db';
import type { QCMasterDetailResponse } from '@/types/api';

interface QCDetailPageProps {
  params: Promise<{ qcUID: string }>;
}

export async function generateMetadata({ params }: QCDetailPageProps): Promise<Metadata> {
  const { qcUID } = await params;
  return {
    title: `QC Master | ${qcUID}`,
    description: `View and edit QC template ${qcUID}`,
  };
}

export default async function QCDetailPage({ params }: QCDetailPageProps) {
  const { qcUID } = await params;

  const headers = await query<QCMasterWithLookups>(
    `SELECT q.*, usr.Name AS OwnerName,
            (SELECT COUNT(*) FROM QCSpecifications s WHERE s.QCUID = q.QCUID) AS SpecCount
     FROM QCMaster q
     LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
     WHERE q.QCUID = ?`,
    [qcUID]
  );

  if (headers.length === 0) {
    notFound();
  }

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

  const initialData: QCMasterDetailResponse = {
    ...headers[0],
    Specifications: specs,
  };

  return <QCForm initialData={initialData} isEdit={true} />;
}
