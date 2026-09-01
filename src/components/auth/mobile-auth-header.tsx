'use client';

import { Logo } from '@/components/layout/logo';

interface MobileAuthHeaderProps {
  heading: string;
  subheading: string;
}

export function MobileAuthHeader({ heading, subheading }: MobileAuthHeaderProps) {
  return (
    <div className="relative mb-6 select-none lg:hidden">
      {/* Background Micro Network SVG */}
      <svg
        className="pointer-events-none absolute -left-4 -top-6 h-36 w-full opacity-20"
        viewBox="0 0 360 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mobile-subtle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Faint Grid Connection Nodes */}
        <path
          d="M 20,40 C 90,20 160,60 260,35 S 330,55 360,40"
          fill="none"
          stroke="url(#mobile-subtle-grad)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle cx="20" cy="40" r="2.5" fill="#0284c7" fillOpacity="0.5" />
        <circle cx="160" cy="60" r="2.5" fill="#0d9488" fillOpacity="0.5" />
        <circle cx="260" cy="35" r="3" fill="#059669" fillOpacity="0.6" />
      </svg>

      {/* 1. QCLink Logo */}
      <div className="relative z-10">
        <Logo size="md" />
      </div>

      {/* 2. Brand Tagline (Subtle, smaller than main heading) */}
      <p className="relative z-10 mt-2 text-xs font-medium text-slate-500 tracking-wide">
        Quality control, connected.
      </p>

      {/* 3. Primary Authentication Heading & Subtitle */}
      <div className="relative z-10 mt-6">
        <h2 className="text-2xl font-bold tracking-tight text-[#0B1528] sm:text-3xl">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {subheading}
        </p>
      </div>
    </div>
  );
}
