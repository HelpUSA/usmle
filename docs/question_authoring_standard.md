# USMLE Platform - Question Authoring Standard

File: D:/dev/usmle/docs/question_authoring_standard.md
Updated: 2026-05-13
Scope: editorial, technical, research, validation, and import rules for expanding the USMLE Step 1 question pool.

## 1. Current USMLE state

The platform is functional locally and online.

- Production domain: https://usmle.helpusbr.com
- Repository: https://github.com/HelpUSA/usmle
- Branch: main
- Last validated commit: b4658e2 Add curated pilot question batch
- Stack: Next.js 14 App Router, TypeScript, React 18, NextAuth v4, PostgreSQL Railway via pg, zod API validation.
- Database: PostgreSQL on Railway.
- Import route: POST /api/dev/seed-minimal with x-admin-key.
- Production import should remain blocked unless there is a controlled import window.

## 2. Active pool and bad draft sources

Current active pool:

- source: pilot_curated_v1
- status: published
- exam: step1
- language: en
- total: 10
- distribution: 2 easy / 5 medium / 3 hard

Bad draft sources to avoid:

- pilot_import: draft, 10 old or generic questions.
- PMC12748819: draft, 2 problematic questions.

Do not reactivate pilot_import or PMC12748819 without manual review. Do not duplicate active pilot_curated_v1 concepts in new batches.

## 3. Expansion goal

Immediate goal: expand from 10 published questions to 30 published questions by adding curated 10-question batches.

Next sources:

- step1_curated_batch_002
- step1_curated_batch_003

Each batch must contain exactly 10 original Step 1 English questions:

- 2 easy
- 5 medium
- 3 hard
- 4 choices every item: A, B, C, D
- exactly 1 correct answer

## 4. JSON contract for /api/dev/seed-minimal

Required endpoint:

POST /api/dev/seed-minimal

Required header:

x-admin-key: ADMIN_SEED_KEY

Minimum payload shape:

{
  "source": "step1_curated_batch_002",
  "questions": [
    {
      "stem": "Original clinical vignette.",
      "difficulty": "medium",
      "prompt": "Which mechanism best explains the finding?",
      "explanation_short": "Short explanation.",
      "explanation_long": "Long teaching explanation.",

      "bibliography": [
        {
          "title": "Open reference title",
          "source": "NCBI Bookshelf or other open reliable source",
          "year": 2026,
          "url": "https://example.org/open-source",
          "note": "Why this source supports the item."
        }
      ],
      "choices": [
        {
          "label": "A",
          "text": "Choice A",
          "correct": false,
          "explanation": "Why A is wrong."
        },
        {
          "label": "B",
          "text": "Choice B",
          "correct": true,
          "explanation": "Why B is correct."
        },
        {
          "label": "C",
          "text": "Choice C",
          "correct": false,
          "explanation": "Why C is wrong."
        },
        {
          "label": "D",
          "text": "Choice D",
          "correct": false,
          "explanation": "Why D is wrong."
        }
      ]
    }
  ],
  "chunkSize": 10,
  "requireExactlyTen": true,
  "requireBibliography": false,
  "allowSeedDevSource": false
}

The editorial standard requires bibliography for every item even if requireBibliography remains false technically.

## 5. Required item structure

Every question must include:

- stem
- difficulty
- prompt
- explanation_short
- explanation_long
- bibliography
- choices

Stem length target:

- minimum: 120 characters
- ideal: 250 to 700 characters
- maximum: 900 characters

Explanation length targets:

- explanation_short: at least 40 characters, preferred 60 to 250
- explanation_long: at least 120 characters, preferred 180 to 900
- each choice explanation: at least 30 characters, preferred 80 to 300

The stem must be original. The prompt must be direct. Distractors must be plausible, related to the same domain, and educational.

## 6. Quality rules

A valid batch must pass these checks before import:

- source is present, unique, and not seed_dev.
- questions array is present.
- exactly 10 questions are present.
- difficulty distribution is 2 easy, 5 medium, 3 hard.
- every question has stem, prompt, explanation_short, explanation_long, bibliography, and choices.
- every question has exactly 4 choices.
- labels are A, B, C, D in order.
- exactly one choice is correct.
- correct answer letters are reasonably distributed across A, B, C, and D.
- no duplicate stems or duplicate choice texts.
- no placeholder text.
- no generic repeated explanation.
- no duplicated active-pool concept.
- JSON is valid.
- file is UTF-8 without BOM.

Blocked terms:

- TBD
- to be determined
- placeholder
- lorem ipsum
- coming soon
- fixme
- todo
- n/a
- not available

Blocked editorial patterns:

- generic explanation without mechanism
- stem too short
- all questions at the same difficulty
- same correct letter repeated too often
- commercial-bank-like wording
- active-pool duplicate concept

## 7. External research rules

Use only reliable, open, verifiable sources.

Preferred source types:

- NCBI Bookshelf
- PubMed Central open-access full text
- PubMed abstracts when enough for stable concept support
- NIH resources
- CDC resources
- WHO resources
- MedlinePlus
- MedlinePlus Genetics
- Merck Manual Professional for conceptual support
- OpenStax
- open clinical guidelines when appropriate

Research workflow:

1. Select a high-yield Step 1 concept.
2. Find an open reliable source.
3. Confirm that the source supports the mechanism.
4. Extract the concept, not the wording.
5. Write a new vignette from scratch.
6. Write plausible distractors.
7. Write original explanations.
8. Add bibliography metadata.
9. Validate the batch.
10. Import only after validation.

## 8. Forbidden commercial banks

Do not copy or paraphrase commercial question bank material.

Forbidden for direct use:

- UWorld
- AMBOSS
- NBME
- USMLE-Rx
- Boards and Beyond
- Pathoma
- First Aid proprietary wording
- Kaplan Qbank
- commercial Anki cards based on question banks
- Reddit bank screenshots
- PDF dumps of commercial content

Commercial sources may not be used for stems, answer structures, explanations, or distractor sets. Questions must be original.

## 9. Difficulty definitions

Easy items test a direct classic mechanism with limited inference. A typical easy item gives a classic presentation and asks for the direct enzyme, mechanism, drug effect, or lab finding.

Medium items require one or two reasoning steps from vignette to diagnosis, then from diagnosis to mechanism, laboratory finding, or drug effect.

Hard items integrate two or more concepts or use strong distractors. A typical hard item requires a specific molecular, biochemical, pharmacologic, immunologic, or physiologic mechanism.

## 10. Deduplication rules

Before drafting a batch, compare proposed topics against all published active sources.

A duplicate exists when a new item tests the same diagnosis and the same mechanism as a published item, even with different wording.

A topic may be reused in a later batch only if the tested mechanism is clearly different and the overlap is documented.

Avoid these pilot_curated_v1 concepts for step1_curated_batch_002:

- iron deficiency anemia
- nonselective beta-blocker in asthma
- myocardial infarction troponin
- prerenal acute kidney injury FeNa
- transposition of great arteries with PGE1
- encapsulated bacteria after splenectomy
- pheochromocytoma alpha blockade before beta blockade

## 11. Approved non-duplicate matrix for step1_curated_batch_002

This is the approved working matrix for the next batch. It is designed to avoid the active pilot_curated_v1 concepts.

1. Easy - G6PD deficiency hemolysis - oxidative stress with impaired NADPH and glutathione protection - source type: NCBI Bookshelf or MedlinePlus Genetics - high-yield enzyme defect with classic trigger.

2. Easy - Lactase deficiency - osmotic diarrhea from unabsorbed lactose after dairy intake - source type: NCBI Bookshelf or NIH digestive disease resource - direct GI physiology.

3. Medium - Sickle cell disease - HbS polymerization causing vaso-occlusion under deoxygenated conditions - source type: NCBI Bookshelf or MedlinePlus Genetics - integrates genetics, hematology, and pathophysiology.

4. Medium - Graves disease - thyroid-stimulating IgG against the TSH receptor - source type: NCBI Bookshelf or endocrine review - autoimmune endocrine mechanism.

5. Medium - Myasthenia gravis - autoantibodies against postsynaptic acetylcholine receptors - source type: NCBI Bookshelf or NIH neuromuscular review - high-yield neuroimmunology.

6. Medium - Diabetic ketoacidosis - insulin deficiency increases lipolysis and hepatic ketogenesis - source type: NCBI Bookshelf, ADA, or NIH review - endocrine metabolism and acid-base reasoning.

7. Medium - Celiac disease - T-cell mediated reaction to deamidated gliadin with villous atrophy - source type: NCBI Bookshelf or NIH digestive disease resource - GI immunology.

8. Hard - Lesch-Nyhan syndrome - HGPRT deficiency causing purine salvage failure and excess uric acid - source type: NCBI Bookshelf or MedlinePlus Genetics - biochemistry, genetics, and neurobehavioral signs.

9. Hard - Alpha-1 antitrypsin deficiency - misfolded protein retention in hepatocytes plus uninhibited neutrophil elastase - source type: NCBI Bookshelf or MedlinePlus Genetics - links liver pathology and panacinar emphysema.

10. Hard - Thiazide-induced hypercalcemia - increased distal tubular calcium reabsorption after NaCl cotransporter inhibition - source type: NCBI Bookshelf pharmacology or nephrology review - renal pharmacology and electrolyte mechanism.

Recommended correct answer balance for a 10-question batch: A = 3, B = 2, C = 3, D = 2, or another reasonably balanced distribution.

## 12. Batch workflow

Use this workflow for every new batch:

1. Define a 10-topic matrix.
2. Deduplicate against active published sources.
3. Research open sources.
4. Draft original questions in English.
5. Fill the JSON contract.
6. Run the local batch validator.
7. Fix every validation failure.
8. Save UTF-8 without BOM.
9. Start the local server connected to Railway.
10. Import through localhost.
11. Confirm counts in the database.
12. Create a new real session.
13. Test question display and review.
14. Commit seed, docs, and scripts.
15. Only then proceed to the next batch.

Do not write batch 003 before batch 002 is validated in a real session.

## 13. Import workflow via localhost to Railway

Preferred import path:

localhost Next.js server -> Railway PostgreSQL

Build and start locally:

cd D:/dev/usmle
npm run build
npm run start

Health check:

Invoke-RestMethod -Method GET -Uri "http://localhost:3000/api/health"

Expected health result:

status = ok
db = up

Import command:

cd D:/dev/usmle
$baseUrl = "http://localhost:3000"
$adminKey = Read-Host "ADMIN_SEED_KEY"
curl.exe -i -X POST "$baseUrl/api/dev/seed-minimal" -H "Content-Type: application/json" -H "x-admin-key: $adminKey" --data-binary "@D/dev/usmle/seed/step1_curated_batch_002.json"

Expected import result:

HTTP 201 Created
ok = true
source = step1_curated_batch_002
created = 10
quality_gate = enabled

If production returns NOT_FOUND or refuses import, keep production blocked unless there is a controlled import window.

## 14. UTF-8 without BOM

Before import, normalize JSON files to UTF-8 without BOM:

cd D:/dev/usmle
$path = "D:/dev/usmle/seed/step1_curated_batch_002.json"
$raw = Get-Content $path -Raw
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $raw, $utf8NoBom)

Use curl.exe --data-binary for imports.

## 15. Database validation after import

After import, confirm published counts by source and difficulty.

Expected published pool after batch 002:

pilot_curated_v1: 2 easy, 5 medium, 3 hard
step1_curated_batch_002: 2 easy, 5 medium, 3 hard

Create a new practice session and verify:

- session status is in_progress
- mode is practice
- exam is step1
- questions come only from published active sources
- old draft sources are not selected
- review mode shows choices, explanations, bibliography, and prompt

## 16. Git and versioning

Commit only after local validation, successful import, and real session testing.

Recommended commit set:

- docs/question_authoring_standard.md
- scripts/validate-question-batch.mjs
- scripts/import-question-batch.mjs
- seed/step1_curated_batch_002.json

Do not commit .env.local. Do not commit secrets. Rotate exposed seed keys.

## 17. Pending implementation files

Next files to create after this standard:

- D:/dev/usmle/scripts/validate-question-batch.mjs
- D:/dev/usmle/scripts/import-question-batch.mjs
- D:/dev/usmle/seed/step1_curated_batch_002.json

Operational rule: do not import, deploy, or touch the database until a new batch passes local validation and human review.
