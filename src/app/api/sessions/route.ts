import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

const CreateSessionSchema = z.object({
  mode: z.enum(["practice", "timed_block", "exam_sim"]),
  exam: z.enum(["step1", "step2ck"]),
  language: z.string().default("en"),
  timed: z.boolean().default(false),
  time_limit_seconds: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    const bodyJson = await req.json().catch(() => ({}));
    const body = CreateSessionSchema.parse(bodyJson);

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
        user_id, mode, exam, language, timed, time_limit_seconds, status, settings_json
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'in_progress', '{}'::jsonb
      )
      RETURNING
        session_id, user_id, mode, exam, language, timed, time_limit_seconds,
        status, settings_json, started_at, submitted_at
      `,
      [
        userId,
        body.mode,
        body.exam,
        body.language,
        body.timed,
        body.time_limit_seconds ?? null,
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
        session_id, user_id, mode, exam, language, timed, time_limit_seconds,
        status, settings_json, started_at, submitted_at
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
