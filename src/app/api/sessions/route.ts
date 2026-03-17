/**
 * Sessions Route (GET/POST)
 *
 * 📍 Localização:
 * src/app/api/sessions/route.ts
 *
 * Responsabilidades:
 * - POST: criar uma nova sessão de estudo
 * - GET: listar sessões recentes do usuário autenticado
 *
 * Contrato:
 * - POST /api/sessions
 *   Body mínimo esperado:
 *   {
 *     mode: "practice" | "timed_block" | "exam_sim",
 *     exam: "step1" | "step2ck",
 *     language?: string
 *   }
 *
 * Regras importantes:
 * - Requer autenticação (NextAuth) ou header dev x-user-id
 * - Garante que o user exista em users_profile
 * - Cria a sessão sempre em status "in_progress"
 * - O mode é autoritativo: timed e time_limit_seconds são derivados do mode,
 *   e não aceitos como fonte de verdade vinda do cliente
 *
 * Semântica de produto:
 * - practice:
 *   - timed = false
 *   - sem limite de tempo
 *   - estratégia de review imediato por questão
 *
 * - timed_block:
 *   - timed = true
 *   - limite padrão de 60 minutos
 *   - estratégia de review diferido (somente ao final)
 *
 * - exam_sim:
 *   - timed = true
 *   - limite padrão de 4 horas
 *   - estratégia de review diferido (somente ao final)
 *
 * Observações:
 * - Mantemos compatibilidade com o contrato já usado no frontend:
 *   o cliente continua enviando { exam, mode }.
 * - timed/time_limit_seconds continuam presentes na resposta para que o frontend
 *   possa adaptar o comportamento da experiência.
 *
 * ✅ Atualização (2026-03-17):
 * - mode passou a definir o comportamento real da sessão
 * - removida a dependência de timed/time_limit_seconds vindos do body
 * - settings_json passou a registrar metadados úteis de UX por modo
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

const CreateSessionSchema = z.object({
  mode: z.enum(["practice", "timed_block", "exam_sim"]),
  exam: z.enum(["step1", "step2ck"]),
  language: z.string().default("en"),
});

type SessionMode = "practice" | "timed_block" | "exam_sim";

function deriveSessionBehavior(mode: SessionMode) {
  switch (mode) {
    case "practice":
      return {
        timed: false,
        time_limit_seconds: null as number | null,
        settings_json: {
          review_strategy: "immediate",
          timer_visible: false,
          mode_semantics: "practice",
        },
      };

    case "timed_block":
      return {
        timed: true,
        time_limit_seconds: 60 * 60, // 60 min
        settings_json: {
          review_strategy: "deferred",
          timer_visible: true,
          mode_semantics: "timed_block",
        },
      };

    case "exam_sim":
      return {
        timed: true,
        time_limit_seconds: 4 * 60 * 60, // 4 h
        settings_json: {
          review_strategy: "deferred",
          timer_visible: true,
          mode_semantics: "exam_sim",
        },
      };

    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unsupported mode: ${exhaustiveCheck}`);
    }
  }
}

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    const bodyJson = await req.json().catch(() => ({}));
    const body = CreateSessionSchema.parse(bodyJson);

    const derived = deriveSessionBehavior(body.mode);

    await query(
      `
      INSERT INTO users_profile (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    const created = await query(
      `
      INSERT INTO sessions (
        user_id,
        mode,
        exam,
        language,
        timed,
        time_limit_seconds,
        status,
        settings_json
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'in_progress', $7::jsonb
      )
      RETURNING
        session_id,
        user_id,
        mode,
        exam,
        language,
        timed,
        time_limit_seconds,
        status,
        settings_json,
        started_at,
        submitted_at
      `,
      [
        userId,
        body.mode,
        body.exam,
        body.language,
        derived.timed,
        derived.time_limit_seconds,
        JSON.stringify(derived.settings_json),
      ]
    );

    return NextResponse.json(created.rows[0], { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);

    const sessions = await query(
      `
      SELECT
        session_id,
        user_id,
        mode,
        exam,
        language,
        timed,
        time_limit_seconds,
        status,
        settings_json,
        started_at,
        submitted_at
      FROM sessions
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 20
      `,
      [userId]
    );

    return NextResponse.json({ sessions: sessions.rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}