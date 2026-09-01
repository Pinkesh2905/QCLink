'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { InspectionResultInputSchema } from '@/validators/inspection-report';

interface LookupItem {
  id: number;
  name: string;
}

interface ResultRowProps {
  row: InspectionResultInputSchema;
  criteriaName?: string;
  resultStatuses: LookupItem[];
  onChange: (updated: InspectionResultInputSchema) => void;
  disabled?: boolean;
  isFieldDisabled?: (moduleName: any, fieldName: string, isEdit?: boolean, userRole?: string) => boolean;
  isEdit?: boolean;
  userRole?: string;
}

export function ResultRow({
  row,
  criteriaName = '',
  resultStatuses,
  onChange,
  disabled = false,
  isFieldDisabled,
  isEdit = false,
  userRole,
}: ResultRowProps) {
  const checkDisabled = (field: string) => {
    if (disabled) return true;
    if (isFieldDisabled) return isFieldDisabled('InspectionResults', field, isEdit, userRole);
    return false;
  };
  const normCriteria = criteriaName.trim().toLowerCase();
  const isOther = normCriteria.includes('other');

  return (
    <div className="rounded-lg border bg-card/60 p-3.5 sm:p-4 space-y-3 shadow-xs min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {row.SrNo}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-foreground break-words">
            {row.Parameter}
          </span>
          {criteriaName && (
            <Badge variant="outline" className="text-[11px] font-normal shrink-0">
              {criteriaName}
            </Badge>
          )}
        </div>

        <div className="text-xs text-muted-foreground shrink-0 break-words">
          Spec: <span className="font-mono font-medium text-foreground">{row.Specification}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Actual input (conditionally enabled/shown when not 'Other') */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Actual Observed Value {!isOther && <span className="text-destructive">*</span>}
          </label>
          {!isOther ? (
            <Input
              type="number"
              step="any"
              value={row.Actual != null ? String(row.Actual) : ''}
              onChange={(e) =>
                onChange({
                  ...row,
                  Actual: e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
              placeholder="Enter measured value"
              disabled={checkDisabled('Actual')}
              className="h-9 text-sm"
            />
          ) : (
            <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 text-xs text-muted-foreground italic border">
              N/A (Visual / Other criteria)
            </div>
          )}
        </div>

        {/* Row Result dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-medium">
            Result Status <span className="text-destructive">*</span>
          </label>
          <Select
            value={row.ResultStatusID ? String(row.ResultStatusID) : ''}
            onValueChange={(val) =>
              onChange({
                ...row,
                ResultStatusID: val ? Number(val) : null,
              })
            }
            disabled={checkDisabled('ResultStatusID')}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select verdict" />
            </SelectTrigger>
            <SelectContent>
              {resultStatuses.map((st) => (
                <SelectItem key={st.id} value={String(st.id)}>
                  {st.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Context info from QC template */}
        <div className="flex flex-col justify-center space-y-0.5 text-xs text-muted-foreground bg-muted/20 p-2 rounded-md border border-muted/40">
          <span>Row #{row.SrNo}</span>
          <span className="truncate">Parameter: {row.Parameter}</span>
        </div>
      </div>
    </div>
  );
}
