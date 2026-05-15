/*
 * File: src/lib/engagement.ts
 *
 * Responsibility:
 * - Centralize persisted engagement/gamification helpers.
 * - Record auditable activity events.
 * - Maintain daily activity aggregates.
 * - Recompute a rebuildable engagement summary.
 *
 * Guardrails:
 * - XP reflects activity only.
 * - XP is not a USMLE score prediction.
 * - Level is not readiness, rank, or percentile.
 * - No cohort ranking is implemented here.
 */

import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { query as dbQuery } from "@/lib/db";

export const ENGAGEMENT_LEVEL_XP = 100;

export const ENGAGEMENT_EVENT_TYPES = [
  "session_started",
  "answer_submitted",
  "answer_correct",
  "answer_incorrect",
  "question_flagged",
  "question_unflagged",
  "session_submitted",
  "review_opened",
  "review_completed",
  "progress_opened",
  "results_opened",
] as const;

export type EngagementEventType = (typeof ENGAGEMENT_EVENT_TYPES)[number];

type EngagementDbClient = Pick<PoolClient, "query">;

type DailyActivityRow = {
  activity_date: string | Date;
  xp_total: number | string | null;
};

export type EngagementSummary = {
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  total_xp: number;
  level_number: number;
  level_progress_xp: number;
  next_level_xp: number;
  last_activity_date: string | null;
  last_event_at: string | null;
};

export type RecordActivityEventInput = {
  userId: string;
  eventType: EngagementEventType;
  occurredAt?: Date;
  eventDate?: string;
  sessionId?: string | null;
  sessionItemId?: string | null;
  questionId?: string | null;
  mode?: string | null;
  exam?: string | null;
  xpDelta?: number;
  studySeconds?: number;
  idempotencyKey?: string | null;
  metadataJson?: Record<string, unknown>;
};

export type RecordActivityEventResult = {
  inserted: boolean;
  event_id: string | null;
  xp_delta: number;
  summary: EngagementSummary | null;
};

const DEFAULT_XP_BY_EVENT_TYPE: Record<EngagementEventType, number> = {
  session_started: 2,
  answer_submitted: 1,
  answer_correct: 1,
  answer_incorrect: 0,
  question_flagged: 0,
  question_unflagged: 0,
  session_submitted: 5,
  review_opened: 2,
  review_completed: 5,
  progress_opened: 0,
  results_opened: 0,
};

function clampNonnegativeInteger(value: unknown): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numeric));
}

function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDateKey(
  value: string | Date | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return formatUtcDateKey(value);
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 10);
}

function addUtcDays(dateKey: string, deltaDays: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);

  return formatUtcDateKey(date);
}

function computeLongestStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dateKeys.length; index += 1) {
    const previous = dateKeys[index - 1];
    const expected = addUtcDays(previous, 1);

    if (dateKeys[index] === expected) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
  }

  return longest;
}

function computeCurrentStreak(dateSet: Set<string>): number {
  const today = formatUtcDateKey(new Date());
  const yesterday = addUtcDays(today, -1);

  let cursor = dateSet.has(today)
    ? today
    : dateSet.has(yesterday)
      ? yesterday
      : null;

  if (!cursor) {
    return 0;
  }

  let streak = 0;

  while (cursor && dateSet.has(cursor)) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return streak;
}

function computeLevel(totalXp: number) {
  const safeTotal = clampNonnegativeInteger(totalXp);

  return {
    level_number: Math.floor(safeTotal / ENGAGEMENT_LEVEL_XP) + 1,
    level_progress_xp: safeTotal % ENGAGEMENT_LEVEL_XP,
    next_level_xp: ENGAGEMENT_LEVEL_XP,
  };
}

function dailyDeltasForEvent(
  eventType: EngagementEventType,
  xpDelta: number,
  studySeconds: number,
) {
  return {
    sessions_started: eventType === "session_started" ? 1 : 0,
    sessions_submitted: eventType === "session_submitted" ? 1 : 0,
    questions_answered: eventType === "answer_submitted" ? 1 : 0,
    questions_correct: eventType === "answer_correct" ? 1 : 0,
    questions_flagged: eventType === "question_flagged" ? 1 : 0,
    review_actions:
      eventType === "review_opened" || eventType === "review_completed" ? 1 : 0,
    xp_total: xpDelta,
    study_seconds: studySeconds,
  };
}

async function runQuery<T extends QueryResultRow>(
  client: EngagementDbClient | undefined,
  text: string,
  params: unknown[],
): Promise<QueryResult<T>> {
  if (client) {
    return client.query<T>(text, params);
  }

  return dbQuery<T>(text, params as Parameters<typeof dbQuery>[1]);
}

export function getDefaultXpForEvent(eventType: EngagementEventType): number {
  return DEFAULT_XP_BY_EVENT_TYPE[eventType] ?? 0;
}

export async function recordActivityEvent(
  input: RecordActivityEventInput,
  client?: EngagementDbClient,
): Promise<RecordActivityEventResult> {
  const occurredAt = input.occurredAt ?? new Date();
  const eventDate = input.eventDate ?? formatUtcDateKey(occurredAt);
  const xpDelta = clampNonnegativeInteger(
    input.xpDelta ?? getDefaultXpForEvent(input.eventType),
  );
  const studySeconds = clampNonnegativeInteger(input.studySeconds ?? 0);
  const metadataJson = JSON.stringify(input.metadataJson ?? {});
  const idempotencyKey = input.idempotencyKey?.trim() || null;

  await runQuery(
    client,
    `
    INSERT INTO users_profile (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING
    `,
    [input.userId],
  );

  const insertedEvent = await runQuery<{ id: string }>(
    client,
    `
    INSERT INTO user_activity_events (
      user_id,
      event_type,
      event_date,
      occurred_at,
      session_id,
      session_item_id,
      question_id,
      mode,
      exam,
      xp_delta,
      metadata_json,
      idempotency_key
    )
    VALUES (
      $1,
      $2,
      $3::date,
      $4::timestamptz,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11::jsonb,
      $12
    )
    ON CONFLICT (user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    DO NOTHING
    RETURNING id
    `,
    [
      input.userId,
      input.eventType,
      eventDate,
      occurredAt.toISOString(),
      input.sessionId ?? null,
      input.sessionItemId ?? null,
      input.questionId ?? null,
      input.mode ?? null,
      input.exam ?? null,
      xpDelta,
      metadataJson,
      idempotencyKey,
    ],
  );

  const eventId = insertedEvent.rows[0]?.id ?? null;

  if (!eventId) {
    return {
      inserted: false,
      event_id: null,
      xp_delta: 0,
      summary: null,
    };
  }

  const deltas = dailyDeltasForEvent(input.eventType, xpDelta, studySeconds);

  await runQuery(
    client,
    `
    INSERT INTO user_daily_activity (
      user_id,
      activity_date,
      sessions_started,
      sessions_submitted,
      questions_answered,
      questions_correct,
      questions_flagged,
      review_actions,
      xp_total,
      study_seconds
    )
    VALUES (
      $1,
      $2::date,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
      sessions_started = user_daily_activity.sessions_started + EXCLUDED.sessions_started,
      sessions_submitted = user_daily_activity.sessions_submitted + EXCLUDED.sessions_submitted,
      questions_answered = user_daily_activity.questions_answered + EXCLUDED.questions_answered,
      questions_correct = user_daily_activity.questions_correct + EXCLUDED.questions_correct,
      questions_flagged = user_daily_activity.questions_flagged + EXCLUDED.questions_flagged,
      review_actions = user_daily_activity.review_actions + EXCLUDED.review_actions,
      xp_total = user_daily_activity.xp_total + EXCLUDED.xp_total,
      study_seconds = user_daily_activity.study_seconds + EXCLUDED.study_seconds,
      updated_at = now()
    `,
    [
      input.userId,
      eventDate,
      deltas.sessions_started,
      deltas.sessions_submitted,
      deltas.questions_answered,
      deltas.questions_correct,
      deltas.questions_flagged,
      deltas.review_actions,
      deltas.xp_total,
      deltas.study_seconds,
    ],
  );

  const summary = await recomputeEngagementSummary(input.userId, client);

  return {
    inserted: true,
    event_id: eventId,
    xp_delta: xpDelta,
    summary,
  };
}

export async function recomputeEngagementSummary(
  userId: string,
  client?: EngagementDbClient,
): Promise<EngagementSummary> {
  const daily = await runQuery<DailyActivityRow>(
    client,
    `
    SELECT
      activity_date,
      xp_total
    FROM user_daily_activity
    WHERE user_id = $1
    ORDER BY activity_date ASC
    `,
    [userId],
  );

  const dateKeys = daily.rows
    .map((row) => normalizeDateKey(row.activity_date))
    .filter((value): value is string => Boolean(value));

  const uniqueDateKeys = Array.from(new Set(dateKeys)).sort();
  const dateSet = new Set(uniqueDateKeys);
  const totalXp = daily.rows.reduce(
    (sum, row) => sum + clampNonnegativeInteger(row.xp_total),
    0,
  );

  const level = computeLevel(totalXp);
  const currentStreakDays = computeCurrentStreak(dateSet);
  const longestStreakDays = computeLongestStreak(uniqueDateKeys);
  const lastActivityDate = uniqueDateKeys[uniqueDateKeys.length - 1] ?? null;

  const event = await runQuery<{ last_event_at: string | null }>(
    client,
    `
    SELECT MAX(occurred_at)::text AS last_event_at
    FROM user_activity_events
    WHERE user_id = $1
    `,
    [userId],
  );

  const lastEventAt = event.rows[0]?.last_event_at ?? null;

  const saved = await runQuery<EngagementSummary>(
    client,
    `
    INSERT INTO user_engagement_summary (
      user_id,
      current_streak_days,
      longest_streak_days,
      total_xp,
      level_number,
      level_progress_xp,
      next_level_xp,
      last_activity_date,
      last_event_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::date,
      $9::timestamptz,
      now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      current_streak_days = EXCLUDED.current_streak_days,
      longest_streak_days = EXCLUDED.longest_streak_days,
      total_xp = EXCLUDED.total_xp,
      level_number = EXCLUDED.level_number,
      level_progress_xp = EXCLUDED.level_progress_xp,
      next_level_xp = EXCLUDED.next_level_xp,
      last_activity_date = EXCLUDED.last_activity_date,
      last_event_at = EXCLUDED.last_event_at,
      updated_at = now()
    RETURNING
      user_id::text,
      current_streak_days,
      longest_streak_days,
      total_xp,
      level_number,
      level_progress_xp,
      next_level_xp,
      last_activity_date::text,
      last_event_at::text
    `,
    [
      userId,
      currentStreakDays,
      longestStreakDays,
      totalXp,
      level.level_number,
      level.level_progress_xp,
      level.next_level_xp,
      lastActivityDate,
      lastEventAt,
    ],
  );

  const summary = saved.rows[0];

  if (!summary) {
    throw new Error("Failed to save engagement summary");
  }

  return summary;
}
