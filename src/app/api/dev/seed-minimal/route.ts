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
 *   "source": "pilot_import",
 *   "questions": [
 *     {
 *       "source": "optional_per_question_source",
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
 *   "requireExactlyTen": true,
 *   "requireBibliography": false,
 *   "allowSeedDevSource": false
 * }
 *
 * Current pilot behavior:
 * - By default, requires exactly 10 questions.
 * - Set requireExactlyTen=false for larger controlled imports.
 *
 * Data behavior:
 * - Imported questions default to source='pilot_import'.
 * - body.source can set a batch-level source.
 * - question.source can override the batch source per question.
 * - source='seed_dev' is blocked unless allowSeedDevSource=true.
 * - question_versions are inserted as active, exam='step1', language='en'.
 * - bibliography is serialized explicitly before inserting into json/jsonb.
 *
 * Quality gate:
 * - Rejects placeholder content such as TBD, placeholder, lorem ipsum.
 * - Rejects very short stems.
 * - Rejects very short explanations.
 * - Requires 4 or 5 choices.
 * - Requires exactly one correct choice.
 * - Requires sequential labels starting at A.
 * - Requires non-empty, non-placeholder explanations for each choice.
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

type InsertedQuestion = {
  questionId: string;
  questionVersionId: string;
  canonical_code: string;
  source: string;
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
  source: string;
  sources: string[];
  requested: number;
  created: number;
  chunks: number;
  elapsed_ms: number;
  quality_gate: string;
  sample: Array<{
    question_id: string;
    question_version_id: string;
    canonical_code: string;
    source: string;
  }>;
  note: string;
};

type QualityIssue = {
  index: number;
  field: string;
  message: string;
  value_preview?: string;
};

const DEFAULT_IMPORT_SOURCE = "pilot_import";
const BLOCKED_DEFAULT_SOURCE = "seed_dev";

const MIN_STEM_CHARS = 120;
const MIN_STEM_WORDS = 18;
const MIN_EXPLANATION_SHORT_CHARS = 40;
const MIN_EXPLANATION_LONG_CHARS = 120;
const MIN_CHOICE_EXPLANATION_CHARS = 30;

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

const ImportSourceSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message:
      "source must start with a letter or number and contain only letters, numbers, underscores, or hyphens.",
  });

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
    source: ImportSourceSchema.optional(),
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
    source: ImportSourceSchema.optional().default(DEFAULT_IMPORT_SOURCE),
    questions: z.array(ImportQuestionSchema).min(1).max(5000),
    chunkSize: z.coerce.number().int().min(1).max(500).optional(),
    requireExactlyTen: z.boolean().optional(),
    requireBibliography: z.boolean().optional().default(false),
    allowSeedDevSource: z.boolean().optional().default(false),
  })
  .strict();

type ImportQuestion = z.infer<typeof ImportQuestionSchema>;
type ImportBody = z.infer<typeof BodySchema>;

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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string): number {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return 0;
  }

  return normalized.split(" ").filter(Boolean).length;
}

function preview(value: string, maxLength = 120): string {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

function hasPlaceholderContent(value: string): boolean {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (!normalized) {
    return true;
  }

  const patterns = [
    /\btbd\b/i,
    /\bto be determined\b/i,
    /\bplaceholder\b/i,
    /\blorem ipsum\b/i,
    /\bcoming soon\b/i,
    /\bfixme\b/i,
    /\btodo\b/i,
    /\bn\/a\b/i,
    /\bnot available\b/i,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

function hasMeaningfulBibliography(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return normalizeWhitespace(value).length >= 10;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return false;
}

function resolveQuestionSource(bodySource: string, question: ImportQuestion) {
  return question.source ?? bodySource;
}

function canonicalPrefixFromSource(source: string): string {
  const cleaned = source
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  return cleaned.length > 0 ? cleaned.slice(0, 48) : "IMPORT";
}

function validateQuestionQuality(
  question: ImportQuestion,
  index: number,
  source: string,
  body: ImportBody
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (source === BLOCKED_DEFAULT_SOURCE && !body.allowSeedDevSource) {
    issues.push({
      index,
      field: "source",
      message:
        "source='seed_dev' is blocked by default. Use 'pilot_import', 'manual_reviewed', or a batch-specific source.",
      value_preview: source,
    });
  }

  if (hasPlaceholderContent(source)) {
    issues.push({
      index,
      field: "source",
      message: "Question source contains placeholder content.",
      value_preview: source,
    });
  }

  if (hasPlaceholderContent(question.stem)) {
    issues.push({
      index,
      field: "stem",
      message: "Question stem contains placeholder content.",
      value_preview: preview(question.stem),
    });
  }

  if (question.stem.length < MIN_STEM_CHARS) {
    issues.push({
      index,
      field: "stem",
      message: `Question stem is too short for USMLE-style content. Minimum: ${MIN_STEM_CHARS} characters.`,
      value_preview: preview(question.stem),
    });
  }

  if (countWords(question.stem) < MIN_STEM_WORDS) {
    issues.push({
      index,
      field: "stem",
      message: `Question stem has too few words for USMLE-style content. Minimum: ${MIN_STEM_WORDS} words.`,
      value_preview: preview(question.stem),
    });
  }

  if (hasPlaceholderContent(question.explanation_short)) {
    issues.push({
      index,
      field: "explanation_short",
      message: "Short explanation contains placeholder content.",
      value_preview: preview(question.explanation_short),
    });
  }

  if (question.explanation_short.length < MIN_EXPLANATION_SHORT_CHARS) {
    issues.push({
      index,
      field: "explanation_short",
      message: `Short explanation is too short. Minimum: ${MIN_EXPLANATION_SHORT_CHARS} characters.`,
      value_preview: preview(question.explanation_short),
    });
  }

  if (hasPlaceholderContent(question.explanation_long)) {
    issues.push({
      index,
      field: "explanation_long",
      message: "Long explanation contains placeholder content.",
      value_preview: preview(question.explanation_long),
    });
  }

  if (question.explanation_long.length < MIN_EXPLANATION_LONG_CHARS) {
    issues.push({
      index,
      field: "explanation_long",
      message: `Long explanation is too short. Minimum: ${MIN_EXPLANATION_LONG_CHARS} characters.`,
      value_preview: preview(question.explanation_long),
    });
  }

  if (body.requireBibliography && !hasMeaningfulBibliography(question.bibliography)) {
    issues.push({
      index,
      field: "bibliography",
      message:
        "Bibliography is required for this import, but this question has no meaningful bibliography.",
    });
  }

  if (question.choices.length < 4 || question.choices.length > 5) {
    issues.push({
      index,
      field: "choices",
      message: "Question must have 4 or 5 choices.",
    });
  }

  const correctCount = question.choices.filter((choice) => choice.correct).length;

  if (correctCount !== 1) {
    issues.push({
      index,
      field: "choices",
      message: "Question must have exactly 1 correct choice.",
      value_preview: `correct_count=${correctCount}`,
    });
  }

  const labels = question.choices.map((choice) => choice.label);
  const uniqueLabels = new Set(labels);

  if (uniqueLabels.size !== labels.length) {
    issues.push({
      index,
      field: "choices.label",
      message: "Choice labels must be unique per question.",
      value_preview: labels.join(", "),
    });
  }

  const expectedOrder = ["A", "B", "C", "D", "E"].slice(0, labels.length);

  for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
    if (labels[labelIndex] !== expectedOrder[labelIndex]) {
      issues.push({
        index,
        field: "choices.label",
        message: `Choice labels must be sequential starting at A. Expected ${expectedOrder.join(
          ", "
        )}.`,
        value_preview: labels.join(", "),
      });
      break;
    }
  }

  question.choices.forEach((choice, choiceIndex) => {
    const fieldPrefix = `choices[${choiceIndex}].`;

    if (hasPlaceholderContent(choice.text)) {
      issues.push({
        index,
        field: `${fieldPrefix}text`,
        message: "Choice text contains placeholder content.",
        value_preview: preview(choice.text),
      });
    }

    if (hasPlaceholderContent(choice.explanation)) {
      issues.push({
        index,
        field: `${fieldPrefix}explanation`,
        message: "Choice explanation contains placeholder content.",
        value_preview: preview(choice.explanation),
      });
    }

    if (choice.explanation.length < MIN_CHOICE_EXPLANATION_CHARS) {
      issues.push({
        index,
        field: `${fieldPrefix}explanation`,
        message: `Choice explanation is too short. Minimum: ${MIN_CHOICE_EXPLANATION_CHARS} characters.`,
        value_preview: preview(choice.explanation),
      });
    }
  });

  return issues;
}

function validateImportQuality(body: ImportBody): QualityIssue[] {
  const issues: QualityIssue[] = [];

  body.questions.forEach((question, index) => {
    const source = resolveQuestionSource(body.source, question);

    issues.push(
      ...validateQuestionQuality(question, index + 1, source, body)
    );
  });

  return issues;
}

function assertValidQuestion(
  question: ImportQuestion,
  source: string,
  body: ImportBody
) {
  const issues = validateQuestionQuality(question, 0, source, body);

  if (issues.length > 0) {
    throw new Error(
      `Question failed quality validation: ${issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join("; ")}`
    );
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
  question: ImportQuestion,
  source: string,
  body: ImportBody
): Promise<InsertedQuestion> {
  assertValidQuestion(question, source, body);

  const canonicalPrefix = canonicalPrefixFromSource(source);
  const canonicalCode = `${canonicalPrefix}_STEP1_${randomUUID()}`;

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
      $2
    )
    RETURNING question_id
    `,
    [canonicalCode, source]
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
    source,
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

    const qualityIssues = validateImportQuality(body);

    if (qualityIssues.length > 0) {
      return errorJson(
        "QUESTION_QUALITY_FAILED",
        "Import blocked by quality gate. Fix the listed issues before importing.",
        {
          total_issues: qualityIssues.length,
          issues: qualityIssues.slice(0, 100),
          omitted_issues: Math.max(0, qualityIssues.length - 100),
        },
        422
      );
    }

    const chunkSize = body.chunkSize ?? 10;
    const totalCount = body.questions.length;

    let createdCount = 0;

    const sample: Array<{
      question_id: string;
      question_version_id: string;
      canonical_code: string;
      source: string;
    }> = [];

    const sources = new Set<string>();

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
          source: string;
        }> = [];

        const chunkSources = new Set<string>();

        for (const question of chunkQuestions) {
          const source = resolveQuestionSource(body.source, question);
          const inserted = await insertOne(client, question, source, body);

          chunkCreated += 1;
          chunkSources.add(source);

          if (sample.length + chunkSample.length < 5) {
            chunkSample.push({
              question_id: inserted.questionId,
              question_version_id: inserted.questionVersionId,
              canonical_code: inserted.canonical_code,
              source: inserted.source,
            });
          }
        }

        return {
          chunkCreated,
          chunkSample,
          chunkSources: [...chunkSources],
        };
      });

      createdCount += chunkResult.chunkCreated;

      for (const item of chunkResult.chunkSample) {
        if (sample.length < 5) {
          sample.push(item);
        }
      }

      for (const source of chunkResult.chunkSources) {
        sources.add(source);
      }

      remaining -= thisChunk;
      cursor += thisChunk;
    }

    const elapsedMs = Date.now() - startedAt;

    const sourceList = [...sources].sort();

    const payload: SuccessPayload = {
      ok: true,
      seed_route_version: "import_only_v3_quality_source_control",
      mode: "import",
      source: body.source,
      sources: sourceList,
      requested: totalCount,
      created: createdCount,
      chunks: Math.ceil(totalCount / chunkSize),
      elapsed_ms: elapsedMs,
      quality_gate: "enabled",
      sample,
      note:
        "Import-only endpoint. Questions must be authored externally and sent in JSON. Imported questions default to source='pilot_import'; source='seed_dev' is blocked unless allowSeedDevSource=true.",
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