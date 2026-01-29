import { NextResponse } from "next/server";
import { z } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

const BodySchema = z.object({
  // Para "skipped", mande null ou omita.
  selected_choice_id: z.string().uuid().nullable().optional(),
  time_spent_seconds: z.number().int().min(0).max(60 * 60).optional(),
  confidence: z.number().int().min(1).max(5).optional(), // 1..5
  flagged_for_review: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string; sessionItemId: string } }
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId, sessionItemId } = params;

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const result = await withTx(async (client) => {
      // 1) Verifica sessão (e trava)
      const sRes = await client.query(
        `
        SELECT session_id, user_id, status
        FROM sessions
        WHERE session_id = $1
        FOR UPDATE
        `,
        [sessionId]
      );

      if (sRes.rowCount === 0) {
        return { status: 404 as const, payload: { error: "Session not found" } };
      }

      const session = sRes.rows[0] as {
        session_id: string;
        user_id: string;
        status: string;
      };

      if (session.user_id !== userId) {
        return { status: 403 as const, payload: { error: "Forbidden" } };
      }

      // ✅ Blindagem: não permitir attempt fora do estado correto
      if (session.status !== "in_progress") {
        return {
          status: 409 as const,
          payload: { error: "Session is not in_progress" },
        };
      }

      // 2) Verifica item pertence à sessão (e trava)
      const itemRes = await client.query(
        `
        SELECT session_item_id, session_id, question_version_id
        FROM session_items
        WHERE session_item_id = $1 AND session_id = $2
        FOR UPDATE
        `,
        [sessionItemId, sessionId]
      );

      if (itemRes.rowCount === 0) {
        return {
          status: 404 as const,
          payload: { error: "Session item not found for this session" },
        };
      }

      const item = itemRes.rows[0] as {
        session_item_id: string;
        session_id: string;
        question_version_id: string;
      };

      // 3) Calcular resultado (correct/wrong/skipped) comparando com question_choices.is_correct
      const selectedChoiceId = body.selected_choice_id ?? null;

      let attemptResult: "correct" | "wrong" | "skipped" = "skipped";
      let isCorrect: boolean | null = null;

      if (selectedChoiceId) {
        const choiceRes = await client.query(
          `
          SELECT is_correct
          FROM question_choices
          WHERE choice_id = $1 AND question_version_id = $2
          `,
          [selectedChoiceId, item.question_version_id]
        );

        if (choiceRes.rowCount === 0) {
          return {
            status: 422 as const,
            payload: {
              error: "selected_choice_id does not belong to this question_version",
            },
          };
        }

        const correct = Boolean(choiceRes.rows[0].is_correct);
        isCorrect = correct;
        attemptResult = correct ? "correct" : "wrong";
      }

      // 4) Upsert attempt (se existir, atualiza)
      const existingAttempt = await client.query(
        `
        SELECT attempt_id
        FROM attempts
        WHERE session_item_id = $1
        LIMIT 1
        `,
        [sessionItemId]
      );

      let attemptRow: any;

      if (existingAttempt.rowCount > 0) {
        const attemptId = existingAttempt.rows[0].attempt_id as string;

        const upd = await client.query(
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
          RETURNING
            attempt_id, user_id, session_id, session_item_id, question_version_id,
            selected_choice_id, result, is_correct, time_spent_seconds, confidence,
            flagged_for_review, answered_at
          `,
          [
            selectedChoiceId,
            attemptResult,
            isCorrect,
            body.time_spent_seconds ?? null,
            body.confidence ?? null,
            body.flagged_for_review ?? null,
            attemptId,
          ]
        );

        attemptRow = upd.rows[0];
        return { status: 200 as const, payload: { attempt: attemptRow } };
      }

      const ins = await client.query(
        `
        INSERT INTO attempts (
          user_id, session_id, session_item_id, question_version_id,
          selected_choice_id, result, is_correct,
          time_spent_seconds, confidence, flagged_for_review
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10
        )
        RETURNING
          attempt_id, user_id, session_id, session_item_id, question_version_id,
          selected_choice_id, result, is_correct, time_spent_seconds, confidence,
          flagged_for_review, answered_at
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

      attemptRow = ins.rows[0];

      // 5) Atualizar user_question_state (upsert) — mantém seu comportamento atual
      const qRes = await client.query(
        `
        SELECT question_id
        FROM question_versions
        WHERE question_version_id = $1
        `,
        [item.question_version_id]
      );

      if (qRes.rowCount === 0) {
        return {
          status: 500 as const,
          payload: { error: "question_version not found (data integrity)" },
        };
      }

      const questionId = qRes.rows[0].question_id as string;

      await client.query(
        `
        INSERT INTO user_question_state (
          user_id, question_id, last_seen_at, last_attempt_id,
          times_seen, times_correct, last_result, bookmarked
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
          times_seen = user_question_state.times_seen + 1,
          times_correct = user_question_state.times_correct + EXCLUDED.times_correct,
          last_result = EXCLUDED.last_result
        `,
        [
          userId,
          questionId,
          attemptRow.attempt_id,
          isCorrect === true ? 1 : 0,
          attemptResult,
        ]
      );

      return { status: 201 as const, payload: { attempt: attemptRow } };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
