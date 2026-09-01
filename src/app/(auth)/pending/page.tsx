import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MobileAuthHeader } from '@/components/auth/mobile-auth-header';
import { Clock, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Awaiting Approval',
  description: 'Your account is pending admin approval',
};

export default function PendingPage() {
  return (
    <div className="w-full">
      {/* Mobile Header */}
      <MobileAuthHeader
        heading="Account Pending Approval"
        subheading="Awaiting administrator review"
      />

      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-xs">
          <Clock className="h-7 w-7" />
        </div>

        <div>
          <h2 className="hidden lg:block text-2xl font-bold tracking-tight text-[#0B1528] sm:text-3xl">
            Account Pending Approval
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            Your account has been created successfully. An administrator needs to
            review and approve your access before you can log in.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-500 leading-relaxed">
          This usually takes a short while. You&apos;ll be able to sign in once
          your account is approved.
        </div>

        <Button
          asChild
          variant="outline"
          className="h-11 sm:h-12 w-full rounded-xl border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}
