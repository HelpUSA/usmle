// src/app/api/dev/seed-minimal/route.ts
//
// DEV Seed Import Endpoint (import-only)
//
// Objetivo:
// - Importar questões (longas, estilo Step 1) a partir de JSON.
// - Não gera questões no código.
//
// Segurança:
// - Requer header: x-admin-key == process.env.ADMIN_SEED_KEY
//
// Body:
// {
//   "questions": [
//     {
//       "stem": "...",
//       "difficulty": "easy"|"medium"|"hard",
//       "explanation_short": "...",
//       "explanation_long": "...",
//       "bibliography": {...} | [...] ,   // opcional (json)
//       "prompt": "...",                  // opcional (string) OU null (será tratado como ausente)
//       "choices": [
//         {"label":"A","text":"...","correct":false,"explanation":"why wrong..."},
//         {"label":"B","text":"...","correct":true ,"explanation":"why correct..."},
//         {"label":"C","text":"...","correct":false,"explanation":"why wrong..."},
//         {"label":"D","text":"...","correct":false,"explanation":"why wrong..."}
//       ]
//     }
//   ],
//   "chunkSize": 10,
//   "requireExactlyTen": true
// }
//
// Importante:
// - Por padrão, exige exatamente 10 questões para o "pilot".
// - Depois a gente remove/relaxa essa trava.
//
// Bugfix (prompt null):
// - Seu JSON pode ter "prompt": null.
// - zod `z.string().optional()` NÃO aceita null (só undefined).
// - Então aceitamos null e normalizamos para undefined.
//
// Bugfix (bibliography JSON no Postgres):
// - Colunas json/jsonb no Postgres exigem JSON válido.
// - O driver `pg` nem sempre serializa objetos JS automaticamente.
// - Então: JSON.stringify + cast ::json no INSERT.
//
// Nota de runtime:
// - Este endpoint usa `pg` (node-only). Garanta runtime NodeJS.
// - Sem isso, Vercel pode tentar Edge e causar erros/intermitência.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "crypto";

type Difficulty = "easy" | "medium" | "hard";
type ChoiceLabel = "A" | "B" | "C" | "D" | "E";

type ImportQuestion = {
  stem: string;
  difficulty: Difficulty;
  explanation_short: string;
  explanation_long: string;
  bibliography?: any;
  prompt?: string; // internamente: string | undefined (null é normalizado)
  choices: Array<{
    label: ChoiceLabel;
    text: string;
    correct: boolean;
    explanation: string;
  }>;
};

const ChoiceSchema = z.object({
  label: z.enum(["A", "B", "C", "D", "E"]),
  text: z.string().min(1),
  correct: z.boolean(),
  explanation: z.string().min(1),
});

const ImportQuestionSchema = z.object({
  stem: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation_short: z.string().min(1),
  explanation_long: z.string().min(1),
  bibliography: z.any().optional(),

  // ✅ aceita string OU null e normaliza para undefined
  prompt: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === null ? undefined : v)),

  choices: z.array(ChoiceSchema).min(4).max(5),
});

const BodySchema = z.object({
  questions: z.array(ImportQuestionSchema).min(1).max(5000),
  chunkSize: z.number().int().min(1).max(500).optional(),
  requireExactlyTen: z.boolean().optional(),
});

function assertValidQuestion(q: ImportQuestion) {
  if (q.choices.length < 4 || q.choices.length > 5) {
    throw new Error("Question must have 4 or 5 choices.");
  }

  const correctCount = q.choices.filter((c) => c.correct).length;
  if (correctCount !== 1) {
    throw new Error("Question must have exactly 1 correct choice.");
  }

  const labels = q.choices.map((c) => c.label);
  const unique = new Set(labels);
  if (unique.size !== labels.length) {
    throw new Error("Choice labels must be unique per question.");
  }

  for (const c of q.choices) {
    if (!c.explanation || c.explanation.trim().length === 0) {
      throw new Error("Each choice must include a non-empty explanation.");
    }
  }
}

async function insertOne(client: any, q: ImportQuestion) {
  assertValidQuestion(q);

  const canonical = `DEV_STEP1_${randomUUID()}`;

  // 1) questions
  const qRes = await client.query(
    `
    INSERT INTO questions (canonical_code, status)
    VALUES ($1, 'published')
    RETURNING question_id
    `,
    [canonical]
  );
  const questionId = qRes.rows[0].question_id as string;

  // ✅ bibliography precisa ser JSON válido para coluna json/jsonb
  const bibliographyJson =
    q.bibliography === undefined || q.bibliography === null
      ? null
      : JSON.stringify(q.bibliography);

  // 2) question_versions
  // Observação:
  // - $7::json força validação/cast no Postgres.
  // - Se sua coluna for jsonb e você quiser, pode trocar ::json por ::jsonb.
  const qvRes = await client.query(
    `
    INSERT INTO question_versions (
      question_id, version, exam, language, difficulty, stem,
      explanation_short, explanation_long, bibliography, prompt,
      is_active
    )
    VALUES (
      $1, 1, 'step1', 'en',
      $2, $3, $4, $5, $6, $7::json, $8,
      true
    )
    RETURNING question_version_id
    `,
    [
      questionId,
      q.difficulty,
      q.stem,
      q.explanation_short,
      q.explanation_long,
      bibliographyJson, // ✅ json string ou null
      q.prompt ?? null, // ✅ null no banco se prompt ausente
    ]
  );
  const questionVersionId = qvRes.rows[0].question_version_id as string;

  // 3) question_choices
  const values: string[] = [];
  const params: any[] = [questionVersionId];
  let p = 2;

  for (const c of q.choices) {
    values.push(`($1, $${p++}, $${p++}, $${p++}, $${p++})`);
    params.push(c.label, c.text, c.correct, c.explanation);
  }

  await client.query(
    `
    INSERT INTO question_choices (
      question_version_id,
      label,
      choice_text,
      is_correct,
      explanation
    )
    VALUES ${values.join(", ")}
    `,
    params
  );

  return { questionId, questionVersionId, canonical_code: canonical };
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bodyJson = await req.json();
    const body = BodySchema.parse(bodyJson);

    // trava do piloto: exige 10 questões
    const requireExactlyTen = body.requireExactlyTen ?? true;
    if (requireExactlyTen && body.questions.length !== 10) {
      return NextResponse.json(
        {
          error: `Pilot mode requires exactly 10 questions. Received: ${body.questions.length}`,
        },
        { status: 400 }
      );
    }

    const chunkSize = body.chunkSize ?? 10;
    const totalCount = body.questions.length;

    let createdCount = 0;
    const sample: Array<{
      question_id: string;
      question_version_id: string;
      canonical_code: string;
    }> = [];

    let remaining = totalCount;
    let cursor = 0;

    while (remaining > 0) {
      const thisChunk = Math.min(chunkSize, remaining);

      const chunkResult = await withTx(async (client) => {
        let chunkCreated = 0;
        const chunkSample: Array<{
          question_id: string;
          question_version_id: string;
          canonical_code: string;
        }> = [];

        for (let i = 0; i < thisChunk; i++) {
          const q = body.questions[cursor + i] as ImportQuestion;
          const ins = await insertOne(client, q);
          chunkCreated += 1;

          if (sample.length + chunkSample.length < 5) {
            chunkSample.push({
              question_id: ins.questionId,
              question_version_id: ins.questionVersionId,
              canonical_code: ins.canonical_code,
            });
          }
        }

        return { chunkCreated, chunkSample };
      });

      createdCount += chunkResult.chunkCreated;
      for (const s of chunkResult.chunkSample) {
        if (sample.length < 5) sample.push(s);
      }

      remaining -= thisChunk;
      cursor += thisChunk;
    }

    const ms = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        seed_route_version: "import_only_v1_pilot10",
        mode: "import",
        requested: totalCount,
        created: createdCount,
        chunks: Math.ceil(totalCount / chunkSize),
        elapsed_ms: ms,
        sample,
        note:
          "Import-only: nenhum template/geração no código. As 10 questões devem vir no JSON.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    const ms = Date.now() - startedAt;

    // ✅ log útil no Vercel (sem segredos)
    console.error("[seed-minimal] error", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      elapsed_ms: ms,
    });

    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
