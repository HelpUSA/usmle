/*
 * File: src/app/api/dev/seed-minimal/route.ts
 *
 * Responsibility:
 * - Import externally authored USMLE-style questions from JSON.
 * - Does not generate questions in code.
 * - Inserts:
 *   - questions;
 *   - question_versions;
 *   - question_choices.
 *
 * API contract:
 * - POST /api/dev/seed-minimal
 *
 * Required header:
 * - x-admin-key: must match process.env.ADMIN_SEED_KEY.
 *
 * Production security:
 * - This is a dev/admin import endpoint.
 * - It is blocked in production by default.
 * - To allow a controlled production import, set:
 *   ADMIN_SEED_ALLOW_PRODUCTION=true
 *
 * Body:
 * {
 *   "questions": [
 *     {
 *       "stem": "...",
 *       "difficulty": "easy" | "medium" | "hard",
 *       "explanation_short": "...",
 *       "explanation_long": "...",
 *       "bibliography": {...} | [...] | null,
 *       "prompt": "..." | null,
 *       "choices": [
 *         { "label": "A", "text": "...", "correct": false, "explanation": "..." },
 *         { "label": "B", "text": "...", "correct": true,  "explanation": "..." },
 *         { "label": "C", "text": "...", "correct": false, "explanation": "..." },
 *         { "label": "D", "text": "...", "correct": false, "explanation": "..." }
 *       ]
 *     }
 *   ],
 *   "chunkSize": 10,
 *   "requireExactlyTen": true
 * }
 *
 * Current pilot behavior:
 * - By default, requires exactly 10 questions.
 * - Set requireExactlyTen=false for larger controlled imports.
 *
 * Data behavior:
 * - Imported questions are marked as source='seed_dev'.
 * - question_versions are inserted as active, exam='step1', language='en'.
 * - bibliography is serialized explicitly before inserting into json/jsonb.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { z, ZodError } from "zod";
import { randomUUID, timingSafeEqual } from "crypto";

type DbClient = Parameters<Parameters<typeof withTx>[0]>[0];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type Difficulty = "easy" | "medium" | "hard";
type ChoiceLabel = "A" | "B" | "C" | "D" | "E";

type ImportQuestion = {
  stem: string;
  difficulty: Difficulty;
  explanation_short: string;
  explanation_long: string;
  bibliography?: JsonValue;
  prompt?: string;
  choices: Array<{
    label: ChoiceLabel;
    text: string;
    correct: boolean;
    explanation: string;
  }>;
};

type InsertedQuestion = {
  questionId: string;
  questionVersionId: string;
  canonical_code: string;
};

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type SuccessPayload = {
  ok: true;
  seed_route_version: string;
  mode: "import";
  requested: number;
  created: number;
  chunks: number;
  elapsed_ms: number;
  sample: Array<{
    question_id: string;
    question_version_id: string;
    canonical_code: string;
  }>;
  note: string;
};

function errorJson(
  code: string,
  message: string,
  details?: unknown,
  status = 400
) {
  const payload: ErrorPayload = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };

  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

const JsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(JsonSchema),
  ])
);

const ChoiceSchema = z
  .object({
    label: z.enum(["A", "B", "C", "D", "E"]),
    text: z.string().trim().min(1),
    correct: z.boolean(),
    explanation: z.string().trim().min(1),
  })
  .strict();

const ImportQuestionSchema = z
  .object({
    stem: z.string().trim().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    explanation_short: z.string().trim().min(1),
    explanation_long: z.string().trim().min(1),
    bibliography: JsonSchema.optional(),

    /*
     * Accepts string, null, or omitted.
     * Internally normalizes null/empty string to undefined.
     */
    prompt: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value === null || value === undefined) return undefined;

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }),

    choices: z.array(ChoiceSchema).min(4).max(5),
  })
  .strict();

const BodySchema = z
  .object({
    questions: z.array(ImportQuestionSchema).min(1).max(5000),
    chunkSize: z.coerce.number().int().min(1).max(500).optional(),
    requireExactlyTen: z.boolean().optional(),
  })
  .strict();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isProductionImportAllowed(): boolean {
  return process.env.ADMIN_SEED_ALLOW_PRODUCTION === "true";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function validateAdminAccess(req: Request) {
  if (isProduction() && !isProductionImportAllowed()) {
    return {
      ok: false as const,
      response: errorJson("NOT_FOUND", "Not found", undefined, 404),
    };
  }

  const configuredAdminKey = process.env.ADMIN_SEED_KEY?.trim();

  if (!configuredAdminKey) {
    return {
      ok: false as const,
      response: errorJson(
        "ADMIN_SEED_KEY_MISSING",
        "ADMIN_SEED_KEY is not configured.",
        undefined,
        500
      ),
    };
  }

  if (isProduction() && configuredAdminKey.length < 32) {
    return {
      ok: false as const,
      response: errorJson(
        "ADMIN_SEED_KEY_WEAK",
        "ADMIN_SEED_KEY must be at least 32 characters in production.",
        undefined,
        500
      ),
    };
  }

  const providedAdminKey = req.headers.get("x-admin-key")?.trim() ?? "";

  if (!providedAdminKey || !safeEqual(providedAdminKey, configuredAdminKey)) {
    return {
      ok: false as const,
      response: errorJson(
        "AUTH_FORBIDDEN",
        "Invalid or missing x-admin-key.",
        { has_admin_key: Boolean(providedAdminKey) },
        403
      ),
    };
  }

  return { ok: true as const };
}

function assertValidQuestion(question: ImportQuestion) {
  if (question.choices.length < 4 || question.choices.length > 5) {
    throw new Error("Question must have 4 or 5 choices.");
  }

  const correctCount = question.choices.filter((choice) => choice.correct).length;

  if (correctCount !== 1) {
    throw new Error("Question must have exactly 1 correct choice.");
  }

  const labels = question.choices.map((choice) => choice.label);
  const uniqueLabels = new Set(labels);

  if (uniqueLabels.size !== labels.length) {
    throw new Error("Choice labels must be unique per question.");
  }

  const expectedOrder = ["A", "B", "C", "D", "E"].slice(0, labels.length);

  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] !== expectedOrder[index]) {
      throw new Error(
        `Choice labels must be sequential starting at A. Expected ${expectedOrder.join(
          ", "
        )}.`
      );
    }
  }

  for (const choice of question.choices) {
    if (!choice.explanation || choice.explanation.trim().length === 0) {
      throw new Error("Each choice must include a non-empty explanation.");
    }
  }
}

function serializeBibliography(value: JsonValue | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

async function insertOne(
  client: DbClient,
  question: ImportQuestion
): Promise<InsertedQuestion> {
  assertValidQuestion(question);

  const canonicalCode = `DEV_STEP1_${randomUUID()}`;

  const questionResult = await client.query<{ question_id: string }>(
    `
    INSERT INTO questions (
      canonical_code,
      status,
      source
    )
    VALUES (
      $1,
      'published',
      'seed_dev'
    )
    RETURNING question_id
    `,
    [canonicalCode]
  );

  if (questionResult.rows.length === 0) {
    throw new Error("Failed to insert question.");
  }

  const questionId = questionResult.rows[0].question_id;
  const bibliographyJson = serializeBibliography(question.bibliography);

  let questionVersionResult;

  try {
    questionVersionResult = await client.query<{
      question_version_id: string;
    }>(
      `
      INSERT INTO question_versions (
        question_id,
        version,
        exam,
        language,
        difficulty,
        stem,
        explanation_short,
        explanation_long,
        bibliography,
        prompt,
        is_active
      )
      VALUES (
        $1,
        1,
        'step1',
        'en',
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        true
      )
      RETURNING question_version_id
      `,
      [
        questionId,
        question.difficulty,
        question.stem,
        question.explanation_short,
        question.explanation_long,
        bibliographyJson,
        question.prompt ?? null,
      ]
    );
  } catch {
    questionVersionResult = await client.query<{
      question_version_id: string;
    }>(
      `
      INSERT INTO question_versions (
        question_id,
        version,
        exam,
        language,
        difficulty,
        stem,
        explanation_short,
        explanation_long,
        bibliography,
        prompt,
        is_active
      )
      VALUES (
        $1,
        1,
        'step1',
        'en',
        $2,
        $3,
        $4,
        $5,
        $6::json,
        $7,
        true
      )
      RETURNING question_version_id
      `,
      [
        questionId,
        question.difficulty,
        question.stem,
        question.explanation_short,
        question.explanation_long,
        bibliographyJson,
        question.prompt ?? null,
      ]
    );
  }

  if (questionVersionResult.rows.length === 0) {
    throw new Error("Failed to insert question_version.");
  }

  const questionVersionId =
    questionVersionResult.rows[0].question_version_id;

  const values: string[] = [];
  const params: Array<string | boolean> = [questionVersionId];

  let placeholderIndex = 2;

  for (const choice of question.choices) {
    values.push(
      `($1, $${placeholderIndex++}, $${placeholderIndex++}, $${placeholderIndex++}, $${placeholderIndex++})`
    );

    params.push(
      choice.label,
      choice.text,
      choice.correct,
      choice.explanation
    );
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

  return {
    questionId,
    questionVersionId,
    canonical_code: canonicalCode,
  };
}

function getErrorDetails(error: unknown) {
  if (error && typeof error === "object") {
    const maybeCode =
      "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    const maybeName =
      "name" in error && typeof error.name === "string"
        ? error.name
        : undefined;

    return {
      code: maybeCode,
      name: maybeName,
    };
  }

  return {};
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const adminAccess = validateAdminAccess(req);

    if (!adminAccess.ok) {
      return adminAccess.response;
    }

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const requireExactlyTen = body.requireExactlyTen ?? true;

    if (requireExactlyTen && body.questions.length !== 10) {
      return errorJson(
        "VALIDATION_FAILED",
        `Pilot mode requires exactly 10 questions. Received: ${body.questions.length}`,
        {
          received: body.questions.length,
          requireExactlyTen,
        },
        400
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

      const chunkQuestions = body.questions.slice(cursor, cursor + thisChunk);

      const chunkResult = await withTx(async (client) => {
        let chunkCreated = 0;

        const chunkSample: Array<{
          question_id: string;
          question_version_id: string;
          canonical_code: string;
        }> = [];

        for (const question of chunkQuestions) {
          const inserted = await insertOne(client, question);

          chunkCreated += 1;

          if (sample.length + chunkSample.length < 5) {
            chunkSample.push({
              question_id: inserted.questionId,
              question_version_id: inserted.questionVersionId,
              canonical_code: inserted.canonical_code,
            });
          }
        }

        return {
          chunkCreated,
          chunkSample,
        };
      });

      createdCount += chunkResult.chunkCreated;

      for (const item of chunkResult.chunkSample) {
        if (sample.length < 5) {
          sample.push(item);
        }
      }

      remaining -= thisChunk;
      cursor += thisChunk;
    }

    const elapsedMs = Date.now() - startedAt;

    const payload: SuccessPayload = {
      ok: true,
      seed_route_version: "import_only_v2_secure_seed_dev",
      mode: "import",
      requested: totalCount,
      created: createdCount,
      chunks: Math.ceil(totalCount / chunkSize),
      elapsed_ms: elapsedMs,
      sample,
      note:
        "Import-only endpoint. Questions must be authored externally and sent in JSON. Imported questions are marked source='seed_dev'.",
    };

    return NextResponse.json(payload, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const elapsedMs = Date.now() - startedAt;

    console.error("[seed-minimal] error", {
      message: getErrorMessage(error, "Unknown error"),
      ...getErrorDetails(error),
      elapsed_ms: elapsedMs,
    });

    if (error instanceof ZodError) {
      return errorJson(
        "VALIDATION_FAILED",
        "Request failed schema validation",
        { issues: error.issues },
        422
      );
    }

    return errorJson(
      "INTERNAL_ERROR",
      getErrorMessage(error, "Unknown error"),
      undefined,
      500
    );
  }
}