import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import type { SessionUser } from '@/types/auth';
import { isDbUnavailable } from '@/lib/db-errors';
import { ContinuousAuthCanvas } from '@/components/auth/continuous-auth-canvas';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Checking for an existing session needs the database. If it is unreachable, still show the
  // login page (the form reports the problem clearly when someone tries to sign in).
  let session: SessionUser | null = null;
  try {
    session = await validateSession();
  } catch (error) {
    if (!isDbUnavailable(error)) throw error;
    console.error('Database unavailable while checking the session on an auth page');
  }

  if (session) {
    redirect('/app/dashboard');
  }

  return <ContinuousAuthCanvas>{children}</ContinuousAuthCanvas>;
}
