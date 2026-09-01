'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';

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
    <div className="no-print sticky top-0 z-20 bg-slate-100/95 backdrop-blur-sm border-b sm:border-0 border-slate-200 py-2 sm:py-0 px-3 sm:px-0 max-w-[210mm] mx-auto mb-3 sm:mb-4 flex items-center justify-between gap-2 shadow-xs sm:shadow-none">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBack}
        className="bg-white hover:bg-slate-50 text-slate-700 shadow-sm border-slate-300 h-8 px-2.5 text-xs sm:text-sm sm:px-3 sm:h-9"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Back
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 hidden md:inline">
          Format: A4 Portrait
        </span>
        <Button
          size="sm"
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium h-8 px-3 text-xs sm:text-sm sm:px-4 sm:h-9"
        >
          <Printer className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Print / PDF
        </Button>
      </div>
    </div>
  );
}
