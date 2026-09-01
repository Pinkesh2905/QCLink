// ============================================================================
// GET /api/items/export
// Exports items to CSV. Supports search filter or full export.
// Available to all authenticated users.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query } from '@/lib/db';
import { generateCSV } from '@/lib/csv';
import { errorResponse } from '@/lib/errors';
import type { ItemWithLookups } from '@/types/db';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const exportAll = url.searchParams.get('exportAll') === 'true';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search && !exportAll) {
      conditions.push('(i.ItemName LIKE ? OR i.ItemUID LIKE ? OR c.CategoryName LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<ItemWithLookups>(
      `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
       LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY i.ItemUID ASC`,
      params
    );

    const headers = [
      'ItemUID',
      'ItemName',
      'Category',
      'UnitOfStock',
      'SubCategory',
      'Make',
      'Size',
      'CurrentStock',
      'MPQ',
      'MinLevel',
      'Owner',
      'CreatedAt',
      'UpdatedAt',
    ];

    const exportRows = rows.map((r) => ({
      ItemUID: r.ItemUID,
      ItemName: r.ItemName,
      Category: r.CategoryName || '',
      UnitOfStock: r.UOMName || '',
      SubCategory: r.SubCategoryName || '',
      Make: r.Make || '',
      Size: r.Size != null ? r.Size : '',
      CurrentStock: r.CurrentStock != null ? r.CurrentStock : '',
      MPQ: r.MPQ != null ? r.MPQ : '',
      MinLevel: r.MinLevel != null ? r.MinLevel : '',
      Owner: r.OwnerName || '',
      CreatedAt: new Date(r.CreatedAt).toISOString(),
      UpdatedAt: new Date(r.UpdatedAt).toISOString(),
    }));

    const csvContent = generateCSV(headers, exportRows);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qclink_items_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
