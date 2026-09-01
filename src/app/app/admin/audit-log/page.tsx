'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileClock, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw } from 'lucide-react';
import type { AuditLogWithUser } from '@/types/db';

const TABLES = [
  { label: 'All Tables', value: '' },
  { label: 'Items (Store Master)', value: 'Items' },
  { label: 'QCMaster', value: 'QCMaster' },
  { label: 'QCSpecifications', value: 'QCSpecifications' },
  { label: 'InspectionReports', value: 'InspectionReports' },
  { label: 'InspectionResults', value: 'InspectionResults' },
  { label: 'Users', value: 'Users' },
  { label: 'Categories', value: 'Categories' },
  { label: 'UnitOfStock', value: 'UnitOfStock' },
  { label: 'SubCategories', value: 'SubCategories' },
  { label: 'SpecificationCriteria', value: 'SpecificationCriteria' },
  { label: 'MethodOfInspection', value: 'MethodOfInspection' },
  { label: 'InspectionFrequency', value: 'InspectionFrequency' },
  { label: 'Responsibility', value: 'Responsibility' },
  { label: 'ReactionPlan', value: 'ReactionPlan' },
  { label: 'ResultStatus', value: 'ResultStatus' },
];

export default function AuditLogViewerPage() {
  const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTable, setSelectedTable] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (selectedTable) params.set('tableName', selectedTable);
      if (recordIdFilter.trim()) params.set('recordId', recordIdFilter.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data);
        setTotal(json.total);
        setTotalPages(json.totalPages);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [page, selectedTable, recordIdFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSelectedTable('');
    setRecordIdFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">CREATE</Badge>;
      case 'UPDATE':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-300">UPDATE</Badge>;
      case 'DELETE':
        return <Badge className="bg-red-50 text-red-700 border-red-300">DELETE</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <FileClock className="h-5 w-5 text-primary" />
          Global Audit Trail & System Log
        </h3>
        <p className="text-sm text-muted-foreground">
          Comprehensive historical audit trail across all transactions, master data changes, and record edits
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Filter Audit Trail</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={handleResetFilters}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Table */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Module / Table</label>
              <Select
                value={selectedTable || 'all'}
                onValueChange={(val) => {
                  setSelectedTable(val === 'all' ? '' : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map((t) => (
                    <SelectItem key={t.value || 'all'} value={t.value || 'all'} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record ID */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Record UID</label>
              <Input
                placeholder="e.g. Item01, QC02, IIR05"
                value={recordIdFilter}
                onChange={(e) => {
                  setRecordIdFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs font-mono"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing page {page} of {totalPages || 1}
          </span>
          <span>{total} total audit records</span>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto max-w-full">
          <Table className="min-w-[800px] sm:min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead className="w-24">Action</TableHead>
                <TableHead className="w-36">Table</TableHead>
                <TableHead className="w-28 font-mono">Record ID</TableHead>
                <TableHead className="w-36">Field</TableHead>
                <TableHead>Old Value</TableHead>
                <TableHead>New Value</TableHead>
                <TableHead className="w-36">Changed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No audit records matching the selected filters
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.AuditID} className="text-xs">
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(log.ChangedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{getActionBadge(log.ActionType)}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {log.TableName}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {log.RecordID}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.FieldName || '—'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-red-600">
                      {log.OldValue ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-emerald-600 font-medium">
                      {log.NewValue ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.ChangedByName || `User #${log.ChangedByUserID}`}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
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
    </div>
  );
}
