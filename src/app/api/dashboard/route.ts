// ============================================================================
// GET /api/dashboard
// Returns summary counts, inspection outcome trends, low stock alerts,
// and recent audit activity feed.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import type {
  DashboardData,
  InspectionTrendPoint,
  LowStockItem,
  RecentActivityEntry,
} from '@/types/api';

export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    // 1. Summary Counts
    const [items] = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM Items'
    );
    const [qc] = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM QCMaster'
    );
    const [inspections] = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM InspectionReports
       WHERE MONTH(InspectionDate) = MONTH(NOW()) AND YEAR(InspectionDate) = YEAR(NOW())`
    );

    let pendingApprovals = 0;
    if (ctx.user.role === 'Admin') {
      const [pending] = await query<{ count: number }>(
        "SELECT COUNT(*) as count FROM Users WHERE Status = 'Pending'"
      );
      pendingApprovals = pending?.count ?? 0;
    }

    // 2. Inspection Outcomes Trend (Grouped by InspectionDate over last 12 weeks)
    const trendRows = await query<{
      periodKey: string;
      periodLabel: string;
      statusName: string;
      cnt: number;
    }>(
      `SELECT 
         DATE_FORMAT(r.InspectionDate, '%Y-%u') AS periodKey,
         DATE_FORMAT(r.InspectionDate, '%b %d') AS periodLabel,
         COALESCE(rs.ResultStatusName, 'Unknown') AS statusName,
         COUNT(*) AS cnt
       FROM InspectionReports r
       LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
       WHERE r.InspectionDate >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
       GROUP BY periodKey, periodLabel, rs.ResultStatusName
       ORDER BY periodKey ASC`
    );

    // Aggregate into distinct period points
    const periodMap = new Map<string, InspectionTrendPoint>();

    for (const row of trendRows) {
      if (!periodMap.has(row.periodKey)) {
        periodMap.set(row.periodKey, {
          period: row.periodLabel,
          accept: 0,
          reject: 0,
          deviation: 0,
          total: 0,
        });
      }

      const point = periodMap.get(row.periodKey)!;
      const s = (row.statusName || '').toLowerCase();
      const count = Number(row.cnt) || 0;

      if (s.includes('deviation')) {
        point.deviation += count;
      } else if (s.includes('reject') || s.includes('fail')) {
        point.reject += count;
      } else if (s.includes('accept') || s.includes('pass') || s.includes('ok')) {
        point.accept += count;
      } else {
        point.accept += count; // Default bucket for positive outcome
      }
      point.total += count;
    }

    const inspectionTrend: InspectionTrendPoint[] = Array.from(periodMap.values());

    // 3. Items Below Min Level (Table is UnitOfStock, singular)
    const lowStockItems = await query<LowStockItem>(
      `SELECT 
         i.ItemUID,
         i.ItemName,
         i.CurrentStock,
         i.MinLevel,
         c.CategoryName,
         u.UOMName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       WHERE i.CurrentStock IS NOT NULL 
         AND i.MinLevel IS NOT NULL 
         AND i.CurrentStock < i.MinLevel
       ORDER BY (i.MinLevel - i.CurrentStock) DESC
       LIMIT 15`
    );

    // 4. Stock Analytics & Health (Store Master)
    const stockHealthRows = await query<{
      status: 'NotTracked' | 'OutOfStock' | 'LowStock' | 'InStock';
      count: number;
    }>(
      `SELECT
         CASE
           WHEN i.MinLevel IS NULL OR i.CurrentStock IS NULL THEN 'NotTracked'
           WHEN i.CurrentStock <= 0 THEN 'OutOfStock'
           WHEN i.CurrentStock < i.MinLevel THEN 'LowStock'
           ELSE 'InStock'
         END AS status,
         COUNT(*) AS count
       FROM Items i
       GROUP BY status`
    );

    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let notTrackedCount = 0;

    for (const row of stockHealthRows) {
      const cnt = Number(row.count) || 0;
      if (row.status === 'InStock') inStockCount = cnt;
      else if (row.status === 'LowStock') lowStockCount = cnt;
      else if (row.status === 'OutOfStock') outOfStockCount = cnt;
      else if (row.status === 'NotTracked') notTrackedCount = cnt;
    }

    const categoryDistribution = await query<{
      categoryName: string;
      itemCount: number;
      totalStock: number;
    }>(
      `SELECT 
         COALESCE(c.CategoryName, 'Uncategorized') AS categoryName,
         COUNT(i.ItemUID) AS itemCount,
         COALESCE(SUM(i.CurrentStock), 0) AS totalStock
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       GROUP BY c.CategoryID, c.CategoryName
       ORDER BY itemCount DESC
       LIMIT 8`
    );

    // 5. Recent Activity Feed (Admin Only - skipped entirely for non-admin users)
    let recentActivity: RecentActivityEntry[] = [];
    if (ctx.user.role === 'Admin') {
      recentActivity = await query<RecentActivityEntry>(
        `SELECT 
           a.AuditID,
           a.TableName,
           a.RecordID,
           a.ActionType,
           a.FieldName,
           a.OldValue,
           a.NewValue,
           a.ChangedAt,
           COALESCE(u.Name, 'System') AS ChangedByName
         FROM AuditLog a
         LEFT JOIN Users u ON a.ChangedByUserID = u.UserID
         ORDER BY a.ChangedAt DESC
         LIMIT 10`
      );
    }

    const data: DashboardData = {
      totalItems: items?.count ?? 0,
      totalQCTemplates: qc?.count ?? 0,
      inspectionsThisMonth: inspections?.count ?? 0,
      pendingApprovals,
      inspectionTrend,
      lowStockItems: lowStockItems || [],
      recentActivity,
      stockAnalytics: {
        health: {
          inStockCount,
          lowStockCount,
          outOfStockCount,
          notTrackedCount,
          totalTrackedItems: items?.count ?? 0,
        },
        categories: categoryDistribution || [],
      },
    };

    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
});
