'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSection } from '@/components/shared/form-section';
import { HistoryModal } from '@/components/shared/history-modal';
import { useSession } from '@/hooks/use-session';
import { useFieldPermissions } from '@/hooks/use-field-permissions';
import { createEmployeeSchema, updateEmployeeSchema } from '@/validators/employee';
import { Loader2, History, ArrowLeft, Save, TriangleAlert } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/datetime';
import type { EmployeeWithOwner } from '@/types/db';

interface EmployeeFormProps {
  initialData?: EmployeeWithOwner & { HasLogin?: number };
  isEdit?: boolean;
}

export function EmployeeForm({ initialData, isEdit = false }: EmployeeFormProps) {
  const router = useRouter();
  const { user } = useSession();
  const { isFieldDisabled } = useFieldPermissions();
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    EmployeeName: initialData?.EmployeeName || '',
    Email: initialData?.Email || '',
    Department: initialData?.Department || '',
    Designation: initialData?.Designation || '',
    Phone: initialData?.Phone || '',
    IsActive: initialData ? (initialData.IsActive ? 'true' : 'false') : 'true',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setGeneralError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setGeneralError(null);

    const payload = {
      EmployeeName: formData.EmployeeName.trim(),
      Email: formData.Email.trim(),
      Department: formData.Department.trim() || null,
      Designation: formData.Designation.trim() || null,
      Phone: formData.Phone.trim() || null,
      IsActive: formData.IsActive === 'true',
    };

    const schema = isEdit ? updateEmployeeSchema : createEmployeeSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/employees/${initialData?.EmployeeUID}` : '/api/employees';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.field) setFieldErrors({ [json.field]: json.error });
        if (json.details) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(json.details)) {
            mapped[k] = Array.isArray(v) ? (v[0] as string) : String(v);
          }
          setFieldErrors(mapped);
        }
        const msg = json.error || 'Failed to save employee';
        setGeneralError(msg);
        toast.error(msg);
        return;
      }

      toast.success(isEdit ? 'Employee updated successfully' : 'Employee created successfully');
      router.push('/app/employee-master');
      router.refresh();
    } catch {
      const err = 'A network error occurred. Please try again.';
      setGeneralError(err);
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/app/employee-master')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isEdit ? `Edit Employee: ${initialData?.EmployeeUID}` : 'New Employee'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update this employee\'s details' : 'Add a person who can be picked as an inspection report reviewer'}
            </p>
          </div>
        </div>

        {isEdit && initialData && (
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
        )}
      </div>

      {generalError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {generalError}
        </div>
      )}

      {isEdit && initialData && !initialData.HasLogin && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No active QCLink user has this email address yet, so this person cannot sign in to review reports.
            Ask your administrator to create a QCLink login with the same email.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 rounded-lg border bg-card p-4 sm:p-6 shadow-sm min-w-0 max-w-full">
        {isEdit && initialData && (
          <FormSection
            title="System Information"
            description="System-managed identifiers and ownership information (read-only)"
          >
            <div className="space-y-2">
              <Label className="text-muted-foreground">Employee UID</Label>
              <Input value={initialData.EmployeeUID} disabled className="bg-muted text-muted-foreground font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Owner</Label>
              <Input value={initialData.OwnerName || `User #${initialData.OwnerUserID}`} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Created At</Label>
              <Input value={formatDateTimeIST(initialData.CreatedAt, { second: '2-digit' })} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Updated At</Label>
              <Input value={formatDateTimeIST(initialData.UpdatedAt, { second: '2-digit' })} disabled className="bg-muted text-muted-foreground" />
            </div>
          </FormSection>
        )}

        <FormSection
          title="Employee Details"
          description="The name and email are what an inspection report shows and where its review request is sent"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="EmployeeName">
              Employee Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="EmployeeName"
              value={formData.EmployeeName}
              onChange={(e) => handleChange('EmployeeName', e.target.value)}
              placeholder="e.g. Anita Sharma"
              required
              maxLength={150}
              disabled={isFieldDisabled('Employees', 'EmployeeName', isEdit, user?.Role)}
            />
            {fieldErrors.EmployeeName && <p className="text-xs text-destructive">{fieldErrors.EmployeeName}</p>}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="Email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="Email"
              type="email"
              value={formData.Email}
              onChange={(e) => handleChange('Email', e.target.value)}
              placeholder="name@company.com"
              required
              maxLength={255}
              disabled={isFieldDisabled('Employees', 'Email', isEdit, user?.Role)}
            />
            <p className="text-xs text-muted-foreground">
              To review a report, this person signs in to QCLink with this same email address.
            </p>
            {fieldErrors.Email && <p className="text-xs text-destructive">{fieldErrors.Email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="Department">Department</Label>
            <Input
              id="Department"
              value={formData.Department}
              onChange={(e) => handleChange('Department', e.target.value)}
              placeholder="e.g. Quality"
              maxLength={100}
              disabled={isFieldDisabled('Employees', 'Department', isEdit, user?.Role)}
            />
            {fieldErrors.Department && <p className="text-xs text-destructive">{fieldErrors.Department}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="Designation">Designation</Label>
            <Input
              id="Designation"
              value={formData.Designation}
              onChange={(e) => handleChange('Designation', e.target.value)}
              placeholder="e.g. QA Manager"
              maxLength={100}
              disabled={isFieldDisabled('Employees', 'Designation', isEdit, user?.Role)}
            />
            {fieldErrors.Designation && <p className="text-xs text-destructive">{fieldErrors.Designation}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="Phone">Phone</Label>
            <Input
              id="Phone"
              value={formData.Phone}
              onChange={(e) => handleChange('Phone', e.target.value)}
              placeholder="e.g. +91 98765 43210"
              maxLength={30}
              disabled={isFieldDisabled('Employees', 'Phone', isEdit, user?.Role)}
            />
            {fieldErrors.Phone && <p className="text-xs text-destructive">{fieldErrors.Phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="IsActive">Status</Label>
            <Select
              value={formData.IsActive}
              onValueChange={(val) => handleChange('IsActive', val)}
              disabled={isFieldDisabled('Employees', 'IsActive', isEdit, user?.Role)}
            >
              <SelectTrigger id="IsActive">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive (hidden from the reviewer list)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/app/employee-master')}>
            Cancel
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={loading || !!user?.ReadOnly}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Employee'}
          </Button>
        </div>
      </form>

      {isEdit && initialData && (
        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          tableName="Employees"
          recordId={initialData.EmployeeUID}
          title={`History — Employee ${initialData.EmployeeUID}`}
        />
      )}
    </div>
  );
}
