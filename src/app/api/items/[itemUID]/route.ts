// ============================================================================
// GET /api/items/[itemUID] — get item detail (caller's company only)
// PUT /api/items/[itemUID] — update item (with ItemName sync)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withWriteAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs, writeAuditLog } from '@/lib/audit';
import { assertLookupIdsVisible } from '@/lib/lookups';
import { requireCompanyId } from '@/lib/tenant';
import {
  syncItemToSheet,
  syncQCMasterToSheet,
  syncInspectionReportToSheet,
  appendAuditLogToSheet,
  type SheetAuditEntry,
} from '@/lib/sheets-sync';
import { enforceFieldPermissions } from '@/lib/field-permissions';
import { updateItemSchema } from '@/validators/items';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type { Item, ItemWithLookups } from '@/types/db';

// ---------------------------------------------------------------------------
// GET — Item Detail
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
    const params = await ctx.params;
    const itemUID = params.itemUID;

    const rows = await query<ItemWithLookups>(
      `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
       LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
       WHERE i.CompanyID = ? AND i.ItemUID = ?`,
      [companyId, itemUID]
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
export const PUT = withWriteAuth(async (req: NextRequest, ctx) => {
  try {
    const companyId = requireCompanyId(ctx.user);
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
      'SELECT * FROM Items WHERE CompanyID = ? AND ItemUID = ?',
      [companyId, itemUID]
    );

    if (!currentItem) {
      throw new AppError('Item not found', 404);
    }

    await assertLookupIdsVisible(companyId, [
      { slug: 'categories', ids: [data.CategoryID] },
      { slug: 'unit-of-stock', ids: [data.UOMID] },
      { slug: 'sub-categories', ids: [data.SubCategoryID] },
    ]);

    // Uniqueness check if ItemName or CategoryID changed
    const newName = data.ItemName ?? currentItem.ItemName;
    const newCat = data.CategoryID ?? currentItem.CategoryID;
    const identityChanged =
      newName.toLowerCase() !== currentItem.ItemName.toLowerCase() ||
      newCat !== currentItem.CategoryID;

    if (identityChanged) {
      const dupes = await query<{ ItemUID: string }>(
        `SELECT ItemUID FROM Items
         WHERE CompanyID = ? AND LOWER(ItemName) = LOWER(?) AND CategoryID = ? AND ItemUID != ?
         LIMIT 1`,
        [companyId, newName, newCat, itemUID]
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

    const cascadedQCUIDs: string[] = [];
    const cascadedIIRUIDs: string[] = [];

    await withTransaction(async (conn) => {
      // Re-check uniqueness immediately before writing (see items/route.ts
      // POST for why: the earlier check ran outside this transaction).
      if (identityChanged) {
        const [dupeRecheck] = await conn.execute(
          `SELECT ItemUID FROM Items
           WHERE CompanyID = ? AND LOWER(ItemName) = LOWER(?) AND CategoryID = ? AND ItemUID != ? LIMIT 1`,
          [companyId, newName, newCat, itemUID]
        ) as [Array<{ ItemUID: string }>, unknown];

        if (dupeRecheck.length > 0) {
          throw new AppError('Item already available. Kindly check!', 409, 'ItemName');
        }
      }

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
      values.push(companyId, itemUID);

      await conn.execute(
        `UPDATE Items SET ${fields.join(', ')} WHERE CompanyID = ? AND ItemUID = ?`,
        values as any
      );

      // Audit log diffs
      await writeAuditDiffs(conn, companyId, 'Items', itemUID, diffs, ctx.user.userId);

      // Cross-module ItemName sync (Section 7)
      if (data.ItemName && data.ItemName !== currentItem.ItemName) {
        // Update QCMaster.ItemName
        const [qcResult] = await conn.execute(
          'SELECT QCUID FROM QCMaster WHERE CompanyID = ? AND ItemUID = ?',
          [companyId, itemUID]
        ) as [Array<{ QCUID: string }>, unknown];

        if (qcResult.length > 0) {
          await conn.execute(
            'UPDATE QCMaster SET ItemName = ?, UpdatedAt = NOW() WHERE CompanyID = ? AND ItemUID = ?',
            [data.ItemName, companyId, itemUID]
          );

          await writeAuditLog(
            conn,
            qcResult.map((row) => ({
              companyId,
              tableName: 'QCMaster',
              recordId: row.QCUID,
              actionType: 'UPDATE' as const,
              fieldName: 'ItemName',
              oldValue: currentItem.ItemName,
              newValue: data.ItemName!,
              changedByUserID: ctx.user.userId,
            }))
          );
          cascadedQCUIDs.push(...qcResult.map((row) => row.QCUID));
        }

        // Update InspectionReports.ItemName
        const [irResult] = await conn.execute(
          'SELECT IIRUID FROM InspectionReports WHERE CompanyID = ? AND ItemUID = ?',
          [companyId, itemUID]
        ) as [Array<{ IIRUID: string }>, unknown];

        if (irResult.length > 0) {
          await conn.execute(
            'UPDATE InspectionReports SET ItemName = ?, UpdatedAt = NOW() WHERE CompanyID = ? AND ItemUID = ?',
            [data.ItemName, companyId, itemUID]
          );

          await writeAuditLog(
            conn,
            irResult.map((row) => ({
              companyId,
              tableName: 'InspectionReports',
              recordId: row.IIRUID,
              actionType: 'UPDATE' as const,
              fieldName: 'ItemName',
              oldValue: currentItem.ItemName,
              newValue: data.ItemName!,
              changedByUserID: ctx.user.userId,
            }))
          );
          cascadedIIRUIDs.push(...irResult.map((row) => row.IIRUID));
        }
      }
    });

    await syncItemToSheet(companyId, itemUID);

    const sheetAuditEntries: SheetAuditEntry[] = diffs.map((d) => ({
      tableName: 'Items',
      recordId: itemUID,
      actionType: 'UPDATE',
      fieldName: d.field,
      oldValue: d.oldValue,
      newValue: d.newValue,
      changedByUserID: ctx.user.userId,
    }));

    for (const qcUID of cascadedQCUIDs) {
      await syncQCMasterToSheet(companyId, qcUID);
      sheetAuditEntries.push({
        tableName: 'QCMaster',
        recordId: qcUID,
        actionType: 'UPDATE',
        fieldName: 'ItemName',
        oldValue: currentItem.ItemName,
        newValue: data.ItemName!,
        changedByUserID: ctx.user.userId,
      });
    }

    for (const iirUID of cascadedIIRUIDs) {
      await syncInspectionReportToSheet(companyId, iirUID);
      sheetAuditEntries.push({
        tableName: 'InspectionReports',
        recordId: iirUID,
        actionType: 'UPDATE',
        fieldName: 'ItemName',
        oldValue: currentItem.ItemName,
        newValue: data.ItemName!,
        changedByUserID: ctx.user.userId,
      });
    }

    await appendAuditLogToSheet(companyId, sheetAuditEntries);

    return NextResponse.json({ message: 'Item updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
