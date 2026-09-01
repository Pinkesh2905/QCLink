import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { validateSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { UserCheck, Users, Database, FileClock, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Panel',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'Admin') {
    redirect('/app/dashboard');
  }

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Admin Panel</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage user accounts, lookup master data, and configure field permissions
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="text-xs justify-center" asChild>
            <Link href="/app/admin/approvals">
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              Approvals
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs justify-center" asChild>
            <Link href="/app/admin/users">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Users
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs justify-center" asChild>
            <Link href="/app/admin/master-data">
              <Database className="mr-1.5 h-3.5 w-3.5" />
              Master Data
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs justify-center" asChild>
            <Link href="/app/admin/field-permissions">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Permissions
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs justify-center" asChild>
            <Link href="/app/admin/audit-log">
              <FileClock className="mr-1.5 h-3.5 w-3.5" />
              Audit Log
            </Link>
          </Button>
        </div>
      </div>

      <div className="min-w-0 max-w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
