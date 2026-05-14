/*
 * File: src/app/api/sessions/[sessionId]/items/[sessionItemId]/route.ts
 *
 * Responsibility:
 * - Update persistent per-session-item state for the authenticated user.
 * - Currently supports pre-answer flagged_for_review without creating an attempt.
 *
 * API contract:
 * - PATCH /api/sessions/:sessionId/items/:sessionItemId
 *   Body:
 *   {
 *     flagged_for_review?: boolean
 *   }
 *
 * Auth contract:
 * - User identity is resolved by getUserIdForApi(req).
 * - The route must never update an item from another user's session.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

const ParamsSchema = z.object({
  sessionId: z.string().uuid("Invalid sessionId"),
  sessionItemId: z.string().uuid("Invalid sessionItemId"),
});

const BodySchema = z
  .object({
    flagged_for_review: z.boolean().optional(),
  })
  .strict();

type RouteParams = {
  params: {
    sessionId: string;
    sessionItemId: string;
  };
};

type SessionItemStateRow = {
  session_item_id: string;
  session_id: string;
  position: number;
  question_version_id: string;
  presented_at: string;
  block_index: number;
  position_in_block: number | null;
  flagged_for_review: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  user_id: string;
  status: string;
};

type SessionItemStatePayload = {
  item: Omit<SessionItemStateRow, "user_id" | "status">;
};

type RouteResult =
  | {
      status: 200;
      payload: SessionItemStatePayload;
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

function stripPrivateFields(
  item: SessionItemStateRow
): SessionItemStatePayload["item"] {
  return {
    session_item_id: item.session_item_id,
    session_id: item.session_id,
    position: item.position,
    question_version_id: item.question_version_id,
    presented_at: item.presented_at,
    block_index: item.block_index,
    position_in_block: item.position_in_block,
    flagged_for_review: item.flagged_for_review,
    first_seen_at: item.first_seen_at,
    last_seen_at: item.last_seen_at,
  };
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const userId = await getUserIdForApi(req);
    const { sessionId, sessionItemId } = ParamsSchema.parse(params);

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const result = await withTx<RouteResult>(async (client) => {
      const itemRes = await client.query<SessionItemStateRow>(
        `
        SELECT
          si.session_item_id,
          si.session_id,
          si.position,
          si.question_version_id,
          si.presented_at,
          si.block_index,
          si.position_in_block,
          si.flagged_for_review,
          si.first_seen_at,
          si.last_seen_at,
          s.user_id,
          s.status
        FROM session_items si
        JOIN sessions s
          ON s.session_id = si.session_id
        WHERE si.session_item_id = $1
          AND si.session_id = $2
        FOR UPDATE OF si
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

      const updated = await client.query<SessionItemStateRow>(
        `
        UPDATE session_items
        SET
          flagged_for_review = COALESCE($1, flagged_for_review)
        WHERE session_item_id = $2
          AND session_id = $3
        RETURNING
          session_item_id,
          session_id,
          position,
          question_version_id,
          presented_at,
          block_index,
          position_in_block,
          flagged_for_review,
          first_seen_at,
          last_seen_at,
          $4::uuid AS user_id,
          $5::text AS status
        `,
        [
          body.flagged_for_review ?? null,
          sessionItemId,
          sessionId,
          item.user_id,
          item.status,
        ]
      );

      if (updated.rows.length === 0) {
        return {
          status: 404,
          payload: { error: "Session item not found for update" },
        };
      }

      return {
        status: 200,
        payload: {
          item: stripPrivateFields(updated.rows[0]),
        },
      };
    });

    return jsonResponse(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to update session item"),
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
