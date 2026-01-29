import { NextResponse } from "next/server";
import { z } from "zod";
import { withTx } from "@/lib/db";
import { getUserIdForApi } from "@/lib/auth";

const QuerySchema = z.object({
  range: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30),
});

// GET /api/me/stats?range=30
// MVP: overall + by_exam (somente sessões submitted)
export async function GET(req: Request) {
  try {
    const userId = await getUserIdForApi(req);
    const url = new URL(req.url);

    const parsed = QuerySchema.parse({
      range: url.searchParams.get("range") ?? undefined,
    });
    const rangeDays = parsed.range;

    const result = await withTx(async (client) => {
      // Overall
      const overallRes = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE a.result IN ('correct','wrong','skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        JOIN sessions s ON s.session_id = a.session_id
        WHERE a.user_id = $1
          AND s.status = 'submitted'
          AND s.submitted_at >= (now() - ($2 || ' days')::interval)
        `,
        [userId, String(rangeDays)]
      );

      const o = overallRes.rows[0] ?? {
        answered: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        avg_time_seconds: 0,
      };

      const answered = Number(o.answered ?? 0);
      const correct = Number(o.correct ?? 0);
      const accuracy = answered > 0 ? correct / answered : 0;

      // By exam
      const byExamRes = await client.query(
        `
        SELECT
          s.exam,
          COUNT(*) FILTER (WHERE a.result IN ('correct','wrong','skipped'))::int AS answered,
          COUNT(*) FILTER (WHERE a.result = 'correct')::int AS correct,
          COUNT(*) FILTER (WHERE a.result = 'wrong')::int AS wrong,
          COUNT(*) FILTER (WHERE a.result = 'skipped')::int AS skipped,
          COALESCE(AVG(a.time_spent_seconds), 0)::float AS avg_time_seconds
        FROM attempts a
        JOIN sessions s ON s.session_id = a.session_id
        WHERE a.user_id = $1
          AND s.status = 'submitted'
          AND s.submitted_at >= (now() - ($2 || ' days')::interval)
        GROUP BY s.exam
        ORDER BY s.exam ASC
        `,
        [userId, String(rangeDays)]
      );

      const by_exam = (byExamRes.rows ?? []).map((r: any) => {
        const ans = Number(r.answered ?? 0);
        const cor = Number(r.correct ?? 0);
        return {
          exam: r.exam,
          answered: ans,
          correct: cor,
          wrong: Number(r.wrong ?? 0),
          skipped: Number(r.skipped ?? 0),
          accuracy: ans > 0 ? cor / ans : 0,
          avg_time_seconds: Number(r.avg_time_seconds ?? 0),
        };
      });

      return {
        status: 200 as const,
        payload: {
          range_days: rangeDays,
          overall: {
            answered,
            correct,
            wrong: Number(o.wrong ?? 0),
            skipped: Number(o.skipped ?? 0),
            accuracy,
            avg_time_seconds: Number(o.avg_time_seconds ?? 0),
          },
          by_exam,
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
