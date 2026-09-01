// ============================================================================
// QCLink — Database Types
// TypeScript interfaces matching the Vezapp MySQL schema exactly.
// These are read-only type definitions — no schema mutations.
// ============================================================================

// ---------------------------------------------------------------------------
// Lookup / Reference Tables
// ---------------------------------------------------------------------------

export interface Category {
  CategoryID: number;
  CategoryName: string;
  IsActive: number; // tinyint(1)
}

export interface UnitOfStock {
  UOMID: number;
  UOMName: string;
  IsActive: number;
}

export interface SubCategory {
  SubCategoryID: number;
  SubCategoryName: string;
  IsActive: number;
}

export interface SpecificationCriteria {
  CriteriaID: number;
  CriteriaName: string;
  IsActive: number;
}

export interface MethodOfInspection {
  MethodID: number;
  MethodName: string;
  IsActive: number;
}

export interface InspectionFrequency {
  FrequencyID: number;
  FrequencyName: string;
  IsActive: number;
}

export interface Responsibility {
  ResponsibilityID: number;
  ResponsibilityName: string;
  IsActive: number;
}

export interface ReactionPlan {
  ReactionPlanID: number;
  ReactionPlanName: string;
  IsActive: number;
}

export interface ResultStatus {
  ResultStatusID: number;
  ResultStatusName: string;
  StatusName?: string;
  // No IsActive column on this table
}

// ---------------------------------------------------------------------------
// Auth Tables
// ---------------------------------------------------------------------------

export type UserRole = 'Admin' | 'User';
export type UserStatus = 'Pending' | 'Active' | 'Rejected' | 'Deactivated';

export interface User {
  UserID: number;
  Name: string;
  Email: string;
  PasswordHash: string;
  Role: UserRole;
  Status: UserStatus;
  CreatedAt: Date;
  UpdatedAt: Date;
}

/** Safe subset of User to send to the client (no password hash). */
export type SafeUser = Omit<User, 'PasswordHash'>;

export interface UserSession {
  SessionID: number;
  UserID: number;
  TokenHash: string;
  CreatedAt: Date;
  ExpiresAt: Date;
  RevokedAt: Date | null;
}

export interface PasswordResetToken {
  ResetID: number;
  UserID: number;
  TokenHash: string;
  CreatedAt: Date;
  ExpiresAt: Date;
  UsedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Core Module Tables
// ---------------------------------------------------------------------------

export interface Item {
  ItemUID: string;       // e.g. "Item01"
  ItemName: string;
  CategoryID: number;
  UOMID: number;
  SubCategoryID: number | null;
  Make: string | null;
  Size: number | null;
  CurrentStock: number | null;
  MPQ: number | null;
  MinLevel: number | null;
  SubmissionID: string | null;
  OwnerUserID: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface QCMaster {
  QCUID: string;        // e.g. "QC01"
  ItemUID: string;
  ItemName: string;      // denormalized
  ImagePath: string | null;
  SubmissionID: string | null;
  OwnerUserID: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface QCSpecification {
  SpecID: number;
  QCUID: string;
  SrNo: number;          // 1–30
  Parameter: string;
  CriteriaID: number;
  MinVal: number | null;
  MaxVal: number | null;
  OtherValue: string | null;
  MethodID: number;
  FrequencyID: number;
  ResponsibilityID: number;
  ReactionPlanID: number;
  Specification: string;  // computed field
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface InspectionReport {
  IIRUID: string;        // e.g. "IIR01"
  InspectionDate: Date;
  ItemUID: string;
  ItemName: string;       // denormalized
  QCUID: string;
  GRNNo: string;
  InvoicePath: string | null;
  InspectionStatusID: number;
  SubmissionID: string | null;
  OwnerUserID: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface InspectionResult {
  ResultID: number;
  IIRUID: string;
  SrNo: number;
  Parameter: string;
  CriteriaID: number;
  MinVal: number | null;
  MaxVal: number | null;
  OtherValue: string | null;
  MethodID: number;
  FrequencyID: number;
  ResponsibilityID: number;
  ReactionPlanID: number;
  Specification: string;
  Actual: number | null;
  ResultStatusID: number | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

// ---------------------------------------------------------------------------
// System Tables
// ---------------------------------------------------------------------------

export interface UIDCounter {
  EntityPrefix: string;
  CurrentValue: number;
  PadWidth: number;
}

export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLog {
  AuditID: number;
  TableName: string;
  RecordID: string;
  ActionType: AuditActionType;
  FieldName: string | null;
  OldValue: string | null;
  NewValue: string | null;
  ChangedByUserID: number;
  ChangedAt: Date;
}

export type PermissionModuleName =
  | 'Items'
  | 'QCMaster'
  | 'QCSpecifications'
  | 'InspectionReports'
  | 'InspectionResults';

export interface FieldPermission {
  FieldPermissionID: number;
  ModuleName: PermissionModuleName;
  FieldName: string;
  MinimumRole: 'User' | 'Admin';
  UpdatedAt: Date;
}

// ---------------------------------------------------------------------------
// Joined / View Types (for API responses)
// ---------------------------------------------------------------------------

export interface ItemWithLookups extends Item {
  CategoryName: string;
  UOMName: string;
  SubCategoryName: string | null;
  OwnerName: string;
}

export interface QCMasterWithLookups extends QCMaster {
  OwnerName: string;
  SpecCount: number;
}

export interface QCSpecificationWithLookups extends QCSpecification {
  CriteriaName: string;
  MethodName: string;
  FrequencyName: string;
  ResponsibilityName: string;
  ReactionPlanName: string;
}

export interface InspectionReportWithLookups extends InspectionReport {
  OwnerName: string;
  InspectionStatusName: string;
}

export interface InspectionResultWithLookups extends InspectionResult {
  CriteriaName: string;
  MethodName: string;
  FrequencyName: string;
  ResponsibilityName: string;
  ReactionPlanName: string;
  ResultStatusName: string | null;
}

export interface AuditLogWithUser extends AuditLog {
  ChangedByName: string;
}
