// ============================================================================
// QCLink — Zod Validators for Employees (Employee Master)
// ============================================================================

import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((val) => (val == null || val.trim() === '' ? null : val.trim()))
    .refine((val) => val === null || val.length <= max, { message: `Must be at most ${max} characters` });

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(255)
  .email('Enter a valid email address')
  .transform((v) => v.toLowerCase());

export const createEmployeeSchema = z.object({
  EmployeeName: z.string().trim().min(1, 'Employee Name is required').max(150),
  Email: emailField,
  Department: optionalText(100),
  Designation: optionalText(100),
  Phone: optionalText(30),
  IsActive: z.union([z.boolean(), z.number()]).optional(),
});

export const updateEmployeeSchema = z.object({
  EmployeeName: z.string().trim().min(1, 'Employee Name is required').max(150).optional(),
  Email: emailField.optional(),
  Department: optionalText(100).optional(),
  Designation: optionalText(100).optional(),
  Phone: optionalText(30).optional(),
  IsActive: z.union([z.boolean(), z.number()]).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
