'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ExportButton } from '@/components/shared/export-button';
import { useSession } from '@/hooks/use-session';
import { Plus } from 'lucide-react';
import { formatDateIST } from '@/lib/datetime';
import type { EmployeeWithOwner } from '@/types/db';

type EmployeeRow = EmployeeWithOwner & { HasLogin?: number };

const columns: Column<EmployeeRow>[] = [
  { key: 'EmployeeUID', header: 'Employee UID', sortable: true, className: 'font-medium w-32' },
  { key: 'EmployeeName', header: 'Name', sortable: true },
  { key: 'Email', header: 'Email', sortable: true },
  { key: 'Department', header: 'Department', sortable: true },
  { key: 'Designation', header: 'Designation', sortable: true },
  {
    key: 'IsActive',
    header: 'Status',
    className: 'w-28',
    render: (row) =>
      row.IsActive ? (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">Active</Badge>
      ) : (
        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-300">Inactive</Badge>
      ),
  },
  {
    key: 'HasLogin',
    header: 'Can review',
    className: 'w-32',
    render: (row) =>
      row.HasLogin ? (
        <span className="text-xs text-emerald-700">Has a QCLink login</span>
      ) : (
        <span className="text-xs text-amber-700">No login yet</span>
      ),
  },
  {
    key: 'UpdatedAt',
    header: 'Updated',
    sortable: true,
    className: 'w-36',
    render: (row) => formatDateIST(row.UpdatedAt),
  },
];

export default function EmployeeMasterListPage() {
  const router = useRouter();
  const { user } = useSession();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Employee Master</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            People who can be chosen as the reviewer of an inspection report
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton exportUrl="/api/employees/export" label="Export" />

          {!user?.ReadOnly && (
            <Button className="w-full sm:w-auto shrink-0" onClick={() => router.push('/app/employee-master/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Employee
            </Button>
          )}
        </div>
      </div>

      <DataTable<EmployeeRow>
        columns={columns}
        fetchUrl="/api/employees"
        searchPlaceholder="Search by name, email, department..."
        rowKey={(row) => row.EmployeeUID}
        onRowClick={(row) => router.push(`/app/employee-master/${row.EmployeeUID}`)}
      />
    </div>
  );
}
