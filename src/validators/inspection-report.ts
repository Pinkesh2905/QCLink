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
});

export const createInspectionReportSchema = z.object({
  InspectionDate: z.string().min(1, 'Inspection Date is required'),
  ItemUID: z.string().min(1, 'Item selection is required'),
  ItemName: z.string().min(1, 'Item Name is required'),
  QCUID: z.string().min(1, 'QC Specification template selection is required'),
  GRNNo: z.string().min(1, 'GRN Number is required').max(100).trim(),
  InvoicePath: z.string().nullable().optional(),
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
  InspectionStatusID: idRequired.optional(),
  Results: z.array(inspectionResultInputSchema).optional(),
});

export type InspectionResultInputSchema = z.infer<typeof inspectionResultInputSchema>;
export type CreateInspectionReportInput = z.infer<typeof createInspectionReportSchema>;
export type UpdateInspectionReportInput = z.infer<typeof updateInspectionReportSchema>;
