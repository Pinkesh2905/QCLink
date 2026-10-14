'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ExportButton } from '@/components/shared/export-button';
import { useSession } from '@/hooks/use-session';
import { Plus, ShieldCheck } from 'lucide-react';
import { formatDateIST } from '@/lib/datetime';
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
  {
    key: 'ReviewStatus',
    header: 'Review',
    sortable: true,
    render: (row) => {
      if (!row.ReviewStatus) return <span className="text-xs text-muted-foreground">—</span>;
      const cls =
        row.ReviewStatus === 'Review Done'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
          : row.ReviewStatus === 'Review Rejected'
          ? 'bg-red-50 text-red-700 border-red-300'
          : 'bg-amber-50 text-amber-700 border-amber-300';
      return (
        <div className="flex flex-col gap-0.5">
          <Badge variant="outline" className={cls}>{row.ReviewStatus}</Badge>
          {row.ReviewerName && <span className="text-[11px] text-muted-foreground">{row.ReviewerName}</span>}
        </div>
      );
    },
  },
  { key: 'OwnerName', header: 'Inspector' },
  {
    key: 'UpdatedAt',
    header: 'Updated',
    sortable: true,
    className: 'w-32',
    render: (row) => formatDateIST(row.UpdatedAt),
  },
];

export default function InspectionReportListPage() {
  const router = useRouter();
  const { user } = useSession();
  const [onlyMine, setOnlyMine] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Incoming Inspection Reports</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage incoming material quality inspection records</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={onlyMine ? 'default' : 'outline'}
            className="w-full sm:w-auto shrink-0"
            onClick={() => setOnlyMine((v) => !v)}
            aria-pressed={onlyMine}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Awaiting my review
          </Button>
          <ExportButton exportUrl="/api/inspection-reports/export" label="Export" />

          {!user?.ReadOnly && (
            <Button className="w-full sm:w-auto shrink-0" onClick={() => router.push('/app/inspection-report/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Inspection Report
            </Button>
          )}
        </div>
      </div>

      <DataTable<InspectionReportWithLookups>
        key={onlyMine ? 'mine' : 'all'}
        columns={columns}
        fetchUrl={onlyMine ? '/api/inspection-reports?review=mine' : '/api/inspection-reports'}
        searchPlaceholder="Search reports by item, UID or GRN..."
        rowKey={(row) => row.IIRUID}
        onRowClick={(row) => router.push(`/app/inspection-report/${row.IIRUID}`)}
      />
    </div>
  );
}
