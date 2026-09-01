// ============================================================================
// QCLink — Zod Validators for Admin Panel
// ============================================================================

import { z } from 'zod';

export const updateUserStatusRoleSchema = z.object({
  Status: z.enum(['Active', 'Rejected', 'Deactivated', 'Pending']).optional(),
  Role: z.enum(['Admin', 'User']).optional(),
});

export const createMasterDataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim(),
});

export const updateMasterDataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim().optional(),
  isActive: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type UpdateUserStatusRoleInput = z.infer<typeof updateUserStatusRoleSchema>;
export type CreateMasterDataInput = z.infer<typeof createMasterDataSchema>;
export type UpdateMasterDataInput = z.infer<typeof updateMasterDataSchema>;
