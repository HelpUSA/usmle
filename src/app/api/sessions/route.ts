/*
 * File: src/app/api/sessions/route.ts
 *
 * Responsibility:
 * - POST: create a new study session for the authenticated API user.
 * - GET: list recent study sessions for the authenticated API user.
 * - GET also returns per-session attempt aggregates for Results cards.
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - That helper may support:
 *   - development x-user-id override;
 *   - NextAuth/session-backed user resolution.
 *
 * Database contract:
 * - Ensures users_profile exists before inserting a session.
 * - Creates sessions with mode-derived behavior:
 *   - practice: untimed, immediate review;
 *   - timed_block: timed, deferred review;
 *   - exam_sim: timed, deferred review.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { query } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

const CreateSessionSchema = z
  .object({
    mode: z.enum(["practice", "timed_block", "exam_sim"]),
    exam: z.enum(["step1", "step2ck", "step3"]),
    language: z.string().trim().min(2).max(10).default("en"),
  })
  .strict();

type SessionMode = z.infer<typeof CreateSessionSchema>["mode"];

type DerivedSessionBehavior = {
  timed: boolean;
  time_limit_seconds: number | null;
  settings_json: {
    review_strategy: "immediate" | "deferred";
    timer_visible: boolean;
    mode_semantics: SessionMode;
    exam_format_version: "legacy" | "usmle_2026_new_software";
    block_size: number | null;
    block_minutes: number | null;
    pacing_target_seconds_per_item: number | null;
    flag_warning_threshold: number | null;
    implementation_phase: "current" | "planned";
  };
};

type SessionListRow = {
  session_id: string;
  user_id: string;
  mode: string;
  exam: string;
  language: string;
  timed: boolean;
  time_limit_seconds: number | null;
  status: string | null;
  settings_json: unknown;
  started_at: string | null;
  submitted_at: string | null;
  answered?: number | string | null;
  correct?: number | string | null;
  wrong?: number | string | null;
  skipped?: number | string | null;
  flagged?: number | string | null;
  avg_time_seconds?: number | string | null;
};

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric;
}

function normalizeSessionListRow(row: SessionListRow) {
  const answered = toNumber(row.answered);
  const correct = toNumber(row.correct);

  return {
    ...row,
    answered,
    correct,
    wrong: toNumber(row.wrong),
    skipped: toNumber(row.skipped),
    flagged: toNumber(row.flagged),
    accuracy: answered > 0 ? correct / answered : 0,
    avg_time_seconds: toNumber(row.avg_time_seconds),
  };
}

function deriveSessionBehavior(mode: SessionMode): DerivedSessionBehavior {
  switch (mode) {
    case "practice":
      return {
        timed: false,
        time_limit_seconds: null,
        settings_json: {
          review_strategy: "immediate",
          timer_visible: false,
          mode_semantics: "practice",
          exam_format_version: "usmle_2026_new_software",
          block_size: null,
          block_minutes: null,
          pacing_target_seconds_per_item: null,
          flag_warning_threshold: null,
          implementation_phase: "current",
        },
      };

    case "timed_block":
      return {
        timed: true,
        time_limit_seconds: 30 * 60,
        settings_json: {
          review_strategy: "deferred",
          timer_visible: true,
          mode_semantics: "timed_block",
          exam_format_version: "usmle_2026_new_software",
          block_size: 20,
          block_minutes: 30,
          pacing_target_seconds_per_item: 90,
          flag_warning_threshold: 5,
          implementation_phase: "current",
        },
      };

    case "exam_sim":
      return {
        timed: true,
        time_limit_seconds: 30 * 60,
        settings_json: {
          review_strategy: "deferred",
          timer_visible: true,
          mode_semantics: "exam_sim",
          exam_format_version: "usmle_2026_new_software",
          block_size: 20,
          block_minutes: 30,
          pacing_target_seconds_per_item: 90,
          flag_warning_threshold: 5,
          implementation_phase: "planned",
        },
      };

    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unsupported mode: ${exhaustiveCheck}`);
    }
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
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

export async function POST(req: Request) {
  try {
    const userId = await getUserIdForApi(req);

    const bodyJson = await req.json().catch(() => ({}));
    const body = CreateSessionSchema.parse(bodyJson);
    const derived = deriveSessionBehavior(body.mode);

    await query(
      `
      INSERT INTO users_profile (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    const created = await query(
      `
      INSERT INTO sessions (
        user_id,
        mode,
        exam,
        language,
        timed,
        time_limit_seconds,
        status,
        settings_json
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'in_progress', $7::jsonb
      )
      RETURNING
        session_id,
        user_id,
        mode,
        exam,
        language,
        timed,
        time_limit_seconds,
        status,
        settings_json,
        started_at,
        submitted_at
      `,
      [
        userId,
        body.mode,
        body.exam,
        body.language,
        derived.timed,
        derived.time_limit_seconds,
        JSON.stringify(derived.settings_json),
      ]
    );

    return NextResponse.json(created.rows[0], { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to create session"),
      },
      {
        status: getErrorStatus(error),
      }
    );
  }
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdForApi(req);

    const sessions = await query(
      `
      SELECT
        s.session_id,
        s.user_id,
        s.mode,
        s.exam,
        s.language,
        s.timed,
        s.time_limit_seconds,
        s.status,
        s.settings_json,
        s.started_at,
        s.submitted_at,
        COALESCE(metrics.answered, 0)::int AS answered,
        COALESCE(metrics.correct, 0)::int AS correct,
        COALESCE(metrics.wrong, 0)::int AS wrong,
        COALESCE(metrics.skipped, 0)::int AS skipped,
        COALESCE(metrics.flagged, 0)::int AS flagged,
        COALESCE(metrics.avg_time_seconds, 0)::float AS avg_time_seconds
      FROM sessions s
      LEFT JOIN (
        SELECT
          a.session_id,
          COUNT(*) FILTER (WHERE a.result IN ('correct', 'wrong', 'skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COUNT(*) FILTER (
            WHERE COALESCE(si.flagged_for_review, a.flagged_for_review, false)
          )::int AS flagged,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        LEFT JOIN session_items si
          ON si.session_item_id = a.session_item_id
          AND si.session_id = a.session_id
        WHERE a.user_id = $1
        GROUP BY a.session_id
      ) AS metrics ON metrics.session_id = s.session_id
      WHERE s.user_id = $1
      ORDER BY s.started_at DESC
      LIMIT 20
      `,
      [userId]
    );

    return NextResponse.json({
      sessions: (sessions.rows as SessionListRow[]).map(normalizeSessionListRow),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to load sessions"),
      },
      {
        status: getErrorStatus(error),
      }
    );
  }
}