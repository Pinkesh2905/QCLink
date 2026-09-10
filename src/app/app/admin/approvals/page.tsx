'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, UserCheck, Clock } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/datetime';
import type { SafeUser } from '@/types/db';

export default function UserApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchPendingUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users?status=Pending');
      if (res.ok) {
        const users = await res.json();
        setPendingUsers(users);
      }
    } catch {
      toast.error('Failed to load pending users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const handleAction = async (userId: number, newStatus: 'Active' | 'Rejected') => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: newStatus }),
      });

      if (res.ok) {
        toast.success(newStatus === 'Active' ? 'User approved successfully' : 'User registration rejected');
        fetchPendingUsers();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to update user status');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Pending Account Approvals
          </h3>
          <p className="text-sm text-muted-foreground">
            Review and grant access to newly registered users awaiting administrative approval
          </p>
        </div>
        <Badge variant="secondary" className="font-mono">
          {pendingUsers.length} Pending
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pendingUsers.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">No Pending Approvals</CardTitle>
            <CardDescription>
              All user signups have been reviewed and approved or rejected.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingUsers.map((u) => (
            <Card key={u.UserID} className="flex flex-col justify-between shadow-xs">
              <CardHeader className="space-y-1 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">
                    {u.Name}
                  </CardTitle>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 shrink-0 text-xs">
                    Pending
                  </Badge>
                </div>
                <CardDescription className="text-xs truncate">
                  {u.Email}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Requested on{' '}
                    {formatDateTimeIST(u.CreatedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={actionLoading === u.UserID}
                    onClick={() => handleAction(u.UserID, 'Rejected')}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={actionLoading === u.UserID}
                    onClick={() => handleAction(u.UserID, 'Active')}
                  >
                    {actionLoading === u.UserID ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
