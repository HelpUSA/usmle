/**
 * Sessions Route (GET/POST)
 *
 * 📍 Localização:
 * src/app/api/sessions/route.ts
 *
 * Responsabilidades:
 * - POST: criar uma nova sessão de estudo
 * - GET: listar sessões recentes do usuário autenticado
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth"; // ✅ CORRETO

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
        time_limit_seconds: 60 * 60,
        settings_json: {
          review_strategy: "deferred",
          timer_visible: true,
          mode_semantics: "timed_block",
        },
      };

    case "exam_sim":
      return {
        timed: true,
        time_limit_seconds: 4 * 60 * 60,
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
    // ✅ AGORA FUNCIONA COM:
    // - header x-user-id
    // - sessão NextAuth
    const userId = await getUserIdForApi(req);

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
    const userId = await getUserIdForApi(req); // ✅ CORRETO

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