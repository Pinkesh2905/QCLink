-- ============================================================================
-- QCLink — Employee Master + Inspection Report review workflow
-- Run once against the shared "Vezapp" database, BEFORE the app version that
-- uses them is deployed (the new app version selects these columns).
--
-- 1. Employees: a per-company master of people (name + email). An Inspection
--    Report picks one of them as its reviewer.
-- 2. InspectionReports: Inspection Remark, the chosen reviewer, the review
--    status ('Review Pending' / 'Review Done' / 'Review Rejected'), the
--    Reviewer Remark (visible only to the reviewer) and when the review
--    request email went out.
-- 3. InspectionResults: an Observed Remark per result row.
--
-- Reports that already exist keep ReviewStatus NULL: they were never sent for
-- review and nobody is asked to review them retroactively.
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE Employees (
  CompanyID INT NOT NULL,
  EmployeeUID VARCHAR(20) NOT NULL,
  EmployeeName VARCHAR(150) NOT NULL,
  Email VARCHAR(255) NOT NULL,
  Department VARCHAR(100) NULL,
  Designation VARCHAR(100) NULL,
  Phone VARCHAR(30) NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  OwnerUserID INT NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (CompanyID, EmployeeUID),
  UNIQUE KEY UQ_Employees_Email (CompanyID, Email),
  CONSTRAINT FK_Employees_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID)
) ENGINE=InnoDB;

ALTER TABLE InspectionReports
  ADD COLUMN InspectionRemark TEXT NULL AFTER InvoicePath,
  ADD COLUMN ReviewerEmployeeUID VARCHAR(20) NULL AFTER InspectionRemark,
  ADD COLUMN ReviewerName VARCHAR(150) NULL AFTER ReviewerEmployeeUID,
  ADD COLUMN ReviewerEmail VARCHAR(255) NULL AFTER ReviewerName,
  ADD COLUMN ReviewStatus VARCHAR(20) NULL AFTER ReviewerEmail,
  ADD COLUMN ReviewerRemark TEXT NULL AFTER ReviewStatus,
  ADD COLUMN ReviewedAt DATETIME NULL AFTER ReviewerRemark,
  ADD COLUMN ReviewEmailSentAt DATETIME NULL AFTER ReviewedAt,
  ADD KEY IX_IIR_ReviewerEmail (CompanyID, ReviewerEmail, ReviewStatus);

ALTER TABLE InspectionResults
  ADD COLUMN ObservedRemark VARCHAR(1000) NULL AFTER ResultStatusID;

-- Check afterwards:
--   SHOW COLUMNS FROM InspectionReports;   -- InspectionRemark ... ReviewEmailSentAt
--   SHOW COLUMNS FROM InspectionResults;   -- ObservedRemark
--   SHOW CREATE TABLE Employees;
--
-- If an ALTER fails with "Duplicate column name", it was already run.
-- To undo:
--   ALTER TABLE InspectionResults DROP COLUMN ObservedRemark;
--   ALTER TABLE InspectionReports DROP INDEX IX_IIR_ReviewerEmail,
--     DROP COLUMN InspectionRemark, DROP COLUMN ReviewerEmployeeUID, DROP COLUMN ReviewerName,
--     DROP COLUMN ReviewerEmail, DROP COLUMN ReviewStatus, DROP COLUMN ReviewerRemark,
--     DROP COLUMN ReviewedAt, DROP COLUMN ReviewEmailSentAt;
--   DROP TABLE Employees;
