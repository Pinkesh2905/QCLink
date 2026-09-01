import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';

export default async function HomePage() {
  const session = await validateSession();

  if (session) {
    redirect('/app/dashboard');
  } else {
    redirect('/login');
  }
}
