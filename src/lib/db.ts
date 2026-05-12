// src/lib/db.ts
//
// File: src/lib/db.ts
//
// Responsibility:
// - Centralized PostgreSQL helper.
// - Provides a small pg Pool configured for Railway/Vercel-style deployments.
// - Provides query() for simple SQL calls.
// - Provides withTx() for atomic multi-step operations.
//
// Env vars:
// - DATABASE_URL: PostgreSQL connection string.
// - PGSSL_DISABLE: if set to a truthy value, disables SSL. Useful for local dev.
//
// Notes:
// - Railway Postgres typically requires SSL.
// - Vercel/serverless can create multiple runtime instances.
// - Pool size is intentionally small to reduce connection pressure.
// - Pool is cached on globalThis to reduce duplicate pools during Next.js dev
//   hot reloads and warm serverless invocations.

import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from "pg";

type DbQueryParam =
  | string
  | number
  | boolean
  | Date
  | Buffer
  | null
  | undefined
  | DbQueryParam[];

type DbQueryParams = DbQueryParam[];

type PgErrorInfo = {
  message: string;
  name?: string;
  code?: string;
};

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPg = globalThis as typeof globalThis & {
  __usmlePgPool?: Pool;
};

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  return !["0", "false", "no", "off"].includes(normalized);
}

function getPgErrorInfo(error: unknown): PgErrorInfo {
  if (error instanceof Error) {
    const maybeCode =
      "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    return {
      message: error.message,
      name: error.name,
      ...(maybeCode ? { code: maybeCode } : {}),
    };
  }

  return {
    message: String(error),
  };
}

function createPool(): Pool {
  return new Pool({
    connectionString: DATABASE_URL,

    // Railway generally requires SSL. Disable only explicitly for local dev.
    ssl: isTruthyEnv(process.env.PGSSL_DISABLE)
      ? false
      : { rejectUnauthorized: false },

    // Serverless-safe defaults.
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,

    // Helps reduce idle/proxy disconnect problems.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

const pool = globalForPg.__usmlePgPool ?? createPool();

globalForPg.__usmlePgPool = pool;

pool.on("error", (error: unknown) => {
  console.error("[db] Pool error", getPgErrorInfo(error));
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: DbQueryParams
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTx<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError: unknown) {
      console.error("[db] ROLLBACK failed", getPgErrorInfo(rollbackError));
    }

    throw error;
  } finally {
    client.release();
  }
}