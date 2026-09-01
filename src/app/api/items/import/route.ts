// ============================================================================
// POST /api/items/import
// Two-phase bulk CSV import endpoint for Items (Store Master).
// Phase 1 (confirm absent/false): validates all rows and returns preview.
// Phase 2 (confirm=true): re-validates, batch-reserves UIDs, and inserts.
// Admin only.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { reserveUIDs } from '@/lib/uid';
import { writeAuditLog } from '@/lib/audit';
import { parseCSV } from '@/lib/csv';
import { errorResponse, AppError } from '@/lib/errors';
import type { Category, UnitOfStock, SubCategory } from '@/types/db';

interface ValidatedItem {
  rowNumber: number;
  ItemName: string;
  CategoryID: number;
  CategoryName: string;
  UOMID: number;
  UOMName: string;
  SubCategoryID: number | null;
  SubCategoryName: string | null;
  Make: string | null;
  Size: number | null;
  CurrentStock: number | null;
  MPQ: number | null;
  MinLevel: number | null;
}

interface RowError {
  rowNumber: number;
  row: Record<string, string>;
  error: string;
}

export const POST = withAdmin(async (req: NextRequest, ctx) => {
  try {
    const isConfirm = req.nextUrl.searchParams.get('confirm') === 'true';

    // 1. Extract CSV string
    let csvText = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        throw new AppError('No CSV file provided in form data', 400);
      }
      csvText = await file.text();
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      csvText = json.csvContent || '';
    } else {
      csvText = await req.text();
    }

    if (!csvText.trim()) {
      throw new AppError('CSV content cannot be empty', 400);
    }

    // 2. Parse CSV
    const { headers, rows } = parseCSV(csvText);

    if (rows.length === 0) {
      throw new AppError('No data rows found in uploaded CSV file', 400);
    }

    // 3. Load active lookups
    const [categories, uoms, subCategories] = await Promise.all([
      query<Category>('SELECT CategoryID, CategoryName FROM Categories WHERE IsActive = 1'),
      query<UnitOfStock>('SELECT UOMID, UOMName FROM UnitOfStock WHERE IsActive = 1'),
      query<SubCategory>('SELECT SubCategoryID, SubCategoryName FROM SubCategories WHERE IsActive = 1'),
    ]);

    const categoryMap = new Map<string, Category>();
    categories.forEach((c) => categoryMap.set(c.CategoryName.trim().toLowerCase(), c));

    const uomMap = new Map<string, UnitOfStock>();
    uoms.forEach((u) => uomMap.set(u.UOMName.trim().toLowerCase(), u));

    const subCategoryMap = new Map<string, SubCategory>();
    subCategories.forEach((s) => subCategoryMap.set(s.SubCategoryName.trim().toLowerCase(), s));

    // 4. Load existing items for uniqueness: (LOWER(ItemName), CategoryID)
    const existingItems = await query<{ name: string; catId: number }>(
      'SELECT LOWER(ItemName) as name, CategoryID as catId FROM Items'
    );
    const existingKeys = new Set(existingItems.map((i) => `${i.name}:::${i.catId}`));

    // 5. Validate rows
    const validRows: ValidatedItem[] = [];
    const errorRows: RowError[] = [];
    const batchKeys = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +1 for 1-based, +1 for header row

      const itemName = (row.ItemName || '').trim();
      const catName = (row.Category || row.CategoryName || '').trim();
      const uomName = (row.UnitOfStock || row.UOMName || row.UOM || '').trim();
      const subCatName = (row.SubCategory || row.SubCategoryName || '').trim();
      const make = (row.Make || '').trim() || null;

      // Required fields check
      if (!itemName) {
        errorRows.push({ rowNumber, row, error: 'ItemName is required' });
        continue;
      }

      if (!catName) {
        errorRows.push({ rowNumber, row, error: 'Category is required' });
        continue;
      }

      const matchedCategory = categoryMap.get(catName.toLowerCase());
      if (!matchedCategory) {
        errorRows.push({
          rowNumber,
          row,
          error: `Category "${catName}" not found or inactive`,
        });
        continue;
      }

      if (!uomName) {
        errorRows.push({ rowNumber, row, error: 'UnitOfStock is required' });
        continue;
      }

      const matchedUOM = uomMap.get(uomName.toLowerCase());
      if (!matchedUOM) {
        errorRows.push({
          rowNumber,
          row,
          error: `Unit of Stock "${uomName}" not found or inactive`,
        });
        continue;
      }

      let subCategoryID: number | null = null;
      let resolvedSubCatName: string | null = null;
      if (subCatName) {
        const matchedSub = subCategoryMap.get(subCatName.toLowerCase());
        if (!matchedSub) {
          errorRows.push({
            rowNumber,
            row,
            error: `SubCategory "${subCatName}" not found or inactive`,
          });
          continue;
        }
        subCategoryID = matchedSub.SubCategoryID;
        resolvedSubCatName = matchedSub.SubCategoryName;
      }

      // Numeric validations
      let size: number | null = null;
      if (row.Size !== undefined && row.Size !== '') {
        const parsed = Number(row.Size);
        if (isNaN(parsed)) {
          errorRows.push({ rowNumber, row, error: `Size "${row.Size}" must be a valid number` });
          continue;
        }
        size = parsed;
      }

      let currentStock: number | null = null;
      if (row.CurrentStock !== undefined && row.CurrentStock !== '') {
        const parsed = Number(row.CurrentStock);
        if (isNaN(parsed)) {
          errorRows.push({
            rowNumber,
            row,
            error: `CurrentStock "${row.CurrentStock}" must be a valid number`,
          });
          continue;
        }
        currentStock = parsed;
      }

      let mpq: number | null = null;
      if (row.MPQ !== undefined && row.MPQ !== '') {
        const parsed = Number(row.MPQ);
        if (isNaN(parsed)) {
          errorRows.push({ rowNumber, row, error: `MPQ "${row.MPQ}" must be a valid number` });
          continue;
        }
        mpq = parsed;
      }

      let minLevel: number | null = null;
      if (row.MinLevel !== undefined && row.MinLevel !== '') {
        const parsed = Number(row.MinLevel);
        if (isNaN(parsed)) {
          errorRows.push({
            rowNumber,
            row,
            error: `MinLevel "${row.MinLevel}" must be a valid number`,
          });
          continue;
        }
        minLevel = parsed;
      }

      // Uniqueness check: (LOWER(ItemName), CategoryID)
      const uniqueKey = `${itemName.toLowerCase()}:::${matchedCategory.CategoryID}`;
      if (existingKeys.has(uniqueKey)) {
        errorRows.push({
          rowNumber,
          row,
          error: `Item "${itemName}" in category "${matchedCategory.CategoryName}" already exists in database`,
        });
        continue;
      }

      if (batchKeys.has(uniqueKey)) {
        errorRows.push({
          rowNumber,
          row,
          error: `Duplicate item "${itemName}" in category "${matchedCategory.CategoryName}" within this import file`,
        });
        continue;
      }

      batchKeys.add(uniqueKey);

      validRows.push({
        rowNumber,
        ItemName: itemName,
        CategoryID: matchedCategory.CategoryID,
        CategoryName: matchedCategory.CategoryName,
        UOMID: matchedUOM.UOMID,
        UOMName: matchedUOM.UOMName,
        SubCategoryID: subCategoryID,
        SubCategoryName: resolvedSubCatName,
        Make: make,
        Size: size,
        CurrentStock: currentStock,
        MPQ: mpq,
        MinLevel: minLevel,
      });
    }

    // Phase 1: Validation preview only
    if (!isConfirm) {
      return NextResponse.json({
        valid: validRows,
        errors: errorRows,
        validCount: validRows.length,
        errorCount: errorRows.length,
        totalRows: rows.length,
      });
    }

    // Phase 2: Commit confirmed valid rows
    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        insertedCount: 0,
        skippedCount: errorRows.length,
        errors: errorRows,
        message: 'No valid rows found to import.',
      });
    }

    const insertedUIDs = await withTransaction(async (conn) => {
      // 1. Reserve contiguous UIDs in a single atomic operation
      const uids = await reserveUIDs(conn, 'Item', validRows.length);

      // 2. Insert all valid items
      for (let idx = 0; idx < validRows.length; idx++) {
        const item = validRows[idx];
        const uid = uids[idx];

        await conn.execute(
          `INSERT INTO Items (
            ItemUID, ItemName, CategoryID, UOMID, SubCategoryID,
            Make, Size, CurrentStock, MPQ, MinLevel,
            OwnerUserID, CreatedAt, UpdatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            uid,
            item.ItemName,
            item.CategoryID,
            item.UOMID,
            item.SubCategoryID,
            item.Make,
            item.Size,
            item.CurrentStock,
            item.MPQ,
            item.MinLevel,
            ctx.user.userId,
          ]
        );
      }

      // 3. Write one AuditLog entry per created item
      const auditEntries = uids.map((uid) => ({
        tableName: 'Items',
        recordId: uid,
        actionType: 'CREATE' as const,
        fieldName: null,
        oldValue: null,
        newValue: 'Bulk CSV Import',
        changedByUserID: ctx.user.userId,
      }));

      await writeAuditLog(conn, auditEntries);

      return uids;
    });

    return NextResponse.json({
      success: true,
      insertedCount: validRows.length,
      skippedCount: errorRows.length,
      errors: errorRows,
      message: `Successfully imported ${validRows.length} items (${errorRows.length} skipped due to errors).`,
      uids: insertedUIDs,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
