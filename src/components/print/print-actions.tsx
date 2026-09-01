'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Download } from 'lucide-react';

interface PrintActionsProps {
  backUrl?: string;
  documentTitle: string;
}

export function PrintActions({ backUrl, documentTitle }: PrintActionsProps) {
  const router = useRouter();

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  return (
    <div className="no-print max-w-[210mm] mx-auto mb-4 px-4 sm:px-0 flex items-center justify-between gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBack}
        className="bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-300"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 hidden sm:inline">
          Format: A4 Portrait
        </span>
        <Button
          size="sm"
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium"
        >
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>
    </div>
  );
}
