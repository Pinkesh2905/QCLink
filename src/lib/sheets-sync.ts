// ============================================================================
// QCLink — Google Sheets Sync
// One-way mirror: after a write commits in MySQL, push the current row(s)
// to the configured Google Sheet. MySQL stays the source of truth — this
// never reads back from the sheet. No-ops when Sheets isn't configured
// (see isSheetsConfigured in ./sheets).
// ============================================================================

import { query } from './db';
import { upsertRow, appendRows, replaceChildRows, safeSync } from './sheets';
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

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function syncItemToSheet(itemUID: string): Promise<void> {
  await safeSync(`Items:${itemUID}`, async () => {
    const [item] = await query<ItemWithLookups>(
      `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
       FROM Items i
       LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
       LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
       LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
       LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
       WHERE i.ItemUID = ?`,
      [itemUID]
    );
    if (!item) return;

    await upsertRow(ITEMS_TAB, ITEMS_HEADERS, itemUID, [
      item.ItemUID, item.ItemName, item.CategoryName, item.UOMName,
      item.SubCategoryName ?? '', item.Make ?? '', item.Size ?? '',
      item.CurrentStock ?? '', item.MPQ ?? '', item.MinLevel ?? '',
      item.OwnerName, String(item.CreatedAt), String(item.UpdatedAt),
    ]);
  });
}

// ---------------------------------------------------------------------------
// QC Master (header + spec rows)
// ---------------------------------------------------------------------------

export async function syncQCMasterToSheet(qcUID: string): Promise<void> {
  await safeSync(`QCMaster:${qcUID}`, async () => {
    const [header] = await query<QCMasterWithLookups>(
      `SELECT q.*, usr.Name AS OwnerName,
              (SELECT COUNT(*) FROM QCSpecifications s WHERE s.QCUID = q.QCUID) AS SpecCount
       FROM QCMaster q
       LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
       WHERE q.QCUID = ?`,
      [qcUID]
    );
    if (!header) return;

    await upsertRow(QC_MASTER_TAB, QC_MASTER_HEADERS, qcUID, [
      header.QCUID, header.ItemUID, header.ItemName, header.SpecCount,
      header.OwnerName, String(header.CreatedAt), String(header.UpdatedAt),
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
       WHERE s.QCUID = ?
       ORDER BY s.SrNo ASC`,
      [qcUID]
    );

    await replaceChildRows(
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

export async function syncInspectionReportToSheet(iirUID: string): Promise<void> {
  await safeSync(`InspectionReports:${iirUID}`, async () => {
    const [header] = await query<InspectionReportWithLookups>(
      `SELECT r.*, rs.ResultStatusName AS InspectionStatusName, usr.Name AS OwnerName
       FROM InspectionReports r
       LEFT JOIN ResultStatus rs ON r.InspectionStatusID = rs.ResultStatusID
       LEFT JOIN Users usr ON r.OwnerUserID = usr.UserID
       WHERE r.IIRUID = ?`,
      [iirUID]
    );
    if (!header) return;

    await upsertRow(INSPECTION_REPORTS_TAB, INSPECTION_REPORTS_HEADERS, iirUID, [
      header.IIRUID, String(header.InspectionDate), header.ItemUID, header.ItemName,
      header.QCUID, header.GRNNo, header.InspectionStatusName ?? '',
      header.OwnerName, String(header.CreatedAt), String(header.UpdatedAt),
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
       WHERE res.IIRUID = ?
       ORDER BY res.SrNo ASC`,
      [iirUID]
    );

    await replaceChildRows(
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

export async function appendAuditLogToSheet(entries: SheetAuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await safeSync(`AuditLog:${entries.length} entries`, async () => {
    const changedAt = new Date().toISOString();
    await appendRows(
      AUDIT_LOG_TAB,
      AUDIT_LOG_HEADERS,
      entries.map((e) => [
        e.tableName, e.recordId, e.actionType, e.fieldName ?? '',
        e.oldValue ?? '', e.newValue ?? '', e.changedByUserID, changedAt,
      ])
    );
  });
}
