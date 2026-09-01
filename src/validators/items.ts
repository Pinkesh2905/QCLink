// ============================================================================
// QCLink — Zod Validators for Items (Store Master)
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

export const createItemSchema = z.object({
  ItemName: z.string().min(1, 'Item Name is required').max(255).trim(),
  CategoryID: idRequired,
  UOMID: idRequired,
  SubCategoryID: idNullable.optional(),
  Make: z.string().max(255).trim().nullable().optional(),
  Size: numericNullable,
  CurrentStock: numericNullable,
  MPQ: numericNullable,
  MinLevel: numericNullable,
});

export const updateItemSchema = z.object({
  ItemName: z.string().min(1, 'Item Name is required').max(255).trim().optional(),
  CategoryID: idRequired.optional(),
  UOMID: idRequired.optional(),
  SubCategoryID: idNullable.optional(),
  Make: z.string().max(255).trim().nullable().optional(),
  Size: numericNullable,
  CurrentStock: numericNullable,
  MPQ: numericNullable,
  MinLevel: numericNullable,
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
