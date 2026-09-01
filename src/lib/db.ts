// ============================================================================
// QCLink — Database Connection Pool
// Singleton mysql2/promise pool configured from environment variables.
// No ORM, no auto-migration — queries only.
// ============================================================================

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.DB_HOST;
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || 'Vezapp';

    if (!host || !user || !password) {
      throw new Error(
        'Missing required database environment variables. ' +
        'Ensure DB_HOST, DB_USER, and DB_PASSWORD are set.'
      );
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      // Return dates as strings to avoid timezone issues
      dateStrings: true,
      // Enable named placeholders for complex queries
      namedPlaceholders: false,
    });
  }

  return pool;
}

/**
 * Execute a parameterized query against the pool.
 * Convenience wrapper around pool.execute() with typed return.
 */
export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const p = getPool();
  const [rows] = await p.execute(sql, params as any);
  return rows as T[];
}

/**
 * Get a connection from the pool for transaction use.
 * Caller is responsible for commit/rollback/release.
 */
export async function getConnection(): Promise<mysql.PoolConnection> {
  const p = getPool();
  return p.getConnection();
}

/**
 * Execute a function inside a database transaction.
 * Automatically commits on success, rolls back on error, and releases the
 * connection in both cases.
 */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
