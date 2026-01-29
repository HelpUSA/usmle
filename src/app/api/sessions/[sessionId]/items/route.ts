import { NextResponse } from "next/server";
import { z } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

const BodySchema = z.object({
  count: z.number().int().min(1).max(200).default(10),
});

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId } = params;

    const result = await withTx(async (client) => {
      const s = await client.query(
        `
        SELECT session_id, user_id
        FROM sessions
        WHERE session_id = $1
        `,
        [sessionId]
      );

      if (s.rowCount === 0) {
        return { status: 404 as const, payload: { error: "Session not found" } };
      }

      if (s.rows[0].user_id !== userId) {
        return { status: 403 as const, payload: { error: "Forbidden" } };
      }

      const items = await client.query(
        `
        SELECT session_item_id, session_id, position, question_version_id, presented_at
        FROM session_items
        WHERE session_id = $1
        ORDER BY position ASC
        `,
        [sessionId]
      );

      return { status: 200 as const, payload: { items: items.rows } };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionId } = params;

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const result = await withTx(async (client) => {
      // 1) trava a sessão (evita duas requisições concorrentes criarem itens)
      const sessionRes = await client.query(
        `
        SELECT session_id, user_id, exam, language, status
        FROM sessions
        WHERE session_id = $1
        FOR UPDATE
        `,
        [sessionId]
      );

      if (sessionRes.rowCount === 0) {
        return { status: 404 as const, payload: { error: "Session not found" } };
      }

      const session = sessionRes.rows[0] as {
        session_id: string;
        user_id: string;
        exam: string;
        language: string;
        status: string;
      };

      if (session.user_id !== userId) {
        return { status: 403 as const, payload: { error: "Forbidden" } };
      }

      if (session.status !== "in_progress") {
        return {
          status: 409 as const,
          payload: { error: "Session is not in_progress" },
        };
      }

      // 2) idempotência: se já existem itens, retorna e não recria
      const existing = await client.query(
        `
        SELECT session_item_id, session_id, position, question_version_id, presented_at
        FROM session_items
        WHERE session_id = $1
        ORDER BY position ASC
        `,
        [sessionId]
      );

      if (existing.rowCount > 0) {
        return { status: 200 as const, payload: { items: existing.rows } };
      }

      // 3) Seleciona question_versions elegíveis, evitando duplicados dentro da sessão
      // (mesmo que hoje a sessão esteja vazia, isso protege o endpoint)
      const qvRes = await client.query(
        `
        SELECT qv.question_version_id
        FROM question_versions qv
        WHERE qv.exam = $1
          AND qv.language = $2
          AND qv.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM session_items si
            WHERE si.session_id = $3
              AND si.question_version_id = qv.question_version_id
          )
        ORDER BY random()
        LIMIT $4
        `,
        [session.exam, session.language, sessionId, body.count]
      );

      if (qvRes.rowCount === 0) {
        return {
          status: 400 as const,
          payload: { error: "No active question_versions available for this exam/language" },
        };
      }

      const qvIds: string[] = qvRes.rows.map((r: any) => r.question_version_id);

      // 4) Inserção ordenada (position 1..N) — insere só o que foi selecionado
      const insertValues: any[] = [];
      const placeholders: string[] = [];

      qvIds.forEach((qvId, idx) => {
        const position = idx + 1;
        placeholders.push(`($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`);
        insertValues.push(sessionId, position, qvId);
      });

      const inserted = await client.query(
        `
        INSERT INTO session_items (session_id, position, question_version_id)
        VALUES ${placeholders.join(", ")}
        RETURNING session_item_id, session_id, position, question_version_id, presented_at
        `,
        insertValues
      );

      return { status: 201 as const, payload: { items: inserted.rows } };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
