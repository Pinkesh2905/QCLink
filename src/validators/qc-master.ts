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

/** The name of a QC template. Together with the item it must be unique. */
export const masterAliasSchema = z
  .string()
  .trim()
  .min(1, 'Master Alias is required')
  .max(100, 'Master Alias can be at most 100 characters');

export const createQCMasterSchema = z.object({
  ItemUID: z.string().min(1, 'Item selection is required'),
  ItemName: z.string().min(1, 'Item Name is required'),
  MasterAlias: masterAliasSchema,
  ImagePath: z.string().nullable().optional(),
  Specifications: z
    .array(qcSpecInputSchema)
    .min(1, 'At least one specification row is required')
    .max(30, 'Maximum 30 specification rows allowed'),
});

export const updateQCMasterSchema = z.object({
  MasterAlias: masterAliasSchema.optional(),
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

/** Is this criteria one that has both a Min and a Max (a range)? */
export function isRangeCriteria(criteriaName: string): boolean {
  const norm = criteriaName.trim().toLowerCase();
  return norm.includes('range') || norm.includes('min max');
}

/** A message when a range specification has a Max below its Min, otherwise null. Min equal to Max is allowed. */
export function rangeError(
  criteriaName: string,
  minVal: number | null | undefined,
  maxVal: number | null | undefined
): string | null {
  if (!isRangeCriteria(criteriaName)) return null;
  if (minVal != null && maxVal != null && maxVal < minVal) return 'Max cannot be less than Min';
  return null;
}

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
