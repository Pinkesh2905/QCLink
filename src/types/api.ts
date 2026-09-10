// ============================================================================
// QCLink — API request/response type definitions
// ============================================================================

import type { SafeUser, ItemWithLookups, QCMasterWithLookups, QCSpecificationWithLookups, InspectionReportWithLookups, InspectionResultWithLookups, AuditLogWithUser } from './db';

// ---------------------------------------------------------------------------
// Generic
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  field?: string;
  details?: Record<string, string[]>;
}

export interface ApiSuccess {
  message: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MeResponse {
  user: SafeUser;
}

// ---------------------------------------------------------------------------
// List Query Params
// ---------------------------------------------------------------------------

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Store Master
// ---------------------------------------------------------------------------

export interface CreateItemRequest {
  ItemName: string;
  CategoryID: number;
  UOMID: number;
  SubCategoryID?: number | null;
  Make?: string | null;
  Size?: number | null;
  CurrentStock?: number | null;
  MPQ?: number | null;
  MinLevel?: number | null;
}

export interface UpdateItemRequest {
  ItemName?: string;
  CategoryID?: number;
  UOMID?: number;
  SubCategoryID?: number | null;
  Make?: string | null;
  Size?: number | null;
  CurrentStock?: number | null;
  MPQ?: number | null;
  MinLevel?: number | null;
}

export type ItemListResponse = PaginatedResponse<ItemWithLookups>;
export type ItemDetailResponse = ItemWithLookups;

// ---------------------------------------------------------------------------
// QC Master
// ---------------------------------------------------------------------------

export interface QCSpecInput {
  SrNo: number;
  Parameter: string;
  CriteriaID: number;
  MinVal?: number | null;
  MaxVal?: number | null;
  OtherValue?: string | null;
  MethodID: number;
  FrequencyID: number;
  ResponsibilityID: number;
  ReactionPlanID: number;
}

export interface CreateQCMasterRequest {
  ItemUID: string;
  ItemName: string;
  ImagePath?: string | null;
  Specifications: QCSpecInput[];
}

export interface UpdateQCMasterRequest {
  ItemUID?: string;
  ItemName?: string;
  ImagePath?: string | null;
  Specifications?: QCSpecInput[];
}

export interface QCMasterDetailResponse extends QCMasterWithLookups {
  Specifications: QCSpecificationWithLookups[];
}

export type QCMasterListResponse = PaginatedResponse<QCMasterWithLookups>;

// ---------------------------------------------------------------------------
// Inspection Report
// ---------------------------------------------------------------------------

export interface InspectionResultInput {
  SrNo: number;
  Parameter: string;
  CriteriaID: number;
  MinVal?: number | null;
  MaxVal?: number | null;
  OtherValue?: string | null;
  MethodID: number;
  FrequencyID: number;
  ResponsibilityID: number;
  ReactionPlanID: number;
  Specification: string;
  Actual?: number | null;
  ResultStatusID?: number | null;
}

export interface CreateInspectionReportRequest {
  InspectionDate: string; // ISO date string
  ItemUID: string;
  ItemName: string;
  QCUID: string;
  GRNNo: string;
  InvoicePath?: string | null;
  InspectionStatusID: number;
  Results: InspectionResultInput[];
}

export interface UpdateInspectionReportRequest {
  InspectionDate?: string;
  ItemUID?: string;
  ItemName?: string;
  QCUID?: string;
  GRNNo?: string;
  InvoicePath?: string | null;
  InspectionStatusID?: number;
  Results?: InspectionResultInput[];
}

export interface InspectionReportDetailResponse extends InspectionReportWithLookups {
  Results: InspectionResultWithLookups[];
}

export type InspectionReportListResponse = PaginatedResponse<InspectionReportWithLookups>;

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export type AuditLogListResponse = PaginatedResponse<AuditLogWithUser>;

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface UpdateUserRequest {
  Status?: 'Active' | 'Rejected' | 'Deactivated';
  Role?: 'Admin' | 'User';
}

export interface MasterDataOption {
  id: number;
  name: string;
  isActive: number;
}

export interface CreateMasterDataRequest {
  name: string;
}

export interface UpdateMasterDataRequest {
  name?: string;
  isActive?: number;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadResponse {
  path: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardCounts {
  totalItems: number;
  totalQCTemplates: number;
  inspectionsThisMonth: number;
  pendingApprovals: number;
}

export interface InspectionTrendPoint {
  period: string; // e.g. "Week 34" or formatted date/month
  accept: number;
  reject: number;
  deviation: number;
  total: number;
}

export interface LowStockItem {
  ItemUID: string;
  ItemName: string;
  CurrentStock: number;
  MinLevel: number;
  CategoryName: string | null;
  UOMName: string | null;
}

export interface RecentActivityEntry {
  AuditID: number;
  TableName: string;
  RecordID: string;
  ActionType: string;
  FieldName: string | null;
  OldValue: string | null;
  NewValue: string | null;
  ChangedByName: string;
  ChangedAt: string;
}

export interface StockCategoryDistribution {
  categoryName: string;
  itemCount: number;
  totalStock: number;
}

export interface StockHealthSummary {
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  notTrackedCount: number;
  totalTrackedItems: number;
}

export interface StockAnalytics {
  health: StockHealthSummary;
  categories: StockCategoryDistribution[];
}

export interface DashboardData extends DashboardCounts {
  inspectionTrend: InspectionTrendPoint[];
  inspectionTrendTotal: number;
  lowStockItems: LowStockItem[];
  recentActivity: RecentActivityEntry[];
  stockAnalytics: StockAnalytics;
}

// ---------------------------------------------------------------------------
// Field Permissions
// ---------------------------------------------------------------------------

export type FieldPermissionsResponse = Record<string, Record<string, 'User' | 'Admin'>>;
