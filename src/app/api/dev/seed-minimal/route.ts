import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await withTx(async (client) => {
      // 1) question
      const q = await client.query(
        `
        INSERT INTO questions (canonical_code, status)
        VALUES ($1, 'published')
        RETURNING question_id
        `,
        [`DEV_STEP1_${Date.now()}`]
      );
      const questionId = q.rows[0].question_id as string;

      // 2) question_version
      const qv = await client.query(
        `
        INSERT INTO question_versions (
          question_id, version, exam, language, difficulty, stem,
          explanation_short, explanation_long, is_active
        )
        VALUES (
          $1, 1, 'step1', 'en', 'medium',
          $2,
          $3,
          $4,
          true
        )
        RETURNING question_version_id
        `,
        [
          questionId,
          "A 24-year-old develops muscle cramps and carpopedal spasm after hyperventilation. Which change explains the symptoms?",
          "Acute respiratory alkalosis decreases ionized calcium.",
          "Hyperventilation lowers CO2, increasing blood pH. Albumin binds more Ca2+ at higher pH, reducing ionized calcium and causing neuromuscular irritability.",
        ]
      );
      const questionVersionId = qv.rows[0].question_version_id as string;

      // 3) choices (A-D)
      const choices = [
        { label: "A", text: "Increased ionized calcium due to decreased albumin binding", correct: false },
        { label: "B", text: "Decreased ionized calcium due to increased albumin binding", correct: true },
        { label: "C", text: "Increased potassium shift out of cells due to alkalosis", correct: false },
        { label: "D", text: "Decreased bicarbonate reabsorption due to respiratory alkalosis", correct: false },
      ];

      for (const c of choices) {
        await client.query(
          `
          INSERT INTO question_choices (
            question_version_id, label, choice_text, is_correct
          )
          VALUES ($1, $2, $3, $4)
          `,
          [questionVersionId, c.label, c.text, c.correct]
        );
      }

      return { questionId, questionVersionId, createdChoices: choices.length };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
