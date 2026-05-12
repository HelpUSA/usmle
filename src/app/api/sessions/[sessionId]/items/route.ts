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
 *   Body: { count?: number, include_seed?: boolean }
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
 *   - balances by difficulty: 30% easy, 50% medium, 20% hard;
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

const ParamsSchema = z.object({
  sessionId: z.string().regex(UUID_RE, "Invalid sessionId"),
});

const BodySchema = z
  .object({
    count: z.coerce.number().int().min(1).max(200).default(10),
    include_seed: z.boolean().optional().default(false),
  })
  .strict();

type RouteParams = {
  params: {
    sessionId: string;
  };
};

type Difficulty = "easy" | "medium" | "hard";

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

type QuestionVersionRow = {
  question_version_id: string;
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

      const target = splitByDifficulty(body.count);

      async function pickByDifficulty(
        difficulty: Difficulty,
        limit: number
      ): Promise<string[]> {
        if (limit <= 0) {
          return [];
        }

        const res = await client.query<QuestionVersionRow>(
          `
          SELECT qv.question_version_id
          FROM question_versions qv
          JOIN questions q ON q.question_id = qv.question_id
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
          ]
        );

        return res.rows.map((row) => row.question_version_id);
      }

      const picked: string[] = [
        ...(await pickByDifficulty("easy", target.easy)),
        ...(await pickByDifficulty("medium", target.medium)),
        ...(await pickByDifficulty("hard", target.hard)),
      ];

      if (picked.length < body.count) {
        const remaining = body.count - picked.length;

        const fillRes = await client.query<QuestionVersionRow>(
          `
          SELECT qv.question_version_id
          FROM question_versions qv
          JOIN questions q ON q.question_id = qv.question_id
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
            picked,
            allowSeed,
          ]
        );

        picked.push(...fillRes.rows.map((row) => row.question_version_id));
      }

      if (picked.length === 0) {
        return {
          status: 400,
          payload: {
            error: "No active question_versions available for this exam/language",
            debug: {
              exam: session.exam,
              language: session.language,
              allowSeed,
              includeSeedRequested,
              note:
                "If allowSeed=false and your only content is seed_dev, selection will be empty. Check questions.source distribution.",
            },
          },
        };
      }

      const insertValues: Array<string | number> = [];
      const placeholders: string[] = [];

      picked.forEach((questionVersionId, index) => {
        const position = index + 1;
        const base = index * 3;

        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        insertValues.push(sessionId, position, questionVersionId);
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