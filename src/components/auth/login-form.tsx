'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileAuthHeader } from '@/components/auth/mobile-auth-header';
import { Loader2, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { loginSchema } from '@/validators/auth';

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    // Client-side validation
    const parsed = loginSchema.safeParse(data);
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Login failed');
        return;
      }

      router.replace('/app/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      {/* Mobile Distinct Branded Hero Header */}
      <MobileAuthHeader
        heading="Welcome back"
        subheading="Sign in to continue to QCLink"
      />

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold tracking-tight text-[#0B1528] xl:text-[28px]">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to continue to QCLink
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
        {/* Email Field */}
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

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative w-full">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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

        {/* Primary CTA */}
        <Button
          type="submit"
          disabled={loading}
          className="h-11 sm:h-12 w-full rounded-xl bg-[#0B1528] text-sm font-semibold text-white shadow-sm hover:bg-[#14223d] active:bg-[#080f1e] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer mt-6"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          Sign in
        </Button>
      </form>

      {/* Footer Navigation */}
      <p className="mt-5 text-center text-xs sm:text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-semibold text-teal-700 hover:text-teal-800 hover:underline transition-colors"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
