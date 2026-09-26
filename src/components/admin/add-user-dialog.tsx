'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface CompanyOption {
  CompanyID: number;
  CompanyName: string;
}

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  companies: CompanyOption[];
  /** Pre-selects and locks the company (when opened from a company's page). */
  fixedCompanyId?: number;
}

const EMPTY_FORM = { Name: '', Email: '', Password: '', Role: 'User', CompanyID: '' };

export function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
  companies,
  fixedCompanyId,
}: AddUserDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, CompanyID: fixedCompanyId ? String(fixedCompanyId) : '' });
      setErrors({});
    }
  }, [open, fixedCompanyId]);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          CompanyID: form.CompanyID ? Number(form.CompanyID) : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`User ${form.Name} created`);
        onOpenChange(false);
        onCreated();
      } else if (json.details) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(json.details)) {
          next[key] = (messages as string[])[0];
        }
        setErrors(next);
      } else if (json.field) {
        setErrors({ [json.field]: json.error });
      } else {
        toast.error(json.error || 'Failed to create user');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Share the initial password with the user directly — they can change it any time with
              &ldquo;Forgot password&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="new-user-name">Name</Label>
            <Input
              id="new-user-name"
              value={form.Name}
              onChange={(e) => setField('Name', e.target.value)}
              required
            />
            {errors.Name && <p className="text-xs text-destructive">{errors.Name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              value={form.Email}
              onChange={(e) => setField('Email', e.target.value)}
              required
            />
            {errors.Email && <p className="text-xs text-destructive">{errors.Email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Initial password</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              value={form.Password}
              onChange={(e) => setField('Password', e.target.value)}
              required
              minLength={8}
            />
            {errors.Password && <p className="text-xs text-destructive">{errors.Password}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={form.CompanyID}
                onValueChange={(v) => setField('CompanyID', v)}
                disabled={!!fixedCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.CompanyID} value={String(c.CompanyID)}>
                      {c.CompanyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.CompanyID && <p className="text-xs text-destructive">{errors.CompanyID}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.Role} onValueChange={(v) => setField('Role', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Admin">Admin (Vezapp staff)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
