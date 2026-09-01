import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new password for your QCLink account',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </Card>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
