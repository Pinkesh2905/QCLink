import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Awaiting Approval',
  description: 'Your account is pending admin approval',
};

export default function PendingPage() {
  return (
    <Card className="text-center">
      <CardHeader className="space-y-4 pb-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Clock className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold">
          Account Pending Approval
        </CardTitle>
        <CardDescription className="text-base">
          Your account has been created successfully. An administrator needs to
          review and approve your access before you can log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This usually takes a short while. You&apos;ll be able to sign in once
          your account is approved.
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button variant="outline" asChild>
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
