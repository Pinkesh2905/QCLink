// ============================================================================
// QCLink — Zod Validators for Incoming Inspection Reports
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

const idNullable = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) || num <= 0 ? null : num;
  });

/** Free text that may be left empty: blank becomes null. */
function optionalText(max: number) {
  return z
    .string()
    .nullish()
    .transform((val) => (val == null || val.trim() === '' ? null : val.trim()))
    .refine((val) => val === null || val.length <= max, { message: `Must be at most ${max} characters` });
}

export const REVIEW_STATUSES = ['Review Pending', 'Review Done', 'Review Rejected'] as const;

export const inspectionResultInputSchema = z.object({
  SrNo: z.union([z.number(), z.string()]).transform(Number),
  Parameter: z.string().min(1).max(255).trim(),
  CriteriaID: idRequired,
  MinVal: numericNullable,
  MaxVal: numericNullable,
  OtherValue: z.string().max(255).trim().nullable().optional(),
  MethodID: idRequired,
  FrequencyID: idRequired,
  ResponsibilityID: idRequired,
  ReactionPlanID: idRequired,
  Specification: z.string().min(1),
  Actual: numericNullable,
  ResultStatusID: idNullable,
  ObservedRemark: optionalText(1000),
});

export const createInspectionReportSchema = z.object({
  InspectionDate: z.string().min(1, 'Inspection Date is required'),
  ItemUID: z.string().min(1, 'Item selection is required'),
  ItemName: z.string().min(1, 'Item Name is required'),
  QCUID: z.string().min(1, 'QC Specification template selection is required'),
  GRNNo: z.string().min(1, 'GRN Number is required').max(100).trim(),
  InvoicePath: z.string().nullable().optional(),
  InspectionRemark: optionalText(2000),
  ReviewerEmployeeUID: z.string().trim().min(1, 'Reviewer is required').max(20),
  InspectionStatusID: idRequired,
  Results: z
    .array(inspectionResultInputSchema)
    .min(1, 'At least one inspection result row is required'),
});

export const updateInspectionReportSchema = z.object({
  InspectionDate: z.string().min(1).optional(),
  ItemUID: z.string().min(1).optional(),
  ItemName: z.string().min(1).optional(),
  QCUID: z.string().min(1).optional(),
  GRNNo: z.string().min(1).max(100).trim().optional(),
  InvoicePath: z.string().nullable().optional(),
  InspectionRemark: optionalText(2000).optional(),
  ReviewerEmployeeUID: z.string().trim().min(1, 'Reviewer is required').max(20).optional(),
  InspectionStatusID: idRequired.optional(),
  Results: z.array(inspectionResultInputSchema).optional(),
});

/** What a reviewer submits: a verdict, plus a remark (mandatory when rejecting). */
export const reviewReportSchema = z
  .object({
    ReviewStatus: z.enum(REVIEW_STATUSES),
    ReviewerRemark: optionalText(2000),
  })
  .refine((v) => v.ReviewStatus !== 'Review Rejected' || v.ReviewerRemark !== null, {
    message: 'Please write a Reviewer Remark explaining the rejection',
    path: ['ReviewerRemark'],
  });

export type ReviewReportInput = z.infer<typeof reviewReportSchema>;
export type InspectionResultInputSchema = z.infer<typeof inspectionResultInputSchema>;
export type CreateInspectionReportInput = z.infer<typeof createInspectionReportSchema>;
export type UpdateInspectionReportInput = z.infer<typeof updateInspectionReportSchema>;
