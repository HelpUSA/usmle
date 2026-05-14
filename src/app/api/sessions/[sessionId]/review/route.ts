/*
 * File: src/app/api/sessions/[sessionId]/review/route.ts
 *
 * Responsibility:
 * - Return the full review payload for one authenticated user's submitted session.
 * - Validate that the session belongs to the authenticated user.
 * - Release answer key, explanations, selected answer, choices, and bibliography
 *   only after the session has been submitted.
 *
 * API contract:
 * - GET /api/sessions/:sessionId/review
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - The route must never return review data for another user's session.
 *
 * Security behavior:
 * - This endpoint intentionally returns answer keys and explanations.
 * - Therefore, it only works when:
 *   - the session exists;
 *   - the session belongs to the authenticated user;
 *   - the session status is submitted.
 *
 * Data integrity behavior:
 * - Attempts are joined by:
 *   - session_item_id;
 *   - session_id;
 *   - authenticated user_id.
 * - This prevents accidental leakage if stale or inconsistent attempts exist.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

const ParamsSchema = z.object({
  sessionId: z.string().uuid("Invalid sessionId"),
});

type RouteParams = {
  params: {
    sessionId: string;
  };
};

type SessionRow = {
  session_id: string;
  user_id: string;
  status: string;
  exam: string;
  language: string;
  started_at: string;
  submitted_at: string | null;
};

type ReviewItemRow = {
  session_item_id: string;
  position: number;
  question_version_id: string;

  stem: string;
  explanation_short: string | null;
  explanation_long: string | null;
  bibliography: unknown;
  prompt: string | null;

  attempt_id: string | null;
  result: "correct" | "wrong" | "skipped" | null;
  is_correct: boolean | null;
  selected_choice_id: string | null;
  time_spent_seconds: number | null;
  confidence: number | null;
  flagged_for_review: boolean | null;
  answered_at: string | null;

  correct_choice_id: string | null;
  correct_label: string | null;
  correct_choice_text: string | null;

  selected_label: string | null;
  selected_choice_text: string | null;
};

type ReviewChoiceRow = {
  question_version_id: string;
  choice_id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
  explanation: string | null;
};

type ReviewAreaRow = {
  question_version_id: string;
  slug: string;
  name: string;
  is_primary: boolean;
};

type ReviewChoice = {
  choice_id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
  explanation: string | null;
};

type ReviewArea = {
  slug: string;
  name: string;
  is_primary: boolean;
};

type ReviewItem = {
  session_item_id: string;
  position: number;
  question_version_id: string;

  stem: string;
  explanation_short: string | null;
  explanation_long: string | null;
  bibliography: unknown;
  prompt: string | null;

  attempt_id: string | null;
  result: "correct" | "wrong" | "skipped" | null;
  is_correct: boolean | null;
  selected_choice_id: string | null;
  time_spent_seconds: number | null;
  confidence: number | null;
  flagged_for_review: boolean;
  answered_at: string | null;

  correct_choice_id: string | null;
  correct_label: string | null;
  correct_choice_text: string | null;

  selected_label: string | null;
  selected_choice_text: string | null;

  areas: ReviewArea[];
  choices: ReviewChoice[];
};

type ReviewPayload = {
  session: {
    session_id: string;
    user_id: string;
    status: string;
    exam: string;
    language: string;
    started_at: string;
    submitted_at: string | null;
  };
  items: ReviewItem[];
};

type RouteResult =
  | {
      status: 200;
      payload: ReviewPayload;
    }
  | {
      status: 403 | 404 | 409;
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

function buildSessionPayload(session: SessionRow): ReviewPayload["session"] {
  return {
    session_id: session.session_id,
    user_id: session.user_id,
    status: session.status,
    exam: session.exam,
    language: session.language,
    started_at: session.started_at,
    submitted_at: session.submitted_at,
  };
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const userId = await getUserIdForApi(req);
    const { sessionId } = ParamsSchema.parse(params);

    const result = await withTx<RouteResult>(async (client) => {
      const sessionRes = await client.query<SessionRow>(
        `
        SELECT
          session_id,
          user_id,
          status,
          exam,
          language,
          started_at,
          submitted_at
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

      if (session.status !== "submitted") {
        return {
          status: 409,
          payload: { error: "Session must be submitted to review" },
        };
      }

      const itemsRes = await client.query<ReviewItemRow>(
        `
        SELECT
          si.session_item_id,
          si.position,
          si.question_version_id,

          qv.stem,
          qv.explanation_short,
          qv.explanation_long,
          qv.bibliography,
          qv.prompt,

          a.attempt_id,
          a.result,
          a.is_correct,
          a.selected_choice_id,
          a.time_spent_seconds,
          a.confidence,
          a.flagged_for_review,
          a.answered_at,

          cc.choice_id AS correct_choice_id,
          cc.label AS correct_label,
          cc.choice_text AS correct_choice_text,

          sc.label AS selected_label,
          sc.choice_text AS selected_choice_text
        FROM session_items si
        JOIN question_versions qv
          ON qv.question_version_id = si.question_version_id

        LEFT JOIN attempts a
          ON a.session_item_id = si.session_item_id
         AND a.session_id = si.session_id
         AND a.user_id = $2

        LEFT JOIN LATERAL (
          SELECT
            choice_id,
            label,
            choice_text
          FROM question_choices
          WHERE question_version_id = si.question_version_id
            AND is_correct = true
          ORDER BY label ASC
          LIMIT 1
        ) cc ON true

        LEFT JOIN question_choices sc
          ON sc.choice_id = a.selected_choice_id
         AND sc.question_version_id = si.question_version_id

        WHERE si.session_id = $1
        ORDER BY si.position ASC
        `,
        [sessionId, userId]
      );

      const rows = itemsRes.rows;

      if (rows.length === 0) {
        return {
          status: 200,
          payload: {
            session: buildSessionPayload(session),
            items: [],
          },
        };
      }

      const questionVersionIds = Array.from(
        new Set(rows.map((row) => row.question_version_id))
      );

      const choicesByQuestionVersionId: Record<string, ReviewChoice[]> = {};
      const areasByQuestionVersionId: Record<string, ReviewArea[]> = {};

      if (questionVersionIds.length > 0) {
        const areasRes = await client.query<ReviewAreaRow>(
          `
          SELECT
            qva.question_version_id,
            ma.slug,
            ma.name,
            qva.is_primary
          FROM question_version_areas qva
          JOIN medical_areas ma
            ON ma.area_id = qva.area_id
          WHERE qva.question_version_id = ANY($1::uuid[])
            AND ma.is_active = true
          ORDER BY
            qva.question_version_id,
            qva.is_primary DESC,
            ma.display_order ASC,
            ma.name ASC
          `,
          [questionVersionIds]
        );

        for (const area of areasRes.rows) {
          if (!areasByQuestionVersionId[area.question_version_id]) {
            areasByQuestionVersionId[area.question_version_id] = [];
          }

          areasByQuestionVersionId[area.question_version_id].push({
            slug: area.slug,
            name: area.name,
            is_primary: Boolean(area.is_primary),
          });
        }

        const choicesRes = await client.query<ReviewChoiceRow>(
          `
          SELECT
            question_version_id,
            choice_id,
            label,
            choice_text,
            is_correct,
            explanation
          FROM question_choices
          WHERE question_version_id = ANY($1::uuid[])
          ORDER BY question_version_id, label ASC
          `,
          [questionVersionIds]
        );

        for (const choice of choicesRes.rows) {
          if (!choicesByQuestionVersionId[choice.question_version_id]) {
            choicesByQuestionVersionId[choice.question_version_id] = [];
          }

          choicesByQuestionVersionId[choice.question_version_id].push({
            choice_id: choice.choice_id,
            label: choice.label,
            choice_text: choice.choice_text,
            is_correct: Boolean(choice.is_correct),
            explanation: choice.explanation ?? null,
          });
        }
      }

      const items: ReviewItem[] = rows.map((row) => ({
        session_item_id: row.session_item_id,
        position: row.position,
        question_version_id: row.question_version_id,

        stem: row.stem,
        explanation_short: row.explanation_short ?? null,
        explanation_long: row.explanation_long ?? null,
        bibliography: row.bibliography ?? null,
        prompt: row.prompt ?? null,

        attempt_id: row.attempt_id ?? null,
        result: row.result ?? null,
        is_correct: row.is_correct ?? null,
        selected_choice_id: row.selected_choice_id ?? null,
        time_spent_seconds: row.time_spent_seconds ?? null,
        confidence: row.confidence ?? null,
        flagged_for_review: row.flagged_for_review ?? false,
        answered_at: row.answered_at ?? null,

        correct_choice_id: row.correct_choice_id ?? null,
        correct_label: row.correct_label ?? null,
        correct_choice_text: row.correct_choice_text ?? null,

        selected_label: row.selected_label ?? null,
        selected_choice_text: row.selected_choice_text ?? null,

        areas: areasByQuestionVersionId[row.question_version_id] ?? [],
        choices: choicesByQuestionVersionId[row.question_version_id] ?? [],
      }));

      return {
        status: 200,
        payload: {
          session: buildSessionPayload(session),
          items,
        },
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to load review"),
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