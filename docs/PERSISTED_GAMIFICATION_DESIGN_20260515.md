# Persisted Gamification Design - 2026-05-15

## Purpose

This document defines the Phase 3 design for persisted gamification in the USMLE platform.

The goal is to make engagement durable across sessions without adding fake rankings, fake percentiles, or unsupported claims.

Phase 3 should persist real user activity and derive streaks, XP, and review momentum from auditable events.

## Current baseline

Current validated production baseline:

- Latest Phase 2 status commit: afcb1f7 Update study engagement phase status
- Latest product code commit before this design document: be501a9 Add results to study loop

Validated frontend loop:

- /study: real weekly metrics, level progress, momentum CTA, review CTA.
- /progress: dashboard engagement cockpit using 365-day real stats.
- /results: results-to-study loop.

Current constraints:

- No persisted gamification tables yet.
- No persisted XP model yet.
- No persisted streak model yet.
- No true cohort ranking yet.
- Existing metrics are derived from submitted sessions and /api/me/stats.

## Non-negotiable guardrails

- Do not imply full USMLE simulation with the current question pool.
- Keep partial simulation language.
- Do not add fake rankings.
- Do not add fake percentiles.
- Do not add fake XP.
- Do not show cohort rank until there is real cohort data and privacy-safe aggregation.
- Do not use gamification to imply official score prediction.
- Every persisted gamification value must be traceable to user activity.

## Phase 3 objectives

Phase 3 should add persisted engagement state through a small, auditable event model.

Primary objectives:

- Persist study activity events.
- Derive daily activity from those events.
- Derive streaks from daily activity.
- Derive XP from transparent event weights.
- Persist or compute review queue state from real session items.
- Expose safe summaries through authenticated APIs.
- Surface persisted engagement on /study and /progress.

Secondary objectives:

- Keep implementation reversible.
- Keep schema small.
- Avoid introducing ranking until a later phase.
- Avoid blocking the current session flow.
- Avoid making the UI dependent on gamification for core study behavior.

## Proposed data model

### Table: user_activity_events

Responsibility:

- Append-only event ledger for user study activity.

Proposed columns:

- id: uuid primary key
- user_id: text not null
- event_type: text not null
- event_date: date not null
- occurred_at: timestamptz not null default now()
- session_id: uuid nullable
- session_item_id: uuid nullable
- question_id: uuid nullable
- mode: text nullable
- exam: text nullable
- xp_delta: integer not null default 0
- metadata_json: jsonb not null default '{}'

Recommended indexes:

- user_activity_events_user_date_idx on user_id, event_date desc
- user_activity_events_user_type_date_idx on user_id, event_type, event_date desc
- user_activity_events_session_idx on session_id
- user_activity_events_session_item_idx on session_item_id

Notes:

- event_date should be derived from occurred_at using the product timezone policy.
- user_id should match the same authenticated identity used by existing stats.
- metadata_json should remain small and non-sensitive.

### Table: user_daily_activity

Responsibility:

- One row per user per activity day.
- Used for streak and daily summary queries.

Proposed columns:

- id: uuid primary key
- user_id: text not null
- activity_date: date not null
- sessions_started: integer not null default 0
- sessions_submitted: integer not null default 0
- questions_answered: integer not null default 0
- questions_correct: integer not null default 0
- questions_flagged: integer not null default 0
- review_actions: integer not null default 0
- xp_total: integer not null default 0
- study_seconds: integer not null default 0
- created_at: timestamptz not null default now()
- updated_at: timestamptz not null default now()

Recommended constraints:

- unique(user_id, activity_date)

Recommended indexes:

- user_daily_activity_user_date_idx on user_id, activity_date desc

Notes:

- This can be maintained incrementally when events are inserted.
- It can also be rebuilt from user_activity_events if needed.

### Table: user_engagement_summary

Responsibility:

- One compact row per user for fast /study and /progress summaries.

Proposed columns:

- user_id: text primary key
- current_streak_days: integer not null default 0
- longest_streak_days: integer not null default 0
- total_xp: integer not null default 0
- level_number: integer not null default 1
- level_progress_xp: integer not null default 0
- next_level_xp: integer not null default 100
- last_activity_date: date nullable
- last_event_at: timestamptz nullable
- updated_at: timestamptz not null default now()

Notes:

- This table is a cache/summary, not the source of truth.
- Source of truth remains user_activity_events plus submitted session data.
- If the summary becomes inconsistent, it should be rebuildable.

## Event types

Recommended initial event types:

- session_started
- answer_submitted
- answer_correct
- answer_incorrect
- question_flagged
- question_unflagged
- session_submitted
- review_opened
- review_completed
- progress_opened
- results_opened

Do not over-model the first version.

Minimum viable event capture:

- session_started when a new session is created.
- answer_submitted when a user attempts a question.
- question_flagged or question_unflagged when flag state changes.
- session_submitted when a session is submitted.
- review_opened when session review is opened.

## XP model

XP should be transparent and modest.

Initial proposed weights:

- session_started: 2 XP
- answer_submitted: 1 XP
- answer_correct: 1 additional XP
- question_flagged: 0 XP
- question_unflagged: 0 XP
- session_submitted: 5 XP
- review_opened: 2 XP
- review_completed: 5 XP

Rules:

- XP is not a score prediction.
- XP is not a percentile.
- XP is not an official performance measure.
- XP only reflects study activity and completion behavior.

Anti-abuse constraints:

- Avoid awarding repeat XP for the same answer event if the API can be retried.
- Prefer idempotency keys where possible.
- Do not award unlimited XP for repeatedly opening the same page.
- Consider daily caps later, but do not add them before observing usage.

## Level model

Initial level formula:

- level_number = floor(total_xp / 100) + 1
- level_progress_xp = total_xp % 100
- next_level_xp = 100

Reason:

- Simple.
- Explainable.
- Easy to change later.
- Does not imply clinical or exam readiness.

UI language:

- Acceptable: Level 3 study activity
- Acceptable: 45 / 100 XP to next level
- Avoid: USMLE readiness level
- Avoid: predicted score level
- Avoid: top rank

## Streak model

Initial streak definition:

- A streak day is a calendar day with at least one meaningful study event.

Meaningful study events:

- session_started
- answer_submitted
- session_submitted
- review_completed

Non-streak events:

- progress_opened
- results_opened
- review_opened by itself may be excluded unless review_completed exists.

Streak computation:

- current_streak_days counts consecutive activity days ending today or yesterday.
- longest_streak_days is the longest historical consecutive sequence.
- missed days break the current streak.

Timezone policy:

- Pick one explicit product timezone policy before migration.
- Recommended initial policy: UTC for backend consistency.
- Later, user-local timezone can be added as a user setting.

## Review queue model

Initial approach:

- Do not create a separate review queue table in Phase 3A.
- Continue deriving review queue from flagged and incorrect session items where possible.
- Add persisted review events first.

Future optional table:

### Table: user_review_queue_items

Possible columns:

- id: uuid primary key
- user_id: text not null
- question_id: uuid not null
- source_session_item_id: uuid nullable
- reason: text not null
- status: text not null default 'open'
- priority: integer not null default 0
- created_at: timestamptz not null default now()
- updated_at: timestamptz not null default now()
- resolved_at: timestamptz nullable

Possible reasons:

- flagged
- incorrect
- slow_correct
- repeated_miss

Recommendation:

- Defer this table until persisted events and daily summaries are stable.

## API design

### GET /api/me/engagement

Responsibility:

- Return authenticated user engagement summary.

Initial response shape:

{
  "summary": {
    "current_streak_days": 0,
    "longest_streak_days": 0,
    "total_xp": 0,
    "level_number": 1,
    "level_progress_xp": 0,
    "next_level_xp": 100,
    "last_activity_date": null
  },
  "today": {
    "activity_date": "2026-05-15",
    "questions_answered": 0,
    "sessions_submitted": 0,
    "xp_total": 0
  },
  "recent_days": []
}

Notes:

- This endpoint should be authenticated.
- It should not expose other users.
- It should not expose rankings.

### POST /api/me/activity-events

Recommendation:

- Avoid exposing a broad generic event write endpoint initially.
- Prefer recording events inside existing trusted server-side routes.

Reason:

- A generic client-writable event endpoint is easier to abuse.
- Existing session routes already know which activity actually happened.

Preferred event recording locations:

- POST /api/sessions: record session_started.
- POST /api/sessions/[sessionId]/items/[sessionItemId]/attempt: record answer_submitted and correctness event.
- Existing flag update route or item update route: record question_flagged/question_unflagged.
- POST /api/sessions/[sessionId]/submit: record session_submitted.
- Review route/page API access: record review_opened or review_completed only if meaningful.

## Frontend integration plan

### /study

Add persisted engagement summary:

- current streak
- total XP
- level progress
- today activity

Keep existing real weekly stats:

- weekly answered
- weekly accuracy
- weekly study time
- flags

Do not replace stats with XP.

### /progress

Add persisted engagement summary card:

- current streak
- longest streak
- total XP
- level progress
- recent activity days

Keep existing 365-day stats.

### /results

Optional later:

- Show XP earned from completed session if session_submit event is available.
- Link back to /study and /progress remains enough for Phase 2G.

## Migration plan

Phase 3B should add migrations only after this design is accepted.

Recommended migration order:

1. Create user_activity_events.
2. Create user_daily_activity.
3. Create user_engagement_summary.
4. Add indexes.
5. Add rebuild script for summaries.
6. Add tests or validation scripts.

Rollback considerations:

- Tables can be dropped without affecting core session data.
- Event recording should be additive.
- Core study flow should continue even if gamification event recording fails.

## Implementation plan

### Phase 3B - Schema and helpers

- Add database migration.
- Add server helper to record activity events.
- Add helper to upsert user_daily_activity.
- Add helper to recompute user_engagement_summary.

### Phase 3C - Event capture

- Record session_started.
- Record answer_submitted.
- Record answer_correct or answer_incorrect.
- Record question_flagged or question_unflagged.
- Record session_submitted.

### Phase 3D - Engagement API

- Add GET /api/me/engagement.
- Return summary, today, recent days.
- Keep endpoint authenticated.

### Phase 3E - Frontend surfacing

- Add persisted streak and XP to /study.
- Add persisted engagement summary to /progress.
- Keep partial simulation wording.

## Validation checklist

Before merging Phase 3 code:

- npm run build passes.
- TypeScript passes.
- Migrations run locally.
- Existing session creation still works.
- Existing answer attempt flow still works.
- Existing session submit still works.
- /api/me/stats remains unchanged or backward compatible.
- /study still renders without engagement rows.
- /progress still renders without engagement rows.
- No fake rank appears.
- No fake percentile appears.
- No fake score prediction appears.

## Open decisions

- Product timezone: UTC vs user-local.
- Whether review_opened should count toward streak.
- Whether XP should be awarded for correct answers only after session submit or immediately after attempt.
- Whether to add daily XP caps.
- Whether to store summary as cache or compute on request for early version.

## Recommendation

Proceed with Phase 3B only after confirming the existing database migration pattern and current session schema.

The next operational step should be an audit-only command that inspects:

- existing migration files
- database helper files
- session route structure
- attempt route structure
- submit route structure
- authentication identity field

After that audit, implement the smallest additive schema possible.
