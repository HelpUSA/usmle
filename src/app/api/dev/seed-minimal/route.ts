import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "crypto";

/**
 * DEV Seed (POST)
 *
 * Objetivo:
 * - Popular o banco com questões originais estilo "Step 1-like" (vinhetas clínicas),
 *   SEM copiar ou derivar de conteúdo proprietário (NBME/USMLE/UWorld).
 *
 * Segurança:
 * - Requer header: x-admin-key == process.env.ADMIN_SEED_KEY
 *
 * Body (opcional):
 * {
 *   "count": 1000,
 *   "chunkSize": 100
 * }
 *
 * Recomendação:
 * - Use chunks para evitar timeout em ambiente serverless.
 */

const BodySchema = z
  .object({
    count: z.number().int().min(1).max(5000).optional(),
    chunkSize: z.number().int().min(10).max(500).optional(),
  })
  .optional();

type Difficulty = "easy" | "medium" | "hard";

type GeneratedQuestion = {
  stem: string;
  difficulty: Difficulty;
  explanation_short: string;
  explanation_long: string;
  choices: Array<{ label: "A" | "B" | "C" | "D"; text: string; correct: boolean }>;
};

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

function makeChoices(correct: string, wrongs: string[]) {
  const all = shuffle([correct, ...wrongs]).slice(0, 4);
  const labels: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  const correctIndex = all.indexOf(correct);

  return all.map((text, idx) => ({
    label: labels[idx],
    text,
    correct: idx === correctIndex,
  }));
}

/**
 * Templates originais "Step1-like".
 * Observação: são vinhetas genéricas educativas (não são questões reais nem cópias).
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
    const correct = "Decreased ionized calcium due to increased albumin binding at higher pH";
    const wrongs = [
      "Increased ionized calcium due to decreased albumin binding",
      "Increased potassium shift out of cells due to alkalosis",
      "Decreased bicarbonate reabsorption as the primary acute compensation",
      "Increased chloride reabsorption causing hypochloremic metabolic alkalosis",
    ];
    return {
      stem,
      difficulty: "medium",
      explanation_short: "Acute respiratory alkalosis reduces ionized calcium by increasing albumin binding.",
      explanation_long:
        "Hyperventilation lowers PaCO2, raising blood pH (respiratory alkalosis). At higher pH, albumin binds more Ca2+, reducing the ionized (biologically active) calcium fraction. Low ionized calcium increases neuromuscular excitability, causing paresthesias and carpopedal spasm.",
      choices: makeChoices(correct, wrongs),
    };
  },

  // 2) Cardio marker
  () => {
    const age = pick([45, 52, 58, 61, 66]);
    const hours = pick([3, 4, 6, 8, 12]);
    const stem = `A ${age}-year-old presents ${hours} hours after onset of crushing substernal chest pain radiating to the left arm. Which serum marker is most specific for myocardial injury at this time?`;
    const correct = "Cardiac troponin I";
    const wrongs = [
      "Myoglobin",
      "Creatine kinase-MB",
      "Lactate dehydrogenase (LDH-1)",
      "Aspartate aminotransferase (AST)",
    ];
    return {
      stem,
      difficulty: "easy",
      explanation_short: "Troponins are highly specific for myocardial injury and rise within hours.",
      explanation_long:
        "Cardiac troponins (I/T) are the most specific markers of myocardial injury. They begin to rise within a few hours of infarction and remain elevated for days, improving diagnostic sensitivity even if presentation is delayed.",
      choices: makeChoices(correct, wrongs),
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
    const correct = "Fractional excretion of sodium (FeNa) < 1%";
    const wrongs = [
      "Muddy brown granular casts",
      "FeNa > 2%",
      "Urine sodium > 40 mEq/L",
      "Urine osmolality < 350 mOsm/kg",
    ];
    return {
      stem,
      difficulty: "medium",
      explanation_short: "Prerenal azotemia shows avid sodium reabsorption: FeNa < 1% and concentrated urine.",
      explanation_long:
        "In prerenal azotemia, renal perfusion is decreased but tubular function is intact, so the kidney conserves sodium and water (low urine sodium, FeNa < 1%) and produces concentrated urine. ATN features impaired tubular reabsorption with granular casts and higher FeNa.",
      choices: makeChoices(correct, wrongs),
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
    const correct = "Inhibiting phagocytosis by reducing opsonization";
    const wrongs = [
      "Inactivating IgA at mucosal surfaces",
      "Surviving inside macrophages by blocking phagolysosome fusion",
      "Producing exotoxin that ADP-ribosylates G proteins",
      "Switching antigenic surface proteins to evade neutralizing antibodies",
    ];
    return {
      stem,
      difficulty: "easy",
      explanation_short: "Capsules inhibit phagocytosis by limiting complement and antibody-mediated opsonization.",
      explanation_long:
        "Encapsulated bacteria resist phagocytosis because the capsule interferes with effective opsonization (e.g., by complement C3b and antibodies). Splenic macrophages are important for clearing encapsulated organisms.",
      choices: makeChoices(correct, wrongs),
    };
  },

  // 5) Pharm beta blocker
  () => {
    const age = pick([28, 35, 42]);
    const history = pick(["asthma", "COPD", "reactive airway disease"]);
    const stem = `A ${age}-year-old with ${history} is started on a nonselective beta blocker for migraine prophylaxis. Soon after, they develop wheezing and shortness of breath. Which receptor blockade most directly causes this effect?`;
    const correct = "Beta-2 receptor blockade in bronchial smooth muscle";
    const wrongs = [
      "Beta-1 receptor blockade in cardiac myocytes",
      "Alpha-1 receptor blockade in vascular smooth muscle",
      "Muscarinic M3 receptor blockade in bronchial smooth muscle",
      "D2 receptor blockade in the chemoreceptor trigger zone",
    ];
    return {
      stem,
      difficulty: "easy",
      explanation_short: "Nonselective beta blockers can precipitate bronchospasm via beta-2 blockade.",
      explanation_long:
        "Beta-2 activation relaxes bronchial smooth muscle. Nonselective beta blockers inhibit beta-2 receptors and can provoke bronchospasm, especially in patients with asthma or other reactive airway disease.",
      choices: makeChoices(correct, wrongs),
    };
  },

  // 6) Endo PTH
  () => {
    const age = pick([52, 60, 63, 70]);
    const stem = `A ${age}-year-old has fatigue and recurrent kidney stones. Labs show elevated serum calcium and low serum phosphate. Which additional finding is most likely?`;
    const correct = "Elevated parathyroid hormone (PTH)";
    const wrongs = [
      "Low parathyroid hormone (PTH)",
      "Low 1,25-dihydroxyvitamin D",
      "Low urinary calcium excretion",
      "Elevated calcitonin with hypocalcemia",
    ];
    return {
      stem,
      difficulty: "medium",
      explanation_short: "Primary hyperparathyroidism causes hypercalcemia, hypophosphatemia, and elevated PTH.",
      explanation_long:
        "PTH increases serum calcium by stimulating bone resorption, increasing renal calcium reabsorption, and activating vitamin D; it decreases serum phosphate by reducing proximal tubular phosphate reabsorption. Kidney stones are a classic complication of hypercalcemia.",
      choices: makeChoices(correct, wrongs),
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
    const correct = "Low ferritin and increased total iron-binding capacity (TIBC)";
    const wrongs = [
      "High ferritin and decreased TIBC",
      "Normal ferritin and normal TIBC",
      "High ferritin and increased serum iron",
      "Low reticulocyte count with high serum iron",
    ];
    return {
      stem,
      difficulty: "medium",
      explanation_short: "Iron deficiency: ↓ferritin, ↑TIBC, ↓serum iron, ↑RDW.",
      explanation_long:
        "Ferritin reflects iron stores and is decreased in iron deficiency. The liver increases transferrin production, raising TIBC. In anemia of chronic disease, ferritin is normal/high and TIBC is decreased due to hepcidin-mediated iron sequestration.",
      choices: makeChoices(correct, wrongs),
    };
  },

  // 8) Immuno Type II
  () => {
    const age = pick([19, 23, 29, 35]);
    const trigger = pick(["penicillin exposure", "new medication", "recent infection"]);
    const stem = `A ${age}-year-old develops anemia after ${trigger}. Labs show elevated LDH and indirect bilirubin. A direct antiglobulin (Coombs) test is positive. This condition is most consistent with which hypersensitivity mechanism?`;
    const correct = "Type II: antibody-mediated cytotoxicity";
    const wrongs = [
      "Type I: IgE-mediated mast cell degranulation",
      "Type III: immune complex deposition",
      "Type IV: T-cell mediated delayed hypersensitivity",
      "Innate immunity activation via toll-like receptors",
    ];
    return {
      stem,
      difficulty: "medium",
      explanation_short: "Warm autoimmune hemolytic anemia is a Type II hypersensitivity reaction.",
      explanation_long:
        "A positive direct Coombs test indicates antibodies (often IgG) bound to RBCs, leading to hemolysis. This is classic Type II hypersensitivity: antibodies directed against cell surface antigens causing cytotoxicity or opsonization.",
      choices: makeChoices(correct, wrongs),
    };
  },
];

function generateQuestion(): GeneratedQuestion {
  const q = pick(TEMPLATES)();

  if (q.choices.length !== 4) {
    throw new Error("Template must generate exactly 4 choices.");
  }
  const correctCount = q.choices.filter((c) => c.correct).length;
  if (correctCount !== 1) {
    throw new Error("Template must generate exactly 1 correct choice.");
  }

  return q;
}

async function insertOne(client: any, q: GeneratedQuestion) {
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
      explanation_short, explanation_long, is_active
    )
    VALUES (
      $1, 1, 'step1', 'en', $2,
      $3,
      $4,
      $5,
      true
    )
    RETURNING question_version_id
    `,
    [questionId, q.difficulty, q.stem, q.explanation_short, q.explanation_long]
  );
  const questionVersionId = qvRes.rows[0].question_version_id as string;

  const values: string[] = [];
  const params: any[] = [questionVersionId];
  let p = 2;

  for (const c of q.choices) {
    values.push(`($1, $${p++}, $${p++}, $${p++})`);
    params.push(c.label, c.text, c.correct);
  }

  await client.query(
    `
    INSERT INTO question_choices (question_version_id, label, choice_text, is_correct)
    VALUES ${values.join(", ")}
    `,
    params
  );

  return { questionId, questionVersionId, canonical_code: canonical };
}

export async function POST(req: Request) {
  try {
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const body = BodySchema.parse(bodyJson);

    const totalCount = body?.count ?? 200;
    const chunkSize = body?.chunkSize ?? 100;

    const startedAt = Date.now();

    let createdCount = 0;
    const sample: Array<{
      question_id: string;
      question_version_id: string;
      canonical_code: string;
    }> = [];

    let remaining = totalCount;

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
          const q = generateQuestion();
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
    }

    const ms = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        seed_route_version: "bulk_v1",
        requested: totalCount,
        created: createdCount,
        chunks: Math.ceil(totalCount / chunkSize),
        elapsed_ms: ms,
        sample,
        note:
          "Questões geradas são originais (vinhetas educativas) e não reproduzem conteúdo proprietário de bancas.",
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
