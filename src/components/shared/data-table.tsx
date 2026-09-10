'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from './search-input';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  fetchUrl: string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  rowKey: (row: T) => string;
}

export function DataTable<T extends object>({
  columns,
  fetchUrl,
  onRowClick,
  searchPlaceholder = 'Search...',
  rowKey,
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );
  const pageSize = 15;

  const debouncedSearch = useDebounce(search, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
      }

      const res = await fetch(`${fetchUrl}?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setTotal(json.total);

        // If records were removed elsewhere and the current page no longer
        // exists, snap back to the last real page instead of showing an
        // empty "No records found" the user has to manually back out of.
        const newTotalPages = Math.ceil(json.total / pageSize);
        if (newTotalPages > 0 && page > newTotalPages) {
          setPage(newTotalPages);
        }
      }
    } catch (err) {
      console.error('DataTable fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, page, pageSize, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (search) params.set('search', search);
    if (sortBy) {
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [page, search, sortBy, sortOrder, pathname, router]);

  const totalPages = Math.ceil(total / pageSize);
  const sortableColumns = columns.filter((c) => c.sortable);
  // Card view (mobile) treats the first column as a compact identifier and
  // the second as the title; everything after is shown as label/value pairs.
  // Matches every current usage (Store Master, QC Master, Inspection
  // Reports), which all lead with a UID column then a name/title column.
  const [idColumn, titleColumn, ...detailColumns] = columns;

  function renderCell(col: Column<T>, row: T): React.ReactNode {
    return col.render
      ? col.render(row)
      : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? '—';
  }

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  }

  function getSortIcon(key: string) {
    if (sortBy !== key) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="w-full sm:max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
          />
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap self-end sm:self-auto">
          {total} {total === 1 ? 'record' : 'records'}
        </span>
      </div>

      {/* Table Container — sm and up */}
      <div className="hidden sm:block rounded-lg border overflow-x-auto max-w-full">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.className}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className="flex items-center font-medium hover:text-foreground transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      {getSortIcon(col.key)}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn('text-xs sm:text-sm', col.className)}
                    >
                      {renderCell(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Card list — below sm, replaces the table (avoids sideways-scrolling
          columns on a phone) */}
      <div className="sm:hidden space-y-3">
        {sortableColumns.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={sortBy || undefined}
              onValueChange={(val) => {
                setSortBy(val);
                setSortOrder('asc');
              }}
            >
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortableColumns.map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {col.header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!sortBy}
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-lg border h-32 flex items-center justify-center text-sm text-muted-foreground">
            No records found
          </div>
        ) : (
          data.map((row) => (
            <div
              key={rowKey(row)}
              className={cn(
                'rounded-lg border p-3.5 space-y-2 bg-card',
                onRowClick && 'cursor-pointer active:bg-muted/50 transition-colors'
              )}
              onClick={() => onRowClick?.(row)}
            >
              {idColumn && (
                <div className="text-[11px] font-mono font-medium text-muted-foreground">
                  {renderCell(idColumn, row)}
                </div>
              )}
              {titleColumn && (
                <div className="text-sm font-semibold leading-snug">
                  {renderCell(titleColumn, row)}
                </div>
              )}
              {detailColumns.length > 0 && (
                <div className="pt-1.5 border-t grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {detailColumns.map((col) => (
                    <div key={col.key} className="text-xs min-w-0">
                      <div className="text-muted-foreground">{col.header}</div>
                      <div className="font-medium truncate">{renderCell(col, row)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 min-h-[32px] min-w-[32px]"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 min-h-[32px] min-w-[32px]"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono px-2 sm:hidden">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 min-h-[32px] min-w-[32px]"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 min-h-[32px] min-w-[32px]"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
