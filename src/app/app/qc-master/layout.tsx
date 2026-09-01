import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QC Master',
};

export default function QCMasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
