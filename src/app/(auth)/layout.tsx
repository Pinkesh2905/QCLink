import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import { ContinuousAuthCanvas } from '@/components/auth/continuous-auth-canvas';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();

  if (session) {
    redirect('/app/dashboard');
  }

  return <ContinuousAuthCanvas>{children}</ContinuousAuthCanvas>;
}
