-- File: db/migrations/20260519_001_flashcards_min.sql
--
-- Responsibility:
-- - Add minimal persisted flashcard decks, cards, user state, and review history.
-- - Seed a small USMLE starter deck for the first API-backed MV.
--
-- Safety:
-- - Additive only.
-- - Does not alter existing session, question, or engagement tables.
-- - Can be rolled back by dropping the four new flashcard tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  exam text NOT NULL DEFAULT 'step1',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcard_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  tag text NOT NULL DEFAULT 'General',
  front text NOT NULL,
  answer text NOT NULL,
  explanation text NOT NULL DEFAULT '',
  pearl text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'mixed',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_cards_deck_position_unique UNIQUE(deck_id, position)
);

CREATE TABLE IF NOT EXISTS user_flashcard_states (
  user_id uuid NOT NULL REFERENCES users_profile(user_id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES flashcard_cards(id) ON DELETE CASCADE,
  review_count integer NOT NULL DEFAULT 0,
  again_count integer NOT NULL DEFAULT 0,
  hard_count integer NOT NULL DEFAULT 0,
  good_count integer NOT NULL DEFAULT 0,
  easy_count integer NOT NULL DEFAULT 0,
  last_rating text NULL,
  last_reviewed_at timestamptz NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id),
  CONSTRAINT user_flashcard_states_counts_check CHECK (
    review_count >= 0 AND again_count >= 0 AND hard_count >= 0 AND good_count >= 0 AND easy_count >= 0
  ),
  CONSTRAINT user_flashcard_states_rating_check CHECK (
    last_rating IS NULL OR last_rating IN ('again', 'hard', 'good', 'easy')
  )
);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(user_id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES flashcard_cards(id) ON DELETE CASCADE,
  rating text NOT NULL,
  previous_due_at timestamptz NULL,
  next_due_at timestamptz NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT flashcard_reviews_rating_check CHECK (rating IN ('again', 'hard', 'good', 'easy'))
);

CREATE INDEX IF NOT EXISTS flashcard_cards_deck_active_idx ON flashcard_cards(deck_id, is_active, position);
CREATE INDEX IF NOT EXISTS user_flashcard_states_user_due_idx ON user_flashcard_states(user_id, due_at);
CREATE INDEX IF NOT EXISTS flashcard_reviews_user_reviewed_idx ON flashcard_reviews(user_id, reviewed_at DESC);

INSERT INTO flashcard_decks (slug, title, description, exam)
VALUES ('usmle-starter-rapid-recall', 'USMLE Starter Rapid Recall', 'High-yield active-recall cards for the first flashcards MVP.', 'step1')
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    updated_at = now();

WITH deck AS (
  SELECT id FROM flashcard_decks WHERE slug = 'usmle-starter-rapid-recall'
)
INSERT INTO flashcard_cards (deck_id, position, tag, front, answer, explanation, pearl, difficulty)
SELECT deck.id, 1, 'Pharmacology', 'The antidote for acetaminophen overdose is [...].', 'N-acetylcysteine', 'Replenishes glutathione and helps prevent hepatic injury.', 'Treat early when overdose is suspected.', 'mixed' FROM deck
UNION ALL SELECT deck.id, 2, 'Cardiology', 'Aortic stenosis classically radiates to the [...].', 'carotids', 'The systolic crescendo-decrescendo murmur commonly radiates to the carotid arteries.', 'Syncope, angina, and dyspnea are late warning symptoms.', 'mixed' FROM deck
UNION ALL SELECT deck.id, 3, 'Endocrine', 'Episodic headache, sweating, palpitations, and hypertension suggest [...].', 'pheochromocytoma', 'Catecholamine secretion can cause paroxysmal adrenergic symptoms.', 'Alpha blockade comes before beta blockade.', 'mixed' FROM deck
UNION ALL SELECT deck.id, 4, 'Biochemistry', 'Glycogen phosphorylase is positively regulated by [...].', 'AMP', 'AMP signals low energy and stimulates glycogen breakdown.', 'ATP and glucose-6-phosphate oppose breakdown.', 'mixed' FROM deck
ON CONFLICT (deck_id, position) DO UPDATE
SET tag = EXCLUDED.tag,
    front = EXCLUDED.front,
    answer = EXCLUDED.answer,
    explanation = EXCLUDED.explanation,
    pearl = EXCLUDED.pearl,
    updated_at = now();

