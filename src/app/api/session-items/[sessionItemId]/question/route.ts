import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { sessionItemId: string } }
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionItemId } = params;

    const result = await withTx(async (client) => {
      // 1) item + valida dono da sessão + status da sessão
      const itemRes = await client.query(
        `
        SELECT
          si.session_item_id, si.session_id, si.position, si.question_version_id,
          s.user_id, s.status
        FROM session_items si
        JOIN sessions s ON s.session_id = si.session_id
        WHERE si.session_item_id = $1
        `,
        [sessionItemId]
      );

      if (itemRes.rowCount === 0) {
        return {
          status: 404 as const,
          payload: { error: "Session item not found" },
        };
      }

      const item = itemRes.rows[0] as {
        session_item_id: string;
        session_id: string;
        position: number;
        question_version_id: string;
        user_id: string;
        status: string;
      };

      if (item.user_id !== userId) {
        return { status: 403 as const, payload: { error: "Forbidden" } };
      }

      // 2) question_version (SEM explicações para não vazar gabarito)
      const qvRes = await client.query(
        `
        SELECT
          question_version_id, exam, language, difficulty,
          stem
        FROM question_versions
        WHERE question_version_id = $1
        `,
        [item.question_version_id]
      );

      if (qvRes.rowCount === 0) {
        return {
          status: 500 as const,
          payload: { error: "Question version not found (data integrity)" },
        };
      }

      // 3) choices (sem is_correct)
      const choicesRes = await client.query(
        `
        SELECT choice_id, label, choice_text
        FROM question_choices
        WHERE question_version_id = $1
        ORDER BY label ASC
        `,
        [item.question_version_id]
      );

      return {
        status: 200 as const,
        payload: {
          session_item: {
            session_item_id: item.session_item_id,
            session_id: item.session_id,
            position: item.position,
            question_version_id: item.question_version_id,
          },
          question: qvRes.rows[0], // <- sem explanation_short/long
          choices: choicesRes.rows,
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
