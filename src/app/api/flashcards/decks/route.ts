/**
 * File: src/app/api/flashcards/decks/route.ts
 *
 * Responsibility:
 * - List active flashcard decks for the authenticated API user.
 */

import { NextResponse } from "next/server";
import { getUserIdForApi } from "@/lib/auth";
import { listFlashcardDecks } from "@/lib/flashcards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await getUserIdForApi(req);
    const decks = await listFlashcardDecks(userId);

    return NextResponse.json({ decks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load flashcard decks";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


