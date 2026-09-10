'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { clearLookupCache } from '@/hooks/use-lookup';
import { Loader2, Plus, Power, PowerOff, Database } from 'lucide-react';

interface MasterDataOption {
  id: number;
  name: string;
  isActive: number;
}

interface TableTabConfig {
  slug: string;
  label: string;
  hasIsActive: boolean;
  description: string;
}

const TABS: TableTabConfig[] = [
  { slug: 'categories', label: 'Categories', hasIsActive: true, description: 'Store Master item primary categories' },
  { slug: 'unit-of-stock', label: 'Unit of Stock', hasIsActive: true, description: 'Measurement units (e.g. Nos, Kg, Meters)' },
  { slug: 'sub-categories', label: 'Sub Categories', hasIsActive: true, description: 'Secondary classification for store items' },
  { slug: 'specification-criteria', label: 'Spec Criteria', hasIsActive: true, description: 'Criteria rules (Only Min, Only Max, Range, Other)' },
  { slug: 'method-of-inspection', label: 'Inspection Methods', hasIsActive: true, description: 'Quality inspection measurement instruments and methods' },
  { slug: 'inspection-frequency', label: 'Frequency', hasIsActive: true, description: 'Inspection frequency intervals (e.g. 100%, 5/Batch)' },
  { slug: 'responsibility', label: 'Responsibility', hasIsActive: true, description: 'Designated roles or persons responsible for testing' },
  { slug: 'reaction-plan', label: 'Reaction Plan', hasIsActive: true, description: 'Action plans in case of quality parameter deviation' },
  { slug: 'result-status', label: 'Result Status', hasIsActive: false, description: 'Inspection disposition statuses (Accept, Reject, Deviation)' },
];

export default function MasterDataManagerPage() {
  const [activeTab, setActiveTab] = useState('categories');
  const [options, setOptions] = useState<MasterDataOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOptionName, setNewOptionName] = useState('');
  const [adding, setAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const currentTab = TABS.find((t) => t.slug === activeTab) || TABS[0];

  const fetchOptions = useCallback(async (slug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/master-data/${slug}`);
      if (res.ok) {
        setOptions(await res.json());
      }
    } catch {
      toast.error('Failed to load options for ' + slug);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions(activeTab);
    setNewOptionName('');
  }, [activeTab, fetchOptions]);

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName.trim()) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/admin/master-data/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOptionName.trim() }),
      });

      const json = await res.json();

      if (res.ok) {
        toast.success(`Added "${newOptionName.trim()}" to ${currentTab.label}`);
        setNewOptionName('');
        clearLookupCache();
        fetchOptions(activeTab);
      } else {
        toast.error(json.error || 'Failed to add option');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (id: number, currentActive: number) => {
    setActionLoading(id);
    const newActive = currentActive === 1 ? 0 : 1;

    try {
      const res = await fetch(`/api/admin/master-data/${activeTab}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });

      const json = await res.json();

      if (res.ok) {
        toast.success(newActive === 1 ? 'Option marked active' : 'Option marked inactive');
        clearLookupCache();
        fetchOptions(activeTab);
      } else {
        toast.error(json.error || 'Failed to update option');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Master Data & Lookup Tables Manager
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure dropdown values across Store Master, QC Master, and Inspection Reports. Options are retired via Active/Inactive toggles rather than hard-deleted.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 max-w-full">
        <div className="overflow-x-auto no-scrollbar max-w-full -mx-1 px-1">
          <TabsList className="flex flex-nowrap sm:flex-wrap h-auto p-1 bg-muted/60 gap-1 w-max sm:w-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.slug}
                value={tab.slug}
                className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs shrink-0"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <Card className="max-w-full overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg">{currentTab.label}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{currentTab.description}</CardDescription>
              </div>

              {/* Add Option Form */}
              <form onSubmit={handleAddOption} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder={`New ${currentTab.label} name...`}
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  className="h-9 w-full sm:w-60 min-w-0 text-sm"
                  required
                />
                <Button type="submit" size="sm" className="w-full sm:w-auto shrink-0" disabled={adding || !newOptionName.trim()}>
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Add Option
                </Button>
              </form>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="hidden sm:block rounded-md border overflow-x-auto max-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Option Name</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    {currentTab.hasIsActive && (
                      <TableHead className="text-right w-36">Toggle</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : options.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        No options configured in this table
                      </TableCell>
                    </TableRow>
                  ) : (
                    options.map((opt) => (
                      <TableRow key={opt.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {opt.id}
                        </TableCell>
                        <TableCell className="font-medium">{opt.name}</TableCell>
                        <TableCell>
                          {opt.isActive === 1 ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-300">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        {currentTab.hasIsActive && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={actionLoading === opt.id}
                              onClick={() => handleToggleActive(opt.id, opt.isActive)}
                            >
                              {opt.isActive === 1 ? (
                                <>
                                  <PowerOff className="mr-1 h-3 w-3 text-destructive" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Power className="mr-1 h-3 w-3 text-emerald-600" />
                                  Reactivate
                                </>
                              )}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Card list — below sm */}
            <div className="sm:hidden space-y-3">
              {loading ? (
                <div className="rounded-md border h-32 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : options.length === 0 ? (
                <div className="rounded-md border h-32 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  No options configured in this table
                </div>
              ) : (
                options.map((opt) => (
                  <div key={opt.id} className="rounded-md border p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-muted-foreground">#{opt.id}</div>
                        <div className="font-medium truncate">{opt.name}</div>
                      </div>
                      {opt.isActive === 1 ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 shrink-0">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-300 shrink-0">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    {currentTab.hasIsActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs"
                        disabled={actionLoading === opt.id}
                        onClick={() => handleToggleActive(opt.id, opt.isActive)}
                      >
                        {opt.isActive === 1 ? (
                          <>
                            <PowerOff className="mr-1 h-3 w-3 text-destructive" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Power className="mr-1 h-3 w-3 text-emerald-600" />
                            Reactivate
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
