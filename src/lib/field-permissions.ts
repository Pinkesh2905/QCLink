// ============================================================================
// QCLink — Field-Level Permission Enforcement
// Server-side checks against FieldPermissions table.
// ============================================================================

import { query } from './db';
import { AppError } from './errors';
import type { FieldPermission, PermissionModuleName } from '@/types/db';

/**
 * Fetch field permissions for a given module as a FieldName -> MinimumRole map.
 */
export async function getModuleFieldPermissions(
  moduleName: PermissionModuleName
): Promise<Map<string, 'User' | 'Admin'>> {
  const rows = await query<Pick<FieldPermission, 'FieldName' | 'MinimumRole'>>(
    'SELECT FieldName, MinimumRole FROM FieldPermissions WHERE ModuleName = ?',
    [moduleName]
  );

  const map = new Map<string, 'User' | 'Admin'>();
  for (const row of rows) {
    map.set(row.FieldName, row.MinimumRole);
  }
  return map;
}

/**
 * Fetch all field permissions across all modules.
 */
export async function getAllFieldPermissions(): Promise<FieldPermission[]> {
  return query<FieldPermission>(
    'SELECT * FROM FieldPermissions ORDER BY ModuleName, FieldName'
  );
}

/**
 * Enforce field-level permissions for a set of changed fields.
 * If user is not Admin and any changed field requires Admin role, throws 403 AppError.
 */
export async function enforceFieldPermissions(
  moduleName: PermissionModuleName,
  changedFields: string[],
  userRole: 'Admin' | 'User'
): Promise<void> {
  // Admins can edit all fields
  if (userRole === 'Admin') {
    return;
  }

  if (changedFields.length === 0) {
    return;
  }

  const permissions = await getModuleFieldPermissions(moduleName);
  const restrictedFields: string[] = [];

  for (const field of changedFields) {
    const minRole = permissions.get(field) ?? 'User';
    if (minRole === 'Admin') {
      restrictedFields.push(field);
    }
  }

  if (restrictedFields.length > 0) {
    throw new AppError(
      `You do not have permission to edit the following field(s): ${restrictedFields.join(
        ', '
      )}. Admin role is required.`,
      403
    );
  }
}
