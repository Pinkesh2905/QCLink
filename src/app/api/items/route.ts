// ============================================================================
// GET /api/items — paginated list with search/sort
// POST /api/items — create new item with UID generation
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { generateUID } from '@/lib/uid';
import { writeCreateAudit } from '@/lib/audit';
import { syncItemToSheet, appendAuditLogToSheet } from '@/lib/sheets-sync';
import { createItemSchema } from '@/validators/items';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { ItemWithLookups } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — List Items
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '15', 10), 100);
    const search = url.searchParams.get('search') || '';
    const sortBy = url.searchParams.get('sortBy') || 'CreatedAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    // Allowlist sortable columns
    const sortableColumns: Record<string, string> = {
      ItemUID: 'i.ItemUID',
      ItemName: 'i.ItemName',
      CategoryName: 'c.CategoryName',
      CurrentStock: 'i.CurrentStock',
      MinLevel: 'i.MinLevel',
      CreatedAt: 'i.CreatedAt',
      UpdatedAt: 'i.UpdatedAt',
    };
    const orderCol = sortableColumns[sortBy] || 'i.CreatedAt';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(i.ItemName LIKE ? OR i.ItemUID LIKE ? OR c.CategoryName LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const rows = await query<ItemWithLookups>(
      `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
       LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
       ${whereClause}
       ORDER BY ${orderCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRow] = await query<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       ${whereClause}`,
      params
    );

    return NextResponse.json({
      data: rows,
      total: countRow.total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow.total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// POST — Create Item
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const parsed = createItemSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    // Uniqueness check: (ItemName, CategoryID) case-insensitive
    const existing = await query<{ ItemUID: string }>(
      `SELECT ItemUID FROM Items
       WHERE LOWER(ItemName) = LOWER(?) AND CategoryID = ?
       LIMIT 1`,
      [data.ItemName, data.CategoryID]
    );

    if (existing.length > 0) {
      throw new AppError('Item already available. Kindly check!', 409, 'ItemName');
    }

    const itemUID = await withTransaction(async (conn) => {
      // Re-check immediately before inserting: the check above ran outside this
      // transaction, so a concurrent request could have inserted the same
      // (ItemName, CategoryID) in between. This narrows — but, absent a DB-level
      // UNIQUE constraint, can't fully close — that race; see errorResponse()'s
      // ER_DUP_ENTRY handling for the authoritative backstop.
      const [dupeRecheck] = await conn.execute(
        `SELECT ItemUID FROM Items WHERE LOWER(ItemName) = LOWER(?) AND CategoryID = ? LIMIT 1`,
        [data.ItemName, data.CategoryID]
      ) as [Array<{ ItemUID: string }>, unknown];

      if (dupeRecheck.length > 0) {
        throw new AppError('Item already available. Kindly check!', 409, 'ItemName');
      }

      const uid = await generateUID(conn, 'Item');

      await conn.execute(
        `INSERT INTO Items (ItemUID, ItemName, CategoryID, UOMID, SubCategoryID, Make, Size, CurrentStock, MPQ, MinLevel, OwnerUserID, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          uid,
          data.ItemName,
          data.CategoryID,
          data.UOMID,
          data.SubCategoryID ?? null,
          data.Make ?? null,
          data.Size ?? null,
          data.CurrentStock ?? null,
          data.MPQ ?? null,
          data.MinLevel ?? null,
          ctx.user.userId,
        ]
      );

      await writeCreateAudit(conn, 'Items', uid, ctx.user.userId);

      return uid;
    });

    await syncItemToSheet(itemUID);
    await appendAuditLogToSheet([
      {
        tableName: 'Items',
        recordId: itemUID,
        actionType: 'CREATE',
        fieldName: null,
        oldValue: null,
        newValue: null,
        changedByUserID: ctx.user.userId,
      },
    ]);

    return NextResponse.json(
      { message: 'Item created successfully', ItemUID: itemUID },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
