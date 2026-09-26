// ============================================================================
// QCLink — Dropdown (lookup) tables
// Options with CompanyID NULL are shared by every company; options with a
// CompanyID are extras visible only to that company. ResultStatus is not
// company-scoped: pass/fail logic keys off its names.
// ============================================================================

import type { PoolConnection } from 'mysql2/promise';
import { query } from './db';
import { AppError } from './errors';

export interface LookupTableConfig {
  table: string;
  idCol: string;
  nameCol: string;
  label: string;
  hasIsActive: boolean;
  companyScoped: boolean;
}

export const LOOKUP_TABLES: Record<string, LookupTableConfig> = {
  categories: { table: 'Categories', idCol: 'CategoryID', nameCol: 'CategoryName', label: 'Category', hasIsActive: true, companyScoped: true },
  'unit-of-stock': { table: 'UnitOfStock', idCol: 'UOMID', nameCol: 'UOMName', label: 'Unit of Stock', hasIsActive: true, companyScoped: true },
  'sub-categories': { table: 'SubCategories', idCol: 'SubCategoryID', nameCol: 'SubCategoryName', label: 'Sub-Category', hasIsActive: true, companyScoped: true },
  'specification-criteria': { table: 'SpecificationCriteria', idCol: 'CriteriaID', nameCol: 'CriteriaName', label: 'Specification Criteria', hasIsActive: true, companyScoped: true },
  'method-of-inspection': { table: 'MethodOfInspection', idCol: 'MethodID', nameCol: 'MethodName', label: 'Method of Inspection', hasIsActive: true, companyScoped: true },
  'inspection-frequency': { table: 'InspectionFrequency', idCol: 'FrequencyID', nameCol: 'FrequencyName', label: 'Inspection Frequency', hasIsActive: true, companyScoped: true },
  responsibility: { table: 'Responsibility', idCol: 'ResponsibilityID', nameCol: 'ResponsibilityName', label: 'Responsibility', hasIsActive: true, companyScoped: true },
  'reaction-plan': { table: 'ReactionPlan', idCol: 'ReactionPlanID', nameCol: 'ReactionPlanName', label: 'Reaction Plan', hasIsActive: true, companyScoped: true },
  'result-status': { table: 'ResultStatus', idCol: 'ResultStatusID', nameCol: 'ResultStatusName', label: 'Result Status', hasIsActive: false, companyScoped: false },
};

export function getLookupConfig(slug: string): LookupTableConfig {
  const config = LOOKUP_TABLES[slug];
  if (!config) {
    throw new AppError(`Unknown lookup table: ${slug}`, 404);
  }
  return config;
}

/**
 * A company sees shared options plus its own, so a name must be unique across
 * that combined list: a new shared option can't collide with any company's
 * private one, and a company option can't collide with a shared one.
 */
export async function findConflictingOption(
  conn: PoolConnection,
  config: LookupTableConfig,
  name: string,
  companyId: number | null,
  excludeId: number | null = null
): Promise<boolean> {
  const conditions = [`LOWER(${config.nameCol}) = LOWER(?)`];
  const values: unknown[] = [name];

  if (config.companyScoped && companyId !== null) {
    conditions.push('(CompanyID IS NULL OR CompanyID = ?)');
    values.push(companyId);
  }
  if (excludeId !== null) {
    conditions.push(`${config.idCol} != ?`);
    values.push(excludeId);
  }

  const [rows] = await conn.execute(
    `SELECT ${config.idCol} FROM ${config.table} WHERE ${conditions.join(' AND ')} LIMIT 1`,
    values as any
  ) as [Array<Record<string, unknown>>, unknown];
  return rows.length > 0;
}

/**
 * Rejects option IDs a company can't see — another company's private option
 * would otherwise be accepted (the FK only proves the row exists) and its
 * name would then show up in this company's records.
 */
export async function assertLookupIdsVisible(
  companyId: number,
  refs: { slug: string; ids: Array<number | null | undefined> }[]
): Promise<void> {
  for (const { slug, ids } of refs) {
    const config = getLookupConfig(slug);
    if (!config.companyScoped) continue;

    const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number'))];
    if (unique.length === 0) continue;

    const rows = await query<{ id: number }>(
      `SELECT ${config.idCol} AS id FROM ${config.table}
       WHERE ${config.idCol} IN (${unique.map(() => '?').join(', ')})
         AND (CompanyID IS NULL OR CompanyID = ?)`,
      [...unique, companyId]
    );

    if (rows.length !== unique.length) {
      throw new AppError(`Invalid ${config.label} selection.`, 400);
    }
  }
}
