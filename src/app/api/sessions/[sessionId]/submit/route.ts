import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId } = params;

    const result = await withTx(async (client) => {
      // 1) Trava sessão
      const sRes = await client.query(
        `
        SELECT session_id, user_id, status, submitted_at
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
        submitted_at: string | null;
      };

      if (session.user_id !== userId) {
        return { status: 403 as const, payload: { error: "Forbidden" } };
      }

      // 2) Conta itens
      const itemsCountRes = await client.query(
        `
        SELECT COUNT(*)::int AS total_items
        FROM session_items
        WHERE session_id = $1
        `,
        [sessionId]
      );
      const totalItems = itemsCountRes.rows[0].total_items as number;

      // ✅ Blindagem: não permite submit vazio
      if (totalItems === 0) {
        return {
          status: 400 as const,
          payload: { error: "Cannot submit empty session" },
        };
      }

      // 3) Conta attempts (respondidos/correct/wrong/skipped)
      const statsRes = await client.query(
        `
        SELECT
          COUNT(*)::int AS answered,
          SUM(CASE WHEN result = 'correct' THEN 1 ELSE 0 END)::int AS correct,
          SUM(CASE WHEN result = 'wrong' THEN 1 ELSE 0 END)::int AS wrong,
          SUM(CASE WHEN result = 'skipped' THEN 1 ELSE 0 END)::int AS skipped
        FROM attempts
        WHERE session_id = $1
        `,
        [sessionId]
      );

      const answered = (statsRes.rows[0].answered as number) ?? 0;
      const correct = (statsRes.rows[0].correct as number) ?? 0;
      const wrong = (statsRes.rows[0].wrong as number) ?? 0;
      const skipped = (statsRes.rows[0].skipped as number) ?? 0;
      const unanswered = totalItems - answered;

      // ✅ Idempotência: se já submitted, NÃO altera nada — só retorna o resumo
      if (session.status === "submitted") {
        return {
          status: 200 as const,
          payload: {
            session_id: sessionId,
            status: "submitted",
            total_items: totalItems,
            answered,
            correct,
            wrong,
            skipped,
            unanswered,
          },
        };
      }

      // ✅ Regra: só permite submit se estiver in_progress
      if (session.status !== "in_progress") {
        return {
          status: 400 as const,
          payload: { error: "Session is not in_progress" },
        };
      }

      // 4) Fecha sessão
      await client.query(
        `
        UPDATE sessions
        SET status = 'submitted',
            submitted_at = now()
        WHERE session_id = $1
        `,
        [sessionId]
      );

      return {
        status: 200 as const,
        payload: {
          session_id: sessionId,
          status: "submitted",
          total_items: totalItems,
          answered,
          correct,
          wrong,
          skipped,
          unanswered,
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
