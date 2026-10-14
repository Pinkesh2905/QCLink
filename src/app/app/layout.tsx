import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { SessionProvider } from '@/hooks/use-session';
import { AppShell } from '@/components/layout/app-shell';
import { toClientSessionUser } from '@/types/auth';
import { isDbUnavailable } from '@/lib/db-errors';
import { ServiceUnavailable } from '@/components/shared/service-unavailable';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getCurrentUser();
  } catch (error) {
    // The session check is the first database call of every page: if MySQL is unreachable, show the
    // friendly "temporarily unavailable" screen (it retries by itself) instead of a server error.
    if (isDbUnavailable(error)) {
      console.error('Database unavailable while checking the session:', (error as { code?: string }).code ?? error);
      return <ServiceUnavailable />;
    }
    throw error;
  }

  if (!session) {
    redirect('/login');
  }

  const initialUser = toClientSessionUser(session);

  return (
    <SessionProvider initialUser={initialUser}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
