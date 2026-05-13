#!/usr/bin/env node
/*
File: D:/dev/usmle/scripts/validate-question-batch.mjs
Responsibility: read-only validator for USMLE Step 1 seed JSON batches.
It does not import data, touch the database, or deploy anything.
*/

import fs from "fs";
import path from "path";

const EXIT_PASS = 0;
const EXIT_VALIDATION = 1;
const EXIT_READ_OR_JSON = 2;
const EXIT_USAGE = 3;

const EXPECTED_DIFF = { easy: 2, medium: 5, hard: 3 };
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const LABELS = ["A", "B", "C", "D"];
const BAD_SOURCES = new Set(["seed_dev", "pilot_import", "PMC12748819"]);
const BLOCKED = [
  "tbd",
  "to be determined",
  "placeholder",
  "lorem ipsum",
  "coming soon",
  "fixme",
  "todo",
  "n/a",
  "not available",
];

function usage() {
  console.log(`USMLE question batch validator (read-only)

Usage:
  node scripts/validate-question-batch.mjs --file <seed.json> [options]

Options:
  --file <path>                  Required. Seed JSON file.
  --expected-source <name>      Optional. Required source value.
  --strict-bibliography        Missing/incomplete bibliography is an error.
  --check-bom                  UTF-8 BOM is an error.
  --help                       Show help.

Exit codes:
  0 pass
  1 validation failed
  2 file/read/JSON error
  3 usage error
`);
}

function parseArgs(argv) {
  const opts = { file: null, expectedSource: null, strictBibliography: false, checkBom: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--file") opts.file = argv[++i];
    else if (a === "--expected-source") opts.expectedSource = argv[++i];
    else if (a === "--strict-bibliography") opts.strictBibliography = true;
    else if (a === "--check-bom") opts.checkBom = true;
    else throw new Error("Unknown argument: " + a);
  }
  return opts;
}

function norm(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function key(v) {
  return norm(v).toLowerCase();
}

function nonEmpty(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function blockedTerm(v) {
  const s = key(v);
  for (const term of BLOCKED) if (s.includes(term)) return term;
  return null;
}

function requireText(errors, label, value, min) {
  if (!nonEmpty(value)) {
    errors.push(label + " is missing or empty.");
    return;
  }
  const n = value.trim().length;
  if (n < min) errors.push(label + " is too short: " + n + " < " + min + ".");
}

function readJson(file) {
  const abs = path.resolve(process.cwd(), file);
  let buf;
  try {
    buf = fs.readFileSync(abs);
  } catch (err) {
    console.error("READ_ERROR: " + err.message);
    process.exit(EXIT_READ_OR_JSON);
  }
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = (hasBom ? buf.subarray(3) : buf).toString("utf8");
  try {
    return { abs, hasBom, data: JSON.parse(text) };
  } catch (err) {
    console.error("JSON_ERROR: " + err.message);
    process.exit(EXIT_READ_OR_JSON);
  }
}

function validate(batch, opts, info) {
  const errors = [];
  const warnings = [];
  const diff = { easy: 0, medium: 0, hard: 0 };
  const answers = { A: 0, B: 0, C: 0, D: 0 };
  const stems = new Map();

  if (info.hasBom) {
    const m = "File has UTF-8 BOM.";
    if (opts.checkBom) errors.push(m);
    else warnings.push(m + " Re-save UTF-8 without BOM before import.");
  }

  if (!batch || typeof batch !== "object" || Array.isArray(batch)) {
    errors.push("Top-level JSON must be an object.");
    return { errors, warnings, diff, answers };
  }

  if (!nonEmpty(batch.source)) {
    errors.push("source is required.");
  } else {
    if (BAD_SOURCES.has(batch.source)) errors.push("Source is blocked: " + batch.source);
    if (opts.expectedSource && batch.source !== opts.expectedSource) {
      errors.push("Source does not match expected-source.");
    }
  }

  if (batch.exam !== undefined && key(batch.exam) !== "step1") errors.push("exam must be step1 when present.");
  if (batch.language !== undefined && key(batch.language) !== "en") errors.push("language must be en when present.");

  if (!Array.isArray(batch.questions)) {
    errors.push("questions must be an array.");
    return { errors, warnings, diff, answers };
  }
  if (batch.questions.length !== 10) errors.push("questions must contain exactly 10 items; got " + batch.questions.length + ".");

  for (let i = 0; i < batch.questions.length; i++) {
    const q = batch.questions[i];
    const p = "question[" + (i + 1) + "]";
    if (!q || typeof q !== "object" || Array.isArray(q)) {
      errors.push(p + " must be an object.");
      continue;
    }

    if (q.exam !== undefined && key(q.exam) !== "step1") errors.push(p + ".exam must be step1.");
    if (q.language !== undefined && key(q.language) !== "en") errors.push(p + ".language must be en.");

    if (!DIFFICULTIES.has(q.difficulty)) errors.push(p + ".difficulty must be easy, medium, or hard.");
    else diff[q.difficulty]++;

    requireText(errors, p + ".stem", q.stem, 120);
    requireText(errors, p + ".prompt", q.prompt, 10);
    requireText(errors, p + ".explanation_short", q.explanation_short, 40);
    requireText(errors, p + ".explanation_long", q.explanation_long, 120);

    for (const [field, value] of [
      ["stem", q.stem],
      ["prompt", q.prompt],
      ["explanation_short", q.explanation_short],
      ["explanation_long", q.explanation_long],
    ]) {
      const t = blockedTerm(value);
      if (t) errors.push(p + "." + field + " contains blocked term: " + t + ".");
    }

    if (nonEmpty(q.stem)) {
      const s = key(q.stem);
      if (stems.has(s)) errors.push(p + ".stem duplicates question[" + stems.get(s) + "].");
      else stems.set(s, i + 1);
    }

    if (!Array.isArray(q.bibliography) || q.bibliography.length === 0) {
      const m = p + ".bibliography must be a non-empty array.";
      if (opts.strictBibliography) errors.push(m); else warnings.push(m);
    } else if (opts.strictBibliography) {
      for (let b = 0; b < q.bibliography.length; b++) {
        const r = q.bibliography[b];
        if (!r || typeof r !== "object" || !nonEmpty(r.title) || !nonEmpty(r.source) || !nonEmpty(r.url)) {
          errors.push(p + ".bibliography[" + b + "] must include title, source, and url.");
        }
      }
    }

    if (!Array.isArray(q.choices)) {
      errors.push(p + ".choices must be an array.");
      continue;
    }
    if (q.choices.length !== 4) {
      errors.push(p + ".choices must have exactly 4 items; got " + q.choices.length + ".");
    }

    const choiceTexts = new Map();
    let correctCount = 0;
    let correctLabel = null;

    for (let c = 0; c < q.choices.length; c++) {
      const choice = q.choices[c];
      const expected = LABELS[c];
      const cp = p + ".choices[" + c + "]";

      if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
        errors.push(cp + " must be an object.");
        continue;
      }

      if (choice.label !== expected) {
        errors.push(cp + ".label must be " + expected + "; got " + choice.label + ".");
      }

      requireText(errors, cp + ".text", choice.text, 1);
      requireText(errors, cp + ".explanation", choice.explanation, 30);

      const t1 = blockedTerm(choice.text);
      if (t1) errors.push(cp + ".text contains blocked term: " + t1 + ".");
      const t2 = blockedTerm(choice.explanation);
      if (t2) errors.push(cp + ".explanation contains blocked term: " + t2 + ".");

      if (choice.correct === true) {
        correctCount++;
        correctLabel = choice.label;
      } else if (choice.correct !== false) {
        errors.push(cp + ".correct must be boolean true or false.");
      }

      if (nonEmpty(choice.text)) {
        const ck = key(choice.text);
        if (choiceTexts.has(ck)) {
          errors.push(p + " has duplicate choice text: " + choice.text + ".");
        } else {
          choiceTexts.set(ck, true);
        }
      }
    }

    if (correctCount !== 1) {
      errors.push(p + " must have exactly one correct choice; got " + correctCount + ".");
    } else if (Object.prototype.hasOwnProperty.call(answers, correctLabel)) {
      answers[correctLabel]++;
    }
  }

  for (const d of Object.keys(EXPECTED_DIFF)) {
    if (diff[d] !== EXPECTED_DIFF[d]) {
      errors.push("difficulty count " + d + " must be " + EXPECTED_DIFF[d] + "; got " + diff[d] + ".");
    }
  }

  for (const label of LABELS) {
    if (answers[label] === 0) errors.push("answer distribution must include label " + label + " at least once.");
    if (answers[label] > 4) errors.push("answer distribution has too many " + label + " answers: " + answers[label] + " > 4.");
  }

  return { errors, warnings, diff, answers };
}

function printResult(result, fileInfo, batch) {
  console.log("USMLE_QUESTION_BATCH_VALIDATOR");
  console.log("file=" + fileInfo.abs);
  console.log("source=" + (batch && batch.source ? batch.source : ""));
  console.log("questions=" + (batch && Array.isArray(batch.questions) ? batch.questions.length : 0));
  console.log("difficulties=" + JSON.stringify(result.diff));
  console.log("answers=" + JSON.stringify(result.answers));
  console.log("errors=" + result.errors.length);
  console.log("warnings=" + result.warnings.length);

  if (result.warnings.length) {
    console.log("");
    console.log("WARNINGS");
    for (const w of result.warnings) console.log("- " + w);
  }

  if (result.errors.length) {
    console.log("");
    console.log("ERRORS");
    result.errors.forEach((e, i) => console.log((i + 1) + ". " + e));
  }

  console.log("");
  console.log(result.errors.length ? "FAIL" : "PASS");
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("USAGE_ERROR: " + err.message);
    usage();
    process.exit(EXIT_USAGE);
  }

  if (opts.help) {
    usage();
    process.exit(EXIT_PASS);
  }

  if (!opts.file) {
    console.error("USAGE_ERROR: --file is required.");
    usage();
    process.exit(EXIT_USAGE);
  }

  const read = readJson(opts.file);
  const result = validate(read.data, opts, read);
  printResult(result, read, read.data);
  process.exit(result.errors.length ? EXIT_VALIDATION : EXIT_PASS);
}

main();
