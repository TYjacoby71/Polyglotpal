import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

db.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

/** Simple query helper — returns rows */
export async function query(sql, params = []) {
  const res = await db.query(sql, params);
  return res.rows;
}

/** Single-row query helper */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}
