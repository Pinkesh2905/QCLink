import type { Metadata } from 'next';
import { QCForm } from '@/components/qc-master/qc-form';

export const metadata: Metadata = {
  title: 'QC Master | New Template',
  description: 'Create a new QC specification template for an item',
};

export default function NewQCPage() {
  return <QCForm isEdit={false} />;
}
