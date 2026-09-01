'use client';

import { Logo } from '@/components/layout/logo';
import {
  ClipboardCheck,
  Layers,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Cpu,
} from 'lucide-react';

export function ContinuousAuthCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-[#f8fafc] via-[#f1f8f6]/50 to-[#edf5fa] selection:bg-teal-100 selection:text-teal-900">
      
      {/* ========================================================================= */}
      {/* 1. "Soft Depth" Layered Ambient Color Glows (Brand Blue, Teal, Green)   */}
      {/* ========================================================================= */}
      {/* Top-Left: Large Brand Blue Glow */}
      <div 
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] sm:h-[520px] sm:w-[520px] lg:h-[640px] lg:w-[640px] rounded-full bg-sky-400/18 blur-[90px] lg:blur-[120px]"
      />
      {/* Bottom-Right: Large Brand Teal Glow */}
      <div 
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 h-[450px] w-[450px] sm:h-[560px] sm:w-[560px] lg:h-[700px] lg:w-[700px] rounded-full bg-teal-500/18 blur-[100px] lg:blur-[130px]"
      />
      {/* Top-Right: Subtle Accent Green Glow */}
      <div 
        aria-hidden="true"
        className="pointer-events-none absolute top-4 right-[5%] lg:right-[12%] h-[280px] w-[280px] lg:h-[380px] lg:w-[380px] rounded-full bg-emerald-400/14 blur-[80px] lg:blur-[100px]"
      />
      {/* Bottom-Left: Subtle Ambient Teal-Blue Softener */}
      <div 
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-[15%] h-[320px] w-[320px] lg:h-[420px] lg:w-[420px] rounded-full bg-blue-300/12 blur-[90px]"
      />

      {/* ========================================================================= */}
      {/* 2. Crisp, Visible Dot-Grid Texture & Global SVG Network                   */}
      {/* ========================================================================= */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Tighter, crisp dot-grid pattern with muted gray dots */}
          <pattern
            id="canvas-dot-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.1" fill="#64748b" fillOpacity="0.22" />
          </pattern>
          <linearGradient id="canvas-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#0d9488" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="canvas-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#canvas-dot-grid)" />

        {/* Global Connection Paths flowing across the entire canvas */}
        <path
          d="M 100,160 C 260,100 380,260 540,200 S 820,140 1060,180 S 1420,120 1680,220"
          fill="none"
          stroke="url(#canvas-grad-1)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        <path
          d="M 140,460 C 320,380 460,540 680,440 S 960,480 1200,400 S 1480,500 1720,440"
          fill="none"
          stroke="url(#canvas-grad-2)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <path
          d="M 240,680 C 420,600 580,720 820,640 S 1180,680 1440,600"
          fill="none"
          stroke="url(#canvas-grad-1)"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />

        {/* Connection Nodes */}
        <circle cx="100" cy="160" r="3.5" fill="#0284c7" fillOpacity="0.6" />
        <circle cx="540" cy="200" r="4.5" fill="#0d9488" fillOpacity="0.7" />
        <circle cx="1060" cy="180" r="3.5" fill="#059669" fillOpacity="0.5" />
        <circle cx="140" cy="460" r="3.5" fill="#0284c7" fillOpacity="0.5" />
        <circle cx="680" cy="440" r="4.5" fill="#0d9488" fillOpacity="0.6" />
        <circle cx="1200" cy="400" r="3.5" fill="#0284c7" fillOpacity="0.5" />
      </svg>

      {/* High-contrast legibility glow behind the form area to keep text & inputs crystal clear */}
      <div 
        aria-hidden="true"
        className="pointer-events-none absolute right-[10%] xl:right-[18%] top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-white/75 blur-3xl opacity-90"
      />

      {/* ========================================================================= */}
      {/* 3. Global Centered Desktop Composition Grid                               */}
      {/* ========================================================================= */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] xl:max-w-[1280px] flex-col justify-between px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 xl:gap-16 w-full my-auto py-2">
          
          {/* Left Column (Brand + Quality Process Ecosystem) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col max-w-[540px] z-10">
            <Logo size="lg" />
            <div className="mt-8">
              {/* Natural line wrap without awkward dangling words */}
              <h1 className="text-3xl font-bold tracking-tight text-[#0B1528] xl:text-[38px] xl:leading-[1.2] max-w-xl">
                Quality control, connected.
              </h1>
              <p className="mt-3 text-sm lg:text-[15px] leading-relaxed text-slate-600 max-w-[460px]">
                Connect quality processes, inspections, production data and teams in one place.
              </p>
            </div>

            {/* Quality Process Ecosystem Cards Stack */}
            <div className="mt-10 xl:mt-12 w-full max-w-[420px] space-y-3.5 select-none">
              {/* Card 1: Incoming Inspection */}
              <div className="animate-auth-float-1 flex items-center justify-between rounded-xl border border-slate-200/75 bg-white/85 px-4 py-3 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.06)] backdrop-blur-xs transition-all hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-100">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Incoming Inspection</p>
                    <p className="text-[11px] text-slate-500">Batch #4092 • Raw Materials</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 className="h-3 w-3" />
                  100% Passed
                </span>
              </div>

              {/* Card 2: QC Specs & Tolerances */}
              <div className="animate-auth-float-2 ml-5 flex items-center justify-between rounded-xl border border-slate-200/75 bg-white/85 px-4 py-3 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.06)] backdrop-blur-xs transition-all hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">QC Specification Master</p>
                    <p className="text-[11px] text-slate-500">Critical limits & standard tests</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 border border-sky-200/60">
                  Active Spec
                </span>
              </div>

              {/* Card 3: Real-Time Quality Analysis */}
              <div className="animate-auth-float-1 ml-2 flex items-center justify-between rounded-xl border border-slate-200/75 bg-white/85 px-4 py-3 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.06)] backdrop-blur-xs transition-all hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Live Quality Metrics</p>
                    <p className="text-[11px] text-slate-500">Zero non-conformance detected</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200/60">
                  <Cpu className="h-3 w-3" />
                  99.8% Yield
                </span>
              </div>

              {/* Card 4: Audit & Release */}
              <div className="animate-auth-float-2 ml-7 flex items-center justify-between rounded-xl border border-slate-200/75 bg-white/85 px-4 py-3 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.06)] backdrop-blur-xs transition-all hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Audit & Decision</p>
                    <p className="text-[11px] text-slate-500">Approved for release</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </span>
              </div>
            </div>
          </div>

          {/* Right Column (Authentication Floating Controls - Vertically Centered) */}
          <div className="col-span-1 lg:col-span-5 flex flex-col justify-center items-center lg:items-start z-10 my-auto">
            <div className="w-full max-w-[420px]">
              {children}
            </div>
          </div>

        </div>

        {/* Subtle Footer */}
        <footer className="mt-8 text-center z-10">
          <p className="text-xs text-slate-400 font-normal">
            © 2026 QCLink — Quality Control Management
          </p>
        </footer>

      </div>
    </div>
  );
}
