'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExportButtonProps {
  exportUrl: string;
  label?: string;
}

export function ExportButton({ exportUrl, label = 'Export' }: ExportButtonProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (exportAll = false) => {
    setDownloading(true);
    try {
      const url = new URL(exportUrl, window.location.origin);
      if (exportAll) {
        url.searchParams.set('exportAll', 'true');
      } else if (search) {
        url.searchParams.set('search', search);
      }

      // Trigger download via window location or anchor element
      const link = document.createElement('a');
      link.href = url.toString();
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export started');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export data');
    } finally {
      setDownloading(false);
    }
  };

  if (!search) {
    return (
      <Button
        variant="outline"
        size="default"
        onClick={() => handleDownload(true)}
        disabled={downloading}
        className="w-full sm:w-auto"
      >
        {downloading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={downloading} className="w-full sm:w-auto">
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {label}
          <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => handleDownload(false)} className="text-xs">
          Export filtered results
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload(true)} className="text-xs">
          Export all records
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
