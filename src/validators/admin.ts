// ============================================================================
// QCLink — Zod Validators for Admin Panel
// ============================================================================

import { z } from 'zod';

export const updateUserStatusRoleSchema = z.object({
  Status: z.enum(['Active', 'Rejected', 'Deactivated', 'Pending']).optional(),
  Role: z.enum(['Admin', 'User']).optional(),
  CompanyID: z.number().int().positive().nullable().optional(),
});

export const createUserSchema = z.object({
  Name: z.string().min(1, 'Name is required').max(255).trim(),
  Email: z.string().email('Enter a valid email').max(255).trim().toLowerCase(),
  Password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  Role: z.enum(['Admin', 'User']),
  CompanyID: z.number({ message: 'Company is required' }).int().positive(),
});

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const companySchema = z.object({
  CompanyName: z.string().min(1, 'Company name is required').max(255).trim(),
  ContactName: optionalText(255),
  ContactEmail: z
    .union([z.string().trim().email('Enter a valid email'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  ContactPhone: optionalText(50),
  Address: optionalText(2000),
});

export const createCompanySchema = companySchema;

export const updateCompanySchema = companySchema.partial().extend({
  IsActive: z.union([z.literal(0), z.literal(1)]).optional(),
});

export const createMasterDataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim(),
  companyId: z.number().int().positive().nullable().optional(),
});

export const updateMasterDataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim().optional(),
  isActive: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type UpdateUserStatusRoleInput = z.infer<typeof updateUserStatusRoleSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateMasterDataInput = z.infer<typeof createMasterDataSchema>;
export type UpdateMasterDataInput = z.infer<typeof updateMasterDataSchema>;
