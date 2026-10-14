// ============================================================================
// QCLink — Employee Master helpers
// ============================================================================

/**
 * SQL select-list fragment (alias `e` = Employees): whether the employee's email
 * belongs to an active QCLink user of the same company. Only such a person can sign
 * in and review the reports they are picked for.
 */
export const HAS_LOGIN_SQL = `EXISTS (
  SELECT 1 FROM Users lu
  WHERE lu.CompanyID = e.CompanyID AND LOWER(lu.Email) = LOWER(e.Email) AND lu.Status = 'Active'
) AS HasLogin`;
