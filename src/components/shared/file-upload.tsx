'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X, FileText, ExternalLink } from 'lucide-react';

interface FileUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
  uploadType: 'qc-images' | 'invoices';
  accept?: string;
  label?: string;
  disabled?: boolean;
}

export function FileUpload({
  value,
  onChange,
  uploadType,
  accept = 'image/*,.pdf',
  label = 'Upload file',
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', uploadType);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onChange(data.path);
      }
    } catch {
      // Error handled silently
    }

    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  }

  // Get file URL via the authenticated presigned redirect endpoint
  const getFileUrl = (val: string) => {
    const cleanKey = val.startsWith('/uploads/')
      ? val.replace('/uploads/', '')
      : val.startsWith('/')
      ? val.substring(1)
      : val;
    return `/api/files/${cleanKey}`;
  };

  return (
    <div className="space-y-2">
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
        disabled={disabled}
      />

      {value ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-muted/20">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate text-xs font-mono text-muted-foreground">
            {value}
          </span>
          <a
            href={getFileUrl(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium px-2 py-1 rounded hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View
          </a>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onChange(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {label}
        </Button>
      )}
    </div>
  );
}
