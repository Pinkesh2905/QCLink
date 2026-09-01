import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inspection Report',
};

export default function InspectionReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
