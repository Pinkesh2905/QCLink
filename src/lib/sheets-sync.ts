// ============================================================================
// QCLink — Google Sheets Sync
// One-way mirror: after a write commits in MySQL, push the current row(s)
// to the owning company's Google Sheet (Companies.GoogleSheetID). MySQL stays
// the source of truth — this never reads back from the sheet. No-ops when the
// service account isn't configured or the company has no sheet.
// ============================================================================

import { query } from './db';
import { upsertRow, appendRows, replaceChildRows, safeSync, isSheetsConfigured } from './sheets';
import { formatISTForExport } from './datetime';
import type {
  ItemWithLookups,
  QCMasterWithLookups,
  QCSpecificationWithLookups,
  InspectionReportWithLookups,
  InspectionResultWithLookups,
  AuditActionType,
} from '@/types/db';

// ---------------------------------------------------------------------------
// Tab schemas
// ---------------------------------------------------------------------------

const ITEMS_TAB = 'Items';
const ITEMS_HEADERS = [
  'ItemUID', 'ItemName', 'Category', 'UOM', 'SubCategory', 'Make', 'Size',
  'CurrentStock', 'MPQ', 'MinLevel', 'Owner', 'CreatedAt', 'UpdatedAt',
];

const QC_MASTER_TAB = 'QCMaster';
const QC_MASTER_HEADERS = [
  'QCUID', 'ItemUID', 'ItemName', 'SpecCount', 'Owner', 'CreatedAt', 'UpdatedAt',
];

const QC_SPECS_TAB = 'QCSpecifications';
const QC_SPECS_HEADERS = [
  'QCUID', 'SrNo', 'Parameter', 'Criteria', 'MinVal', 'MaxVal', 'OtherValue',
  'Method', 'Frequency', 'Responsibility', 'ReactionPlan', 'Specification',
];

const INSPECTION_REPORTS_TAB = 'InspectionReports';
const INSPECTION_REPORTS_HEADERS = [
  'IIRUID', 'InspectionDate', 'ItemUID', 'ItemName', 'QCUID', 'GRNNo',
  'Status', 'Owner', 'CreatedAt', 'UpdatedAt',
];

const INSPECTION_RESULTS_TAB = 'InspectionResults';
const INSPECTION_RESULTS_HEADERS = [
  'IIRUID', 'SrNo', 'Parameter', 'Criteria', 'MinVal', 'MaxVal', 'OtherValue',
  'Method', 'Frequency', 'Responsibility', 'ReactionPlan', 'Specification',
  'Actual', 'ResultStatus',
];

const AUDIT_LOG_TAB = 'AuditLog';
const AUDIT_LOG_HEADERS = [
  'TableName', 'RecordID', 'ActionType', 'FieldName', 'OldValue', 'NewValue',
  'ChangedByUserID', 'ChangedAt',
];

async function getCompanySheetId(companyId: number): Promise<string | null> {
  if (!isSheetsConfigured()) return null;
  const [row] = await query<{ GoogleSheetID: string | null }>(
    'SELECT GoogleSheetID FROM Companies WHERE CompanyID = ?',
    [companyId]
  );
  return row?.GoogleSheetID?.trim() || null;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function syncItemToSheet(companyId: number, itemUID: string): Promise<void> {
  await safeSync(`Items:${companyId}:${itemUID}`, async () => {
    const sheetId = await getCompanySheetId(companyId);
    if (!sheetId) return;

    const [item] = await query<ItemWithLookups>(
      `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
       LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
       WHERE i.CompanyID = ? AND i.ItemUID = ?`,
      [companyId, itemUID]
    );
    if (!item) return;

    await upsertRow(sheetId, ITEMS_TAB, ITEMS_HEADERS, itemUID, [
      item.ItemUID, item.ItemName, item.CategoryName, item.UOMName,
      item.SubCategoryName ?? '', item.Make ?? '', item.Size ?? '',
      item.CurrentStock ?? '', item.MPQ ?? '', item.MinLevel ?? '',
      item.OwnerName, formatISTForExport(item.CreatedAt), formatISTForExport(item.UpdatedAt),
    ]);
  });
}

// ---------------------------------------------------------------------------
// QC Master (header + spec rows)
// ---------------------------------------------------------------------------

export async function syncQCMasterToSheet(companyId: number, qcUID: string): Promise<void> {
  await safeSync(`QCMaster:${companyId}:${qcUID}`, async () => {
    const sheetId = await getCompanySheetId(companyId);
    if (!sheetId) return;

    const [header] = await query<QCMasterWithLookups>(
      `SELECT q.*, usr.Name AS OwnerName,
              (SELECT COUNT(*) FROM QCSpecifications s
               WHERE s.CompanyID = q.CompanyID AND s.QCUID = q.QCUID) AS SpecCount
       FROM QCMaster q
       LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
       WHERE q.CompanyID = ? AND q.QCUID = ?`,
      [companyId, qcUID]
    );
    if (!header) return;

    await upsertRow(sheetId, QC_MASTER_TAB, QC_MASTER_HEADERS, qcUID, [
      header.QCUID, header.ItemUID, header.ItemName, header.SpecCount,
      header.OwnerName, formatISTForExport(header.CreatedAt), formatISTForExport(header.UpdatedAt),
    ]);

    const specs = await query<QCSpecificationWithLookups>(
      `SELECT s.*, c.CriteriaName, m.MethodName, f.FrequencyName,
              r.ResponsibilityName, rp.ReactionPlanName
       FROM QCSpecifications s
       LEFT JOIN SpecificationCriteria c ON s.CriteriaID = c.CriteriaID
       LEFT JOIN MethodOfInspection m ON s.MethodID = m.MethodID
       LEFT JOIN InspectionFrequency f ON s.FrequencyID = f.FrequencyID
       LEFT JOIN Responsibility r ON s.ResponsibilityID = r.ResponsibilityID
       LEFT JOIN ReactionPlan rp ON s.ReactionPlanID = rp.ReactionPlanID
       WHERE s.CompanyID = ? AND s.QCUID = ?
       ORDER BY s.SrNo ASC`,
      [companyId, qcUID]
    );

    await replaceChildRows(
      sheetId,
      QC_SPECS_TAB,
      QC_SPECS_HEADERS,
      qcUID,
      specs.map((s) => [
        s.QCUID, s.SrNo, s.Parameter, s.CriteriaName, s.MinVal ?? '',
        s.MaxVal ?? '', s.OtherValue ?? '', s.MethodName, s.FrequencyName,
        s.ResponsibilityName, s.ReactionPlanName, s.Specification,
      ])
    );
  });
}

// ---------------------------------------------------------------------------
// Inspection Reports (header + result rows)
// ---------------------------------------------------------------------------

export async function syncInspectionReportToSheet(companyId: number, iirUID: string): Promise<void> {
  await safeSync(`InspectionReports:${companyId}:${iirUID}`, async () => {
    const sheetId = await getCompanySheetId(companyId);
    if (!sheetId) return;

    const [header] = await query<InspectionReportWithLookups>(
      `SELECT r.*, rs.ResultStatusName AS InspectionStatusName, usr.Name AS OwnerName
       FROM InspectionReports r
       LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
       LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
       WHERE r.CompanyID = ? AND r.IIRUID = ?`,
      [companyId, iirUID]
    );
    if (!header) return;

    await upsertRow(sheetId, INSPECTION_REPORTS_TAB, INSPECTION_REPORTS_HEADERS, iirUID, [
      header.IIRUID, String(header.InspectionDate), header.ItemUID, header.ItemName,
      header.QCUID, header.GRNNo, header.InspectionStatusName ?? '',
      header.OwnerName, formatISTForExport(header.CreatedAt), formatISTForExport(header.UpdatedAt),
    ]);

    const results = await query<InspectionResultWithLookups>(
      `SELECT res.*, c.CriteriaName, m.MethodName, f.FrequencyName,
              resp.ResponsibilityName, rp.ReactionPlanName, rs.ResultStatusName
       FROM InspectionResults res
       LEFT JOIN SpecificationCriteria c ON res.CriteriaID = c.CriteriaID
       LEFT JOIN MethodOfInspection m ON res.MethodID = m.MethodID
       LEFT JOIN InspectionFrequency f ON res.FrequencyID = f.FrequencyID
       LEFT JOIN Responsibility resp ON res.ResponsibilityID = resp.ResponsibilityID
       LEFT JOIN ReactionPlan rp ON res.ReactionPlanID = rp.ReactionPlanID
       LEFT JOIN ResultStatus rs ON res.ResultStatusID = rs.ResultStatusID
       WHERE res.CompanyID = ? AND res.IIRUID = ?
       ORDER BY res.SrNo ASC`,
      [companyId, iirUID]
    );

    await replaceChildRows(
      sheetId,
      INSPECTION_RESULTS_TAB,
      INSPECTION_RESULTS_HEADERS,
      iirUID,
      results.map((r) => [
        r.IIRUID, r.SrNo, r.Parameter, r.CriteriaName, r.MinVal ?? '',
        r.MaxVal ?? '', r.OtherValue ?? '', r.MethodName, r.FrequencyName,
        r.ResponsibilityName, r.ReactionPlanName, r.Specification,
        r.Actual ?? '', r.ResultStatusName ?? '',
      ])
    );
  });
}

// ---------------------------------------------------------------------------
// Audit log (append-only)
// ---------------------------------------------------------------------------

export interface SheetAuditEntry {
  tableName: string;
  recordId: string;
  actionType: AuditActionType;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedByUserID: number;
}

export async function appendAuditLogToSheet(
  companyId: number,
  entries: SheetAuditEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  await safeSync(`AuditLog:${companyId}:${entries.length} entries`, async () => {
    const sheetId = await getCompanySheetId(companyId);
    if (!sheetId) return;

    const changedAt = formatISTForExport(new Date());
    await appendRows(
      sheetId,
      AUDIT_LOG_TAB,
      AUDIT_LOG_HEADERS,
      entries.map((e) => [
        e.tableName, e.recordId, e.actionType, e.fieldName ?? '',
        e.oldValue ?? '', e.newValue ?? '', e.changedByUserID, changedAt,
      ])
    );
  });
}
