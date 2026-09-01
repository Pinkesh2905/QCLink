import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import { SessionProvider } from '@/hooks/use-session';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  const initialUser = {
    UserID: session.userId,
    Name: session.name,
    Email: session.email,
    Role: session.role,
  };

  return (
    <SessionProvider initialUser={initialUser}>
      <AppShell user={initialUser}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
