/*
 * File: src/app/api/me/stats/route.ts
 *
 * Responsibility:
 * - Return authenticated-user performance statistics.
 * - Aggregate submitted-session attempts over a configurable date range.
 * - Provide:
 *   - overall attempt metrics;
 *   - metrics grouped by exam;
 *   - metrics grouped by study mode;
 *   - metrics grouped by USMLE 2026 block index.
 *
 * API contract:
 * - GET /api/me/stats?range=30
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - In production, this should resolve through the authenticated NextAuth session.
 * - In development/test, getUserIdForApi may also allow a validated x-user-id.
 *
 * Data contract:
 * - Only submitted sessions are counted.
 * - Attempts counted as answered are result IN ('correct', 'wrong', 'skipped').
 * - Accuracy = correct / answered.
 * - Flag count uses persisted session_items flag when available,
 *   otherwise the attempt-level flag.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QuerySchema = z
  .object({
    range: z.coerce.number().int().min(1).max(365).default(30),
  })
  .strict();

type AggregateRow = {
  answered?: number | string | null;
  correct?: number | string | null;
  wrong?: number | string | null;
  skipped?: number | string | null;
  flagged?: number | string | null;
  avg_time_seconds?: number | string | null;
};

type ByExamRow = AggregateRow & {
  exam?: string | null;
};

type ByModeRow = AggregateRow & {
  mode?: string | null;
};

type ByBlockRow = AggregateRow & {
  block_index?: number | string | null;
};

type NormalizedAggregate = {
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
  flagged: number;
  accuracy: number;
  avg_time_seconds: number;
};

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric;
}

function normalizeAggregate(row: AggregateRow | null | undefined): NormalizedAggregate {
  const answered = toNumber(row?.answered);
  const correct = toNumber(row?.correct);

  return {
    answered,
    correct,
    wrong: toNumber(row?.wrong),
    skipped: toNumber(row?.skipped),
    flagged: toNumber(row?.flagged),
    accuracy: answered > 0 ? correct / answered : 0,
    avg_time_seconds: toNumber(row?.avg_time_seconds),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
      .join("; ");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("unauthorized") ||
    message.includes("not authenticated") ||
    message.includes("authentication required") ||
    message.includes("sign in")
  );
}

function getErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (isAuthError(error)) {
    return 401;
  }

  return 500;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdForApi(req);
    const url = new URL(req.url);

    const parsed = QuerySchema.parse({
      range: url.searchParams.get("range") ?? undefined,
    });

    const rangeDays = parsed.range;

    const payload = await withTx(async (client) => {
      const overallRes = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE a.result IN ('correct', 'wrong', 'skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COUNT(*) FILTER (
            WHERE COALESCE(si.flagged_for_review, a.flagged_for_review, false)
          )::int AS flagged,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        JOIN sessions s ON s.session_id = a.session_id
        LEFT JOIN session_items si
          ON si.session_item_id = a.session_item_id
          AND si.session_id = a.session_id
        WHERE a.user_id = $1
          AND s.user_id = $1
          AND s.status = 'submitted'
          AND s.submitted_at >= (now() - ($2::int * interval '1 day'))
        `,
        [userId, rangeDays]
      );

      const overall = normalizeAggregate(
        (overallRes.rows?.[0] ?? null) as AggregateRow | null
      );

      const byExamRes = await client.query(
        `
        SELECT
          s.exam,
          COUNT(*) FILTER (WHERE a.result IN ('correct', 'wrong', 'skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COUNT(*) FILTER (
            WHERE COALESCE(si.flagged_for_review, a.flagged_for_review, false)
          )::int AS flagged,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        JOIN sessions s ON s.session_id = a.session_id
        LEFT JOIN session_items si
          ON si.session_item_id = a.session_item_id
          AND si.session_id = a.session_id
        WHERE a.user_id = $1
          AND s.user_id = $1
          AND s.status = 'submitted'
          AND s.submitted_at >= (now() - ($2::int * interval '1 day'))
        GROUP BY s.exam
        ORDER BY s.exam ASC
        `,
        [userId, rangeDays]
      );

      const byModeRes = await client.query(
        `
        SELECT
          s.mode,
          COUNT(*) FILTER (WHERE a.result IN ('correct', 'wrong', 'skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COUNT(*) FILTER (
            WHERE COALESCE(si.flagged_for_review, a.flagged_for_review, false)
          )::int AS flagged,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        JOIN sessions s ON s.session_id = a.session_id
        LEFT JOIN session_items si
          ON si.session_item_id = a.session_item_id
          AND si.session_id = a.session_id
        WHERE a.user_id = $1
          AND s.user_id = $1
          AND s.status = 'submitted'
          AND s.submitted_at >= (now() - ($2::int * interval '1 day'))
        GROUP BY s.mode
        ORDER BY s.mode ASC
        `,
        [userId, rangeDays]
      );

      const by_exam = ((byExamRes.rows ?? []) as ByExamRow[]).map((row) => ({
        exam: row.exam ?? "unknown",
        ...normalizeAggregate(row),
      }));

      const byBlockRes = await client.query(
        `
        SELECT
          COALESCE(si.block_index, 1)::int AS block_index,
          COUNT(*) FILTER (WHERE a.result IN ('correct', 'wrong', 'skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COUNT(*) FILTER (
            WHERE COALESCE(si.flagged_for_review, a.flagged_for_review, false)
          )::int AS flagged,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        JOIN sessions s ON s.session_id = a.session_id
        LEFT JOIN session_items si
          ON si.session_item_id = a.session_item_id
          AND si.session_id = a.session_id
        WHERE a.user_id = $1
          AND s.user_id = $1
          AND s.status = 'submitted'
          AND s.submitted_at >= (now() - ($2::int * interval '1 day'))
        GROUP BY COALESCE(si.block_index, 1)
        ORDER BY block_index ASC
        `,
        [userId, rangeDays]
      );

      const by_mode = ((byModeRes.rows ?? []) as ByModeRow[]).map((row) => ({
        mode: row.mode ?? "unknown",
        ...normalizeAggregate(row),
      }));

      const by_block = ((byBlockRes.rows ?? []) as ByBlockRow[]).map((row) => ({
        block_index: Math.max(1, Math.trunc(toNumber(row.block_index) || 1)),
        ...normalizeAggregate(row),
      }));

      return {
        range_days: rangeDays,
        overall,
        by_exam,
        by_mode,
        by_block,
      };
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to load user statistics"),
      },
      {
        status: getErrorStatus(error),
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}