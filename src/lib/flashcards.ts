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

const FALLBACK_DECKS: FlashcardDeckSummary[] = [
  {
    id: "usmle-starter-rapid-recall",
    slug: "usmle-starter-rapid-recall",
    title: "USMLE Rapid Recall Starter",
    description: "High-yield core concepts across Step 1, Step 2, and Step 3.",
    exam: "step1",
    active_cards: 6,
    due_cards: 6,
  },
  {
    id: "cardiology-high-yield",
    slug: "cardiology-high-yield",
    title: "Cardiology & Vascular Medicine",
    description: "Murmurs, antiarrhythmics, heart failure, and EKG pearls.",
    exam: "step1",
    active_cards: 5,
    due_cards: 5,
  },
  {
    id: "pharmacology-antidotes",
    slug: "pharmacology-antidotes",
    title: "Pharmacology Antidotes & Tox",
    description: "Essential antidotes, toxicities, and mechanism of actions.",
    exam: "step1",
    active_cards: 5,
    due_cards: 5,
  },
  {
    id: "nutrition-science-2026",
    slug: "nutrition-science-2026",
    title: "USMLE 2026 Nutrition Science",
    description: "Vitamin deficiencies, metabolic pathways, and dietetics.",
    exam: "step1",
    active_cards: 5,
    due_cards: 5,
  },
  {
    id: "endocrine-metabolism",
    slug: "endocrine-metabolism",
    title: "Endocrine & Metabolic Disorders",
    description: "Adrenal, thyroid, pituitary, and diabetes high-yield cards.",
    exam: "step2ck",
    active_cards: 4,
    due_cards: 4,
  },
];

const FALLBACK_CARDS_BY_DECK: Record<string, FlashcardDueCard[]> = {
  "usmle-starter-rapid-recall": [
    { id: "acetaminophen", deck_id: "starter", deck_title: "USMLE Rapid Recall Starter", position: 1, tag: "Pharmacology", front: "The antidote for acetaminophen overdose is [...].", answer: "N-acetylcysteine", explanation: "Replenishes glutathione and helps prevent hepatic injury.", pearl: "Treat early when overdose is suspected.", review_count: 0, due_at: new Date().toISOString() },
    { id: "aortic-stenosis", deck_id: "starter", deck_title: "USMLE Rapid Recall Starter", position: 2, tag: "Cardiology", front: "Aortic stenosis classically radiates to the [...].", answer: "carotids", explanation: "The systolic crescendo-decrescendo murmur radiates to the carotid arteries.", pearl: "Syncope, angina, and dyspnea are late warning symptoms.", review_count: 0, due_at: new Date().toISOString() },
    { id: "pheochromocytoma", deck_id: "starter", deck_title: "USMLE Rapid Recall Starter", position: 3, tag: "Endocrine", front: "Episodic headache, sweating, palpitations, and hypertension suggest [...].", answer: "pheochromocytoma", explanation: "Catecholamine secretion can cause paroxysmal adrenergic symptoms.", pearl: "Alpha blockade comes before beta blockade.", review_count: 0, due_at: new Date().toISOString() },
    { id: "glycogen", deck_id: "starter", deck_title: "USMLE Rapid Recall Starter", position: 4, tag: "Biochemistry", front: "Glycogen phosphorylase is positively regulated by [...].", answer: "AMP", explanation: "AMP signals low energy and stimulates glycogen breakdown.", pearl: "ATP and glucose-6-phosphate oppose breakdown.", review_count: 0, due_at: new Date().toISOString() },
    { id: "vitamin-b3", deck_id: "starter", deck_title: "USMLE Rapid Recall Starter", position: 5, tag: "Nutrition Science", front: "Pellagra (Dermatitis, Diarrhea, Dementia) is caused by deficiency of [...].", answer: "Vitamin B3 (Niacin)", explanation: "Niacin is required for NAD+/NADP+ synthesis.", pearl: "Tryptophan is a precursor to niacin synthesis.", review_count: 0, due_at: new Date().toISOString() },
  ],
  "cardiology-high-yield": [
    { id: "cardio-1", deck_id: "cardio", deck_title: "Cardiology", position: 1, tag: "Cardiology", front: "Holosystolic murmur at the apex radiating to the axilla indicates [...].", answer: "Mitral Regurgitation", explanation: "Mitral regurgitation is a holosystolic murmur best heard at the apex.", pearl: "Often caused by ischemic heart disease or rheumatic fever.", review_count: 0, due_at: new Date().toISOString() },
    { id: "cardio-2", deck_id: "cardio", deck_title: "Cardiology", position: 2, tag: "Cardiology", front: "First-line drug for acute STEMI symptom relief and preload reduction is [...].", answer: "Nitroglycerin", explanation: "Venodilator that reduces cardiac preload and oxygen demand.", pearl: "Contraindicated if right ventricular infarction or PDE-5 inhibitor use.", review_count: 0, due_at: new Date().toISOString() },
    { id: "cardio-3", deck_id: "cardio", deck_title: "Cardiology", position: 3, tag: "Cardiology", front: "Beck's Triad for Cardiac Tamponade consists of hypotension, distended neck veins, and [...].", answer: "Distant/muffled heart sounds", explanation: "Pericardial fluid impairs ventricular filling during diastole.", pearl: "Pulsus paradoxus > 10 mmHg drop in SBP on inspiration is classic.", review_count: 0, due_at: new Date().toISOString() },
  ],
  "nutrition-science-2026": [
    { id: "nutri-1", deck_id: "nutri", deck_title: "Nutrition Science", position: 1, tag: "Nutrition Science", front: "Wernicke-Korsakoff syndrome is caused by deficiency of [...].", answer: "Vitamin B1 (Thiamine)", explanation: "Thiamine is a cofactor for pyruvate dehydrogenase and alpha-ketoglutarate dehydrogenase.", pearl: "Give thiamine BEFORE glucose to prevent precipitating encephalopathy.", review_count: 0, due_at: new Date().toISOString() },
    { id: "nutri-2", deck_id: "nutri", deck_title: "Nutrition Science", position: 2, tag: "Nutrition Science", front: "Vitamin C (Ascorbic acid) deficiency leads to defective hydroxylation of [...].", answer: "Proline and Lysine in Collagen", explanation: "Causes scurvy with swollen gums, poor wound healing, and perifollicular hemorrhages.", pearl: "Vitamin C also enhances non-heme iron absorption.", review_count: 0, due_at: new Date().toISOString() },
    { id: "nutri-3", deck_id: "nutri", deck_title: "Nutrition Science", position: 3, tag: "Nutrition Science", front: "Acrodermatitis enteropathica and impaired wound healing suggest deficiency of [...].", answer: "Zinc", explanation: "Zinc is essential for transcription factors (zinc finger proteins).", pearl: "Common in patients receiving TPN without mineral supplementation.", review_count: 0, due_at: new Date().toISOString() },
  ],
};

export async function listFlashcardDecks(userId: string): Promise<FlashcardDeckSummary[]> {
  try {
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
    if (result.rows.length > 0) {
      return result.rows.map(row => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        exam: row.exam,
        active_cards: toNumber(row.active_cards),
        due_cards: toNumber(row.due_cards),
      }));
    }
    return FALLBACK_DECKS;
  } catch {
    return FALLBACK_DECKS;
  }
}

export async function listDueFlashcards(userId: string, deckSlug: string, limit: number): Promise<FlashcardDueCard[]> {
  const clampedLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  try {
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

    if (result.rows.length > 0) {
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
  } catch {
    // Fallback to static cards when DB is unpopulated or offline
  }

  const fallbackList = FALLBACK_CARDS_BY_DECK[deckSlug] || FALLBACK_CARDS_BY_DECK["usmle-starter-rapid-recall"];
  return fallbackList.slice(0, clampedLimit);
}

export async function recordFlashcardReview(userId: string, cardId: string, rating: FlashcardRating) {
  const now = new Date();
  try {
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
  } catch {
    return {
      card_id: cardId,
      rating,
      review_count: 1,
      next_due_at: new Date(now.getTime() + minutesForRating(rating, 1) * 60_000).toISOString(),
    };
  }
}




