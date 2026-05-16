import { NextRequest, NextResponse } from "next/server";

import { getUserIdForApi } from "@/lib/auth";
import { query } from "@/lib/db";
import { recordActivityEvent } from "@/lib/engagement";

type DbRow = Record<string, unknown>;

function asInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 0) : fallback;
}

function asDateKey(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

function asTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value).trim();
  return text || null;
}

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getErrorStatus(error: unknown): number {
  return error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
}

function emptySummary() {
  return {
    current_streak_days: 0,
    longest_streak_days: 0,
    total_xp: 0,
    level_number: 1,
    level_progress_xp: 0,
    next_level_xp: 100,
    last_activity_date: null,
    last_event_at: null,
  };
}

function emptyDay(activityDate: string) {
  return {
    activity_date: activityDate,
    sessions_started: 0,
    sessions_submitted: 0,
    questions_answered: 0,
    questions_correct: 0,
    questions_flagged: 0,
    review_actions: 0,
    xp_total: 0,
    study_seconds: 0,
  };
}

function mapSummary(row: DbRow | undefined) {
  if (!row) return emptySummary();

  return {
    current_streak_days: asInt(row.current_streak_days),
    longest_streak_days: asInt(row.longest_streak_days),
    total_xp: asInt(row.total_xp),
    level_number: Math.max(asInt(row.level_number, 1), 1),
    level_progress_xp: asInt(row.level_progress_xp),
    next_level_xp: Math.max(asInt(row.next_level_xp, 100), 1),
    last_activity_date: asDateKey(row.last_activity_date),
    last_event_at: asTimestamp(row.last_event_at),
  };
}

function mapDay(row: DbRow) {
  return {
    activity_date: asDateKey(row.activity_date) ?? todayUtcKey(),
    sessions_started: asInt(row.sessions_started),
    sessions_submitted: asInt(row.sessions_submitted),
    questions_answered: asInt(row.questions_answered),
    questions_correct: asInt(row.questions_correct),
    questions_flagged: asInt(row.questions_flagged),
    review_actions: asInt(row.review_actions),
    xp_total: asInt(row.xp_total),
    study_seconds: asInt(row.study_seconds),
  };
}

function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.toLowerCase().includes("unauthorized") ||
      error.message.toLowerCase().includes("auth"))
  );
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdForApi(req);
    const today = todayUtcKey();

    await query(
      `
      INSERT INTO users_profile (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [userId],
    );

    const summaryRes = await query(
      `
      SELECT current_streak_days, longest_streak_days, total_xp,
        level_number, level_progress_xp, next_level_xp,
        last_activity_date::text AS last_activity_date, last_event_at
      FROM user_engagement_summary
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const recentRes = await query(
      `
      SELECT activity_date::text AS activity_date, sessions_started,
        sessions_submitted, questions_answered, questions_correct,
        questions_flagged, review_actions, xp_total, study_seconds
      FROM user_daily_activity
      WHERE user_id = $1
      ORDER BY activity_date DESC
      LIMIT 30
      `,
      [userId],
    );

    const recent_days = recentRes.rows.map((row) => mapDay(row as DbRow));
    const todayRow =
      recent_days.find((day) => day.activity_date === today) ?? emptyDay(today);

    return NextResponse.json({
      summary: mapSummary(summaryRes.rows[0] as DbRow | undefined),
      today: todayRow,
      recent_days,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to load engagement summary", error);

    return NextResponse.json(
      { error: "Failed to load engagement summary" },
      { status: 500 },
    );
  }
}

function isTrackablePageEvent(
  value: unknown
): value is "progress_opened" | "results_opened" {
  return value === "progress_opened" || value === "results_opened";
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdForApi(req);
    const body: unknown = await req.json().catch(() => null);
    const eventType =
      body && typeof body === "object" && "event_type" in body
        ? (body as { event_type?: unknown }).event_type
        : null;

    if (!isTrackablePageEvent(eventType)) {
      return NextResponse.json(
        { error: "Invalid engagement event" },
        { status: 400 }
      );
    }

    const eventDate = todayUtcKey();

    await recordActivityEvent({
      userId,
      eventType,
      eventDate,
      idempotencyKey: `${eventType}:${userId}:${eventDate}`,
      metadataJson: {
        source: "page_view",
      },
    });

    return NextResponse.json(
      { ok: true, event_type: eventType, event_date: eventDate },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to record engagement event"
        ),
      },
      {
        status: getErrorStatus(error),
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
