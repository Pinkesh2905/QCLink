import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import { SessionProvider } from '@/hooks/use-session';

export default async function PrintLayout({
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
      <div className="min-h-screen bg-slate-100/80 print:bg-white text-slate-900 antialiased py-0 sm:py-6 print:py-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-container {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              border-radius: 0 !important;
            }
            thead {
              display: table-header-group !important;
            }
            tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}} />
        {children}
      </div>
    </SessionProvider>
  );
}
