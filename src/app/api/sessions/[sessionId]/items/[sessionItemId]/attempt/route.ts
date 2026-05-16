/*
 * File: src/app/api/sessions/[sessionId]/items/[sessionItemId]/attempt/route.ts
 *
 * Responsibility:
 * - Record or update the authenticated user's attempt for one session item.
 * - Validate that the session belongs to the authenticated user.
 * - Validate that the session item belongs to the requested session.
 * - Validate that selected_choice_id belongs to the item's question_version.
 * - Compute result: correct, wrong, or skipped.
 * - Return an enriched feedback payload for immediate-review practice mode.
 *
 * API contract:
 * - POST /api/sessions/:sessionId/items/:sessionItemId/attempt
 *
 * Request body:
 * - selected_choice_id?: string | null
 * - time_spent_seconds?: number
 * - confidence?: number
 * - flagged_for_review?: boolean
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - The route must never record or update attempts for another user's session.
 *
 * Important behavior:
 * - Only in_progress sessions accept attempts.
 * - Upsert is preserved by session_item_id/user/session.
 * - Updating the same attempt does not inflate times_seen.
 * - Updating a previously correct attempt to wrong/skipped adjusts times_correct.
 * - The enriched response keeps compatibility with the session player:
 *   - attempt
 *   - is_correct
 *   - result
 *   - explanation_short
 *   - explanation_long
 *   - bibliography
 *   - choices[] with is_correct and explanation
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";
import { recordActivityEvent } from "@/lib/engagement";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ParamsSchema = z.object({
  sessionId: z.string().regex(UUID_RE, "Invalid sessionId"),
  sessionItemId: z.string().regex(UUID_RE, "Invalid sessionItemId"),
});

const BodySchema = z
  .object({
    selected_choice_id: z.string().uuid().nullable().optional(),
    time_spent_seconds: z.coerce.number().int().min(0).max(60 * 60).optional(),
    confidence: z.coerce.number().int().min(1).max(5).optional(),
    flagged_for_review: z.boolean().optional(),
  })
  .strict();

type RouteParams = {
  params: {
    sessionId: string;
    sessionItemId: string;
  };
};

type AttemptResult = "correct" | "wrong" | "skipped";

type SessionRow = {
  session_id: string;
  user_id: string;
  status: string;
};

type SessionItemRow = {
  session_item_id: string;
  session_id: string;
  question_version_id: string;
};

type SelectedChoiceRow = {
  is_correct: boolean;
};

type ExistingAttemptRow = {
  attempt_id: string;
  result: AttemptResult;
  is_correct: boolean | null;
};

type AttemptRow = {
  attempt_id: string;
  user_id: string;
  session_id: string;
  session_item_id: string;
  question_version_id: string;
  selected_choice_id: string | null;
  result: AttemptResult;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  confidence: number | null;
  flagged_for_review: boolean;
  answered_at: string;
};

type QuestionIdRow = {
  question_id: string;
};

type QuestionVersionContentRow = {
  explanation_short: string | null;
  explanation_long: string | null;
  bibliography: unknown;
};

type FeedbackChoiceRow = {
  choice_id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
  explanation: string | null;
};

type AttemptPayload = {
  attempt: AttemptRow;
  is_correct: boolean | null;
  result: AttemptResult;
  explanation_short: string | null;
  explanation_long: string | null;
  bibliography: unknown;
  choices: FeedbackChoiceRow[];
};

type RouteResult =
  | {
      status: 200 | 201;
      payload: AttemptPayload;
    }
  | {
      status: 403 | 404 | 409 | 422 | 500;
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

function correctValue(value: boolean | null): number {
  return value === true ? 1 : 0;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await getUserIdForApi(req);
    const { sessionId, sessionItemId } = ParamsSchema.parse(params);

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const result = await withTx<RouteResult>(async (client) => {
      const sessionRes = await client.query<SessionRow>(
        `
        SELECT
          session_id,
          user_id,
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

      const itemRes = await client.query<SessionItemRow>(
        `
        SELECT
          session_item_id,
          session_id,
          question_version_id
        FROM session_items
        WHERE session_item_id = $1
          AND session_id = $2
        FOR UPDATE
        `,
        [sessionItemId, sessionId]
      );

      if (itemRes.rows.length === 0) {
        return {
          status: 404,
          payload: { error: "Session item not found for this session" },
        };
      }

      const item = itemRes.rows[0];
      const selectedChoiceId = body.selected_choice_id ?? null;

      let attemptResult: AttemptResult = "skipped";
      let isCorrect: boolean | null = null;

      if (selectedChoiceId) {
        const choiceRes = await client.query<SelectedChoiceRow>(
          `
          SELECT is_correct
          FROM question_choices
          WHERE choice_id = $1
            AND question_version_id = $2
          `,
          [selectedChoiceId, item.question_version_id]
        );

        if (choiceRes.rows.length === 0) {
          return {
            status: 422,
            payload: {
              error: "selected_choice_id does not belong to this question_version",
            },
          };
        }

        isCorrect = Boolean(choiceRes.rows[0].is_correct);
        attemptResult = isCorrect ? "correct" : "wrong";
      }

      const existingAttemptRes = await client.query<ExistingAttemptRow>(
        `
        SELECT
          attempt_id,
          result,
          is_correct
        FROM attempts
        WHERE session_item_id = $1
          AND session_id = $2
          AND user_id = $3
        LIMIT 1
        FOR UPDATE
        `,
        [sessionItemId, sessionId, userId]
      );

      const previousAttempt = existingAttemptRes.rows[0] ?? null;
      let attemptRow: AttemptRow;

      if (previousAttempt) {
        const updated = await client.query<AttemptRow>(
          `
          UPDATE attempts
          SET
            selected_choice_id = $1,
            result = $2,
            is_correct = $3,
            time_spent_seconds = COALESCE($4, time_spent_seconds),
            confidence = COALESCE($5, confidence),
            flagged_for_review = COALESCE($6, flagged_for_review),
            answered_at = now()
          WHERE attempt_id = $7
            AND user_id = $8
            AND session_id = $9
            AND session_item_id = $10
          RETURNING
            attempt_id,
            user_id,
            session_id,
            session_item_id,
            question_version_id,
            selected_choice_id,
            result,
            is_correct,
            time_spent_seconds,
            confidence,
            flagged_for_review,
            answered_at
          `,
          [
            selectedChoiceId,
            attemptResult,
            isCorrect,
            body.time_spent_seconds ?? null,
            body.confidence ?? null,
            body.flagged_for_review ?? null,
            previousAttempt.attempt_id,
            userId,
            sessionId,
            sessionItemId,
          ]
        );

        if (updated.rows.length === 0) {
          return {
            status: 500,
            payload: { error: "Failed to update attempt" },
          };
        }

        attemptRow = updated.rows[0];
      } else {
        const inserted = await client.query<AttemptRow>(
          `
          INSERT INTO attempts (
            user_id,
            session_id,
            session_item_id,
            question_version_id,
            selected_choice_id,
            result,
            is_correct,
            time_spent_seconds,
            confidence,
            flagged_for_review
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10
          )
          RETURNING
            attempt_id,
            user_id,
            session_id,
            session_item_id,
            question_version_id,
            selected_choice_id,
            result,
            is_correct,
            time_spent_seconds,
            confidence,
            flagged_for_review,
            answered_at
          `,
          [
            userId,
            sessionId,
            sessionItemId,
            item.question_version_id,
            selectedChoiceId,
            attemptResult,
            isCorrect,
            body.time_spent_seconds ?? null,
            body.confidence ?? null,
            body.flagged_for_review ?? false,
          ]
        );

        if (inserted.rows.length === 0) {
          return {
            status: 500,
            payload: { error: "Failed to insert attempt" },
          };
        }

        attemptRow = inserted.rows[0];
      }

      const questionRes = await client.query<QuestionIdRow>(
        `
        SELECT question_id
        FROM question_versions
        WHERE question_version_id = $1
        `,
        [item.question_version_id]
      );

      if (questionRes.rows.length === 0) {
        return {
          status: 500,
          payload: { error: "question_version not found" },
        };
      }

      const questionId = questionRes.rows[0].question_id;

      const newCorrectValue = correctValue(isCorrect);
      const previousCorrectValue = previousAttempt
        ? correctValue(previousAttempt.is_correct)
        : 0;

      const timesSeenDelta = previousAttempt ? 0 : 1;
      const timesCorrectDelta = previousAttempt
        ? newCorrectValue - previousCorrectValue
        : newCorrectValue;

      await client.query(
        `
        INSERT INTO user_question_state (
          user_id,
          question_id,
          last_seen_at,
          last_attempt_id,
          times_seen,
          times_correct,
          last_result,
          bookmarked
        )
        VALUES (
          $1, $2, now(), $3,
          1,
          $4,
          $5,
          false
        )
        ON CONFLICT (user_id, question_id) DO UPDATE
        SET
          last_seen_at = now(),
          last_attempt_id = EXCLUDED.last_attempt_id,
          times_seen = GREATEST(1, user_question_state.times_seen + $6),
          times_correct = GREATEST(0, user_question_state.times_correct + $7),
          last_result = EXCLUDED.last_result
        `,
        [
          userId,
          questionId,
          attemptRow.attempt_id,
          newCorrectValue,
          attemptResult,
          timesSeenDelta,
          timesCorrectDelta,
        ]
      );

      if (!previousAttempt) {
        await recordActivityEvent(
          {
            userId,
            eventType: "answer_submitted",
            sessionId,
            sessionItemId,
            questionId,
            studySeconds: body.time_spent_seconds ?? 0,
            idempotencyKey: `answer_submitted:${attemptRow.attempt_id}`,
            metadataJson: {
              result: attemptResult,
              is_correct: attemptRow.is_correct,
              flagged_for_review: attemptRow.flagged_for_review,
            },
          },
          client
        );

        if (attemptRow.is_correct === true) {
          await recordActivityEvent(
            {
              userId,
              eventType: "answer_correct",
              sessionId,
              sessionItemId,
              questionId,
              idempotencyKey: `answer_correct:${attemptRow.attempt_id}`,
              metadataJson: {
                result: attemptResult,
              },
            },
            client
          );
        } else if (attemptRow.result === "wrong") {
          await recordActivityEvent(
            {
              userId,
              eventType: "answer_incorrect",
              sessionId,
              sessionItemId,
              questionId,
              idempotencyKey: `answer_incorrect:${attemptRow.attempt_id}`,
              metadataJson: {
                result: attemptResult,
              },
            },
            client
          );
        }

        if (attemptRow.flagged_for_review === true) {
          await recordActivityEvent(
            {
              userId,
              eventType: "question_flagged",
              sessionId,
              sessionItemId,
              questionId,
              idempotencyKey: `question_flagged:${attemptRow.attempt_id}`,
              metadataJson: {
                result: attemptResult,
              },
            },
            client
          );
        }
      }

      const questionVersionContentRes =
        await client.query<QuestionVersionContentRow>(
          `
          SELECT
            explanation_short,
            explanation_long,
            bibliography
          FROM question_versions
          WHERE question_version_id = $1
          LIMIT 1
          `,
          [item.question_version_id]
        );

      if (questionVersionContentRes.rows.length === 0) {
        return {
          status: 500,
          payload: { error: "question_version content not found" },
        };
      }

      const questionVersionContent = questionVersionContentRes.rows[0];

      const choicesRes = await client.query<FeedbackChoiceRow>(
        `
        SELECT
          choice_id,
          label,
          choice_text,
          is_correct,
          explanation
        FROM question_choices
        WHERE question_version_id = $1
        ORDER BY label ASC
        `,
        [item.question_version_id]
      );

      const payload: AttemptPayload = {
        attempt: attemptRow,
        is_correct: attemptRow.is_correct,
        result: attemptRow.result,
        explanation_short: questionVersionContent.explanation_short ?? null,
        explanation_long: questionVersionContent.explanation_long ?? null,
        bibliography: questionVersionContent.bibliography ?? null,
        choices: choicesRes.rows,
      };

      return {
        status: previousAttempt ? 200 : 201,
        payload,
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to record attempt"),
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