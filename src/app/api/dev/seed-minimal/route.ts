import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "crypto";

/**
 * DEV Seed / Import (POST)
 *
 * Objetivo:
 * - Popular o banco com questões originais estilo "Step 1-like" (vinhetas clínicas),
 *   SEM copiar ou derivar de conteúdo proprietário (NBME/USMLE/UWorld).
 * - OU importar um batch (>=100) via JSON padronizado, preenchendo:
 *   - question_versions.* (stem, explanations, optional bibliography/prompt)
 *   - question_choices.* (label, choice_text, is_correct, explanation)
 *
 * Segurança:
 * - Requer header: x-admin-key == process.env.ADMIN_SEED_KEY
 *
 * Body (opcional):
 * 1) Seed generator:
 * {
 *   "count": 1000,
 *   "chunkSize": 100
 * }
 *
 * 2) Import:
 * {
 *   "questions": [
 *     {
 *       "stem": "...",
 *       "difficulty": "easy"|"medium"|"hard",
 *       "explanation_short": "...",
 *       "explanation_long": "...",
 *       "bibliography": {...},   // opcional (json)
 *       "prompt": "...",         // opcional
 *       "choices": [
 *         {"label":"A","text":"...","correct":false,"explanation":"why wrong..."},
 *         {"label":"B","text":"...","correct":true ,"explanation":"why correct..."},
 *         {"label":"C","text":"...","correct":false,"explanation":"why wrong..."},
 *         {"label":"D","text":"...","correct":false,"explanation":"why wrong..."}
 *       ]
 *     }
 *   ],
 *   "chunkSize": 100
 * }
 *
 * Recomendação:
 * - Use chunks para evitar timeout em ambiente serverless.
 */

type Difficulty = "easy" | "medium" | "hard";
type ChoiceLabel = "A" | "B" | "C" | "D" | "E";

type GeneratedQuestion = {
  stem: string;
  difficulty: Difficulty;
  explanation_short: string;
  explanation_long: string;
  bibliography?: any;
  prompt?: string;
  choices: Array<{
    label: ChoiceLabel;
    text: string;
    correct: boolean;
    explanation: string; // why correct/why wrong
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
  prompt: z.string().optional(),
  choices: z.array(ChoiceSchema).min(4).max(5),
});

const BodySchema = z
  .object({
    count: z.number().int().min(1).max(5000).optional(),
    chunkSize: z.number().int().min(10).max(500).optional(),
    questions: z.array(ImportQuestionSchema).min(1).max(5000).optional(),
  })
  .optional();

// util simples
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assertValidQuestion(q: GeneratedQuestion) {
  // 4 ou 5 opções
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

function makeChoicesWithExplanations(args: {
  correct: { text: string; explanation: string };
  wrongs: Array<{ text: string; explanation: string }>;
  labels?: ChoiceLabel[]; // default A-D
}) {
  const labels = args.labels ?? ["A", "B", "C", "D"];
  const all = shuffle([args.correct, ...args.wrongs]).slice(0, labels.length);
  const correctIndex = all.findIndex((x) => x.text === args.correct.text);

  return all.map((item, idx) => ({
    label: labels[idx],
    text: item.text,
    correct: idx === correctIndex,
    explanation: item.explanation,
  }));
}

/**
 * Templates originais "Step1-like".
 * Observação: são vinhetas genéricas educativas (não são questões reais nem cópias).
 *
 * IMPORTANTE:
 * - Aqui cada alternativa agora tem explanation (why correct/why wrong).
 * - Isso alimenta question_choices.explanation e habilita o Review UX v2 completo.
 */
const TEMPLATES: Array<() => GeneratedQuestion> = [
  // 1) Acid-base
  () => {
    const age = pick([18, 22, 24, 27, 30, 34]);
    const trigger = pick([
      "panic attack",
      "pain episode",
      "high altitude exposure",
      "anxiety before a procedure",
    ]);
    const stem = `A ${age}-year-old develops perioral tingling, muscle cramps, and carpopedal spasm shortly after hyperventilating during a ${trigger}. Arterial blood gas shows decreased PaCO2. Which change best explains the symptoms?`;

    const correct = {
      text: "Decreased ionized calcium due to increased albumin binding at higher pH",
      explanation:
        "Respiratory alkalosis raises blood pH, increasing albumin binding of Ca2+ and lowering ionized calcium, which increases neuromuscular excitability.",
    };

    const wrongs = [
      {
        text: "Increased ionized calcium due to decreased albumin binding",
        explanation:
          "Alkalosis does the opposite: it increases albumin binding and lowers ionized calcium, not increases it.",
      },
      {
        text: "Increased potassium shift out of cells due to alkalosis",
        explanation:
          "Alkalosis tends to shift potassium into cells (leading to hypokalemia), not out of cells.",
      },
      {
        text: "Decreased bicarbonate reabsorption as the primary acute compensation",
        explanation:
          "Acute respiratory alkalosis is primarily buffered immediately; renal bicarbonate loss is a delayed compensation over hours to days.",
      },
      {
        text: "Increased chloride reabsorption causing hypochloremic metabolic alkalosis",
        explanation:
          "Hypochloremic metabolic alkalosis is a different primary disorder (e.g., vomiting); it does not explain symptoms triggered by hyperventilation-induced respiratory alkalosis.",
      },
    ];

    return {
      stem,
      difficulty: "medium",
      explanation_short:
        "Acute respiratory alkalosis reduces ionized calcium by increasing albumin binding.",
      explanation_long:
        "Hyperventilation lowers PaCO2, raising blood pH (respiratory alkalosis). At higher pH, albumin binds more Ca2+, reducing the ionized (biologically active) calcium fraction. Low ionized calcium increases neuromuscular excitability, causing paresthesias and carpopedal spasm.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 2) Cardio marker
  () => {
    const age = pick([45, 52, 58, 61, 66]);
    const hours = pick([3, 4, 6, 8, 12]);
    const stem = `A ${age}-year-old presents ${hours} hours after onset of crushing substernal chest pain radiating to the left arm. Which serum marker is most specific for myocardial injury at this time?`;

    const correct = {
      text: "Cardiac troponin I",
      explanation:
        "Troponin I is highly specific for myocardial injury and rises within hours; it stays elevated for days.",
    };

    const wrongs = [
      {
        text: "Myoglobin",
        explanation:
          "Myoglobin rises early but is not specific (also released from skeletal muscle).",
      },
      {
        text: "Creatine kinase-MB",
        explanation:
          "CK-MB is less specific than troponin and can rise with skeletal muscle injury; it is useful for reinfarction but not the most specific marker.",
      },
      {
        text: "Lactate dehydrogenase (LDH-1)",
        explanation:
          "LDH-1 was used historically and rises later; it is less specific than troponin for myocardial injury.",
      },
      {
        text: "Aspartate aminotransferase (AST)",
        explanation:
          "AST is nonspecific and can be elevated in many conditions (e.g., liver injury, muscle injury).",
      },
    ];

    return {
      stem,
      difficulty: "easy",
      explanation_short:
        "Troponins are highly specific for myocardial injury and rise within hours.",
      explanation_long:
        "Cardiac troponins (I/T) are the most specific markers of myocardial injury. They begin to rise within a few hours of infarction and remain elevated for days, improving diagnostic sensitivity even if presentation is delayed.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 3) Renal FeNa
  () => {
    const age = pick([70, 74, 78, 82]);
    const cause = pick([
      "vomiting and diarrhea",
      "poor oral intake during a heat wave",
      "gastrointestinal bleeding",
    ]);
    const stem = `A ${age}-year-old has oliguria after ${cause}. Labs show elevated BUN and creatinine. Which finding is most consistent with prerenal azotemia?`;

    const correct = {
      text: "Fractional excretion of sodium (FeNa) < 1%",
      explanation:
        "In prerenal azotemia, tubules are intact and avidly reabsorb sodium, producing low urine sodium and FeNa < 1%.",
    };

    const wrongs = [
      {
        text: "Muddy brown granular casts",
        explanation:
          "Muddy brown casts suggest acute tubular necrosis (ATN), not prerenal azotemia.",
      },
      {
        text: "FeNa > 2%",
        explanation:
          "A FeNa > 2% supports intrinsic renal failure (e.g., ATN) due to impaired sodium reabsorption.",
      },
      {
        text: "Urine sodium > 40 mEq/L",
        explanation:
          "High urine sodium suggests intrinsic renal injury (tubular dysfunction), whereas prerenal states usually have low urine sodium.",
      },
      {
        text: "Urine osmolality < 350 mOsm/kg",
        explanation:
          "Prerenal states typically have concentrated urine (high osmolality). Low osmolality suggests impaired concentrating ability (e.g., ATN).",
      },
    ];

    return {
      stem,
      difficulty: "medium",
      explanation_short:
        "Prerenal azotemia shows avid sodium reabsorption: FeNa < 1% and concentrated urine.",
      explanation_long:
        "In prerenal azotemia, renal perfusion is decreased but tubular function is intact, so the kidney conserves sodium and water (low urine sodium, FeNa < 1%) and produces concentrated urine. ATN features impaired tubular reabsorption with granular casts and higher FeNa.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 4) Micro capsule
  () => {
    const age = pick([2, 4, 6, 8]);
    const bug = pick([
      "Streptococcus pneumoniae",
      "Haemophilus influenzae type b",
      "Neisseria meningitidis",
    ]);
    const stem = `A ${age}-year-old has recurrent infections with ${bug}. The organism’s capsule primarily helps it evade host defenses by which mechanism?`;

    const correct = {
      text: "Inhibiting phagocytosis by reducing opsonization",
      explanation:
        "Capsules interfere with complement/antibody opsonization, reducing effective phagocytosis by neutrophils and macrophages.",
    };

    const wrongs = [
      {
        text: "Inactivating IgA at mucosal surfaces",
        explanation:
          "IgA protease is a separate virulence factor (e.g., Neisseria, H. influenzae), not the primary role of the capsule.",
      },
      {
        text: "Surviving inside macrophages by blocking phagolysosome fusion",
        explanation:
          "Blocking phagolysosome fusion is a strategy of intracellular pathogens (e.g., Mycobacterium), not a capsule function.",
      },
      {
        text: "Producing exotoxin that ADP-ribosylates G proteins",
        explanation:
          "ADP-ribosylating exotoxins (e.g., cholera, pertussis) are toxin mechanisms, not capsule-mediated immune evasion.",
      },
      {
        text: "Switching antigenic surface proteins to evade neutralizing antibodies",
        explanation:
          "Antigenic variation is used by organisms like Neisseria gonorrhoeae; capsules mainly prevent opsonization/phagocytosis.",
      },
    ];

    return {
      stem,
      difficulty: "easy",
      explanation_short:
        "Capsules inhibit phagocytosis by limiting complement and antibody-mediated opsonization.",
      explanation_long:
        "Encapsulated bacteria resist phagocytosis because the capsule interferes with effective opsonization (e.g., by complement C3b and antibodies). Splenic macrophages are important for clearing encapsulated organisms.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 5) Pharm beta blocker
  () => {
    const age = pick([28, 35, 42]);
    const history = pick(["asthma", "COPD", "reactive airway disease"]);
    const stem = `A ${age}-year-old with ${history} is started on a nonselective beta blocker for migraine prophylaxis. Soon after, they develop wheezing and shortness of breath. Which receptor blockade most directly causes this effect?`;

    const correct = {
      text: "Beta-2 receptor blockade in bronchial smooth muscle",
      explanation:
        "Beta-2 activation causes bronchodilation; blocking beta-2 can precipitate bronchospasm, especially in reactive airway disease.",
    };

    const wrongs = [
      {
        text: "Beta-1 receptor blockade in cardiac myocytes",
        explanation:
          "Beta-1 blockade decreases heart rate/contractility; it does not directly cause bronchospasm.",
      },
      {
        text: "Alpha-1 receptor blockade in vascular smooth muscle",
        explanation:
          "Alpha-1 blockade causes vasodilation/orthostasis, not wheezing from bronchoconstriction.",
      },
      {
        text: "Muscarinic M3 receptor blockade in bronchial smooth muscle",
        explanation:
          "Blocking M3 would reduce bronchoconstriction (opposite effect); M3 activation promotes bronchoconstriction and secretions.",
      },
      {
        text: "D2 receptor blockade in the chemoreceptor trigger zone",
        explanation:
          "D2 blockade is related to antiemetics/antipsychotics and extrapyramidal effects, not bronchospasm.",
      },
    ];

    return {
      stem,
      difficulty: "easy",
      explanation_short:
        "Nonselective beta blockers can precipitate bronchospasm via beta-2 blockade.",
      explanation_long:
        "Beta-2 activation relaxes bronchial smooth muscle. Nonselective beta blockers inhibit beta-2 receptors and can provoke bronchospasm, especially in patients with asthma or other reactive airway disease.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 6) Endo PTH
  () => {
    const age = pick([52, 60, 63, 70]);
    const stem = `A ${age}-year-old has fatigue and recurrent kidney stones. Labs show elevated serum calcium and low serum phosphate. Which additional finding is most likely?`;

    const correct = {
      text: "Elevated parathyroid hormone (PTH)",
      explanation:
        "Primary hyperparathyroidism causes increased PTH leading to hypercalcemia and hypophosphatemia due to phosphate wasting.",
    };

    const wrongs = [
      {
        text: "Low parathyroid hormone (PTH)",
        explanation:
          "Low PTH would be expected in hypercalcemia due to non-PTH causes (e.g., malignancy), not classic PTH-driven hypercalcemia with low phosphate.",
      },
      {
        text: "Low 1,25-dihydroxyvitamin D",
        explanation:
          "PTH increases 1α-hydroxylase activity, which raises 1,25-(OH)2 vitamin D rather than lowering it.",
      },
      {
        text: "Low urinary calcium excretion",
        explanation:
          "Low urinary calcium suggests familial hypocalciuric hypercalcemia (FHH); kidney stones with hypercalcemia often correlate with higher urinary calcium.",
      },
      {
        text: "Elevated calcitonin with hypocalcemia",
        explanation:
          "Calcitonin lowers calcium; this contradicts the elevated calcium described.",
      },
    ];

    return {
      stem,
      difficulty: "medium",
      explanation_short:
        "Primary hyperparathyroidism causes hypercalcemia, hypophosphatemia, and elevated PTH.",
      explanation_long:
        "PTH increases serum calcium by stimulating bone resorption, increasing renal calcium reabsorption, and activating vitamin D; it decreases serum phosphate by reducing proximal tubular phosphate reabsorption. Kidney stones are a classic complication of hypercalcemia.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 7) Heme iron deficiency
  () => {
    const age = pick([34, 41, 50, 57]);
    const scenario = pick([
      "heavy menstrual bleeding",
      "long-standing NSAID use with occult GI blood loss",
      "diet low in iron",
    ]);
    const stem = `A ${age}-year-old with ${scenario} has fatigue. CBC shows microcytic anemia. Which lab pattern is most consistent with iron deficiency anemia?`;

    const correct = {
      text: "Low ferritin and increased total iron-binding capacity (TIBC)",
      explanation:
        "Iron deficiency depletes iron stores (low ferritin) and increases transferrin production (high TIBC).",
    };

    const wrongs = [
      {
        text: "High ferritin and decreased TIBC",
        explanation:
          "This pattern is more consistent with anemia of chronic disease (hepcidin-mediated iron sequestration) rather than iron deficiency.",
      },
      {
        text: "Normal ferritin and normal TIBC",
        explanation:
          "A normal ferritin/TIBC pattern does not match classic iron deficiency, where ferritin is typically decreased and TIBC increased.",
      },
      {
        text: "High ferritin and increased serum iron",
        explanation:
          "High ferritin with high serum iron suggests iron overload states, not iron deficiency.",
      },
      {
        text: "Low reticulocyte count with high serum iron",
        explanation:
          "High serum iron does not fit iron deficiency; low reticulocytes may occur in many anemias but the iron pattern is inconsistent.",
      },
    ];

    return {
      stem,
      difficulty: "medium",
      explanation_short:
        "Iron deficiency: ↓ferritin, ↑TIBC, ↓serum iron, ↑RDW.",
      explanation_long:
        "Ferritin reflects iron stores and is decreased in iron deficiency. The liver increases transferrin production, raising TIBC. In anemia of chronic disease, ferritin is normal/high and TIBC is decreased due to hepcidin-mediated iron sequestration.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },

  // 8) Immuno Type II
  () => {
    const age = pick([19, 23, 29, 35]);
    const trigger = pick(["penicillin exposure", "new medication", "recent infection"]);
    const stem = `A ${age}-year-old develops anemia after ${trigger}. Labs show elevated LDH and indirect bilirubin. A direct antiglobulin (Coombs) test is positive. This condition is most consistent with which hypersensitivity mechanism?`;

    const correct = {
      text: "Type II: antibody-mediated cytotoxicity",
      explanation:
        "Direct Coombs positivity indicates antibodies bound to RBCs leading to immune-mediated hemolysis (Type II hypersensitivity).",
    };

    const wrongs = [
      {
        text: "Type I: IgE-mediated mast cell degranulation",
        explanation:
          "Type I hypersensitivity causes immediate allergic reactions (urticaria, anaphylaxis), not antibody-mediated hemolytic anemia with a positive direct Coombs.",
      },
      {
        text: "Type III: immune complex deposition",
        explanation:
          "Type III involves circulating immune complexes depositing in tissues (e.g., serum sickness, PSGN), not direct antibody binding to RBCs.",
      },
      {
        text: "Type IV: T-cell mediated delayed hypersensitivity",
        explanation:
          "Type IV is delayed, T-cell mediated (e.g., contact dermatitis, TB skin test), not Coombs-positive hemolysis.",
      },
      {
        text: "Innate immunity activation via toll-like receptors",
        explanation:
          "TLR activation is part of innate immune recognition and does not explain Coombs-positive, antibody-mediated hemolysis.",
      },
    ];

    return {
      stem,
      difficulty: "medium",
      explanation_short:
        "Warm autoimmune hemolytic anemia is a Type II hypersensitivity reaction.",
      explanation_long:
        "A positive direct Coombs test indicates antibodies (often IgG) bound to RBCs, leading to hemolysis. This is classic Type II hypersensitivity: antibodies directed against cell surface antigens causing cytotoxicity or opsonization.",
      choices: makeChoicesWithExplanations({ correct, wrongs }),
    };
  },
];

function generateQuestion(): GeneratedQuestion {
  const q = pick(TEMPLATES)();
  assertValidQuestion(q);
  return q;
}

async function insertOne(client: any, q: GeneratedQuestion) {
  assertValidQuestion(q);

  const canonical = `DEV_STEP1_${randomUUID()}`;

  const qRes = await client.query(
    `
    INSERT INTO questions (canonical_code, status)
    VALUES ($1, 'published')
    RETURNING question_id
    `,
    [canonical]
  );
  const questionId = qRes.rows[0].question_id as string;

  const qvRes = await client.query(
    `
    INSERT INTO question_versions (
      question_id, version, exam, language, difficulty, stem,
      explanation_short, explanation_long, bibliography, prompt,
      is_active
    )
    VALUES (
      $1, 1, 'step1', 'en', $2,
      $3,
      $4,
      $5,
      $6,
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
      q.bibliography ?? null,
      q.prompt ?? null,
    ]
  );
  const questionVersionId = qvRes.rows[0].question_version_id as string;

  // choices: label, choice_text, is_correct, explanation
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

function toGeneratedQuestionForImport(q: z.infer<typeof ImportQuestionSchema>): GeneratedQuestion {
  const mapped: GeneratedQuestion = {
    stem: q.stem,
    difficulty: q.difficulty,
    explanation_short: q.explanation_short,
    explanation_long: q.explanation_long,
    bibliography: q.bibliography,
    prompt: q.prompt,
    choices: q.choices.map((c) => ({
      label: c.label,
      text: c.text,
      correct: c.correct,
      explanation: c.explanation,
    })),
  };
  assertValidQuestion(mapped);
  return mapped;
}

export async function POST(req: Request) {
  try {
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const chunkSize = body?.chunkSize ?? 100;

    // Mode selection:
    // - If "questions" provided => import mode
    // - Else => generator mode (count)
    const importQuestions = body?.questions?.length ? body.questions : null;

    const totalCount = importQuestions ? importQuestions.length : body?.count ?? 200;

    const startedAt = Date.now();

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
          const q =
            importQuestions
              ? toGeneratedQuestionForImport(importQuestions[cursor + i])
              : generateQuestion();

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
        seed_route_version: importQuestions ? "import_v1" : "bulk_v2_choice_explanations",
        mode: importQuestions ? "import" : "generate",
        requested: totalCount,
        created: createdCount,
        chunks: Math.ceil(totalCount / chunkSize),
        elapsed_ms: ms,
        sample,
        note:
          "Questões geradas/importadas devem ser originais (vinhetas educativas) e não reproduzir conteúdo proprietário. Choice-level explanations são gravadas em question_choices.explanation.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
