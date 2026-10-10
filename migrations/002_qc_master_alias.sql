-- ============================================================================
-- QCLink — QC Master "Master Alias"
-- Run once against the shared "Vezapp" database, BEFORE the app version that
-- asks for a Master Alias is deployed.
--
-- Adds a name for each QC template, so one item can have several templates
-- (for example one per supplier) and each is told apart by its alias.
-- The combination company + item + alias must be unique (the comparison ignores
-- capitals and accents, like the rest of this database).
--
-- Templates that already exist keep a NULL alias: MySQL lets any number of NULLs
-- share a unique index. The app asks for an alias the next time such a template
-- is edited.
-- ============================================================================

ALTER TABLE QCMaster
  ADD COLUMN MasterAlias VARCHAR(100) NULL AFTER ItemName,
  ADD UNIQUE KEY UQ_QCMaster_ItemAlias (CompanyID, ItemUID, MasterAlias);

-- Check afterwards (should list MasterAlias, and the new unique key):
--   SHOW COLUMNS FROM QCMaster;
--   SHOW INDEX FROM QCMaster;
--
-- If the ALTER fails with "Duplicate key name" or "Duplicate column name", it was already run.
-- To undo:  ALTER TABLE QCMaster DROP INDEX UQ_QCMaster_ItemAlias, DROP COLUMN MasterAlias;
