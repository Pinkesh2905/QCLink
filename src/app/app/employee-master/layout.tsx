import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Employee Master',
};

export default function EmployeeMasterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
