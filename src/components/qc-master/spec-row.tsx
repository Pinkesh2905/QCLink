'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { computeSpecification, type QCSpecInputSchema } from '@/validators/qc-master';

interface LookupItem {
  id: number;
  name: string;
}

interface SpecRowProps {
  row: QCSpecInputSchema;
  index: number;
  criteriaList: LookupItem[];
  methods: LookupItem[];
  frequencies: LookupItem[];
  responsibilities: LookupItem[];
  reactionPlans: LookupItem[];
  onChange: (updated: QCSpecInputSchema) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
  isFieldDisabled?: (moduleName: any, fieldName: string, isEdit?: boolean, userRole?: string) => boolean;
  isEdit?: boolean;
  userRole?: string;
}

export function SpecRow({
  row,
  index,
  criteriaList,
  methods,
  frequencies,
  responsibilities,
  reactionPlans,
  onChange,
  onRemove,
  canRemove,
  disabled = false,
  isFieldDisabled,
  isEdit = false,
  userRole,
}: SpecRowProps) {
  const checkDisabled = (field: string) => {
    if (disabled) return true;
    if (isFieldDisabled) return isFieldDisabled('QCSpecifications', field, isEdit, userRole);
    return false;
  };
  const selectedCriteria = criteriaList.find((c) => c.id === row.CriteriaID);
  const criteriaName = selectedCriteria?.name || '';
  const normCriteria = criteriaName.trim().toLowerCase();

  const isOnlyMin = normCriteria.includes('only min');
  const isOnlyMax = normCriteria.includes('only max');
  const isRange = normCriteria.includes('range') || normCriteria.includes('min max');
  const isOther = normCriteria.includes('other');

  // Compute preview of Specification
  const computedSpec = computeSpecification(
    criteriaName,
    row.MinVal,
    row.MaxVal,
    row.OtherValue
  );

  return (
    <div className="rounded-lg border bg-card/60 p-4 space-y-3 relative shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Row #{index + 1}
          </span>
        </div>

        {canRemove && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Parameter Name */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">
            Parameter <span className="text-destructive">*</span>
          </label>
          <Input
            value={row.Parameter}
            onChange={(e) => onChange({ ...row, Parameter: e.target.value })}
            placeholder="e.g. Thread Diameter, Surface Finish"
            disabled={checkDisabled('Parameter')}
            className="h-9 text-sm"
            required
          />
        </div>

        {/* Criteria */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Criteria <span className="text-destructive">*</span>
          </label>
          <Select
            value={row.CriteriaID ? String(row.CriteriaID) : ''}
            onValueChange={(val) => {
              const num = Number(val);
              // Clear whichever of MinVal/MaxVal/OtherValue don't apply to the
              // newly selected criteria — otherwise a value entered under a
              // previous criteria (e.g. MaxVal under "Range") rides along
              // hidden in state and gets saved even though neither the UI nor
              // the computed Specification text show it anymore.
              const newName = (criteriaList.find((c) => c.id === num)?.name || '')
                .trim()
                .toLowerCase();
              const newIsOnlyMin = newName.includes('only min');
              const newIsOnlyMax = newName.includes('only max');
              const newIsRange = newName.includes('range') || newName.includes('min max');
              const newIsOther = newName.includes('other');

              onChange({
                ...row,
                CriteriaID: num,
                MinVal: newIsOnlyMin || newIsRange ? row.MinVal : null,
                MaxVal: newIsOnlyMax || newIsRange ? row.MaxVal : null,
                OtherValue: newIsOther ? row.OtherValue : null,
              });
            }}
            disabled={checkDisabled('CriteriaID')}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select criteria" />
            </SelectTrigger>
            <SelectContent>
              {criteriaList.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic Criteria Value Inputs */}
        <div className="space-y-1">
          {isOnlyMin && (
            <div>
              <label className="text-xs font-medium">Min Value</label>
              <Input
                type="number"
                step="any"
                value={row.MinVal != null ? String(row.MinVal) : ''}
                onChange={(e) =>
                  onChange({
                    ...row,
                    MinVal: e.target.value !== '' ? Number(e.target.value) : null,
                  })
                }
                placeholder="e.g. 5.0"
                disabled={checkDisabled('MinVal')}
                className="h-9 text-sm"
              />
            </div>
          )}

          {isOnlyMax && (
            <div>
              <label className="text-xs font-medium">Max Value</label>
              <Input
                type="number"
                step="any"
                value={row.MaxVal != null ? String(row.MaxVal) : ''}
                onChange={(e) =>
                  onChange({
                    ...row,
                    MaxVal: e.target.value !== '' ? Number(e.target.value) : null,
                  })
                }
                placeholder="e.g. 10.0"
                disabled={checkDisabled('MaxVal')}
                className="h-9 text-sm"
              />
            </div>
          )}

          {isRange && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Min</label>
                <Input
                  type="number"
                  step="any"
                  value={row.MinVal != null ? String(row.MinVal) : ''}
                  onChange={(e) =>
                    onChange({
                      ...row,
                      MinVal: e.target.value !== '' ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Min"
                  disabled={checkDisabled('MinVal')}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Max</label>
                <Input
                  type="number"
                  step="any"
                  value={row.MaxVal != null ? String(row.MaxVal) : ''}
                  onChange={(e) =>
                    onChange({
                      ...row,
                      MaxVal: e.target.value !== '' ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Max"
                  disabled={checkDisabled('MaxVal')}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          {isOther && (
            <div>
              <label className="text-xs font-medium">Other Value</label>
              <Input
                value={row.OtherValue || ''}
                onChange={(e) => onChange({ ...row, OtherValue: e.target.value })}
                placeholder="e.g. No burrs / Visual check"
                disabled={checkDisabled('OtherValue')}
                className="h-9 text-sm"
              />
            </div>
          )}

          {!isOnlyMin && !isOnlyMax && !isRange && !isOther && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Specification Value</label>
              <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 text-xs text-muted-foreground italic">
                Select criteria first
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Computed Specification Preview */}
      <div className="rounded-md bg-muted/30 px-3 py-1.5 border border-muted flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Computed Specification:</span>
        <span className="font-semibold text-foreground font-mono">{computedSpec}</span>
      </div>

      {/* Lookup Controls */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
        {/* Method */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Method of Inspection <span className="text-destructive">*</span>
          </label>
          <Select
            value={row.MethodID ? String(row.MethodID) : ''}
            onValueChange={(val) => onChange({ ...row, MethodID: Number(val) })}
            disabled={checkDisabled('MethodID')}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Frequency */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Frequency <span className="text-destructive">*</span>
          </label>
          <Select
            value={row.FrequencyID ? String(row.FrequencyID) : ''}
            onValueChange={(val) => onChange({ ...row, FrequencyID: Number(val) })}
            disabled={checkDisabled('FrequencyID')}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {frequencies.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Responsibility */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Responsibility <span className="text-destructive">*</span>
          </label>
          <Select
            value={row.ResponsibilityID ? String(row.ResponsibilityID) : ''}
            onValueChange={(val) => onChange({ ...row, ResponsibilityID: Number(val) })}
            disabled={checkDisabled('ResponsibilityID')}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select responsibility" />
            </SelectTrigger>
            <SelectContent>
              {responsibilities.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reaction Plan */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Reaction Plan <span className="text-destructive">*</span>
          </label>
          <Select
            value={row.ReactionPlanID ? String(row.ReactionPlanID) : ''}
            onValueChange={(val) => onChange({ ...row, ReactionPlanID: Number(val) })}
            disabled={checkDisabled('ReactionPlanID')}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select reaction plan" />
            </SelectTrigger>
            <SelectContent>
              {reactionPlans.map((rp) => (
                <SelectItem key={rp.id} value={String(rp.id)}>
                  {rp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
