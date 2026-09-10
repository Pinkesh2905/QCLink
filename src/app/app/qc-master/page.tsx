'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ExportButton } from '@/components/shared/export-button';
import { Plus } from 'lucide-react';
import { formatDateIST } from '@/lib/datetime';
import type { QCMasterWithLookups } from '@/types/db';

const columns: Column<QCMasterWithLookups>[] = [
  { key: 'QCUID', header: 'QC UID', sortable: true, className: 'font-medium w-28' },
  { key: 'ItemName', header: 'Item Name', sortable: true },
  {
    key: 'SpecCount',
    header: 'Specs',
    sortable: true,
    className: 'text-center w-24',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
        {row.SpecCount || 0} rows
      </span>
    ),
  },
  { key: 'OwnerName', header: 'Owner' },
  {
    key: 'UpdatedAt',
    header: 'Updated',
    sortable: true,
    className: 'w-36',
    render: (row) => formatDateIST(row.UpdatedAt),
  },
];

export default function QCMasterListPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">QC Master</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage incoming quality specification templates</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton exportUrl="/api/qc-master/export" label="Export" />

          <Button className="w-full sm:w-auto shrink-0" onClick={() => router.push('/app/qc-master/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New QC Template
          </Button>
        </div>
      </div>

      <DataTable<QCMasterWithLookups>
        columns={columns}
        fetchUrl="/api/qc-master"
        searchPlaceholder="Search QC templates by item or UID..."
        rowKey={(row) => row.QCUID}
        onRowClick={(row) => router.push(`/app/qc-master/${row.QCUID}`)}
      />
    </div>
  );
}
