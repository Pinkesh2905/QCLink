// ============================================================================
// QCLink — Field Permissions Type Definitions
// ============================================================================

import type { PermissionModuleName, FieldPermission } from './db';

export type { PermissionModuleName, FieldPermission };

/**
 * Module -> Map of FieldName -> MinimumRole ('User' | 'Admin')
 */
export type FieldPermissionMap = Record<PermissionModuleName, Record<string, 'User' | 'Admin'>>;

export interface FieldPermissionGroup {
  moduleName: PermissionModuleName;
  label: string;
  permissions: FieldPermission[];
}

export interface UpdateFieldPermissionRequest {
  minimumRole: 'User' | 'Admin';
}
