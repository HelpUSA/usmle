-- Migration: 20260514_001_session_item_block_state
-- Purpose:
-- - Add persistent per-session-item block metadata for USMLE 2026-style sessions.
-- - Add persistent pre-answer flag state without creating attempts.
-- - Keep the migration idempotent for safe local/prod execution.
--
-- This migration is intentionally backward-compatible:
-- - Existing session_items are backfilled into block 1 using a 20-item block rhythm.
-- - first_seen_at and last_seen_at remain nullable until the player/API begins writing them.
-- - No existing attempts or sessions are modified.

ALTER TABLE public.session_items
  ADD COLUMN IF NOT EXISTS block_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS position_in_block integer,
  ADD COLUMN IF NOT EXISTS flagged_for_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;

UPDATE public.session_items
SET
  block_index = GREATEST(1, ((position - 1) / 20) + 1),
  position_in_block = COALESCE(position_in_block, ((position - 1) % 20) + 1)
WHERE
  position IS NOT NULL
  AND (
    block_index IS NULL
    OR block_index < 1
    OR position_in_block IS NULL
    OR position_in_block < 1
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_items_block_index_positive_chk'
  ) THEN
    ALTER TABLE public.session_items
      ADD CONSTRAINT session_items_block_index_positive_chk
      CHECK (block_index >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_items_position_in_block_positive_chk'
  ) THEN
    ALTER TABLE public.session_items
      ADD CONSTRAINT session_items_position_in_block_positive_chk
      CHECK (position_in_block IS NULL OR position_in_block >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_items_session_block_position
  ON public.session_items (session_id, block_index, position_in_block);

CREATE INDEX IF NOT EXISTS idx_session_items_session_flagged
  ON public.session_items (session_id)
  WHERE flagged_for_review = true;

COMMENT ON COLUMN public.session_items.block_index IS
  'One-based block number within a session. Used for USMLE 2026-style block UI and analytics.';

COMMENT ON COLUMN public.session_items.position_in_block IS
  'One-based position within the session block. Derived from session_items.position for generated blocks.';

COMMENT ON COLUMN public.session_items.flagged_for_review IS
  'Persistent pre-answer question flag state for review/navigation. Does not require an attempt row.';

COMMENT ON COLUMN public.session_items.first_seen_at IS
  'First time the authenticated user opened this session item in the player. Nullable for legacy rows.';

COMMENT ON COLUMN public.session_items.last_seen_at IS
  'Most recent time the authenticated user opened this session item in the player. Nullable for legacy rows.';
