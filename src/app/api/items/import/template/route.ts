// ============================================================================
// GET /api/items/import/template
// Downloads the standard CSV template for bulk item importing.
// Admin only.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { generateCSV } from '@/lib/csv';

export const GET = withAdmin(async (_req: NextRequest) => {
  const headers = [
    'ItemName',
    'Category',
    'UnitOfStock',
    'SubCategory',
    'Make',
    'Size',
    'CurrentStock',
    'MPQ',
    'MinLevel',
  ];

  const sampleRows = [
    {
      ItemName: 'Hexagonal Bolt M8x30',
      Category: 'Hardware',
      UnitOfStock: 'Nos',
      SubCategory: 'Fasteners',
      Make: 'Unbrako',
      Size: '8',
      CurrentStock: '500',
      MPQ: '50',
      MinLevel: '100',
    },
  ];

  const csvContent = generateCSV(headers, sampleRows);

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="qclink_items_template.csv"',
    },
  });
});
