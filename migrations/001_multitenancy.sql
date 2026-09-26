-- ============================================================================
-- QCLink — Multitenancy + Subscriptions
-- Run once against the shared "Vezapp" database. All existing QCLink data and
-- users are assigned to company 1 ("Vezapp (Internal)").
--
-- Tables other apps on this database may share: Users (new nullable
-- CompanyID), AuditLog (new nullable CompanyID), Subscriptions (keyed by
-- AppCode). No existing column changes shape in a breaking way.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Companies (tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE Companies (
  CompanyID INT AUTO_INCREMENT PRIMARY KEY,
  CompanyName VARCHAR(255) NOT NULL,
  ContactName VARCHAR(255) NULL,
  ContactEmail VARCHAR(255) NULL,
  ContactPhone VARCHAR(50) NULL,
  Address TEXT NULL,
  GoogleSheetID VARCHAR(255) NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_Companies_Name (CompanyName)
) ENGINE=InnoDB;

INSERT INTO Companies (CompanyID, CompanyName) VALUES (1, 'Vezapp (Internal)');

-- ---------------------------------------------------------------------------
-- 2. Users belong to a company (nullable: the Vezapp super-admin has none)
-- ---------------------------------------------------------------------------
ALTER TABLE Users
  ADD COLUMN CompanyID INT NULL AFTER Role,
  ADD CONSTRAINT FK_Users_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

UPDATE Users SET CompanyID = 1;

-- ---------------------------------------------------------------------------
-- 3. Per-app subscriptions + dummy payments
-- ---------------------------------------------------------------------------
CREATE TABLE Subscriptions (
  SubscriptionID INT AUTO_INCREMENT PRIMARY KEY,
  CompanyID INT NOT NULL,
  AppCode VARCHAR(30) NOT NULL,
  PlanCode VARCHAR(30) NOT NULL,
  StartDate DATE NOT NULL,
  EndDate DATE NOT NULL, -- inclusive: last day of access
  Source ENUM('Admin', 'Payment') NOT NULL,
  CreatedByUserID INT NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Subscriptions_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID),
  CONSTRAINT FK_Subscriptions_User FOREIGN KEY (CreatedByUserID) REFERENCES Users (UserID),
  KEY IX_Subscriptions_CompanyApp (CompanyID, AppCode, EndDate)
) ENGINE=InnoDB;

CREATE TABLE SubscriptionPayments (
  PaymentID INT AUTO_INCREMENT PRIMARY KEY,
  SubscriptionID INT NOT NULL,
  CompanyID INT NOT NULL,
  AppCode VARCHAR(30) NOT NULL,
  Amount DECIMAL(12, 2) NOT NULL,
  Currency CHAR(3) NOT NULL DEFAULT 'INR',
  Gateway VARCHAR(30) NOT NULL,
  GatewayReference VARCHAR(100) NOT NULL,
  Status ENUM('Success', 'Failed') NOT NULL,
  PaidByUserID INT NOT NULL,
  PaidAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Payments_Subscription FOREIGN KEY (SubscriptionID) REFERENCES Subscriptions (SubscriptionID),
  CONSTRAINT FK_Payments_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID),
  CONSTRAINT FK_Payments_User FOREIGN KEY (PaidByUserID) REFERENCES Users (UserID),
  KEY IX_Payments_CompanyApp (CompanyID, AppCode, PaidAt)
) ENGINE=InnoDB;

-- Starting 3-month plan for the internal company, so its existing non-admin
-- users keep full access after the switch.
INSERT INTO Subscriptions (CompanyID, AppCode, PlanCode, StartDate, EndDate, Source, CreatedByUserID)
SELECT 1, 'QCLink', 'QUARTERLY', CURDATE(),
       DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 3 MONTH), INTERVAL 1 DAY),
       'Admin', (SELECT MIN(UserID) FROM Users WHERE Role = 'Admin');

-- ---------------------------------------------------------------------------
-- 4. Per-company UID sequences (Item01, QC01, IIR01 restart per company).
--    The shared UIDCounters table is left untouched for other apps.
-- ---------------------------------------------------------------------------
CREATE TABLE CompanyUIDCounters (
  CompanyID INT NOT NULL,
  EntityPrefix VARCHAR(10) NOT NULL,
  CurrentValue INT NOT NULL DEFAULT 0,
  PadWidth TINYINT NOT NULL DEFAULT 2,
  PRIMARY KEY (CompanyID, EntityPrefix),
  CONSTRAINT FK_CompanyUIDCounters_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID)
) ENGINE=InnoDB;

INSERT INTO CompanyUIDCounters (CompanyID, EntityPrefix, CurrentValue, PadWidth)
  SELECT 1, EntityPrefix, CurrentValue, PadWidth
  FROM UIDCounters
  WHERE EntityPrefix IN ('Item', 'QC', 'IIR');

-- ---------------------------------------------------------------------------
-- 5. CompanyID on every tenant-owned table
-- ---------------------------------------------------------------------------
ALTER TABLE Items ADD COLUMN CompanyID INT NULL FIRST;
ALTER TABLE QCMaster ADD COLUMN CompanyID INT NULL FIRST;
ALTER TABLE QCSpecifications ADD COLUMN CompanyID INT NULL AFTER SpecID;
ALTER TABLE InspectionReports ADD COLUMN CompanyID INT NULL FIRST;
ALTER TABLE InspectionResults ADD COLUMN CompanyID INT NULL AFTER ResultID;

UPDATE Items SET CompanyID = 1;
UPDATE QCMaster SET CompanyID = 1;
UPDATE QCSpecifications SET CompanyID = 1;
UPDATE InspectionReports SET CompanyID = 1;
UPDATE InspectionResults SET CompanyID = 1;

ALTER TABLE Items MODIFY CompanyID INT NOT NULL;
ALTER TABLE QCMaster MODIFY CompanyID INT NOT NULL;
ALTER TABLE QCSpecifications MODIFY CompanyID INT NOT NULL;
ALTER TABLE InspectionReports MODIFY CompanyID INT NOT NULL;
ALTER TABLE InspectionResults MODIFY CompanyID INT NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Drop single-column FKs/indexes between the UID-keyed tables
-- ---------------------------------------------------------------------------
ALTER TABLE QCMaster DROP FOREIGN KEY FK_QCMaster_Item;
ALTER TABLE InspectionReports DROP FOREIGN KEY FK_IIR_Item, DROP FOREIGN KEY FK_IIR_QCMaster;
ALTER TABLE QCSpecifications DROP FOREIGN KEY FK_QCSpec_QCMaster;
ALTER TABLE InspectionResults DROP FOREIGN KEY FK_IIRResult_Report;

ALTER TABLE QCMaster DROP INDEX FK_QCMaster_Item;
ALTER TABLE InspectionReports DROP INDEX FK_IIR_Item, DROP INDEX FK_IIR_QCMaster;

-- ---------------------------------------------------------------------------
-- 7. Composite primary keys: the same UID may now exist once per company
-- ---------------------------------------------------------------------------
ALTER TABLE Items
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (CompanyID, ItemUID),
  DROP INDEX UQ_Items_NameCategory,
  ADD UNIQUE KEY UQ_Items_NameCategory (CompanyID, ItemName, CategoryID),
  ADD CONSTRAINT FK_Items_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE QCMaster
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (CompanyID, QCUID),
  ADD CONSTRAINT FK_QCMaster_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE InspectionReports
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (CompanyID, IIRUID),
  ADD CONSTRAINT FK_IIR_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE QCSpecifications
  DROP INDEX UQ_QCSpec_SrNo,
  ADD UNIQUE KEY UQ_QCSpec_SrNo (CompanyID, QCUID, SrNo);

ALTER TABLE InspectionResults
  DROP INDEX UQ_IIRResult_SrNo,
  ADD UNIQUE KEY UQ_IIRResult_SrNo (CompanyID, IIRUID, SrNo);

-- ---------------------------------------------------------------------------
-- 8. Composite FKs — a record can only reference rows of its own company
-- ---------------------------------------------------------------------------
ALTER TABLE QCMaster
  ADD CONSTRAINT FK_QCMaster_Item FOREIGN KEY (CompanyID, ItemUID) REFERENCES Items (CompanyID, ItemUID);

ALTER TABLE InspectionReports
  ADD CONSTRAINT FK_IIR_Item FOREIGN KEY (CompanyID, ItemUID) REFERENCES Items (CompanyID, ItemUID),
  ADD CONSTRAINT FK_IIR_QCMaster FOREIGN KEY (CompanyID, QCUID) REFERENCES QCMaster (CompanyID, QCUID);

ALTER TABLE QCSpecifications
  ADD CONSTRAINT FK_QCSpec_QCMaster FOREIGN KEY (CompanyID, QCUID) REFERENCES QCMaster (CompanyID, QCUID) ON DELETE CASCADE;

ALTER TABLE InspectionResults
  ADD CONSTRAINT FK_IIRResult_Report FOREIGN KEY (CompanyID, IIRUID) REFERENCES InspectionReports (CompanyID, IIRUID) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 9. Dropdown options: CompanyID NULL = shared by every company, set = extra
--    option visible only to that company. CompanyScope (0 for shared) keeps
--    names unique within each scope at the DB level, since MySQL treats NULLs
--    as distinct in a UNIQUE index. (ResultStatus stays global — pass/fail
--    logic keys off its names.)
-- ---------------------------------------------------------------------------
ALTER TABLE Categories ADD COLUMN CompanyID INT NULL;
ALTER TABLE Categories
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX CategoryName,
  ADD UNIQUE KEY UQ_Categories_ScopeName (CompanyScope, CategoryName),
  ADD CONSTRAINT FK_Categories_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE SubCategories ADD COLUMN CompanyID INT NULL;
ALTER TABLE SubCategories
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX SubCategoryName,
  ADD UNIQUE KEY UQ_SubCategories_ScopeName (CompanyScope, SubCategoryName),
  ADD CONSTRAINT FK_SubCategories_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE UnitOfStock ADD COLUMN CompanyID INT NULL;
ALTER TABLE UnitOfStock
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX UOMName,
  ADD UNIQUE KEY UQ_UnitOfStock_ScopeName (CompanyScope, UOMName),
  ADD CONSTRAINT FK_UnitOfStock_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE SpecificationCriteria ADD COLUMN CompanyID INT NULL;
ALTER TABLE SpecificationCriteria
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX CriteriaName,
  ADD UNIQUE KEY UQ_SpecificationCriteria_ScopeName (CompanyScope, CriteriaName),
  ADD CONSTRAINT FK_SpecificationCriteria_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE MethodOfInspection ADD COLUMN CompanyID INT NULL;
ALTER TABLE MethodOfInspection
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX MethodName,
  ADD UNIQUE KEY UQ_MethodOfInspection_ScopeName (CompanyScope, MethodName),
  ADD CONSTRAINT FK_MethodOfInspection_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE InspectionFrequency ADD COLUMN CompanyID INT NULL;
ALTER TABLE InspectionFrequency
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX FrequencyName,
  ADD UNIQUE KEY UQ_InspectionFrequency_ScopeName (CompanyScope, FrequencyName),
  ADD CONSTRAINT FK_InspectionFrequency_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE Responsibility ADD COLUMN CompanyID INT NULL;
ALTER TABLE Responsibility
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX ResponsibilityName,
  ADD UNIQUE KEY UQ_Responsibility_ScopeName (CompanyScope, ResponsibilityName),
  ADD CONSTRAINT FK_Responsibility_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

ALTER TABLE ReactionPlan ADD COLUMN CompanyID INT NULL;
ALTER TABLE ReactionPlan
  ADD COLUMN CompanyScope INT AS (COALESCE(CompanyID, 0)) STORED,
  DROP INDEX ReactionPlanName,
  ADD UNIQUE KEY UQ_ReactionPlan_ScopeName (CompanyScope, ReactionPlanName),
  ADD CONSTRAINT FK_ReactionPlan_Company FOREIGN KEY (CompanyID) REFERENCES Companies (CompanyID);

-- ---------------------------------------------------------------------------
-- 10. AuditLog: record IDs like "Item01" now repeat across companies, so
--     history lookups must also filter by company. NULL for
--     platform-level changes (users, shared options).
-- ---------------------------------------------------------------------------
ALTER TABLE AuditLog
  ADD COLUMN CompanyID INT NULL AFTER RecordID,
  ADD KEY IX_AuditLog_CompanyRecord (CompanyID, TableName, RecordID);

UPDATE AuditLog
SET CompanyID = 1
WHERE TableName IN ('Items', 'QCMaster', 'QCSpecifications', 'InspectionReports', 'InspectionResults');
