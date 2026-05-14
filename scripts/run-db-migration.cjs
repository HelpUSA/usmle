#!/usr/bin/env node
/*
 * File: scripts/run-db-migration.cjs
 *
 * Responsibility:
 * - Apply one SQL migration file to the configured PostgreSQL database.
 * - Load DATABASE_URL from .env.local when it is not already present.
 * - Keep a small public.schema_migrations ledger independent of Prisma.
 *
 * Usage:
 *   node scripts/run-db-migration.cjs db/migrations/20260514_001_session_item_block_state.sql
 *
 * Safety:
 * - Does not print DATABASE_URL.
 * - Runs the SQL inside a transaction.
 * - Skips the migration if the migration filename is already present in
 *   public.schema_migrations.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);

    if (!match) {
      continue;
    }

    const key = match[1];

    if (process.env[key]) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getMigrationPath() {
  const input = process.argv[2];

  if (!input) {
    throw new Error(
      "Missing migration file path. Usage: node scripts/run-db-migration.cjs <path-to-sql>"
    );
  }

  const fullPath = path.resolve(process.cwd(), input);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Migration file not found: ${input}`);
  }

  if (!fullPath.endsWith(".sql")) {
    throw new Error(`Migration file must be a .sql file: ${input}`);
  }

  return fullPath;
}

function getMigrationId(fullPath) {
  return path.basename(fullPath);
}

function shouldUseSsl(url) {
  return (
    url.includes("railway") ||
    url.includes("proxy.rlwy") ||
    url.includes("sslmode=require")
  );
}

async function main() {
  loadEnvLocal();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const migrationPath = getMigrationPath();
  const migrationId = getMigrationId(migrationPath);
  const sql = fs.readFileSync(migrationPath, "utf8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        migration_id text PRIMARY KEY,
        checksum_sha256 text NOT NULL,
        applied_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    const existing = await client.query(
      `
      SELECT migration_id, checksum_sha256, applied_at
      FROM public.schema_migrations
      WHERE migration_id = $1
      LIMIT 1
      `,
      [migrationId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      if (row.checksum_sha256 !== checksum) {
        throw new Error(
          `Migration ${migrationId} is already applied with a different checksum`
        );
      }

      await client.query("COMMIT");

      console.log("MIGRATION_ALREADY_APPLIED=True");
      console.log(`MIGRATION_ID=${migrationId}`);
      console.log("DATABASE_URL_PRINTED=False");
      return;
    }

    await client.query(sql);

    await client.query(
      `
      INSERT INTO public.schema_migrations (migration_id, checksum_sha256)
      VALUES ($1, $2)
      `,
      [migrationId, checksum]
    );

    await client.query("COMMIT");

    console.log("MIGRATION_APPLIED=True");
    console.log(`MIGRATION_ID=${migrationId}`);
    console.log(`MIGRATION_SHA256=${checksum}`);
    console.log("DATABASE_URL_PRINTED=False");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK_FAILED");
      console.error(rollbackError?.stack || rollbackError?.message || String(rollbackError));
    }

    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("MIGRATION_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
