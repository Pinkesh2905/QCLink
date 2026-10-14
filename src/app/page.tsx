import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import { isDbUnavailable } from '@/lib/db-errors';
import { ServiceUnavailable } from '@/components/shared/service-unavailable';

export default async function HomePage() {
  let session;
  try {
    session = await validateSession();
  } catch (error) {
    if (isDbUnavailable(error)) {
      console.error('Database unavailable on the home page:', (error as { code?: string }).code ?? error);
      return <ServiceUnavailable />;
    }
    throw error;
  }

  if (session) {
    redirect('/app/dashboard');
  } else {
    redirect('/login');
  }
}
