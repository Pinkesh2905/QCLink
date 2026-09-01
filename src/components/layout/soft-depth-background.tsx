'use client';

interface SoftDepthBackgroundProps {
  variant?: 'auth' | 'app';
  className?: string;
}

export function SoftDepthBackground({
  variant = 'app',
  className = '',
}: SoftDepthBackgroundProps) {
  const isAuth = variant === 'auth';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none -z-10 ${className}`}
    >
      {/* 1. Layered Ambient Color Glows */}
      {/* Top-Left: Brand Blue */}
      <div
        className={`pointer-events-none absolute rounded-full ${
          isAuth
            ? '-top-24 -left-24 h-[420px] w-[420px] sm:h-[520px] sm:w-[520px] lg:h-[640px] lg:w-[640px] bg-sky-400/18 blur-[90px] lg:blur-[120px]'
            : '-top-32 -left-32 h-[380px] w-[380px] sm:h-[480px] sm:w-[480px] lg:h-[580px] lg:w-[580px] bg-sky-400/7 blur-[90px] lg:blur-[110px]'
        }`}
      />

      {/* Bottom-Right: Brand Teal */}
      <div
        className={`pointer-events-none absolute rounded-full ${
          isAuth
            ? '-bottom-32 -right-32 h-[450px] w-[450px] sm:h-[560px] sm:w-[560px] lg:h-[700px] lg:w-[700px] bg-teal-500/18 blur-[100px] lg:blur-[130px]'
            : '-bottom-36 -right-36 h-[400px] w-[400px] sm:h-[500px] sm:w-[500px] lg:h-[600px] lg:w-[600px] bg-teal-500/8 blur-[100px] lg:blur-[120px]'
        }`}
      />

      {/* Top-Right: Accent Green */}
      <div
        className={`pointer-events-none absolute rounded-full ${
          isAuth
            ? 'top-4 right-[5%] lg:right-[12%] h-[280px] w-[280px] lg:h-[380px] lg:w-[380px] bg-emerald-400/14 blur-[80px] lg:blur-[100px]'
            : 'top-10 right-[8%] lg:right-[15%] h-[260px] w-[260px] lg:h-[340px] lg:w-[340px] bg-emerald-400/6 blur-[80px]'
        }`}
      />

      {/* Bottom-Left: Subtle Ambient Glow */}
      <div
        className={`pointer-events-none absolute rounded-full ${
          isAuth
            ? 'bottom-0 left-[15%] h-[320px] w-[320px] lg:h-[420px] lg:w-[420px] bg-blue-300/12 blur-[90px]'
            : 'bottom-6 left-[10%] h-[280px] w-[280px] lg:h-[360px] lg:w-[360px] bg-blue-300/5 blur-[90px]'
        }`}
      />

      {/* 2. Crisp Dot-Grid Pattern Texture */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={`soft-depth-dots-${variant}`}
            width={isAuth ? '32' : '36'}
            height={isAuth ? '32' : '36'}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="2"
              cy="2"
              r={isAuth ? '1.1' : '1'}
              fill="#64748b"
              fillOpacity={isAuth ? '0.22' : '0.08'}
            />
          </pattern>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={`url(#soft-depth-dots-${variant})`}
        />
      </svg>
    </div>
  );
}
