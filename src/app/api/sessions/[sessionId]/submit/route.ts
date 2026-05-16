/*
 * File: src/app/api/sessions/[sessionId]/submit/route.ts
 *
 * Responsibility:
 * - Submit/finalize one authenticated user's study session.
 * - Validate that the session belongs to the authenticated user.
 * - Prevent submission of an empty session.
 * - Preserve idempotency:
 *   - if the session is already submitted, return the current summary;
 *   - do not change submitted_at again.
 * - Only allow real state transition from in_progress to submitted.
 *
 * API contract:
 * - POST /api/sessions/:sessionId/submit
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - The route must never submit another user's session.
 *
 * Summary behavior:
 * - total_items is counted from session_items.
 * - answered/correct/wrong/skipped are counted from attempts joined to the
 *   session's own items and scoped to the authenticated user.
 * - unanswered = total_items - answered.
 * - accuracy = correct / answered.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";
import { recordActivityEvent } from "@/lib/engagement";

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
  submitted_at: string | null;
};

type SummaryRow = {
  total_items: number | string | null;
  answered: number | string | null;
  correct: number | string | null;
  wrong: number | string | null;
  skipped: number | string | null;
};

type SubmitSummaryPayload = {
  session_id: string;
  status: "submitted";
  submitted_at: string | null;
  total_items: number;
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
  unanswered: number;
  accuracy: number;
};

type RouteResult =
  | {
      status: 200;
      payload: SubmitSummaryPayload;
    }
  | {
      status: 400 | 403 | 404 | 409;
      payload: {
        error: string;
      };
    };

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric;
}

function normalizeSummaryRow(row: SummaryRow | null | undefined) {
  const totalItems = toNumber(row?.total_items);
  const answered = toNumber(row?.answered);
  const correct = toNumber(row?.correct);
  const wrong = toNumber(row?.wrong);
  const skipped = toNumber(row?.skipped);
  const unanswered = Math.max(0, totalItems - answered);

  return {
    total_items: totalItems,
    answered,
    correct,
    wrong,
    skipped,
    unanswered,
    accuracy: answered > 0 ? correct / answered : 0,
  };
}

function buildSubmittedPayload(
  sessionId: string,
  submittedAt: string | null,
  summaryRow: SummaryRow | null | undefined
): SubmitSummaryPayload {
  const summary = normalizeSummaryRow(summaryRow);

  return {
    session_id: sessionId,
    status: "submitted",
    submitted_at: submittedAt,
    ...summary,
  };
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

export async function POST(req: Request, { params }: RouteParams) {
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
          submitted_at
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

      const summaryRes = await client.query<SummaryRow>(
        `
        SELECT
          COUNT(si.session_item_id)::int AS total_items,
          COUNT(a.attempt_id) FILTER (
            WHERE a.result IN ('correct', 'wrong', 'skipped')
          )::int AS answered,
          COUNT(a.attempt_id) FILTER (
            WHERE a.result = 'correct'
          )::int AS correct,
          COUNT(a.attempt_id) FILTER (
            WHERE a.result = 'wrong'
          )::int AS wrong,
          COUNT(a.attempt_id) FILTER (
            WHERE a.result = 'skipped'
          )::int AS skipped
        FROM session_items si
        LEFT JOIN attempts a
          ON a.session_item_id = si.session_item_id
         AND a.session_id = si.session_id
         AND a.user_id = $2
        WHERE si.session_id = $1
        `,
        [sessionId, userId]
      );

      const summaryRow = summaryRes.rows[0] ?? null;
      const normalizedSummary = normalizeSummaryRow(summaryRow);

      if (normalizedSummary.total_items === 0) {
        return {
          status: 400,
          payload: { error: "Cannot submit empty session" },
        };
      }

      if (session.status === "submitted") {
        return {
          status: 200,
          payload: buildSubmittedPayload(
            sessionId,
            session.submitted_at,
            summaryRow
          ),
        };
      }

      if (session.status !== "in_progress") {
        return {
          status: 409,
          payload: { error: "Session is not in_progress" },
        };
      }

      const updatedSessionRes = await client.query<Pick<SessionRow, "submitted_at">>(
        `
        UPDATE sessions
        SET
          status = 'submitted',
          submitted_at = now()
        WHERE session_id = $1
          AND user_id = $2
          AND status = 'in_progress'
        RETURNING submitted_at
        `,
        [sessionId, userId]
      );

      if (updatedSessionRes.rows.length === 0) {
        return {
          status: 409,
          payload: { error: "Session could not be submitted" },
        };
      }

      const submittedAt = updatedSessionRes.rows[0].submitted_at;

      await recordActivityEvent(
        {
          userId,
          eventType: "session_submitted",
          sessionId,
          idempotencyKey: `session_submitted:${sessionId}`,
          metadataJson: {
            submitted_at: submittedAt,
            total_items: normalizedSummary.total_items,
            answered: normalizedSummary.answered,
            correct: normalizedSummary.correct,
            wrong: normalizedSummary.wrong,
            skipped: normalizedSummary.skipped,
          },
        },
        client
      );

      return {
        status: 200,
        payload: buildSubmittedPayload(sessionId, submittedAt, summaryRow),
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to submit session"),
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