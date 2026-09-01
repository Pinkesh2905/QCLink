import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { IRForm } from '@/components/inspection-report/ir-form';
import type {
  InspectionReportWithLookups,
  InspectionResultWithLookups,
} from '@/types/db';
import type { InspectionReportDetailResponse } from '@/types/api';

interface IRDetailPageProps {
  params: Promise<{ iirUID: string }>;
}

export async function generateMetadata({ params }: IRDetailPageProps): Promise<Metadata> {
  const { iirUID } = await params;
  return {
    title: `Inspection Report | ${iirUID}`,
    description: `View and edit inspection report ${iirUID}`,
  };
}

export default async function IRDetailPage({ params }: IRDetailPageProps) {
  const { iirUID } = await params;

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

  const initialData: InspectionReportDetailResponse = {
    ...headers[0],
    Results: results,
  };

  return <IRForm initialData={initialData} isEdit={true} />;
}
