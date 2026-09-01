'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { generateCSV } from '@/lib/csv';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidItem {
  rowNumber: number;
  ItemName: string;
  CategoryName: string;
  UOMName: string;
  SubCategoryName: string | null;
  Make: string | null;
  Size: number | null;
  CurrentStock: number | null;
  MPQ: number | null;
  MinLevel: number | null;
}

interface RowError {
  rowNumber: number;
  row: Record<string, string>;
  error: string;
}

interface ValidationReport {
  valid: ValidItem[];
  errors: RowError[];
  validCount: number;
  errorCount: number;
  totalRows: number;
}

export function ImportModal({ open, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [importResult, setImportResult] = useState<{
    insertedCount: number;
    skippedCount: number;
    errors: RowError[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setValidating(false);
    setImporting(false);
    setReport(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a valid .csv file');
      return;
    }
    setFile(selectedFile);
    validateFile(selectedFile);
  };

  const validateFile = async (csvFile: File) => {
    setValidating(true);
    setReport(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch('/api/items/import', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data: ValidationReport = await res.json();
        setReport(data);
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Failed to validate CSV file');
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Network error during file validation');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/items/import?confirm=true', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setImportResult({
          insertedCount: json.insertedCount,
          skippedCount: json.skippedCount,
          errors: json.errors || [],
        });
        toast.success(json.message || 'Items imported successfully');
        onSuccess();
      } else {
        toast.error(json.error || json.message || 'Failed to commit import');
      }
    } catch (err) {
      console.error('Import commit error:', err);
      toast.error('Network error during import commitment');
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    const errors = importResult?.errors || report?.errors || [];
    if (errors.length === 0) return;

    const headers = ['RowNumber', 'ItemName', 'Category', 'UnitOfStock', 'ErrorMessage'];
    const rows = errors.map((e) => ({
      RowNumber: e.rowNumber,
      ItemName: e.row.ItemName || '',
      Category: e.row.Category || '',
      UnitOfStock: e.row.UnitOfStock || '',
      ErrorMessage: e.error,
    }));

    const csvString = generateCSV(headers, rows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qclink_import_errors_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => (!val ? handleClose() : null)}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Import Items (Store Master)
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Upload a CSV file to create inventory items in batch. We validate every row before inserting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Download Template Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border bg-muted/40 text-xs sm:text-sm">
            <div>
              <p className="font-semibold text-foreground">Need the standard CSV format?</p>
              <p className="text-muted-foreground text-xs">
                Includes required headers (ItemName, Category, UnitOfStock) and sample row.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => {
                window.open('/api/items/import/template', '_blank');
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download Template
            </Button>
          </div>

          {/* Upload Dropzone */}
          {!importResult && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/20 flex flex-col items-center justify-center gap-3"
                >
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Click to choose CSV file or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max file size: 5MB (.csv only)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={validating || importing}
                    >
                      Change File
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={resetState}
                      disabled={validating || importing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Progress */}
          {validating && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Validating CSV rows & lookups...</p>
              <p className="text-xs text-muted-foreground">Checking categories, units, and unique constraints</p>
            </div>
          )}

          {/* Validation Preview Report */}
          {report && !importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                  <p className="text-lg font-bold font-mono">{report.totalRows}</p>
                </div>
                <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Valid Rows</p>
                  <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {report.validCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-rose-500/10 border-rose-500/30">
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Error Rows</p>
                  <p className="text-lg font-bold font-mono text-rose-700 dark:text-rose-400">
                    {report.errorCount}
                  </p>
                </div>
              </div>

              {/* Error Details */}
              {report.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Rows with Errors ({report.errors.length}) — will be skipped
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground h-7"
                      onClick={downloadErrorReport}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download Error CSV
                    </Button>
                  </div>
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900 overflow-hidden max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-rose-50 dark:bg-rose-950/40">
                        <TableRow>
                          <TableHead className="w-16 text-xs font-mono">Row #</TableHead>
                          <TableHead className="text-xs">Item Name</TableHead>
                          <TableHead className="text-xs">Error Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.errors.map((err, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="font-mono text-muted-foreground">
                              {err.rowNumber}
                            </TableCell>
                            <TableCell className="font-medium">
                              {err.row.ItemName || '—'}
                            </TableCell>
                            <TableCell className="text-destructive font-medium">
                              {err.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Valid Items Sample */}
              {report.valid.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready to Import ({report.valid.length})
                  </h4>
                  <div className="rounded-lg border overflow-hidden max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-16 text-xs font-mono">Row #</TableHead>
                          <TableHead className="text-xs">Item Name</TableHead>
                          <TableHead className="text-xs">Category</TableHead>
                          <TableHead className="text-xs">UOM</TableHead>
                          <TableHead className="text-xs text-right">Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.valid.slice(0, 50).map((v, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="font-mono text-muted-foreground">
                              {v.rowNumber}
                            </TableCell>
                            <TableCell className="font-medium">{v.ItemName}</TableCell>
                            <TableCell>{v.CategoryName}</TableCell>
                            <TableCell>{v.UOMName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {v.CurrentStock ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {report.valid.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing first 50 of {report.valid.length} items to be created
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Result Summary */}
          {importResult && (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Bulk Import Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Successfully created <span className="font-semibold text-foreground">{importResult.insertedCount}</span> inventory items.
                </p>
                {importResult.skippedCount > 0 && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {importResult.skippedCount} rows were skipped due to errors.
                  </p>
                )}
              </div>

              {importResult.skippedCount > 0 && (
                <Button variant="outline" size="sm" onClick={downloadErrorReport} className="text-xs">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download Skipped Rows Report
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 sm:p-6 border-t bg-muted/20 flex flex-col-reverse sm:flex-row justify-between gap-3">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={importing}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>

          {!importResult && report && (
            <Button
              size="sm"
              disabled={importing || report.validCount === 0}
              onClick={handleConfirmImport}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Items...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Confirm Import ({report.validCount} Items)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
