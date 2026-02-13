// src/app/api/sessions/[sessionId]/review/route.ts
//
// Review Endpoint
// - Só permite review se a sessão estiver submitted
// - Retorna: sessão + items com stem, explanations, bibliography/prompt,
//   attempt info, alternativa correta, alternativa marcada,
//   e TODAS as choices com is_correct + explanation (review UX v2)
//
// Observação: TS-safe (evita rowCount).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId } = params;

    const result = await withTx(async (client) => {
      // 1) Carrega sessão
      const sRes = await client.query(
        `
        SELECT session_id, user_id, status, exam, language, started_at, submitted_at
        FROM sessions
        WHERE session_id = $1
        `,
        [sessionId]
      );

      // ✅ TS-safe
      if (sRes.rows.length === 0) {
        return { status: 404 as const, payload: { error: "Session not found" } };
      }

      const session = sRes.rows[0] as {
        session_id: string;
        user_id: string;
        status: string;
        exam: string;
        language: string;
        started_at: string;
        submitted_at: string | null;
      };

      if (session.user_id !== userId) {
        return { status: 403 as const, payload: { error: "Forbidden" } };
      }

      // ✅ Blindagem: review só para sessão submetida
      if (session.status !== "submitted") {
        return {
          status: 409 as const,
          payload: { error: "Session must be submitted to review" },
        };
      }

      // 2) Itens + attempt + correta/selecionada (sem expandir choices aqui pra não duplicar)
      const itemsRes = await client.query(
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

        LEFT JOIN question_choices cc
          ON cc.question_version_id = si.question_version_id
         AND cc.is_correct = true

        LEFT JOIN question_choices sc
          ON sc.choice_id = a.selected_choice_id

        WHERE si.session_id = $1
        ORDER BY si.position ASC
        `,
        [sessionId]
      );

      const rows = itemsRes.rows as Array<any>;

      if (rows.length === 0) {
        return {
          status: 200 as const,
          payload: {
            session: {
              session_id: session.session_id,
              user_id: session.user_id,
              status: session.status,
              exam: session.exam,
              language: session.language,
              started_at: session.started_at,
              submitted_at: session.submitted_at,
            },
            items: [],
          },
        };
      }

      // 3) Buscar todas as alternatives (choices) com explanation por alternativa
      const qvIds = Array.from(new Set(rows.map((r) => r.question_version_id))) as string[];

      const choicesByQvId: Record<
        string,
        Array<{
          choice_id: string;
          label: string;
          choice_text: string;
          is_correct: boolean;
          explanation: string | null;
        }>
      > = {};

      if (qvIds.length > 0) {
        const choicesRes = await client.query(
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
          [qvIds]
        );

        for (const c of choicesRes.rows) {
          if (!choicesByQvId[c.question_version_id]) {
            choicesByQvId[c.question_version_id] = [];
          }
          choicesByQvId[c.question_version_id].push({
            choice_id: c.choice_id,
            label: c.label,
            choice_text: c.choice_text,
            is_correct: Boolean(c.is_correct),
            explanation: c.explanation ?? null,
          });
        }
      }

      const items = rows.map((r) => ({
        session_item_id: r.session_item_id,
        position: r.position,
        question_version_id: r.question_version_id,

        stem: r.stem,
        explanation_short: r.explanation_short ?? null,
        explanation_long: r.explanation_long ?? null,

        bibliography: r.bibliography ?? null,
        prompt: r.prompt ?? null,

        attempt_id: r.attempt_id ?? null,
        result: r.result ?? null,
        is_correct: r.is_correct ?? null,
        selected_choice_id: r.selected_choice_id ?? null,
        time_spent_seconds: r.time_spent_seconds ?? null,
        confidence: r.confidence ?? null,
        flagged_for_review: r.flagged_for_review ?? false,
        answered_at: r.answered_at ?? null,

        correct_choice_id: r.correct_choice_id ?? null,
        correct_label: r.correct_label ?? null,
        correct_choice_text: r.correct_choice_text ?? null,

        selected_label: r.selected_label ?? null,
        selected_choice_text: r.selected_choice_text ?? null,

        // ✅ review completo: alternativas + explicação por alternativa
        choices: choicesByQvId[r.question_version_id] ?? [],
      }));

      return {
        status: 200 as const,
        payload: {
          session: {
            session_id: session.session_id,
            user_id: session.user_id,
            status: session.status,
            exam: session.exam,
            language: session.language,
            started_at: session.started_at,
            submitted_at: session.submitted_at,
          },
          items,
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
