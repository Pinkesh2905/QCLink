'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizeConfig = {
  sm: { width: 34, height: 25, text: 'text-base' },
  md: { width: 44, height: 32, text: 'text-xl' },
  lg: { width: 56, height: 41, text: 'text-2xl' },
};

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const s = sizeConfig[size];

  return (
    <div className={cn('flex items-center gap-3 select-none shrink-0', className)}>
      <img
        src="/logo.svg"
        alt="QCLink Logo"
        width={s.width}
        height={s.height}
        style={{ width: `${s.width}px`, height: `${s.height}px` }}
        className="shrink-0 object-contain block"
      />
      {showText && (
        <span className={cn('tracking-tight text-foreground leading-none font-bold', s.text)}>
          QCLink
        </span>
      )}
    </div>
  );
}
