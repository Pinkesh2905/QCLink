import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { SessionProvider } from '@/hooks/use-session';
import { AppShell } from '@/components/layout/app-shell';
import { toClientSessionUser } from '@/types/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();

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
