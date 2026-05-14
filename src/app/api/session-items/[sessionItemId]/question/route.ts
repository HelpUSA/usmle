/*
 * File: src/app/api/session-items/[sessionItemId]/question/route.ts
 *
 * Responsibility:
 * - Load the question associated with a session_item.
 * - Validate that the session_item belongs to the authenticated user.
 * - Return only pre-submit-safe question data:
 *   - minimal session_item metadata;
 *   - question_version stem/prompt-safe metadata;
 *   - choices without is_correct and without explanations.
 *
 * API contract:
 * - GET /api/session-items/:sessionItemId/question
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - In production, this should resolve through the authenticated NextAuth session.
 * - In development/test, getUserIdForApi may allow a validated x-user-id.
 *
 * Security behavior:
 * - Does not return:
 *   - question_choices.is_correct;
 *   - question_choices.explanation;
 *   - question_versions.explanation_short;
 *   - question_versions.explanation_long;
 *   - bibliography.
 * - Refuses access if the session item belongs to another user.
 * - Refuses question loading after the session is no longer in_progress.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  sessionItemId: z.string().uuid("Invalid sessionItemId"),
});

type RouteParams = {
  params: {
    sessionItemId: string;
  };
};

type SessionItemJoinRow = {
  session_item_id: string;
  session_id: string;
  position: number;
  question_version_id: string;
  block_index: number;
  position_in_block: number | null;
  flagged_for_review: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  user_id: string;
  status: string;
};

type MedicalAreaPayload = {
  slug: string;
  name: string;
  is_primary: boolean;
};

type QuestionVersionPublicRow = {
  question_version_id: string;
  exam: string;
  language: string;
  difficulty: string | null;
  stem: string;
  prompt?: string | null;
  areas: MedicalAreaPayload[];
};

type QuestionVersionDbRow = Omit<QuestionVersionPublicRow, "areas">;

type ChoicePublicRow = {
  choice_id: string;
  label: string;
  choice_text: string;
};

type MedicalAreaRow = {
  slug: string;
  name: string;
  is_primary: boolean;
};

type QuestionPayload = {
  session_item: {
    session_item_id: string;
    session_id: string;
    position: number;
    question_version_id: string;
    block_index: number;
    position_in_block: number | null;
    flagged_for_review: boolean;
    first_seen_at: string | null;
    last_seen_at: string | null;
  };
  question: QuestionVersionPublicRow;
  choices: ChoicePublicRow[];
};

type RouteResult =
  | {
      status: 200;
      payload: QuestionPayload;
    }
  | {
      status: 403 | 404 | 409 | 500;
      payload: {
        error: string;
      };
    };

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

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const userId = await getUserIdForApi(req);
    const { sessionItemId } = ParamsSchema.parse(params);

    const result = await withTx<RouteResult>(async (client) => {
      const itemRes = await client.query<SessionItemJoinRow>(
        `
        SELECT
          si.session_item_id,
          si.session_id,
          si.position,
          si.question_version_id,
          si.block_index,
          si.position_in_block,
          si.flagged_for_review,
          si.first_seen_at,
          si.last_seen_at,
          s.user_id,
          s.status
        FROM session_items si
        JOIN sessions s ON s.session_id = si.session_id
        WHERE si.session_item_id = $1
        `,
        [sessionItemId]
      );

      if (itemRes.rows.length === 0) {
        return {
          status: 404,
          payload: { error: "Session item not found" },
        };
      }

      let item = itemRes.rows[0];

      if (item.user_id !== userId) {
        return {
          status: 403,
          payload: { error: "Forbidden" },
        };
      }

      if (item.status !== "in_progress") {
        return {
          status: 409,
          payload: { error: "Session is not in_progress" },
        };
      }

      const seenUpdateRes = await client.query<SessionItemJoinRow>(
        `
        UPDATE session_items si
        SET
          first_seen_at = COALESCE(si.first_seen_at, now()),
          last_seen_at = now()
        FROM sessions s
        WHERE si.session_item_id = $1
          AND s.session_id = si.session_id
        RETURNING
          si.session_item_id,
          si.session_id,
          si.position,
          si.question_version_id,
          si.block_index,
          si.position_in_block,
          si.flagged_for_review,
          si.first_seen_at,
          si.last_seen_at,
          s.user_id,
          s.status
        `,
        [sessionItemId]
      );

      if (seenUpdateRes.rows.length > 0) {
        item = seenUpdateRes.rows[0];
      }

      const questionRes = await client.query<QuestionVersionDbRow>(
        `
        SELECT
          question_version_id,
          exam,
          language,
          difficulty,
          stem,
          prompt
        FROM question_versions
        WHERE question_version_id = $1
        LIMIT 1
        `,
        [item.question_version_id]
      );

      if (questionRes.rows.length === 0) {
        return {
          status: 500,
          payload: { error: "Question version not found" },
        };
      }

      const choicesRes = await client.query<ChoicePublicRow>(
        `
        SELECT
          choice_id,
          label,
          choice_text
        FROM question_choices
        WHERE question_version_id = $1
        ORDER BY label ASC
        `,
        [item.question_version_id]
      );

      const areasRes = await client.query<MedicalAreaRow>(
        `
        SELECT
          ma.slug,
          ma.name,
          qva.is_primary
        FROM question_version_areas qva
        JOIN medical_areas ma
          ON ma.area_id = qva.area_id
        WHERE qva.question_version_id = $1
          AND ma.is_active = true
        ORDER BY qva.is_primary DESC, ma.display_order ASC, ma.name ASC
        `,
        [item.question_version_id]
      );

      return {
        status: 200,
        payload: {
          session_item: {
            session_item_id: item.session_item_id,
            session_id: item.session_id,
            position: item.position,
            question_version_id: item.question_version_id,
            block_index: item.block_index,
            position_in_block: item.position_in_block,
            flagged_for_review: item.flagged_for_review,
            first_seen_at: item.first_seen_at,
            last_seen_at: item.last_seen_at,
          },
          question: {
            ...questionRes.rows[0],
            areas: areasRes.rows.map((area) => ({
              slug: area.slug,
              name: area.name,
              is_primary: Boolean(area.is_primary),
            })),
          },
          choices: choicesRes.rows,
        },
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to load question"),
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