'use client';

import { Button } from '@/components/ui/button';
import { Plus, AlertCircle } from 'lucide-react';
import { SpecRow } from './spec-row';
import type { QCSpecInputSchema } from '@/validators/qc-master';

interface LookupItem {
  id: number;
  name: string;
}

interface SpecGridProps {
  rows: QCSpecInputSchema[];
  onChange: (rows: QCSpecInputSchema[]) => void;
  criteriaList: LookupItem[];
  methods: LookupItem[];
  frequencies: LookupItem[];
  responsibilities: LookupItem[];
  reactionPlans: LookupItem[];
  disabled?: boolean;
  isFieldDisabled?: (moduleName: any, fieldName: string, isEdit?: boolean, userRole?: string) => boolean;
  isEdit?: boolean;
  userRole?: string;
}

export function SpecGrid({
  rows,
  onChange,
  criteriaList,
  methods,
  frequencies,
  responsibilities,
  reactionPlans,
  disabled = false,
  isFieldDisabled,
  isEdit = false,
  userRole,
}: SpecGridProps) {
  const isMaxReached = rows.length >= 30;

  const handleAddRow = () => {
    if (isMaxReached) return;
    const newRow: QCSpecInputSchema = {
      SrNo: rows.length + 1,
      Parameter: '',
      CriteriaID: criteriaList[0]?.id || 0,
      MinVal: null,
      MaxVal: null,
      OtherValue: null,
      MethodID: methods[0]?.id || 0,
      FrequencyID: frequencies[0]?.id || 0,
      ResponsibilityID: responsibilities[0]?.id || 0,
      ReactionPlanID: reactionPlans[0]?.id || 0,
    };
    onChange([...rows, newRow]);
  };

  const handleRowChange = (index: number, updated: QCSpecInputSchema) => {
    const updatedRows = [...rows];
    updatedRows[index] = { ...updated, SrNo: index + 1 };
    onChange(updatedRows);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    const filtered = rows.filter((_, i) => i !== index);
    // Re-assign SrNo 1..N
    const renumbered = filtered.map((r, idx) => ({ ...r, SrNo: idx + 1 }));
    onChange(renumbered);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Specification Details</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
            {rows.length} / 30 rows
          </span>
        </div>

        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={isMaxReached}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Specification Row
          </Button>
        )}
      </div>

      {isMaxReached && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Maximum of 30 specification rows reached.</span>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <SpecRow
            key={idx}
            row={row}
            index={idx}
            criteriaList={criteriaList}
            methods={methods}
            frequencies={frequencies}
            responsibilities={responsibilities}
            reactionPlans={reactionPlans}
            onChange={(updated) => handleRowChange(idx, updated)}
            onRemove={() => handleRemoveRow(idx)}
            canRemove={rows.length > 1}
            disabled={disabled}
            isFieldDisabled={isFieldDisabled}
            isEdit={isEdit}
            userRole={userRole}
          />
        ))}
      </div>
    </div>
  );
}
