'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package,
  ClipboardCheck,
  FileText,
  Users,
  AlertTriangle,
  Activity,
  ArrowRight,
  TrendingUp,
  Clock,
  ExternalLink,
  ShieldCheck,
  Boxes,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import type { DashboardData } from '@/types/api';

function formatRelativeTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (isValid(d)) {
      return formatDistanceToNow(d, { addSuffix: true });
    }
  } catch {
    // fallback
  }
  return String(dateStr);
}

function getActionBadge(actionType: string) {
  switch (actionType.toUpperCase()) {
    case 'CREATE':
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-300 dark:text-emerald-400">CREATE</Badge>;
    case 'UPDATE':
      return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-300 dark:text-blue-400">UPDATE</Badge>;
    case 'DELETE':
      return <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 border-rose-300 dark:text-rose-400">DELETE</Badge>;
    default:
      return <Badge variant="outline">{actionType}</Badge>;
  }
}

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1', '#64748b'];

export default function DashboardPage() {
  const { user } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchDashboard() {
    try {
      setError(null);
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        setData(await res.json());
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `Server returned status ${res.status} while loading dashboard data.`);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Network error while loading dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  const isAdmin = user?.Role === 'Admin';

  const cards = [
    {
      title: 'Total Items',
      value: data?.totalItems ?? 0,
      icon: <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      href: '/app/store-master',
    },
    {
      title: 'QC Templates',
      value: data?.totalQCTemplates ?? 0,
      icon: <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      href: '/app/qc-master',
    },
    {
      title: 'Inspections This Month',
      value: data?.inspectionsThisMonth ?? 0,
      icon: <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />,
      bg: 'bg-violet-50 dark:bg-violet-950/50',
      href: '/app/inspection-report',
    },
    ...(isAdmin
      ? [
          {
            title: 'Pending Approvals',
            value: data?.pendingApprovals ?? 0,
            icon: <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
            bg: 'bg-amber-50 dark:bg-amber-950/50',
            href: '/app/admin/approvals',
          },
        ]
      : [
          {
            title: 'Low Stock Alerts',
            value: data?.lowStockItems?.length ?? 0,
            icon: <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
            bg: 'bg-rose-50 dark:bg-rose-950/50',
            href: '/app/store-master',
          },
        ]),
  ];

  const stockHealth = data?.stockAnalytics?.health;
  const totalStockItems = stockHealth?.totalTrackedItems || data?.totalItems || 0;
  const inStockPct = totalStockItems > 0 ? Math.round(((stockHealth?.inStockCount ?? 0) / totalStockItems) * 100) : 0;
  const lowStockPct = totalStockItems > 0 ? Math.round(((stockHealth?.lowStockCount ?? 0) / totalStockItems) * 100) : 0;
  const outOfStockPct = totalStockItems > 0 ? Math.round(((stockHealth?.outOfStockCount ?? 0) / totalStockItems) * 100) : 0;
  const notTrackedPct = totalStockItems > 0 ? Math.round(((stockHealth?.notTrackedCount ?? 0) / totalStockItems) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, {user?.Name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Real-time quality control outcomes, inventory health, and store analytics.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline">
            <Link href="/app/inspection-report/new">
              <FileText className="mr-1.5 h-4 w-4" />
              New Inspection
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app/store-master/new">
              <Package className="mr-1.5 h-4 w-4" />
              New Item
            </Link>
          </Button>
        </div>
      </div>

      {/* Error Alert if dashboard fetch fails */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-3 sm:p-4 text-sm text-destructive">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 hover:bg-destructive/20 text-destructive text-xs shrink-0 ml-2"
            onClick={() => {
              setLoading(true);
              fetchDashboard();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Top 4 Summary Metric Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="group min-w-0">
            <Card className="transition-all hover:border-primary/50 hover:shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">
                  {card.title}
                </CardTitle>
                <div className={`rounded-lg p-2 shrink-0 ${card.bg}`}>{card.icon}</div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl sm:text-3xl font-bold">{card.value}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main Analytics Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 min-w-0">
        {/* Inspection Outcomes Trend Chart (7 or 8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0 w-full space-y-6">
          <Card className="w-full min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-primary shrink-0" />
                  <span>Inspection Outcomes Over Time</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Outcome distribution (Accept vs. Deviation vs. Reject) over past 12 weeks
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs self-start sm:self-auto shrink-0 h-8 px-2">
                <Link href="/app/inspection-report">
                  View Reports
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0 pb-4 px-2 sm:px-6">
              {loading ? (
                <div className="h-64 sm:h-72 w-full animate-pulse rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs sm:text-sm">
                  Loading inspection analytics...
                </div>
              ) : !data?.inspectionTrend || data.inspectionTrend.length === 0 ? (
                <div className="h-64 sm:h-72 w-full flex flex-col items-center justify-center rounded-lg border border-dashed text-center p-6">
                  <ShieldCheck className="h-9 w-9 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No inspection report data available</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                    Create new inspection reports to view outcome trends and quality distributions.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href="/app/inspection-report/new">Create First Inspection</Link>
                  </Button>
                </div>
              ) : (
                <div className="h-64 sm:h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.inspectionTrend}
                      margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                      <XAxis
                        dataKey="period"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingBottom: '8px', fontSize: '11px' }}
                      />
                      <Bar dataKey="accept" name="Accept" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="deviation" name="Accept Under Dev." fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
                      <Bar dataKey="reject" name="Reject" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Below Min Level Table */}
          <Card className="w-full min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span>Items Below Minimum Level</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Inventory items requiring reorder or restock attention
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="text-xs self-start sm:self-auto shrink-0 h-8">
                <Link href="/app/store-master">
                  Manage Stock
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : !data?.lowStockItems || data.lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-5 text-center rounded-lg border border-dashed">
                  <ShieldCheck className="h-7 w-7 text-emerald-500 mb-1" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Stock Levels Optimal
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All inventory items are currently at or above their configured minimum thresholds.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="pb-2 pl-2 sm:pl-0 font-medium">Item UID</th>
                        <th className="pb-2 font-medium">Item Name</th>
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 text-right font-medium">Current</th>
                        <th className="pb-2 text-right font-medium">Min Level</th>
                        <th className="pb-2 text-right pr-2 sm:pr-0 font-medium">Deficit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data.lowStockItems.map((item) => {
                        const deficit = (item.MinLevel || 0) - (item.CurrentStock || 0);
                        return (
                          <tr key={item.ItemUID} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 pl-2 sm:pl-0 font-mono text-xs font-semibold text-primary">
                              {item.ItemUID}
                            </td>
                            <td className="py-2.5 font-medium truncate max-w-[150px]">{item.ItemName}</td>
                            <td className="py-2.5 text-xs text-muted-foreground">
                              {item.CategoryName || '—'}
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                              {item.CurrentStock ?? 0} {item.UOMName || ''}
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                              {item.MinLevel ?? 0} {item.UOMName || ''}
                            </td>
                            <td className="py-2.5 pr-2 sm:pr-0 text-right">
                              <Badge variant="destructive" className="font-mono text-[11px] py-0 h-5">
                                -{deficit}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side Column (5 or 4 cols): Stock Analytics & Admin Recent Activity */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0 w-full space-y-6">
          {/* Store Master Stock Analytics Card (Visible to all users) */}
          <Card className="w-full min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Boxes className="h-4.5 w-4.5 text-primary shrink-0" />
                  <span>Stock Analytics</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Store Master health & category distribution
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs shrink-0 h-8 px-2">
                <Link href="/app/store-master">
                  Store Master
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-16 animate-pulse rounded bg-muted" />
                  <div className="h-32 animate-pulse rounded bg-muted" />
                </div>
              ) : (
                <>
                  {/* Stock Health Status Badges Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border bg-emerald-500/5 p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 mb-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">In Stock</span>
                      </div>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        {stockHealth?.inStockCount ?? 0}
                      </p>
                      <span className="text-[10px] text-muted-foreground">{inStockPct}%</span>
                    </div>

                    <div className="rounded-lg border bg-amber-500/5 p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-0.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">Low Stock</span>
                      </div>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        {stockHealth?.lowStockCount ?? 0}
                      </p>
                      <span className="text-[10px] text-muted-foreground">{lowStockPct}%</span>
                    </div>

                    <div className="rounded-lg border bg-rose-500/5 p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 mb-0.5">
                        <AlertOctagon className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">Out of Stock</span>
                      </div>
                      <p className="text-lg font-bold text-rose-700 dark:text-rose-300">
                        {stockHealth?.outOfStockCount ?? 0}
                      </p>
                      <span className="text-[10px] text-muted-foreground">{outOfStockPct}%</span>
                    </div>
                  </div>

                  {/* Optional Not Tracked indicator if items exist without MinLevel or CurrentStock */}
                  {(stockHealth?.notTrackedCount ?? 0) > 0 && (
                    <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Not Tracked (Missing Min/Stock)</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-[11px] h-5">
                        {stockHealth?.notTrackedCount} items ({notTrackedPct}%)
                      </Badge>
                    </div>
                  )}

                  {/* Stock Health Progress Distribution Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">Inventory Health Ratio</span>
                      <span className="font-mono text-[11px]">{totalStockItems} total items</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                      {inStockPct > 0 && (
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${inStockPct}%` }}
                          title={`In Stock: ${inStockPct}%`}
                        />
                      )}
                      {lowStockPct > 0 && (
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${lowStockPct}%` }}
                          title={`Low Stock: ${lowStockPct}%`}
                        />
                      )}
                      {outOfStockPct > 0 && (
                        <div
                          className="h-full bg-rose-500 transition-all"
                          style={{ width: `${outOfStockPct}%` }}
                          title={`Out of Stock: ${outOfStockPct}%`}
                        />
                      )}
                      {notTrackedPct > 0 && (
                        <div
                          className="h-full bg-slate-400 transition-all"
                          style={{ width: `${notTrackedPct}%` }}
                          title={`Not Tracked: ${notTrackedPct}%`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Category-wise Stock Distribution */}
                  <div className="space-y-3 pt-1 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        Category Stock Breakdown
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {data?.stockAnalytics?.categories?.length ?? 0} categories
                      </span>
                    </div>

                    {!data?.stockAnalytics?.categories || data.stockAnalytics.categories.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No category stock data available.</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {data.stockAnalytics.categories.map((cat, idx) => (
                          <div
                            key={cat.categoryName}
                            className="flex items-center justify-between rounded-md border p-2 text-xs hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                              />
                              <span className="font-medium truncate">{cat.categoryName}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <span className="text-muted-foreground">{cat.itemCount} items</span>
                              <Badge variant="outline" className="font-semibold text-[11px] py-0 h-5">
                                {cat.totalStock} qty
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed (ADMIN ONLY) */}
          {isAdmin && (
            <Card className="w-full min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-4.5 w-4.5 text-primary shrink-0" />
                    <span>Recent Activity</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Admin audit log entries
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs shrink-0 h-8 px-2">
                  <Link href="/app/admin/audit-log">
                    All Logs
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : !data?.recentActivity || data.recentActivity.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No recent activity recorded.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {data.recentActivity.map((act) => (
                      <div
                        key={act.AuditID}
                        className="flex flex-col gap-1 rounded-lg border p-2.5 text-xs hover:bg-muted/30 transition-colors min-w-0"
                      >
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1.5 font-medium min-w-0">
                            {getActionBadge(act.ActionType)}
                            <span className="text-foreground font-semibold truncate max-w-[110px]">
                              {act.TableName}
                            </span>
                            <span className="font-mono text-muted-foreground text-[11px] truncate max-w-[80px]">
                              {act.RecordID}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 ml-auto">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(act.ChangedAt)}
                          </span>
                        </div>

                        {act.FieldName && (
                          <div className="text-[11px] text-muted-foreground pl-1 border-l-2 border-primary/40 font-mono break-all line-clamp-2">
                            {act.FieldName}: <span className="text-muted-foreground/70">{act.OldValue || 'null'}</span> → <span className="font-semibold text-foreground">{act.NewValue || 'null'}</span>
                          </div>
                        )}

                        <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                          By <span className="font-medium text-foreground">{act.ChangedByName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
