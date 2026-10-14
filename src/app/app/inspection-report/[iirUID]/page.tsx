import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { loadReport, presentReport } from '@/lib/inspection-report';
import { IRForm } from '@/components/inspection-report/ir-form';
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
  const user = await getCurrentUser();
  if (!user?.companyId) notFound();

  const loaded = await loadReport(user.companyId, iirUID);
  if (!loaded) {
    notFound();
  }

  // The Reviewer Remark is stripped here unless the signed-in user is the reviewer.
  const initialData: InspectionReportDetailResponse = {
    ...presentReport(loaded.header, user.email),
    Results: loaded.results,
  };

  return <IRForm initialData={initialData} isEdit={true} />;
}
