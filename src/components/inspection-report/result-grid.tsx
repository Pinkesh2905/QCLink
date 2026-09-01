'use client';

import { ResultRow } from './result-row';
import type { InspectionResultInputSchema } from '@/validators/inspection-report';

interface LookupItem {
  id: number;
  name: string;
}

interface ResultGridProps {
  results: InspectionResultInputSchema[];
  criteriaList: LookupItem[];
  resultStatuses: LookupItem[];
  onChange: (updatedResults: InspectionResultInputSchema[]) => void;
  disabled?: boolean;
  isFieldDisabled?: (moduleName: any, fieldName: string, isEdit?: boolean, userRole?: string) => boolean;
  isEdit?: boolean;
  userRole?: string;
}

export function ResultGrid({
  results,
  criteriaList,
  resultStatuses,
  onChange,
  disabled = false,
  isFieldDisabled,
  isEdit = false,
  userRole,
}: ResultGridProps) {
  const criteriaMap = new Map<number, string>();
  criteriaList.forEach((c) => criteriaMap.set(c.id, c.name));

  const handleRowChange = (index: number, updated: InspectionResultInputSchema) => {
    const copy = [...results];
    copy[index] = updated;
    onChange(copy);
  };

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No inspection specifications loaded. Select an item and its QC Master template above to snapshot testing parameters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Inspection Testing Results</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
          {results.length} testing {results.length === 1 ? 'parameter' : 'parameters'}
        </span>
      </div>

      <div className="space-y-3">
        {results.map((r, idx) => (
          <ResultRow
            key={r.SrNo || idx}
            row={r}
            criteriaName={criteriaMap.get(r.CriteriaID) || ''}
            resultStatuses={resultStatuses}
            onChange={(updated) => handleRowChange(idx, updated)}
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
