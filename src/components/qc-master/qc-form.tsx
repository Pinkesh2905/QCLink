'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSection } from '@/components/shared/form-section';
import { ItemCombobox } from '@/components/shared/item-combobox';
import { FileUpload } from '@/components/shared/file-upload';
import { HistoryModal } from '@/components/shared/history-modal';
import { SpecGrid } from './spec-grid';
import { useLookup } from '@/hooks/use-lookup';
import { useSession } from '@/hooks/use-session';
import { useFieldPermissions } from '@/hooks/use-field-permissions';
import { createQCMasterSchema, updateQCMasterSchema, type QCSpecInputSchema } from '@/validators/qc-master';
import { Loader2, History, ArrowLeft, Save, Printer } from 'lucide-react';
import type { QCMasterDetailResponse } from '@/types/api';

interface QCFormProps {
  initialData?: QCMasterDetailResponse;
  isEdit?: boolean;
}

export function QCForm({ initialData, isEdit = false }: QCFormProps) {
  const router = useRouter();
  const { user } = useSession();
  const { isFieldDisabled } = useFieldPermissions();
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Lookups
  const { options: criteriaList } = useLookup('specification-criteria', isEdit);
  const { options: methods } = useLookup('method-of-inspection', isEdit);
  const { options: frequencies } = useLookup('inspection-frequency', isEdit);
  const { options: responsibilities } = useLookup('responsibility', isEdit);
  const { options: reactionPlans } = useLookup('reaction-plan', isEdit);

  // Initial Specs
  const initialSpecs: QCSpecInputSchema[] = initialData?.Specifications?.map((s) => ({
    SrNo: s.SrNo,
    Parameter: s.Parameter,
    CriteriaID: s.CriteriaID,
    MinVal: s.MinVal,
    MaxVal: s.MaxVal,
    OtherValue: s.OtherValue,
    MethodID: s.MethodID,
    FrequencyID: s.FrequencyID,
    ResponsibilityID: s.ResponsibilityID,
    ReactionPlanID: s.ReactionPlanID,
  })) || [
    {
      SrNo: 1,
      Parameter: '',
      CriteriaID: criteriaList[0]?.id || 1,
      MinVal: null,
      MaxVal: null,
      OtherValue: null,
      MethodID: methods[0]?.id || 1,
      FrequencyID: frequencies[0]?.id || 1,
      ResponsibilityID: responsibilities[0]?.id || 1,
      ReactionPlanID: reactionPlans[0]?.id || 1,
    },
  ];

  const [itemUID, setItemUID] = useState(initialData?.ItemUID || '');
  const [itemName, setItemName] = useState(initialData?.ItemName || '');
  const [imagePath, setImagePath] = useState<string | null>(initialData?.ImagePath || null);
  const [specs, setSpecs] = useState<QCSpecInputSchema[]>(initialSpecs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneralError(null);

    const parsed = (isEdit ? updateQCMasterSchema : createQCMasterSchema).safeParse({
      ItemUID: itemUID,
      ItemName: itemName,
      ImagePath: imagePath,
      Specifications: specs,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const msg = firstError ? `${firstError.path.join('.')}: ${firstError.message}` : 'Validation failed';
      setGeneralError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/qc-master/${initialData?.QCUID}` : '/api/qc-master';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json();

      if (!res.ok) {
        const err = json.error || 'Failed to save QC Master';
        setGeneralError(err);
        toast.error(err);
        return;
      }

      toast.success(isEdit ? 'QC Specification template updated' : 'QC Specification template created');
      router.push('/app/qc-master');
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
          <Button variant="outline" size="icon" onClick={() => router.push('/app/qc-master')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isEdit ? `QC Template: ${initialData?.QCUID}` : 'New QC Specification Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Manage QC specifications and testing parameters' : 'Create inspection criteria template for an inventory item'}
            </p>
          </div>
        </div>

        {isEdit && initialData && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`/print/qc-master/${initialData.QCUID}`, '_blank')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          </div>
        )}
      </div>

      {generalError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 rounded-lg border bg-card p-4 sm:p-6 shadow-sm min-w-0 max-w-full">
        {/* System Locked Fields (edit mode) */}
        {isEdit && initialData && (
          <FormSection
            title="System Information"
            description="System-managed identifiers and ownership information (read-only)"
          >
            <div className="space-y-2">
              <Label className="text-muted-foreground">QC UID</Label>
              <Input value={initialData.QCUID} disabled className="bg-muted text-muted-foreground font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Submission ID</Label>
              <Input value={initialData.SubmissionID || '—'} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Owner</Label>
              <Input value={initialData.OwnerName || `User #${initialData.OwnerUserID}`} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Created At</Label>
              <Input
                value={new Date(initialData.CreatedAt).toLocaleString('en-IN')}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Updated At</Label>
              <Input
                value={new Date(initialData.UpdatedAt).toLocaleString('en-IN')}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          </FormSection>
        )}

        {/* QC Header Section */}
        <FormSection
          title="QC Item"
          description="Select the store item and optional technical drawing or reference image"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-select">
              Select Item <span className="text-destructive">*</span>
            </Label>
            <ItemCombobox
              value={itemUID}
              onSelect={(selected) => {
                setItemUID(selected.ItemUID);
                setItemName(selected.ItemName);
              }}
              disabled={isEdit}
              placeholder="Search and select an item..."
            />
          </div>

          <div className="space-y-2">
            <Label>Item UID</Label>
            <Input value={itemUID || '—'} disabled className="bg-muted font-mono" />
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label>Technical Reference Image (optional)</Label>
            <FileUpload
              value={imagePath}
              onChange={setImagePath}
              uploadType="qc-images"
              accept="image/*"
              label="Upload QC Reference Image"
              disabled={isFieldDisabled('QCMaster', 'ImagePath', isEdit, user?.Role)}
            />
          </div>
        </FormSection>

        {/* Repeating Specifications Grid */}
        <div className="border-t pt-6">
          <SpecGrid
            rows={specs}
            onChange={setSpecs}
            criteriaList={criteriaList}
            methods={methods}
            frequencies={frequencies}
            responsibilities={responsibilities}
            reactionPlans={reactionPlans}
            isFieldDisabled={isFieldDisabled}
            isEdit={isEdit}
            userRole={user?.Role}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/app/qc-master')}>
            Cancel
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create QC Master Template'}
          </Button>
        </div>
      </form>

      {isEdit && initialData && (
        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          tableName="QCMaster"
          childTables="QCSpecifications"
          recordId={initialData.QCUID}
          title={`History — QC Template ${initialData.QCUID}`}
        />
      )}
    </div>
  );
}
