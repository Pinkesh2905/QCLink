import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Store Master',
};

export default function StoreMasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
