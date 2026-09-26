'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { PlanStatusBadge } from '@/components/subscription/plan-status-badge';
import { formatDateIST } from '@/lib/datetime';
import { todayIST } from '@/lib/plans';
import { Building2, Loader2, Plus } from 'lucide-react';
import type { CompanyWithStats } from '@/types/db';

const EMPTY_FORM = {
  CompanyName: '',
  ContactName: '',
  ContactEmail: '',
  ContactPhone: '',
  Address: '',
};

function planStatus(endDate: string | null) {
  if (!endDate) return 'none' as const;
  return endDate >= todayIST() ? ('active' as const) : ('expired' as const);
}

function PlanCell({ endDate }: { endDate: string | null }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <PlanStatusBadge status={planStatus(endDate)} />
      {endDate && <span className="text-xs text-muted-foreground">until {formatDateIST(endDate)}</span>}
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/companies');
      if (res.ok) setCompanies(await res.json());
      else toast.error('Failed to load companies');
    } catch {
      toast.error('Network error loading companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`${form.CompanyName} created`);
        setCreateOpen(false);
        router.push(`/app/admin/companies/${json.CompanyID}`);
      } else if (json.details) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(json.details)) {
          next[key] = (messages as string[])[0];
        }
        setErrors(next);
      } else if (json.field) {
        setErrors({ [json.field]: json.error });
      } else {
        toast.error(json.error || 'Failed to create company');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Companies
          </h3>
          <p className="text-sm text-muted-foreground">
            Each company only sees its own data.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add company
        </Button>
      </div>

      <div className="hidden sm:block rounded-lg border bg-card overflow-x-auto max-w-full">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right w-20">Users</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  No companies yet
                </TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <TableRow
                  key={c.CompanyID}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/app/admin/companies/${c.CompanyID}`)}
                >
                  <TableCell>
                    <div className="font-medium">{c.CompanyName}</div>
                    {c.ContactEmail && <div className="text-xs text-muted-foreground">{c.ContactEmail}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.UserCount}</TableCell>
                  <TableCell>
                    <PlanCell endDate={c.PlanEndDate} />
                  </TableCell>
                  <TableCell>
                    {c.IsActive ? (
                      <Badge variant="outline">Active</Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-300">Suspended</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Card list — below sm */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="rounded-lg border h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-lg border h-32 flex items-center justify-center text-sm text-muted-foreground">
            No companies yet
          </div>
        ) : (
          companies.map((c) => (
            <button
              key={c.CompanyID}
              type="button"
              onClick={() => router.push(`/app/admin/companies/${c.CompanyID}`)}
              className="w-full text-left rounded-lg border bg-card p-3.5 space-y-2 active:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.CompanyName}</span>
                {!c.IsActive && (
                  <Badge className="bg-red-50 text-red-700 border-red-300 shrink-0">Suspended</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{c.UserCount} users</div>
              <div className="pt-1.5 border-t flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Plan</span>
                <PlanCell endDate={c.PlanEndDate} />
              </div>
            </button>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add company</DialogTitle>
              <DialogDescription>
                The company starts on a 3-month plan today. You can add users after saving.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={form.CompanyName}
                onChange={(e) => setField('CompanyName', e.target.value)}
                required
              />
              {errors.CompanyName && <p className="text-xs text-destructive">{errors.CompanyName}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Contact name</Label>
                <Input
                  id="contact-name"
                  value={form.ContactName}
                  onChange={(e) => setField('ContactName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Contact phone</Label>
                <Input
                  id="contact-phone"
                  value={form.ContactPhone}
                  onChange={(e) => setField('ContactPhone', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Contact email</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.ContactEmail}
                onChange={(e) => setField('ContactEmail', e.target.value)}
              />
              {errors.ContactEmail && <p className="text-xs text-destructive">{errors.ContactEmail}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-address">Address</Label>
              <Textarea
                id="company-address"
                rows={2}
                value={form.Address}
                onChange={(e) => setField('Address', e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create company
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
