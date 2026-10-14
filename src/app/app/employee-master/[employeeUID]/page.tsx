import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { HAS_LOGIN_SQL } from '@/lib/employees';
import { EmployeeForm } from '@/components/employee-master/employee-form';
import type { EmployeeWithOwner } from '@/types/db';

interface EmployeeDetailPageProps {
  params: Promise<{ employeeUID: string }>;
}

export async function generateMetadata({ params }: EmployeeDetailPageProps): Promise<Metadata> {
  const { employeeUID } = await params;
  return {
    title: `Employee Master | ${employeeUID}`,
    description: `View and edit employee ${employeeUID}`,
  };
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { employeeUID } = await params;
  const user = await getCurrentUser();
  if (!user?.companyId) notFound();

  const rows = await query<EmployeeWithOwner & { HasLogin: number }>(
    `SELECT e.*, usr.Name AS OwnerName, ${HAS_LOGIN_SQL}
     FROM Employees e
     LEFT JOIN Users usr ON e.OwnerUserID = usr.UserID
     WHERE e.CompanyID = ? AND e.EmployeeUID = ?`,
    [user.companyId, employeeUID]
  );

  if (rows.length === 0) {
    notFound();
  }

  return <EmployeeForm initialData={rows[0]} isEdit={true} />;
}
