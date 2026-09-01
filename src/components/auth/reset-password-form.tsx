'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileAuthHeader } from '@/components/auth/mobile-auth-header';
import { Loader2, KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { resetPasswordSchema } from '@/validators/auth';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <div className="w-full max-w-[420px]">
        {/* Mobile Header */}
        <MobileAuthHeader
          heading="Invalid Reset Link"
          subheading="Security token missing or expired"
        />

        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200/80 shadow-xs">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="hidden lg:block text-2xl font-bold tracking-tight text-[#0B1528] xl:text-[28px]">
              Invalid Reset Link
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              This password reset link is missing a security token.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-500 leading-relaxed">
            Please check your email and click the full link, or request a new password reset.
          </div>

          <div className="flex flex-col gap-3">
            <Button
              asChild
              className="h-11 sm:h-12 w-full rounded-xl bg-[#0B1528] text-sm font-semibold text-white shadow-sm hover:bg-[#14223d]"
            >
              <Link href="/forgot-password">Request New Reset Link</Link>
            </Button>
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
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ token, password });
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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-[420px]">
        {/* Mobile Header */}
        <MobileAuthHeader
          heading="Password Reset Successful"
          subheading="You can now sign in with your new password"
        />

        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/80 shadow-xs">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="hidden lg:block text-2xl font-bold tracking-tight text-[#0B1528] xl:text-[28px]">
              Password Reset Successful
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              Your password has been updated. All previous active sessions have been revoked for your security.
            </p>
          </div>

          <Button
            asChild
            className="h-11 sm:h-12 w-full rounded-xl bg-[#0B1528] text-sm font-semibold text-white shadow-sm hover:bg-[#14223d]"
          >
            <Link href="/login">Sign in with New Password</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px]">
      {/* Mobile Distinct Branded Hero Header */}
      <MobileAuthHeader
        heading="Create new password"
        subheading="Enter and confirm your new password below"
      />

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold tracking-tight text-[#0B1528] xl:text-[28px]">
          Create new password
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Please enter and confirm your new password below.
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
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              New Password
            </Label>
            <span className="text-[11px] text-slate-400 font-normal">Min. 8 characters</span>
          </div>
          <div className="relative w-full">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus
              required
              className="h-11 sm:h-12 w-full rounded-xl border-slate-200/90 bg-white px-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs hover:border-slate-300 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/15 transition-all"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-red-600 font-medium">{fieldErrors.password}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-xs font-semibold uppercase tracking-wider text-slate-700 block"
          >
            Confirm Password
          </Label>
          <div className="relative w-full">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              required
              className="h-11 sm:h-12 w-full rounded-xl border-slate-200/90 bg-white px-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs hover:border-slate-300 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/15 transition-all"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-xs text-red-600 font-medium">{fieldErrors.confirmPassword}</p>
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
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          Set New Password
        </Button>
      </form>

      <p className="mt-5 text-center text-xs sm:text-sm text-slate-500">
        <Link
          href="/login"
          className="font-semibold text-teal-700 hover:text-teal-800 hover:underline transition-colors"
        >
          Cancel and return to sign in
        </Link>
      </p>
    </div>
  );
}
