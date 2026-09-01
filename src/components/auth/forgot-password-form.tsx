'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileAuthHeader } from '@/components/auth/mobile-auth-header';
import { Loader2, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { forgotPasswordSchema } from '@/validators/auth';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
    };

    // Client-side validation
    const parsed = forgotPasswordSchema.safeParse(data);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to submit password reset request');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-[420px]">
        {/* Mobile Header */}
        <MobileAuthHeader
          heading="Check your email"
          subheading="Password reset instructions sent"
        />

        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/80 shadow-xs">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="hidden lg:block text-2xl font-bold tracking-tight text-[#0B1528] xl:text-[28px]">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              If an active account exists for that email address, we have sent instructions to reset your password.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-500 leading-relaxed">
            Please check your inbox (and spam folder) for the password reset link. The link expires in 30 minutes.
          </div>

          <Button
            asChild
            variant="outline"
            className="h-11 sm:h-12 w-full rounded-xl border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px]">
      {/* Mobile Distinct Branded Hero Header */}
      <MobileAuthHeader
        heading="Forgot password"
        subheading="Enter your email to receive a password reset link"
      />

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold tracking-tight text-[#0B1528] xl:text-[28px]">
          Forgot password
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {/* Form Error Banner */}
      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200/80 bg-red-50/90 px-3.5 py-2.5 text-xs text-red-700 transition-all"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-7 space-y-4 sm:space-y-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-wider text-slate-700 block"
          >
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            required
            className="h-11 sm:h-12 w-full rounded-xl border-slate-200/90 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs hover:border-slate-300 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/15 transition-all"
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-600 font-medium">{fieldErrors.email}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 sm:h-12 w-full rounded-xl bg-[#0B1528] text-sm font-semibold text-white shadow-sm hover:bg-[#14223d] active:bg-[#080f1e] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer mt-6"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Send reset link
        </Button>
      </form>

      {/* Footer Navigation */}
      <p className="mt-5 text-center text-xs sm:text-sm text-slate-500">
        Remember your password?{' '}
        <Link
          href="/login"
          className="font-semibold text-teal-700 hover:text-teal-800 hover:underline transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
