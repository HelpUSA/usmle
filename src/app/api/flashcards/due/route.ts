/**
 * File: src/app/api/flashcards/due/route.ts
 *
 * Responsibility:
 * - Return due flashcards for a deck and the authenticated API user.
 */

import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getUserIdForApi } from "@/lib/auth";
import { listDueFlashcards } from "@/lib/flashcards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  deck: z.string().trim().min(1).max(80).default("usmle-starter-rapid-recall"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: Request) {
  try {
    const userId = await getUserIdForApi(req);
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      deck: url.searchParams.get("deck") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const cards = await listDueFlashcards(userId, parsed.deck, parsed.limit);


    return NextResponse.json({ cards });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to load due flashcards";
    const status = message === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
