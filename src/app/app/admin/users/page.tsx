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
import { useSession } from '@/hooks/use-session';
import { Loader2, Search, Users, UserCheck, UserX, Shield, ShieldAlert } from 'lucide-react';
import type { SafeUser, UserRole, UserStatus } from '@/types/db';

export default function UserDirectoryPage() {
  const { user: currentSessionUser } = useSession();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/users${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      toast.error('Failed to load user directory');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdate = async (
    userId: number,
    payload: { Status?: UserStatus; Role?: UserRole }
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
            Manage account roles, permissions, and active/deactivated statuses
          </p>
        </div>

        <div className="w-full sm:w-72">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto max-w-full">
        <Table className="min-w-[620px] sm:min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
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
                      {new Date(u.CreatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
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
    </div>
  );
}
