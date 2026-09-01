'use client';

import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Labeled fieldset wrapper matching the original Clappia form layout.
 * Groups related form fields under a section heading.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <fieldset className={cn('space-y-4 min-w-0 max-w-full', className)}>
      <div className="space-y-1">
        <legend className="text-sm sm:text-base font-semibold text-foreground">{title}</legend>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
        {children}
      </div>
    </fieldset>
  );
}
