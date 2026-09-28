/**
 * File: src/lib/flashcards.ts
 *
 * Responsibility:
 * - Centralize minimal flashcard query and scheduling helpers.
 * - Keep the spaced-repetition logic explicit and auditable.
 */

import { query } from "@/lib/db";

export const FLASHCARD_RATINGS = ["again", "hard", "good", "easy"] as const;

export type FlashcardRating = (typeof FLASHCARD_RATINGS)[number];

export type FlashcardDeckSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  exam: string;
  active_cards: number;
  due_cards: number;
};

export type FlashcardDueCard = {
  id: string;
  deck_id: string;
  deck_title: string;
  position: number;
  tag: string;
  front: string;
  answer: string;
  explanation: string;
  pearl: string;
  review_count: number;
  due_at: string;
};

type DeckRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  exam: string;
  active_cards: number | string | null;
  due_cards: number | string | null;
};

type CardRow = {
  id: string;
  deck_id: string;
  deck_title: string;
  position: number;
  tag: string;
  front: string;
  answer: string;
  explanation: string;
  pearl: string;
  review_count: number | string | null;
  due_at: string | Date | null;
};

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numeric));
}

function toIso(value: string | Date | null): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function minutesForRating(rating: FlashcardRating, reviewCount: number): number {
  switch (rating) {
    case "again":
      return 20;
    case "hard":
      return 1440;
    case "good":
      return 1440 * Math.max(3, reviewCount + 1);
    case "easy":
      return 1440 * Math.max(7, reviewCount * 2 + 7);
    default:
      return 1440;
  }
}

export function isFlashcardRating(value: unknown): value is FlashcardRating {
  return typeof value === "string" && (FLASHCARD_RATINGS as readonly string[]).includes(value);
}

export async function listFlashcardDecks(userId: string): Promise<FlashcardDeckSummary[]> {
  const result = await query<DeckRow>(
    `
    SELECT d.id, d.slug, d.title, d.description, d.exam,
      COUNT(c.id) FILTER (WHERE c.is_active)::int as active_cards,
      COUNT(c.id) FILTER (WHERE c.is_active AND COALESCE(s.due_at, now()) <= now())::int as due_cards
    FROM flashcard_decks d
    LEFT JOIN flashcard_cards c ON c.deck_id = d.id
    LEFT JOIN user_flashcard_states s ON s.user_id = $1 AND s.card_id = c.id
    WHERE d.is_active
    GROUP BY d.id, d.slug, d.title, d.description, d.exam
    ORDER BY d.title ASC
    `,
    [userId]
  );

  return result.rows.map(row => ( {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    exam: row.exam,
    active_cards: toNumber(row.active_cards),
    due_cards: toNumber(row.due_cards),
  }));
}

export async function listDueFlashcards(userId: string, deckSlug: string, limit: number): Promise<FlashcardDueCard[]> {
  const clampedLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const result = await query<CardRow>(
    `
    SELECT c.id, c.deck_id, d.title as deck_title, c.position, c.tag, c.front, c.answer, c.explanation, c.pearl,
      COALESCE(s.due_at, now()) as due_at,
      COALESCE(s.review_count, 0) as review_count
    FROM flashcard_cards c
    JOIN flashcard_decks d ON d.id = c.deck_id
    LEFT JOIN user_flashcard_states s ON s.user_id = $1 AND s.card_id = c.id
    WHERE d.slug = $2
      AND d.is_active
      AND c.is_active
      AND COALESCE(s.due_at, now()) <= now()
    ORDER BY COALESCE(s.due_at, now()) ASC, c.position ASC
    LIMIT $3
    `,
    [userId, deckSlug, clampedLimit]
  );

  return result.rows.map(row => ({
    id: row.id,
    deck_id: row.deck_id,
    deck_title: row.deck_title,
    position: toNumber(row.position),
    tag: row.tag,
    front: row.front,
    answer: row.answer,
    explanation: row.explanation,
    pearl: row.pearl,
    review_count: toNumber(row.review_count),
    due_at: toIso(row.due_at),
  }));
}

export async function recordFlashcardReview(userId: string, cardId: string, rating: FlashcardRating) {
  const now = new Date();
  const current = await query<{
    review_count: number | string | null;
    due_at: string | Date | null;
  }>(
    "SELECT review_count, due_at FROM user_flashcard_states WHERE user_id = $1 AND card_id = $2",
    [userId, cardId]
  );
  const reviewCount = toNumber(current.rows[0]?.review_count);
  const previousDueAt = current.rows[0]?.due_at ? toIso(current.rows[0].due_at) : null;
  const nextDueAt = new Date(now.getTime() + minutesForRating(rating, reviewCount) * 60_000);

  const update = await query<{
    review_count: number;
    due_at: string | Date;
  }>(
    `
    INSERT INTO user_flashcard_states (user_id, card_id, review_count, again_count, hard_count, good_count, easy_count, last_rating, last_reviewed_at, due_at, updated_at)
    VALUES ($1, $2, 1, CASE WHEN $3 = 'again' THEN 1 ELSE 0 END, CASE WHEN $3 = 'hard' THEN 1 ELSE 0 END, CASE WHEN $3 = 'good' THEN 1 ELSE 0 END, CASE WHEN $3 = 'easy' THEN 1 ELSE 0 END, $3, $4, $5, $4)
    ON CONFLICT (user_id, card_id) DO UPDATE
    SET review_count = user_flashcard_states.review_count + 1,
        again_count = user_flashcard_states.again_count + CASE WHEN $3 = 'again' THEN 1 ELSE 0 END,
        hard_count = user_flashcard_states.hard_count + CASE WHEN $3 = 'hard' THEN 1 ELSE 0 END,
        good_count = user_flashcard_states.good_count + CASE WHEN $3 = 'good' THEN 1 ELSE 0 END
       , easy_count = user_flashcard_states.easy_count + CASE WHEN $3 = 'easy' THEN 1 ELSE 0 END
       , last_rating = $3
       , last_reviewed_at = $4
       , due_at = $5
       , updated_at = $4
    RETURNING review_count, due_at
    `,
    [userId, cardId, rating, now, nextDueAt]
  );

  await query(
    "INSERT INTO flashcard_reviews (user_id, card_id, rating, previous_due_at, next_due_at, reviewed_at, metadata_json) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)",
    [userId, cardId, rating, previousDueAt, nextDueAt, now, JSON.stringify({ reviewCountBefore: reviewCount })]
  );

  const row = update.rows[0];

  return {
    card_id: cardId,
    rating,
    review_count: toNumber(row.review_count),
    next_due_at: toIso(row.due_at),
  };
}



