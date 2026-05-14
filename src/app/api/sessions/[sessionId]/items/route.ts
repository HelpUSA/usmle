/*
 * File: src/app/api/sessions/[sessionId]/items/route.ts
 *
 * Responsibility:
 * - GET: list generated items for one authenticated user's study session.
 * - POST: generate session items idempotently for one authenticated user's session.
 *
 * API contract:
 * - GET  /api/sessions/:sessionId/items
 * - POST /api/sessions/:sessionId/items
 *   Body:
 *   {
 *     count?: number,
 *     include_seed?: boolean,
 *     includedAreaSlugs?: string[],
 *     excludedAreaSlugs?: string[],
 *     difficultyDefault?: "easy" | "medium" | "hard" | "all",
 *     difficultyOrderMode?: "random" | "ascending" | "descending",
 *     areaOrderMode?: "random" | "by_area"
 *   }
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - The route must never return or generate items for a session owned by
 *   another user.
 *
 * Product behavior:
 * - Only in_progress sessions can generate new items.
 * - POST is idempotent:
 *   - if items already exist, it returns the existing items;
 *   - it does not recreate or reshuffle the session.
 * - Question selection:
 *   - supports inclusion/exclusion by medical area;
 *   - supports a preferred difficulty, defaulting to easy;
 *   - supports the legacy balanced mode when difficultyDefault="all";
 *   - supports final ordering by area and/or difficulty;
 *   - prioritizes unseen and less-seen questions;
 *   - excludes seed_dev by default, except when include_seed=true or when
 *     no non-seed published content exists.
 *
 * Database notes:
 * - Uses rows.length instead of rowCount because pg rowCount can be number | null.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const ParamsSchema = z.object({
  sessionId: z.string().regex(UUID_RE, "Invalid sessionId"),
});

const AreaSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(SLUG_RE, "Invalid area slug");

const BodySchema = z
  .object({
    count: z.coerce.number().int().min(1).max(200).default(10),
    include_seed: z.boolean().optional().default(false),
    includedAreaSlugs: z.array(AreaSlugSchema).max(100).optional().default([]),
    excludedAreaSlugs: z.array(AreaSlugSchema).max(100).optional().default([]),
    difficultyDefault: z
      .enum(["easy", "medium", "hard", "all"])
      .optional()
      .default("easy"),
    difficultyOrderMode: z
      .enum(["random", "ascending", "descending"])
      .optional()
      .default("random"),
    areaOrderMode: z.enum(["random", "by_area"]).optional().default("random"),
  })
  .strict();

type RouteParams = {
  params: {
    sessionId: string;
  };
};

type Difficulty = "easy" | "medium" | "hard";
type DifficultyDefault = Difficulty | "all";
type DifficultyOrderMode = "random" | "ascending" | "descending";
type AreaOrderMode = "random" | "by_area";

type SessionRow = {
  session_id: string;
  user_id: string;
  exam: string;
  language: string;
  status: string;
};

type SessionItemRow = {
  session_item_id: string;
  session_id: string;
  position: number;
  question_version_id: string;
  presented_at: string;
};

type QuestionCandidateRow = {
  question_version_id: string;
  difficulty: Difficulty;
  primary_area_slug: string | null;
  primary_area_name: string | null;
  primary_area_display_order: number | null;
};

type RouteResult =
  | {
      status: 200 | 201;
      payload: {
        items: SessionItemRow[];
      };
    }
  | {
      status: 400 | 403 | 404 | 409;
      payload: {
        error: string;
        debug?: Record<string, unknown>;
      };
    };

function splitByDifficulty(count: number): Record<Difficulty, number> {
  const easy = Math.max(0, Math.round(count * 0.3));
  const hard = Math.max(0, Math.round(count * 0.2));
  const medium = Math.max(0, count - easy - hard);

  return { easy, medium, hard };
}

function uniqueSlugs(slugs: string[]): string[] {
  return Array.from(
    new Set(
      slugs
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0)
    )
  );
}

function difficultyRank(difficulty: Difficulty): number {
  if (difficulty === "easy") return 1;
  if (difficulty === "medium") return 2;
  return 3;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function sortPickedCandidates(
  candidates: QuestionCandidateRow[],
  difficultyOrderMode: DifficultyOrderMode,
  areaOrderMode: AreaOrderMode
): QuestionCandidateRow[] {
  const randomized = shuffle(candidates);

  if (difficultyOrderMode === "random" && areaOrderMode === "random") {
    return randomized;
  }

  return randomized.sort((left, right) => {
    if (areaOrderMode === "by_area") {
      const leftArea = left.primary_area_display_order ?? 9999;
      const rightArea = right.primary_area_display_order ?? 9999;

      if (leftArea !== rightArea) {
        return leftArea - rightArea;
      }

      const leftName = left.primary_area_name ?? "";
      const rightName = right.primary_area_name ?? "";

      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }
    }

    if (difficultyOrderMode !== "random") {
      const leftDifficulty = difficultyRank(left.difficulty);
      const rightDifficulty = difficultyRank(right.difficulty);

      if (leftDifficulty !== rightDifficulty) {
        return difficultyOrderMode === "ascending"
          ? leftDifficulty - rightDifficulty
          : rightDifficulty - leftDifficulty;
      }
    }

    return 0;
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      .join("; ");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("unauthorized") ||
    message.includes("not authenticated") ||
    message.includes("authentication required") ||
    message.includes("sign in")
  );
}

function getErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (isAuthError(error)) {
    return 401;
  }

  return 500;
}

function jsonResponse(result: RouteResult) {
  return NextResponse.json(result.payload, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function readSessionItems(
  client: Parameters<Parameters<typeof withTx>[0]>[0],
  sessionId: string
): Promise<SessionItemRow[]> {
  const items = await client.query<SessionItemRow>(
    `
    SELECT
      session_item_id,
      session_id,
      position,
      question_version_id,
      presented_at
    FROM session_items
    WHERE session_id = $1
    ORDER BY position ASC
    `,
    [sessionId]
  );

  return items.rows;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const userId = await getUserIdForApi(req);
    const { sessionId } = ParamsSchema.parse(params);

    const result = await withTx<RouteResult>(async (client) => {
      const sessionRes = await client.query<Pick<SessionRow, "session_id" | "user_id">>(
        `
        SELECT
          session_id,
          user_id
        FROM sessions
        WHERE session_id = $1
        `,
        [sessionId]
      );

      if (sessionRes.rows.length === 0) {
        return {
          status: 404,
          payload: { error: "Session not found" },
        };
      }

      const session = sessionRes.rows[0];

      if (session.user_id !== userId) {
        return {
          status: 403,
          payload: { error: "Forbidden" },
        };
      }

      const items = await readSessionItems(client, sessionId);

      return {
        status: 200,
        payload: { items },
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to load session items"),
      },
      {
        status: getErrorStatus(error),
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await getUserIdForApi(req);
    const { sessionId } = ParamsSchema.parse(params);

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const includedAreaSlugs = uniqueSlugs(body.includedAreaSlugs);
    const excludedAreaSlugs = uniqueSlugs(body.excludedAreaSlugs);
    const difficultyDefault: DifficultyDefault = body.difficultyDefault;
    const difficultyOrderMode: DifficultyOrderMode = body.difficultyOrderMode;
    const areaOrderMode: AreaOrderMode = body.areaOrderMode;

    const result = await withTx<RouteResult>(async (client) => {
      const sessionRes = await client.query<SessionRow>(
        `
        SELECT
          session_id,
          user_id,
          exam,
          language,
          status
        FROM sessions
        WHERE session_id = $1
        FOR UPDATE
        `,
        [sessionId]
      );

      if (sessionRes.rows.length === 0) {
        return {
          status: 404,
          payload: { error: "Session not found" },
        };
      }

      const session = sessionRes.rows[0];

      if (session.user_id !== userId) {
        return {
          status: 403,
          payload: { error: "Forbidden" },
        };
      }

      if (session.status !== "in_progress") {
        return {
          status: 409,
          payload: { error: "Session is not in_progress" },
        };
      }

      const existingItems = await readSessionItems(client, sessionId);

      if (existingItems.length > 0) {
        return {
          status: 200,
          payload: { items: existingItems },
        };
      }

      const includeSeedRequested = body.include_seed;

      const nonSeedPublished = await client.query<{ exists: number }>(
        `
        SELECT 1 AS exists
        FROM questions q
        WHERE q.status = 'published'
          AND q.source <> 'seed_dev'
        LIMIT 1
        `
      );

      const allowSeed =
        includeSeedRequested || nonSeedPublished.rows.length === 0;

      async function pickByDifficulty(
        difficulty: Difficulty,
        limit: number
      ): Promise<QuestionCandidateRow[]> {
        if (limit <= 0) {
          return [];
        }

        const res = await client.query<QuestionCandidateRow>(
          `
          SELECT
            qv.question_version_id,
            qv.difficulty,
            pma.slug AS primary_area_slug,
            pma.name AS primary_area_name,
            pma.display_order AS primary_area_display_order
          FROM question_versions qv
          JOIN questions q
            ON q.question_id = qv.question_id
          LEFT JOIN question_version_areas pqva
            ON pqva.question_version_id = qv.question_version_id
           AND pqva.is_primary = true
          LEFT JOIN medical_areas pma
            ON pma.area_id = pqva.area_id
          LEFT JOIN user_question_state uqs
            ON uqs.user_id = $5
           AND uqs.question_id = q.question_id
          WHERE qv.exam = $1
            AND qv.language = $2
            AND qv.is_active = true
            AND qv.difficulty = $6
            AND q.status = 'published'
            AND (
              $7::boolean = true
              OR q.source <> 'seed_dev'
            )
            AND (
              cardinality($8::text[]) = 0
              OR EXISTS (
                SELECT 1
                FROM question_version_areas qva_include
                JOIN medical_areas ma_include
                  ON ma_include.area_id = qva_include.area_id
                WHERE qva_include.question_version_id = qv.question_version_id
                  AND ma_include.is_active = true
                  AND ma_include.slug = ANY($8::text[])
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM question_version_areas qva_exclude
              JOIN medical_areas ma_exclude
                ON ma_exclude.area_id = qva_exclude.area_id
              WHERE qva_exclude.question_version_id = qv.question_version_id
                AND ma_exclude.is_active = true
                AND ma_exclude.slug = ANY($9::text[])
            )
            AND NOT EXISTS (
              SELECT 1
              FROM session_items si
              WHERE si.session_id = $3
                AND si.question_version_id = qv.question_version_id
            )
          ORDER BY
            (uqs.question_id IS NULL) DESC,
            COALESCE(uqs.times_seen, 0) ASC,
            random()
          LIMIT $4
          `,
          [
            session.exam,
            session.language,
            sessionId,
            limit,
            userId,
            difficulty,
            allowSeed,
            includedAreaSlugs,
            excludedAreaSlugs,
          ]
        );

        return res.rows;
      }

      let picked: QuestionCandidateRow[] = [];

      if (difficultyDefault === "all") {
        const target = splitByDifficulty(body.count);

        picked = [
          ...(await pickByDifficulty("easy", target.easy)),
          ...(await pickByDifficulty("medium", target.medium)),
          ...(await pickByDifficulty("hard", target.hard)),
        ];
      } else {
        picked = await pickByDifficulty(difficultyDefault, body.count);
      }

      if (picked.length < body.count) {
        const remaining = body.count - picked.length;
        const pickedIds = picked.map((row) => row.question_version_id);

        const fillRes = await client.query<QuestionCandidateRow>(
          `
          SELECT
            qv.question_version_id,
            qv.difficulty,
            pma.slug AS primary_area_slug,
            pma.name AS primary_area_name,
            pma.display_order AS primary_area_display_order
          FROM question_versions qv
          JOIN questions q
            ON q.question_id = qv.question_id
          LEFT JOIN question_version_areas pqva
            ON pqva.question_version_id = qv.question_version_id
           AND pqva.is_primary = true
          LEFT JOIN medical_areas pma
            ON pma.area_id = pqva.area_id
          LEFT JOIN user_question_state uqs
            ON uqs.user_id = $5
           AND uqs.question_id = q.question_id
          WHERE qv.exam = $1
            AND qv.language = $2
            AND qv.is_active = true
            AND q.status = 'published'
            AND (
              $7::boolean = true
              OR q.source <> 'seed_dev'
            )
            AND (
              cardinality($8::text[]) = 0
              OR EXISTS (
                SELECT 1
                FROM question_version_areas qva_include
                JOIN medical_areas ma_include
                  ON ma_include.area_id = qva_include.area_id
                WHERE qva_include.question_version_id = qv.question_version_id
                  AND ma_include.is_active = true
                  AND ma_include.slug = ANY($8::text[])
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM question_version_areas qva_exclude
              JOIN medical_areas ma_exclude
                ON ma_exclude.area_id = qva_exclude.area_id
              WHERE qva_exclude.question_version_id = qv.question_version_id
                AND ma_exclude.is_active = true
                AND ma_exclude.slug = ANY($9::text[])
            )
            AND NOT EXISTS (
              SELECT 1
              FROM session_items si
              WHERE si.session_id = $3
                AND si.question_version_id = qv.question_version_id
            )
            AND qv.question_version_id <> ALL($6::uuid[])
          ORDER BY
            (uqs.question_id IS NULL) DESC,
            COALESCE(uqs.times_seen, 0) ASC,
            random()
          LIMIT $4
          `,
          [
            session.exam,
            session.language,
            sessionId,
            remaining,
            userId,
            pickedIds,
            allowSeed,
            includedAreaSlugs,
            excludedAreaSlugs,
          ]
        );

        picked.push(...fillRes.rows);
      }

      if (picked.length === 0) {
        return {
          status: 400,
          payload: {
            error:
              "No active question_versions available for this exam/language and selected filters",
            debug: {
              exam: session.exam,
              language: session.language,
              allowSeed,
              includeSeedRequested,
              includedAreaSlugs,
              excludedAreaSlugs,
              difficultyDefault,
              difficultyOrderMode,
              areaOrderMode,
              note:
                "Check published questions, active question_versions, medical area mappings, and difficulty distribution.",
            },
          },
        };
      }

      const orderedPicked = sortPickedCandidates(
        picked,
        difficultyOrderMode,
        areaOrderMode
      );

      const insertValues: Array<string | number> = [];
      const placeholders: string[] = [];

      orderedPicked.forEach((candidate, index) => {
        const position = index + 1;
        const base = index * 3;

        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        insertValues.push(sessionId, position, candidate.question_version_id);
      });

      const inserted = await client.query<SessionItemRow>(
        `
        WITH inserted AS (
          INSERT INTO session_items (
            session_id,
            position,
            question_version_id
          )
          VALUES ${placeholders.join(", ")}
          RETURNING
            session_item_id,
            session_id,
            position,
            question_version_id,
            presented_at
        )
        SELECT
          session_item_id,
          session_id,
          position,
          question_version_id,
          presented_at
        FROM inserted
        ORDER BY position ASC
        `,
        insertValues
      );

      return {
        status: 201,
        payload: { items: inserted.rows },
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to generate session items"),
      },
      {
        status: getErrorStatus(error),
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
