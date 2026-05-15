-- File: db/migrations/20260515_001_persisted_gamification.sql
--
-- Responsibility:
-- - Add additive persisted gamification tables.
-- - Store auditable user activity events.
-- - Store daily activity aggregates.
-- - Store a rebuildable engagement summary cache.
--
-- Safety:
-- - Additive only.
-- - Does not alter existing study/session tables.
-- - Does not introduce rankings, percentiles, or score prediction.
-- - Can be rolled back by dropping the three new tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(user_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date date NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NULL REFERENCES sessions(session_id) ON DELETE SET NULL,
  session_item_id uuid NULL REFERENCES session_items(session_item_id) ON DELETE SET NULL,
  question_id uuid NULL REFERENCES questions(question_id) ON DELETE SET NULL,
  mode text NULL,
  exam text NULL,
  xp_delta integer NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_activity_events_event_type_check CHECK (
    event_type IN (
      'session_started',
      'answer_submitted',
      'answer_correct',
      'answer_incorrect',
      'question_flagged',
      'question_unflagged',
      'session_submitted',
      'review_opened',
      'review_completed',
      'progress_opened',
      'results_opened'
    )
  ),
  CONSTRAINT user_activity_events_xp_delta_check CHECK (xp_delta >= 0),
  CONSTRAINT user_activity_events_metadata_object_check CHECK (
    jsonb_typeof(metadata_json) = 'object'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_activity_events_user_idempotency_idx
  ON user_activity_events(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_activity_events_user_date_idx
  ON user_activity_events(user_id, event_date DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_user_type_date_idx
  ON user_activity_events(user_id, event_type, event_date DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_session_idx
  ON user_activity_events(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_activity_events_session_item_idx
  ON user_activity_events(session_item_id)
  WHERE session_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_daily_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(user_id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  sessions_started integer NOT NULL DEFAULT 0,
  sessions_submitted integer NOT NULL DEFAULT 0,
  questions_answered integer NOT NULL DEFAULT 0,
  questions_correct integer NOT NULL DEFAULT 0,
  questions_flagged integer NOT NULL DEFAULT 0,
  review_actions integer NOT NULL DEFAULT 0,
  xp_total integer NOT NULL DEFAULT 0,
  study_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_daily_activity_unique_user_date UNIQUE (user_id, activity_date),
  CONSTRAINT user_daily_activity_nonnegative_check CHECK (
    sessions_started >= 0
    AND sessions_submitted >= 0
    AND questions_answered >= 0
    AND questions_correct >= 0
    AND questions_flagged >= 0
    AND review_actions >= 0
    AND xp_total >= 0
    AND study_seconds >= 0
  )
);

CREATE INDEX IF NOT EXISTS user_daily_activity_user_date_idx
  ON user_daily_activity(user_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS user_engagement_summary (
  user_id uuid PRIMARY KEY REFERENCES users_profile(user_id) ON DELETE CASCADE,
  current_streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  total_xp integer NOT NULL DEFAULT 0,
  level_number integer NOT NULL DEFAULT 1,
  level_progress_xp integer NOT NULL DEFAULT 0,
  next_level_xp integer NOT NULL DEFAULT 100,
  last_activity_date date NULL,
  last_event_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_engagement_summary_nonnegative_check CHECK (
    current_streak_days >= 0
    AND longest_streak_days >= 0
    AND total_xp >= 0
    AND level_number >= 1
    AND level_progress_xp >= 0
    AND next_level_xp > 0
  )
);

COMMENT ON TABLE user_activity_events IS
  'Append-only event ledger for persisted engagement activity.';

COMMENT ON TABLE user_daily_activity IS
  'One row per user per activity day for streak and daily summary queries.';

COMMENT ON TABLE user_engagement_summary IS
  'Rebuildable per-user engagement summary cache. Not a ranking table.';
