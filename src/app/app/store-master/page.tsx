'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ExportButton } from '@/components/shared/export-button';
import { ImportModal } from '@/components/store-master/import-modal';
import { useSession } from '@/hooks/use-session';
import { Plus, Upload } from 'lucide-react';
import type { ItemWithLookups } from '@/types/db';

const columns: Column<ItemWithLookups>[] = [
  { key: 'ItemUID', header: 'Item UID', sortable: true, className: 'font-medium w-28' },
  { key: 'ItemName', header: 'Item Name', sortable: true },
  { key: 'CategoryName', header: 'Category', sortable: true },
  {
    key: 'CurrentStock',
    header: 'Stock',
    sortable: true,
    className: 'text-right w-24',
    render: (row) => <span className="tabular-nums">{row.CurrentStock ?? '—'}</span>,
  },
  {
    key: 'MinLevel',
    header: 'Min Level',
    sortable: true,
    className: 'text-right w-24',
    render: (row) => <span className="tabular-nums">{row.MinLevel ?? '—'}</span>,
  },
  { key: 'OwnerName', header: 'Owner' },
  {
    key: 'UpdatedAt',
    header: 'Updated',
    sortable: true,
    className: 'w-36',
    render: (row) =>
      new Date(row.UpdatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
];

export default function StoreMasterListPage() {
  const router = useRouter();
  const { user } = useSession();
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = user?.Role === 'Admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Store Master</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your inventory items</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton exportUrl="/api/items/export" label="Export" />

          {isAdmin && (
            <Button
              variant="outline"
              className="w-full sm:w-auto shrink-0"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}

          <Button className="w-full sm:w-auto shrink-0" onClick={() => router.push('/app/store-master/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Item
          </Button>
        </div>
      </div>

      <DataTable<ItemWithLookups>
        key={refreshKey}
        columns={columns}
        fetchUrl="/api/items"
        searchPlaceholder="Search items..."
        rowKey={(row) => row.ItemUID}
        onRowClick={(row) => router.push(`/app/store-master/${row.ItemUID}`)}
      />

      {isAdmin && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setRefreshKey((k) => k + 1);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
