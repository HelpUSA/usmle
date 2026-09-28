/**
 * File: src/app/api/flashcards/review/route.ts
 *
 * Responsibility:
 * - Record a flashcard recating rating and return the next due date.
 */

import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getUserIdForApi } from "@/lib/auth";
import { isFlashcardRating, recordFlashcardReview } from "@/lib/flashcards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.unknown().refine(isFlashcardRating, "Invalid flashcard rating"),
}).strict();

export async function POST(req: Request) {
  try {
    const userId = await getUserIdForApi(req);
    const body = ReviewSchema.parse(await req.json());
    const review = await recordFlashcardReview(userId, body.cardId, body.rating);

    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid review" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to record flashcard review";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


