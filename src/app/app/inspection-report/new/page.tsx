import type { Metadata } from 'next';
import { IRForm } from '@/components/inspection-report/ir-form';

export const metadata: Metadata = {
  title: 'Inspection Report | New Report',
  description: 'Create a new incoming quality inspection report against QC specifications',
};

export default function NewInspectionReportPage() {
  return <IRForm isEdit={false} />;
}
