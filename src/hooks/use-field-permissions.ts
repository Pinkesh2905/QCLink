'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PermissionModuleName } from '@/types/db';
import type { FieldPermissionsResponse } from '@/types/api';

let cachedPermissions: FieldPermissionsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearFieldPermissionsCache() {
  cachedPermissions = null;
  cacheTimestamp = 0;
}

/**
 * Hook to retrieve field permission configuration for client-side disabled field rendering.
 */
export function useFieldPermissions() {
  const [permissions, setPermissions] = useState<FieldPermissionsResponse | null>(cachedPermissions);
  const [loading, setLoading] = useState<boolean>(!cachedPermissions);

  const fetchPermissions = useCallback(async (force = false) => {
    if (!force && cachedPermissions && Date.now() - cacheTimestamp < CACHE_TTL) {
      setPermissions(cachedPermissions);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/field-permissions');
      if (res.ok) {
        const data: FieldPermissionsResponse = await res.json();
        cachedPermissions = data;
        cacheTimestamp = Date.now();
        setPermissions(data);
      }
    } catch (err) {
      console.error('Failed to fetch field permissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /**
   * Helper to check if a specific field should be disabled in edit mode for non-admin users.
   * Creation mode (isEdit = false) is open.
   */
  const isFieldDisabled = useCallback(
    (
      moduleName: PermissionModuleName,
      fieldName: string,
      isEdit: boolean = true,
      userRole?: string
    ): boolean => {
      // If not in edit mode or user is Admin, field is never locked by FieldPermissions
      if (!isEdit || userRole === 'Admin') {
        return false;
      }

      if (!permissions) {
        return false;
      }

      const modulePerms = permissions[moduleName];
      if (!modulePerms) {
        return false;
      }

      const minRole = modulePerms[fieldName];
      return minRole === 'Admin';
    },
    [permissions]
  );

  return {
    permissions,
    loading,
    isFieldDisabled,
    invalidate: () => fetchPermissions(true),
  };
}
