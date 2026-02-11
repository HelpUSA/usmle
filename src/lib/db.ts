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
// - Vercel (serverless) can spawn multiple lambdas → too many pooled connections can cause ECONNRESET.
// - We keep the pool small + enable keepalive + timeouts to reduce resets.
// - Use withTx() for multi-step writes to ensure atomicity.

import { Pool, PoolClient } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Falhar cedo ajuda muito em produção (Vercel)
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: DATABASE_URL,

  // Railway geralmente usa SSL. Em local, você pode desabilitar com PGSSL_DISABLE=1
  ssl: process.env.PGSSL_DISABLE ? false : { rejectUnauthorized: false },

  // ✅ serverless-safe defaults
  max: 2, // evita "explodir" conexões em Vercel
  connectionTimeoutMillis: 10_000, // falha rápido se não conectar
  idleTimeoutMillis: 30_000, // fecha conexões ociosas
  allowExitOnIdle: true, // ajuda em dev/testes

  // ✅ reduz ECONNRESET por conexões ociosas/terminadas pelo proxy
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// Log de erro do pool (não vaza DATABASE_URL)
pool.on("error", (err) => {
  console.error("[db] Pool error", {
    message: err?.message,
    code: (err as any)?.code,
    name: err?.name,
  });
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
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr: any) {
      console.error("[db] ROLLBACK failed", {
        message: rollbackErr?.message,
        code: rollbackErr?.code,
      });
    }
    throw e;
  } finally {
    client.release();
  }
}
