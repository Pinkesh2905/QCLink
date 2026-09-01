'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
import { clearFieldPermissionsCache } from '@/hooks/use-field-permissions';
import type { FieldPermission, PermissionModuleName } from '@/types/db';

const MODULE_DEFINITIONS: {
  moduleName: PermissionModuleName;
  label: string;
  description: string;
}[] = [
  {
    moduleName: 'Items',
    label: 'Store Master (Items)',
    description: 'Control which user roles can edit inventory and item specification fields.',
  },
  {
    moduleName: 'QCMaster',
    label: 'QC Master (Header)',
    description: 'Permissions for QC Master template header fields.',
  },
  {
    moduleName: 'QCSpecifications',
    label: 'QC Master (Specifications Grid)',
    description: 'Permissions for parameters, criteria, tolerances, and inspection criteria rows.',
  },
  {
    moduleName: 'InspectionReports',
    label: 'Inspection Reports (Header)',
    description: 'Permissions for operational inspection dates, GRN references, and outcome statuses.',
  },
  {
    moduleName: 'InspectionResults',
    label: 'Inspection Results (Test Actuals)',
    description: 'Permissions for recorded measurement actuals and test status entries.',
  },
];

export default function FieldPermissionsPage() {
  const [permissions, setPermissions] = useState<FieldPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/field-permissions');
      if (res.ok) {
        const data: FieldPermission[] = await res.json();
        setPermissions(data);
      } else {
        toast.error('Failed to load field permissions');
      }
    } catch (err) {
      console.error('Failed to fetch field permissions:', err);
      toast.error('Network error loading field permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const handleRoleChange = async (permissionId: number, newRole: 'User' | 'Admin') => {
    setUpdatingId(permissionId);
    try {
      const res = await fetch(`/api/admin/field-permissions/${permissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minimumRole: newRole }),
      });

      if (res.ok) {
        setPermissions((prev) =>
          prev.map((p) =>
            p.FieldPermissionID === permissionId
              ? { ...p, MinimumRole: newRole, UpdatedAt: new Date() }
              : p
          )
        );
        clearFieldPermissionsCache();
        toast.success(`Permission updated to ${newRole === 'Admin' ? 'Admin Only' : 'All Users'}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to update permission');
      }
    } catch (err) {
      console.error('Failed to update field permission:', err);
      toast.error('Network error updating permission');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Field Edit Permissions</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure role restrictions for editable fields across all modules. Changes take effect immediately.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPermissions}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6">
          {MODULE_DEFINITIONS.map((def) => {
            const modulePerms = permissions.filter((p) => p.ModuleName === def.moduleName);
            if (modulePerms.length === 0) return null;

            return (
              <Card key={def.moduleName} className="overflow-hidden border-border/80 shadow-xs">
                <CardHeader className="bg-muted/40 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {def.label}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground font-mono">
                      {modulePerms.length} fields
                    </span>
                  </div>
                  <CardDescription className="text-xs">{def.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {modulePerms.map((perm) => {
                    const isAdminOnly = perm.MinimumRole === 'Admin';
                    const isBusy = updatingId === perm.FieldPermissionID;

                    return (
                      <div
                        key={perm.FieldPermissionID}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm font-mono">{perm.FieldName}</span>
                            {isAdminOnly ? (
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 text-[11px]"
                              >
                                <ShieldAlert className="mr-1 h-3 w-3" />
                                Admin Only
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[11px]"
                              >
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                All Users
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isAdminOnly
                              ? 'Only administrators can modify this field when editing.'
                              : 'All active users can modify this field when editing.'}
                          </p>
                        </div>

                        <div className="w-full sm:w-48 shrink-0">
                          <Select
                            disabled={isBusy}
                            value={perm.MinimumRole}
                            onValueChange={(val) =>
                              handleRoleChange(perm.FieldPermissionID, val as 'User' | 'Admin')
                            }
                          >
                            <SelectTrigger className="w-full h-9 text-xs">
                              {isBusy ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Saving...</span>
                                </div>
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="User" className="text-xs">
                                Editable by all Users
                              </SelectItem>
                              <SelectItem value="Admin" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                Admin Only
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
