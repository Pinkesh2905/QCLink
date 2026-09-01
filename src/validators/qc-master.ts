// ============================================================================
// QCLink — Zod Validators for QC Master
// ============================================================================

import { z } from 'zod';

const numericNullable = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  });

const idRequired = z
  .union([z.number(), z.string()])
  .transform((val) => Number(val))
  .refine((num) => !isNaN(num) && num > 0, { message: 'Must be a valid positive ID' });

export const qcSpecInputSchema = z.object({
  SrNo: z.union([z.number(), z.string()]).transform(Number),
  Parameter: z.string().min(1, 'Parameter name is required').max(255).trim(),
  CriteriaID: idRequired,
  MinVal: numericNullable,
  MaxVal: numericNullable,
  OtherValue: z.string().max(255).trim().nullable().optional(),
  MethodID: idRequired,
  FrequencyID: idRequired,
  ResponsibilityID: idRequired,
  ReactionPlanID: idRequired,
});

export const createQCMasterSchema = z.object({
  ItemUID: z.string().min(1, 'Item selection is required'),
  ItemName: z.string().min(1, 'Item Name is required'),
  ImagePath: z.string().nullable().optional(),
  Specifications: z
    .array(qcSpecInputSchema)
    .min(1, 'At least one specification row is required')
    .max(30, 'Maximum 30 specification rows allowed'),
});

export const updateQCMasterSchema = z.object({
  ImagePath: z.string().nullable().optional(),
  Specifications: z
    .array(qcSpecInputSchema)
    .min(1, 'At least one specification row is required')
    .max(30, 'Maximum 30 specification rows allowed')
    .optional(),
});

export type QCSpecInputSchema = z.infer<typeof qcSpecInputSchema>;
export type CreateQCMasterInput = z.infer<typeof createQCMasterSchema>;
export type UpdateQCMasterInput = z.infer<typeof updateQCMasterSchema>;

/**
 * Server-side helper to compute the Specification string based on CriteriaName and values.
 */
export function computeSpecification(
  criteriaName: string,
  minVal: number | null | undefined,
  maxVal: number | null | undefined,
  otherValue: string | null | undefined
): string {
  const norm = criteriaName.trim().toLowerCase();
  if (norm === 'only min' || norm.includes('only min')) {
    return minVal != null ? `Min ${minVal}` : 'Please define specification!';
  } else if (norm === 'only max' || norm.includes('only max')) {
    return maxVal != null ? `Max ${maxVal}` : 'Please define specification!';
  } else if (norm === 'min max range' || norm.includes('range')) {
    return minVal != null && maxVal != null
      ? `${minVal}-${maxVal}`
      : 'Please define specification!';
  } else if (norm === 'other' || norm.includes('other')) {
    return otherValue ? otherValue.trim() : 'Please define specification!';
  }
  return 'Please define specification!';
}
