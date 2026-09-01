'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ExportButton } from '@/components/shared/export-button';
import { Plus } from 'lucide-react';
import type { InspectionReportWithLookups } from '@/types/db';

const columns: Column<InspectionReportWithLookups>[] = [
  { key: 'IIRUID', header: 'Report UID', sortable: true, className: 'font-medium w-28' },
  { key: 'ItemName', header: 'Item Name', sortable: true },
  {
    key: 'InspectionDate',
    header: 'Inspection Date',
    sortable: true,
    className: 'w-32',
    render: (row) =>
      new Date(row.InspectionDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
  { key: 'GRNNo', header: 'GRN No', sortable: true, className: 'font-mono' },
  {
    key: 'InspectionStatusName',
    header: 'Status',
    sortable: true,
    render: (row) => {
      const name = row.InspectionStatusName || '—';
      const norm = name.toLowerCase();
      let variant: 'default' | 'outline' | 'destructive' | 'secondary' = 'outline';
      let customClass = '';

      if (norm.includes('accept') && !norm.includes('deviation')) {
        customClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
      } else if (norm.includes('reject')) {
        customClass = 'bg-red-50 text-red-700 border-red-300';
      } else if (norm.includes('deviation')) {
        customClass = 'bg-amber-50 text-amber-700 border-amber-300';
      }

      return (
        <Badge variant={variant} className={customClass}>
          {name}
        </Badge>
      );
    },
  },
  { key: 'OwnerName', header: 'Inspector' },
  {
    key: 'UpdatedAt',
    header: 'Updated',
    sortable: true,
    className: 'w-32',
    render: (row) =>
      new Date(row.UpdatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
];

export default function InspectionReportListPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Incoming Inspection Reports</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage incoming material quality inspection records</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton exportUrl="/api/inspection-reports/export" label="Export" />

          <Button className="w-full sm:w-auto shrink-0" onClick={() => router.push('/app/inspection-report/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Inspection Report
          </Button>
        </div>
      </div>

      <DataTable<InspectionReportWithLookups>
        columns={columns}
        fetchUrl="/api/inspection-reports"
        searchPlaceholder="Search reports by item, UID or GRN..."
        rowKey={(row) => row.IIRUID}
        onRowClick={(row) => router.push(`/app/inspection-report/${row.IIRUID}`)}
      />
    </div>
  );
}
