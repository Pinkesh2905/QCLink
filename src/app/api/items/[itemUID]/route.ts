// ============================================================================
// GET /api/items/[itemUID] — get item detail
// PUT /api/items/[itemUID] — update item (with ItemName sync)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs, writeAuditLog } from '@/lib/audit';
import { enforceFieldPermissions } from '@/lib/field-permissions';
import { updateItemSchema } from '@/validators/items';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { Item, ItemWithLookups } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — Item Detail
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const itemUID = params.itemUID;

    const rows = await query<ItemWithLookups>(
      `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
       LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
       WHERE i.ItemUID = ?`,
      [itemUID]
    );

    if (rows.length === 0) {
      throw new AppError('Item not found', 404);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// PUT — Update Item
// ---------------------------------------------------------------------------
export const PUT = withAuth(async (req: NextRequest, ctx) => {
  try {
    const routeParams = await ctx.params;
    const itemUID = routeParams.itemUID;

    const body = await req.json();
    const parsed = updateItemSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    // Fetch current row
    const [currentItem] = await query<Item>(
      'SELECT * FROM Items WHERE ItemUID = ?',
      [itemUID]
    );

    if (!currentItem) {
      throw new AppError('Item not found', 404);
    }

    // Uniqueness check if ItemName or CategoryID changed
    const newName = data.ItemName ?? currentItem.ItemName;
    const newCat = data.CategoryID ?? currentItem.CategoryID;

    if (
      newName.toLowerCase() !== currentItem.ItemName.toLowerCase() ||
      newCat !== currentItem.CategoryID
    ) {
      const dupes = await query<{ ItemUID: string }>(
        `SELECT ItemUID FROM Items
         WHERE LOWER(ItemName) = LOWER(?) AND CategoryID = ? AND ItemUID != ?
         LIMIT 1`,
        [newName, newCat, itemUID]
      );

      if (dupes.length > 0) {
        throw new AppError('Item already available. Kindly check!', 409, 'ItemName');
      }
    }

    const editableFields = [
      'ItemName', 'CategoryID', 'UOMID', 'SubCategoryID',
      'Make', 'Size', 'CurrentStock', 'MPQ', 'MinLevel',
    ];

    const newRow: Record<string, unknown> = { ...currentItem };

    for (const field of editableFields) {
      if (field in data) {
        const value = (data as Record<string, unknown>)[field];
        newRow[field] = value ?? null;
      }
    }

    // Diff and verify field permissions
    const diffs = diffFields(
      currentItem as unknown as Record<string, unknown>,
      newRow,
      editableFields
    );

    if (diffs.length === 0) {
      return NextResponse.json({ message: 'No changes detected' });
    }

    const changedFieldNames = diffs.map((d) => d.field);
    await enforceFieldPermissions('Items', changedFieldNames, ctx.user.role);

    await withTransaction(async (conn) => {
      // Build update SET clause dynamically
      const fields: string[] = [];
      const values: unknown[] = [];

      for (const field of editableFields) {
        if (field in data) {
          const value = (data as Record<string, unknown>)[field];
          fields.push(`${field} = ?`);
          values.push(value ?? null);
        }
      }

      fields.push('UpdatedAt = NOW()');
      values.push(itemUID);

      await conn.execute(
        `UPDATE Items SET ${fields.join(', ')} WHERE ItemUID = ?`,
        values as any
      );

      // Audit log diffs
      await writeAuditDiffs(conn, 'Items', itemUID, diffs, ctx.user.userId);

      // Cross-module ItemName sync (Section 7)
      if (data.ItemName && data.ItemName !== currentItem.ItemName) {
        // Update QCMaster.ItemName
        const [qcResult] = await conn.execute(
          'SELECT QCUID FROM QCMaster WHERE ItemUID = ?',
          [itemUID]
        ) as [Array<{ QCUID: string }>, unknown];

        if (qcResult.length > 0) {
          await conn.execute(
            'UPDATE QCMaster SET ItemName = ?, UpdatedAt = NOW() WHERE ItemUID = ?',
            [data.ItemName, itemUID]
          );

          // AuditLog for each QCMaster row
          const qcAuditEntries = qcResult.map((row) => ({
            tableName: 'QCMaster',
            recordId: row.QCUID,
            actionType: 'UPDATE' as const,
            fieldName: 'ItemName',
            oldValue: currentItem.ItemName,
            newValue: data.ItemName!,
            changedByUserID: ctx.user.userId,
          }));
          await writeAuditLog(conn, qcAuditEntries);
        }

        // Update InspectionReports.ItemName
        const [irResult] = await conn.execute(
          'SELECT IIRUID FROM InspectionReports WHERE ItemUID = ?',
          [itemUID]
        ) as [Array<{ IIRUID: string }>, unknown];

        if (irResult.length > 0) {
          await conn.execute(
            'UPDATE InspectionReports SET ItemName = ?, UpdatedAt = NOW() WHERE ItemUID = ?',
            [data.ItemName, itemUID]
          );

          // AuditLog for each IR row
          const irAuditEntries = irResult.map((row) => ({
            tableName: 'InspectionReports',
            recordId: row.IIRUID,
            actionType: 'UPDATE' as const,
            fieldName: 'ItemName',
            oldValue: currentItem.ItemName,
            newValue: data.ItemName!,
            changedByUserID: ctx.user.userId,
          }));
          await writeAuditLog(conn, irAuditEntries);
        }
      }
    });

    return NextResponse.json({ message: 'Item updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
