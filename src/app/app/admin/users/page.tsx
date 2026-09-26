'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDateIST } from '@/lib/datetime';
import { useSession } from '@/hooks/use-session';
import { AddUserDialog } from '@/components/admin/add-user-dialog';
import { Loader2, Search, Users, UserCheck, UserX, UserPlus } from 'lucide-react';
import type { UserWithCompany, UserRole, UserStatus } from '@/types/db';

interface CompanyOption {
  CompanyID: number;
  CompanyName: string;
}

const ALL_COMPANIES = 'all';

export default function UserDirectoryPage() {
  const { user: currentSessionUser } = useSession();
  const [users, setUsers] = useState<UserWithCompany[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (companyFilter !== ALL_COMPANIES) params.set('companyId', companyFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      toast.error('Failed to load user directory');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, companyFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetch('/api/admin/companies')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: CompanyOption[]) => setCompanies(rows))
      .catch(() => toast.error('Failed to load companies'));
  }, []);

  const handleUpdate = async (
    userId: number,
    payload: { Status?: UserStatus; Role?: UserRole; CompanyID?: number }
  ) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        toast.success('User updated successfully');
        fetchUsers();
      } else {
        toast.error(json.error || 'Failed to update user');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">Active</Badge>;
      case 'Pending':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-300">Pending</Badge>;
      case 'Deactivated':
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-300">Deactivated</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-50 text-red-700 border-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            User Directory & Access Control
          </h3>
          <p className="text-sm text-muted-foreground">
            Create accounts, assign companies, and manage roles and access
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="h-9 w-full sm:w-52 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COMPANIES}>All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.CompanyID} value={String(c.CompanyID)}>
                  {c.CompanyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button size="sm" className="h-9" onClick={() => setAddUserOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add user
          </Button>
        </div>
      </div>

      <div className="hidden sm:block rounded-lg border bg-card overflow-x-auto max-w-full">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = currentSessionUser?.UserID === u.UserID;
                const isRowLoading = actionLoading === u.UserID;

                return (
                  <TableRow key={u.UserID}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{u.Name}</span>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            You
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.Email}</TableCell>
                    <TableCell>
                      <CompanySelect
                        user={u}
                        companies={companies}
                        disabled={isRowLoading}
                        onChange={(companyId) => handleUpdate(u.UserID, { CompanyID: companyId })}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(u.Status)}</TableCell>
                    <TableCell>
                      {isSelf ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-muted">
                          {u.Role}
                        </span>
                      ) : (
                        <Select
                          value={u.Role}
                          onValueChange={(val) =>
                            handleUpdate(u.UserID, { Role: val as UserRole })
                          }
                          disabled={isRowLoading}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="User">User</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateIST(u.CreatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground italic">Current user</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {u.Status === 'Active' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
                              disabled={isRowLoading}
                              onClick={() => handleUpdate(u.UserID, { Status: 'Deactivated' })}
                            >
                              <UserX className="mr-1 h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-emerald-600 hover:bg-emerald-50"
                              disabled={isRowLoading}
                              onClick={() => handleUpdate(u.UserID, { Status: 'Active' })}
                            >
                              <UserCheck className="mr-1 h-3.5 w-3.5" />
                              Activate
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Card list — below sm */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="rounded-lg border h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border h-32 flex items-center justify-center text-sm text-muted-foreground">
            No users found
          </div>
        ) : (
          users.map((u) => {
            const isSelf = currentSessionUser?.UserID === u.UserID;
            const isRowLoading = actionLoading === u.UserID;

            return (
              <div key={u.UserID} className="rounded-lg border bg-card p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{u.Name}</span>
                    {isSelf && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  {getStatusBadge(u.Status)}
                </div>

                <div className="text-xs text-muted-foreground truncate">{u.Email}</div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Company</div>
                  <CompanySelect
                    user={u}
                    companies={companies}
                    disabled={isRowLoading}
                    onChange={(companyId) => handleUpdate(u.UserID, { CompanyID: companyId })}
                  />
                </div>

                <div className="pt-1.5 border-t grid grid-cols-2 gap-x-3 gap-y-2 items-end">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Role</div>
                    {isSelf ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-muted">
                        {u.Role}
                      </span>
                    ) : (
                      <Select
                        value={u.Role}
                        onValueChange={(val) =>
                          handleUpdate(u.UserID, { Role: val as UserRole })
                        }
                        disabled={isRowLoading}
                      >
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Joined</div>
                    <div className="text-xs">
                      {formatDateIST(u.CreatedAt)}
                    </div>
                  </div>
                </div>

                {!isSelf && (
                  <div className="pt-1">
                    {u.Status === 'Active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs text-destructive hover:bg-destructive/10"
                        disabled={isRowLoading}
                        onClick={() => handleUpdate(u.UserID, { Status: 'Deactivated' })}
                      >
                        <UserX className="mr-1 h-3.5 w-3.5" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs text-emerald-600 hover:bg-emerald-50"
                        disabled={isRowLoading}
                        onClick={() => handleUpdate(u.UserID, { Status: 'Active' })}
                      >
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                        Activate
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onCreated={fetchUsers}
        companies={companies}
      />
    </div>
  );
}

function CompanySelect({
  user,
  companies,
  disabled,
  onChange,
}: {
  user: UserWithCompany;
  companies: CompanyOption[];
  disabled: boolean;
  onChange: (companyId: number) => void;
}) {
  return (
    <Select
      value={user.CompanyID ? String(user.CompanyID) : undefined}
      onValueChange={(val) => onChange(Number(val))}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-full sm:w-44 text-xs">
        <SelectValue placeholder="No company" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.CompanyID} value={String(c.CompanyID)} className="text-xs">
            {c.CompanyName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
