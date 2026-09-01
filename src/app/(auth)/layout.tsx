import { ContinuousAuthCanvas } from '@/components/auth/continuous-auth-canvas';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ContinuousAuthCanvas>{children}</ContinuousAuthCanvas>;
}
