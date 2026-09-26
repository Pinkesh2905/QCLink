'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlanStatusBadge } from '@/components/subscription/plan-status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateIST, formatDateTimeIST } from '@/lib/datetime';
import { Loader2, CreditCard } from 'lucide-react';
import type { SubscriptionSummary } from '@/lib/subscriptions';
import type { SubscriptionPlan } from '@/lib/plans';

interface SubscriptionResponse extends SubscriptionSummary {
  companyName: string | null;
  plan: SubscriptionPlan;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function SubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscription');
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error('Failed to load subscription');
      }
    } catch {
      toast.error('Network error loading subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await fetch('/api/subscription/renew', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Payment successful — plan active through ${formatDateIST(json.endDate)}`);
        setCheckoutOpen(false);
        await fetchData();
        // Re-render the server layout so the session (read-only flag, banner) updates.
        router.refresh();
      } else {
        toast.error(json.error || 'Payment failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const renewLabel = data.status === 'active' ? 'Extend plan' : 'Renew plan';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Subscription</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          QCLink plan for {data.companyName ?? 'your company'}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {data.plan.label}
              <PlanStatusBadge status={data.status} />
            </CardTitle>
            <CardDescription>
              {data.status === 'active' && data.endDate && (
                <>
                  Active through <span className="font-medium text-foreground">{formatDateIST(data.endDate)}</span>
                  {data.daysLeft !== null && ` · ${data.daysLeft} day${data.daysLeft === 1 ? '' : 's'} left`}
                </>
              )}
              {data.status === 'expired' && data.endDate && (
                <>
                  Ended on <span className="font-medium text-foreground">{formatDateIST(data.endDate)}</span>.
                  Your data is view-only until you renew.
                </>
              )}
              {data.status === 'none' && 'Your company has no QCLink plan yet.'}
            </CardDescription>
          </div>
          <Button onClick={() => setCheckoutOpen(true)} className="w-full sm:w-auto shrink-0">
            <CreditCard className="mr-2 h-4 w-4" />
            {renewLabel}
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {data.plan.months} months of full access for {inr.format(data.plan.priceINR)}. Renewing early
          adds the new period after your current end date, so no days are lost.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.periods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                      No plan periods yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.periods.map((p) => (
                    <TableRow key={p.SubscriptionID}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateIST(p.StartDate)} – {formatDateIST(p.EndDate)}
                      </TableCell>
                      <TableCell>{p.PlanCode === data.plan.code ? data.plan.label : p.PlanCode}</TableCell>
                      <TableCell>{p.Source === 'Payment' ? 'Payment' : 'Granted by Vezapp'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No payments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.payments.map((p) => (
                    <TableRow key={p.PaymentID}>
                      <TableCell className="whitespace-nowrap">{formatDateTimeIST(p.PaidAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.GatewayReference}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr.format(Number(p.Amount))}</TableCell>
                      <TableCell>{p.Status}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={checkoutOpen} onOpenChange={(open) => !paying && setCheckoutOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renewLabel}</DialogTitle>
            <DialogDescription>
              Test mode — no real payment is taken. This records a dummy payment and extends your plan.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{data.plan.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium">{data.companyName}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{inr.format(data.plan.priceINR)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={paying}>
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={paying}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pay {inr.format(data.plan.priceINR)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
