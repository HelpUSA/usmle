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

      if (sRes.rowCount === 0) {
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
          status: 400 as const,
          payload: { error: "Session must be submitted to review" },
        };
      }

      // 2) Itens + tentativa (se houver) + correta/selecionada + explicações + flagged
      // Não fazemos JOIN em "todas as choices" aqui para não duplicar linhas.
      const itemsRes = await client.query(
        `
        SELECT
          si.session_item_id,
          si.position,
          si.question_version_id,
          qv.stem,
          qv.explanation_short,
          qv.explanation_long,

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

      // 3) Buscar todas as alternativas (choices) de todos question_version_id retornados
      const qvIds = Array.from(new Set(rows.map((r) => r.question_version_id))) as string[];

      const choicesByQvId: Record<
        string,
        Array<{ choice_id: string; label: string; choice_text: string; is_correct: boolean }>
      > = {};

      if (qvIds.length > 0) {
        const choicesRes = await client.query(
          `
          SELECT question_version_id, choice_id, label, choice_text, is_correct
          FROM question_choices
          WHERE question_version_id = ANY($1)
          ORDER BY question_version_id, label ASC
          `,
          [qvIds]
        );

        for (const c of choicesRes.rows) {
          if (!choicesByQvId[c.question_version_id]) choicesByQvId[c.question_version_id] = [];
          choicesByQvId[c.question_version_id].push({
            choice_id: c.choice_id,
            label: c.label,
            choice_text: c.choice_text,
            is_correct: c.is_correct,
          });
        }
      }

      const items = rows.map((r) => ({
        session_item_id: r.session_item_id,
        position: r.position,
        question_version_id: r.question_version_id,
        stem: r.stem,

        explanation_short: r.explanation_short,
        explanation_long: r.explanation_long,

        attempt_id: r.attempt_id,
        result: r.result,
        is_correct: r.is_correct,
        selected_choice_id: r.selected_choice_id,
        time_spent_seconds: r.time_spent_seconds,
        confidence: r.confidence,
        flagged_for_review: r.flagged_for_review ?? false,
        answered_at: r.answered_at,

        correct_choice_id: r.correct_choice_id,
        correct_label: r.correct_label,
        correct_choice_text: r.correct_choice_text,

        selected_label: r.selected_label,
        selected_choice_text: r.selected_choice_text,

        // ✅ review completo
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
