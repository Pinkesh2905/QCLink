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
import { useLookup } from '@/hooks/use-lookup';
import { useSession } from '@/hooks/use-session';
import { useFieldPermissions } from '@/hooks/use-field-permissions';
import { createItemSchema, updateItemSchema } from '@/validators/items';
import { Loader2, History, ArrowLeft, Save } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/datetime';
import type { ItemWithLookups } from '@/types/db';

interface ItemFormProps {
  initialData?: ItemWithLookups;
  isEdit?: boolean;
}

export function ItemForm({ initialData, isEdit = false }: ItemFormProps) {
  const router = useRouter();
  const { user } = useSession();
  const { isFieldDisabled } = useFieldPermissions();
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Lookups (includeInactive in edit mode so deactivated selected values still show)
  const { options: categories, loading: categoriesLoading } = useLookup('categories', isEdit);
  const { options: uoms, loading: uomsLoading } = useLookup('unit-of-stock', isEdit);
  const { options: subCategories, loading: subCategoriesLoading } = useLookup('sub-categories', isEdit);

  // Form state
  const [formData, setFormData] = useState({
    ItemName: initialData?.ItemName || '',
    CategoryID: initialData?.CategoryID ? String(initialData.CategoryID) : '',
    UOMID: initialData?.UOMID ? String(initialData.UOMID) : '',
    SubCategoryID: initialData?.SubCategoryID ? String(initialData.SubCategoryID) : '',
    Make: initialData?.Make || '',
    Size: initialData?.Size != null ? String(initialData.Size) : '',
    CurrentStock: initialData?.CurrentStock != null ? String(initialData.CurrentStock) : '',
    MPQ: initialData?.MPQ != null ? String(initialData.MPQ) : '',
    MinLevel: initialData?.MinLevel != null ? String(initialData.MinLevel) : '',
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
      ItemName: formData.ItemName.trim(),
      CategoryID: formData.CategoryID ? Number(formData.CategoryID) : undefined,
      UOMID: formData.UOMID ? Number(formData.UOMID) : undefined,
      SubCategoryID: formData.SubCategoryID ? Number(formData.SubCategoryID) : null,
      Make: formData.Make.trim() || null,
      Size: formData.Size !== '' ? Number(formData.Size) : null,
      CurrentStock: formData.CurrentStock !== '' ? Number(formData.CurrentStock) : null,
      MPQ: formData.MPQ !== '' ? Number(formData.MPQ) : null,
      MinLevel: formData.MinLevel !== '' ? Number(formData.MinLevel) : null,
    };

    const schema = isEdit ? updateItemSchema : createItemSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        errors[key] = issue.message;
      }
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/items/${initialData?.ItemUID}` : '/api/items';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(json.details)) {
            mapped[k] = Array.isArray(v) ? (v[0] as string) : String(v);
          }
          setFieldErrors(mapped);
        }
        const errorMsg = json.error || 'Failed to save item';
        setGeneralError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success(isEdit ? 'Item updated successfully' : 'Item created successfully');
      router.push('/app/store-master');
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
          <Button variant="outline" size="icon" onClick={() => router.push('/app/store-master')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isEdit ? `Edit Item: ${initialData?.ItemUID}` : 'New Item'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update inventory item attributes' : 'Create a new inventory item in Store Master'}
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

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 rounded-lg border bg-card p-4 sm:p-6 shadow-sm min-w-0 max-w-full">
        {/* System Locked Fields (visible in edit mode) */}
        {isEdit && initialData && (
          <FormSection
            title="System Information"
            description="System-managed identifiers and ownership information (read-only)"
          >
            <div className="space-y-2">
              <Label className="text-muted-foreground">Item UID</Label>
              <Input value={initialData.ItemUID} disabled className="bg-muted text-muted-foreground font-mono" />
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
                value={formatDateTimeIST(initialData.CreatedAt, { second: '2-digit' })}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Updated At</Label>
              <Input
                value={formatDateTimeIST(initialData.UpdatedAt, { second: '2-digit' })}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          </FormSection>
        )}

        {/* Item Details */}
        <FormSection
          title="Item Details"
          description="Primary identification and categorization details for this store item"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ItemName">
              Item Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ItemName"
              value={formData.ItemName}
              onChange={(e) => handleChange('ItemName', e.target.value)}
              placeholder="e.g. Hexagonal Bolt M8x30"
              required
              disabled={isFieldDisabled('Items', 'ItemName', isEdit, user?.Role)}
            />
            {fieldErrors.ItemName && (
              <p className="text-xs text-destructive">{fieldErrors.ItemName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="CategoryID">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.CategoryID}
              onValueChange={(val) => handleChange('CategoryID', val)}
              disabled={categoriesLoading || isFieldDisabled('Items', 'CategoryID', isEdit, user?.Role)}
            >
              <SelectTrigger id="CategoryID">
                <SelectValue placeholder={categoriesLoading ? 'Loading categories...' : 'Select category'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.CategoryID && (
              <p className="text-xs text-destructive">{fieldErrors.CategoryID}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="UOMID">
              Unit of Stock (UOM) <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.UOMID}
              onValueChange={(val) => handleChange('UOMID', val)}
              disabled={uomsLoading || isFieldDisabled('Items', 'UOMID', isEdit, user?.Role)}
            >
              <SelectTrigger id="UOMID">
                <SelectValue placeholder={uomsLoading ? 'Loading units...' : 'Select unit'} />
              </SelectTrigger>
              <SelectContent>
                {uoms.map((uom) => (
                  <SelectItem key={uom.id} value={String(uom.id)}>
                    {uom.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.UOMID && (
              <p className="text-xs text-destructive">{fieldErrors.UOMID}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="SubCategoryID">Sub Category</Label>
            <Select
              value={formData.SubCategoryID}
              onValueChange={(val) => handleChange('SubCategoryID', val)}
              disabled={subCategoriesLoading || isFieldDisabled('Items', 'SubCategoryID', isEdit, user?.Role)}
            >
              <SelectTrigger id="SubCategoryID">
                <SelectValue placeholder={subCategoriesLoading ? 'Loading sub-categories...' : 'Select sub-category (optional)'} />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((sub) => (
                  <SelectItem key={sub.id} value={String(sub.id)}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.SubCategoryID && (
              <p className="text-xs text-destructive">{fieldErrors.SubCategoryID}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="Make">Make / Manufacturer</Label>
            <Input
              id="Make"
              value={formData.Make}
              onChange={(e) => handleChange('Make', e.target.value)}
              placeholder="e.g. Unbrako"
              disabled={isFieldDisabled('Items', 'Make', isEdit, user?.Role)}
            />
            {fieldErrors.Make && (
              <p className="text-xs text-destructive">{fieldErrors.Make}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="Size">Size</Label>
            <Input
              id="Size"
              type="number"
              step="any"
              value={formData.Size}
              onChange={(e) => handleChange('Size', e.target.value)}
              placeholder="e.g. 8"
              disabled={isFieldDisabled('Items', 'Size', isEdit, user?.Role)}
            />
            {fieldErrors.Size && (
              <p className="text-xs text-destructive">{fieldErrors.Size}</p>
            )}
          </div>
        </FormSection>

        {/* Stock & Reorder Levels */}
        <FormSection
          title="Stock & Inventory Levels"
          description="Inventory tracking parameters, minimum thresholds and order quantities"
        >
          <div className="space-y-2">
            <Label htmlFor="CurrentStock">Current Stock</Label>
            <Input
              id="CurrentStock"
              type="number"
              step="any"
              value={formData.CurrentStock}
              onChange={(e) => handleChange('CurrentStock', e.target.value)}
              placeholder="0"
              disabled={isFieldDisabled('Items', 'CurrentStock', isEdit, user?.Role)}
            />
            {fieldErrors.CurrentStock && (
              <p className="text-xs text-destructive">{fieldErrors.CurrentStock}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="MPQ">Minimum Pack Quantity (MPQ)</Label>
            <Input
              id="MPQ"
              type="number"
              step="any"
              value={formData.MPQ}
              onChange={(e) => handleChange('MPQ', e.target.value)}
              placeholder="0"
              disabled={isFieldDisabled('Items', 'MPQ', isEdit, user?.Role)}
            />
            {fieldErrors.MPQ && (
              <p className="text-xs text-destructive">{fieldErrors.MPQ}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="MinLevel">Minimum Level</Label>
            <Input
              id="MinLevel"
              type="number"
              step="any"
              value={formData.MinLevel}
              onChange={(e) => handleChange('MinLevel', e.target.value)}
              placeholder="0"
              disabled={isFieldDisabled('Items', 'MinLevel', isEdit, user?.Role)}
            />
            {fieldErrors.MinLevel && (
              <p className="text-xs text-destructive">{fieldErrors.MinLevel}</p>
            )}
          </div>
        </FormSection>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/app/store-master')}>
            Cancel
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </form>

      {isEdit && initialData && (
        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          tableName="Items"
          recordId={initialData.ItemUID}
          title={`History — Item ${initialData.ItemUID}`}
        />
      )}
    </div>
  );
}
