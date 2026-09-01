'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AuditLogWithUser } from '@/types/db';

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  /** The main table name (e.g. 'Items') */
  tableName: string;
  /** Optional comma-separated child table names for joined history */
  childTables?: string;
  /** The record ID to fetch history for */
  recordId: string;
  /** Title shown in the dialog header */
  title?: string;
}

export function HistoryModal({
  open,
  onClose,
  tableName,
  childTables,
  recordId,
  title = 'History',
}: HistoryModalProps) {
  const [entries, setEntries] = useState<AuditLogWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!open || !recordId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const tables = childTables
          ? `${tableName},${childTables}`
          : tableName;
        const res = await fetch(
          `/api/audit-log?tableName=${tables}&recordId=${encodeURIComponent(recordId)}&page=${page}&pageSize=20`
        );
        if (res.ok) {
          const json = await res.json();
          setEntries(json.data);
          setTotalPages(json.totalPages);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, tableName, childTables, recordId, page]);

  // Reset page when opening
  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  function formatAction(entry: AuditLogWithUser): React.ReactNode {
    if (entry.ActionType === 'CREATE') {
      return (
        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
          Created
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
        Updated
      </Badge>
    );
  }

  function formatDate(dateStr: string | Date): string {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No history entries found
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.AuditID}
                className="rounded-lg border p-3 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {formatAction(entry)}
                    {entry.FieldName && (
                      <span className="text-xs sm:text-sm font-medium">
                        {entry.TableName !== tableName && (
                          <span className="text-muted-foreground">
                            [{entry.TableName}]{' '}
                          </span>
                        )}
                        {entry.FieldName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.ChangedAt)}
                  </span>
                </div>

                {entry.ActionType === 'UPDATE' && entry.FieldName && (
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs sm:text-sm">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">From: </span>
                      <span className="text-red-600 break-words font-mono text-xs">
                        {entry.OldValue ?? '(empty)'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">To: </span>
                      <span className="text-emerald-600 break-words font-mono text-xs">
                        {entry.NewValue ?? '(empty)'}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  by {entry.ChangedByName || 'Unknown'}
                </p>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
