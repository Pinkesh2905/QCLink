'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlanStatusBadge } from '@/components/subscription/plan-status-badge';
import { AddUserDialog } from '@/components/admin/add-user-dialog';
import { formatDateIST, formatDateTimeIST } from '@/lib/datetime';
import { ArrowLeft, Loader2, Plus, Save, UserPlus } from 'lucide-react';
import type { SubscriptionSummary } from '@/lib/subscriptions';
import type { Company, UserWithCompany } from '@/types/db';

interface CompanyDetail {
  company: Company;
  subscription: SubscriptionSummary;
  users: UserWithCompany[];
}

type DetailField = 'CompanyName' | 'ContactName' | 'ContactEmail' | 'ContactPhone' | 'Address';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function CompanyDetailPage({ params }: { params: Promise<{ companyID: string }> }) {
  const { companyID } = use(params);
  const [data, setData] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<DetailField, string>>({
    CompanyName: '', ContactName: '', ContactEmail: '', ContactPhone: '', Address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [extending, setExtending] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/companies/${companyID}`);
      if (!res.ok) {
        toast.error('Failed to load company');
        return;
      }
      const json: CompanyDetail = await res.json();
      setData(json);
      setForm({
        CompanyName: json.company.CompanyName ?? '',
        ContactName: json.company.ContactName ?? '',
        ContactEmail: json.company.ContactEmail ?? '',
        ContactPhone: json.company.ContactPhone ?? '',
        Address: json.company.Address ?? '',
      });
    } catch {
      toast.error('Network error loading company');
    } finally {
      setLoading(false);
    }
  }, [companyID]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateCompany = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/companies/${companyID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { res, json: await res.json() };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { res, json } = await updateCompany(form);
      if (res.ok) {
        toast.success(json.message);
        await fetchData();
      } else if (json.details) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(json.details)) {
          next[key] = (messages as string[])[0];
        }
        setErrors(next);
      } else if (json.field) {
        setErrors({ [json.field]: json.error });
      } else {
        toast.error(json.error || 'Failed to save company');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!data) return;
    const next = data.company.IsActive ? 0 : 1;
    if (next === 0 && !window.confirm(`Suspend ${data.company.CompanyName}? Its users will be signed out and blocked until reactivated.`)) {
      return;
    }
    setTogglingActive(true);
    try {
      const { res, json } = await updateCompany({ IsActive: next });
      if (res.ok) {
        toast.success(next ? 'Company reactivated' : 'Company suspended');
        await fetchData();
      } else {
        toast.error(json.error || 'Failed to update company');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleExtend = async () => {
    setExtending(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyID}/subscriptions`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Plan active through ${formatDateIST(json.endDate)}`);
        await fetchData();
      } else {
        toast.error(json.error || 'Failed to extend plan');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setExtending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Company not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/admin/companies">Back to companies</Link>
        </Button>
      </div>
    );
  }

  const { company, subscription: sub } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" className="shrink-0" asChild>
            <Link href="/app/admin/companies" aria-label="Back to companies">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold truncate flex items-center gap-2">
              {company.CompanyName}
              {!company.IsActive && (
                <Badge className="bg-red-50 text-red-700 border-red-300">Suspended</Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">Added {formatDateIST(company.CreatedAt)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleActive}
          disabled={togglingActive}
          className={company.IsActive ? 'text-destructive hover:bg-destructive/10' : 'text-emerald-700 hover:bg-emerald-50'}
        >
          {togglingActive && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {company.IsActive ? 'Suspend company' : 'Reactivate company'}
        </Button>
      </div>

      {/* Plan */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              Plan
              <PlanStatusBadge status={sub.status} />
            </CardTitle>
            <CardDescription>
              {sub.endDate
                ? `${sub.status === 'active' ? 'Active through' : 'Ended on'} ${formatDateIST(sub.endDate)}`
                : 'No plan — users of this company cannot sign in.'}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleExtend} disabled={extending} className="shrink-0">
            {extending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            {sub.status === 'none' ? 'Start 3 months' : 'Add 3 months'}
          </Button>
        </CardHeader>
        {(sub.periods.length > 0 || sub.payments.length > 0) && (
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-1">
              {sub.periods.map((p) => (
                <div key={p.SubscriptionID} className="flex justify-between gap-3 text-muted-foreground">
                  <span>{formatDateIST(p.StartDate)} – {formatDateIST(p.EndDate)}</span>
                  <span>{p.Source === 'Payment' ? 'Paid' : 'Granted'}</span>
                </div>
              ))}
            </div>
            {sub.payments.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                {sub.payments.map((pay) => (
                  <div key={pay.PaymentID} className="flex justify-between gap-3 text-muted-foreground">
                    <span className="font-mono">{pay.GatewayReference}</span>
                    <span>
                      {inr.format(Number(pay.Amount))} · {formatDateTimeIST(pay.PaidAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Company name</Label>
                <Input
                  id="d-name"
                  value={form.CompanyName}
                  onChange={(e) => setForm((f) => ({ ...f, CompanyName: e.target.value }))}
                  required
                />
                {errors.CompanyName && <p className="text-xs text-destructive">{errors.CompanyName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-contact">Contact name</Label>
                <Input
                  id="d-contact"
                  value={form.ContactName}
                  onChange={(e) => setForm((f) => ({ ...f, ContactName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-email">Contact email</Label>
                <Input
                  id="d-email"
                  type="email"
                  value={form.ContactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, ContactEmail: e.target.value }))}
                />
                {errors.ContactEmail && <p className="text-xs text-destructive">{errors.ContactEmail}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-phone">Contact phone</Label>
                <Input
                  id="d-phone"
                  value={form.ContactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, ContactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-address">Address</Label>
              <Textarea
                id="d-address"
                rows={2}
                value={form.Address}
                onChange={(e) => setForm((f) => ({ ...f, Address: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save details
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Users</CardTitle>
            <CardDescription>{data.users.length} in this company</CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddUserOpen(true)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Add user
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No users yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.users.map((u) => (
                    <TableRow key={u.UserID}>
                      <TableCell className="font-medium">{u.Name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.Email}</TableCell>
                      <TableCell>{u.Role}</TableCell>
                      <TableCell>{u.Status}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onCreated={fetchData}
        companies={[{ CompanyID: company.CompanyID, CompanyName: company.CompanyName }]}
        fixedCompanyId={company.CompanyID}
      />
    </div>
  );
}
