/**
 * Session Items Route (GET/POST)
 *
 * 📍 Localização:
 * src/app/api/sessions/[sessionId]/items/route.ts
 *
 * Responsabilidades:
 * - GET: listar itens já gerados da sessão (ordenados por position)
 * - POST: gerar itens da sessão de forma idempotente
 *
 * Contrato:
 * - GET  /api/sessions/:sessionId/items
 * - POST /api/sessions/:sessionId/items
 *   Body: { count?: number } (default 10, min 1, max 200)
 *
 * Regras importantes:
 * - Requer autenticação (NextAuth) ou header dev x-user-id
 * - Só permite gerar itens quando a sessão estiver em status "in_progress"
 * - POST é idempotente: se já existem itens, retorna os existentes e não recria
 *
 * Observação (build/TS):
 * - Em alguns typings do driver `pg`, `rowCount` pode ser `number | null`.
 *   Para evitar falha no build (Vercel), usamos `rows.length` em vez de `rowCount`.
 *
 * Patch (DEV seed isolation):
 * - Evita misturar conteúdo de seed DEV com produção:
 *   filtra questions.source <> 'dev_seed' e questions.status='published'
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

const BodySchema = z.object({
  count: z.number().int().min(1).max(200).default(10),
});

type Difficulty = "easy" | "medium" | "hard";

function splitByDifficulty(count: number) {
  // alvo: 30% easy, 50% medium, 20% hard (arredondando)
  const easy = Math.max(0, Math.round(count * 0.3));
  const hard = Math.max(0, Math.round(count * 0.2));
  let medium = count - easy - hard;
  if (medium < 0) medium = 0;
  return { easy, medium, hard };
}

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

      // ✅ TS-safe
      if (s.rows.length === 0) {
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

      // ✅ TS-safe
      if (sessionRes.rows.length === 0) {
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

      if (existing.rows.length > 0) {
        return { status: 200 as const, payload: { items: existing.rows } };
      }

      // 3) Seleção "melhor para o usuário":
      // - prioriza questões não vistas (user_question_state ausente -> aparece primeiro)
      // - depois as menos vistas (times_seen ASC)
      // - balanceia por dificuldade (quando disponível)
      //
      // Patch: filtra questions.status='published' e questions.source<>'dev_seed'
      const target = splitByDifficulty(body.count);

      async function pickByDifficulty(diff: Difficulty, limit: number) {
        if (limit <= 0) return [] as string[];

        const res = await client.query(
          `
          SELECT qv.question_version_id
          FROM question_versions qv
          JOIN questions q ON q.question_id = qv.question_id
          LEFT JOIN user_question_state uqs
            ON uqs.user_id = $5 AND uqs.question_id = q.question_id
          WHERE qv.exam = $1
            AND qv.language = $2
            AND qv.is_active = true
            AND qv.difficulty = $6
            AND q.status = 'published'
            AND q.source <> 'dev_seed'
            AND NOT EXISTS (
              SELECT 1
              FROM session_items si
              WHERE si.session_id = $3
                AND si.question_version_id = qv.question_version_id
            )
          ORDER BY
            (uqs.question_id IS NULL) DESC,
            COALESCE(uqs.times_seen, 0) ASC,
            random()
          LIMIT $4
          `,
          [session.exam, session.language, sessionId, limit, userId, diff]
        );

        return res.rows.map((r: any) => r.question_version_id as string);
      }

      const picked: string[] = [];
      const easyIds = await pickByDifficulty("easy", target.easy);
      picked.push(...easyIds);

      const mediumIds = await pickByDifficulty("medium", target.medium);
      picked.push(...mediumIds);

      const hardIds = await pickByDifficulty("hard", target.hard);
      picked.push(...hardIds);

      // Se não deu para completar (falta de questões daquela dificuldade), completa com o que houver
      if (picked.length < body.count) {
        const remaining = body.count - picked.length;

        const fillRes = await client.query(
          `
          SELECT qv.question_version_id
          FROM question_versions qv
          JOIN questions q ON q.question_id = qv.question_id
          LEFT JOIN user_question_state uqs
            ON uqs.user_id = $5 AND uqs.question_id = q.question_id
          WHERE qv.exam = $1
            AND qv.language = $2
            AND qv.is_active = true
            AND q.status = 'published'
            AND q.source <> 'dev_seed'
            AND NOT EXISTS (
              SELECT 1
              FROM session_items si
              WHERE si.session_id = $3
                AND si.question_version_id = qv.question_version_id
            )
            AND qv.question_version_id <> ALL($6::uuid[])
          ORDER BY
            (uqs.question_id IS NULL) DESC,
            COALESCE(uqs.times_seen, 0) ASC,
            random()
          LIMIT $4
          `,
          [session.exam, session.language, sessionId, remaining, userId, picked]
        );

        picked.push(
          ...fillRes.rows.map((r: any) => r.question_version_id as string)
        );
      }

      if (picked.length === 0) {
        return {
          status: 400 as const,
          payload: {
            error: "No active question_versions available for this exam/language",
          },
        };
      }

      // 4) Inserção ordenada (position 1..N)
      const insertValues: any[] = [];
      const placeholders: string[] = [];

      picked.forEach((qvId, idx) => {
        const position = idx + 1;
        placeholders.push(
          `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`
        );
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
