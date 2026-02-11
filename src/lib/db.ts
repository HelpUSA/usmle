// src/lib/db.ts
//
// Postgres helper (pg Pool + transaction wrapper)
//
// Env vars:
// - DATABASE_URL: PostgreSQL connection string (Railway / local)
// - PGSSL_DISABLE: if set (any truthy string), disables SSL (useful for local dev)
//
// Notes:
// - Railway Postgres typically requires SSL; we default to SSL enabled with rejectUnauthorized=false.
// - Use withTx() for multi-step writes to ensure atomicity.

import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL_DISABLE ? false : { rejectUnauthorized: false },
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
