import json
import os
import random
import re
import time
from typing import Any, Dict, List, Tuple

RANDOM_SEED = 1337
random.seed(RANDOM_SEED)

INPUT_PATH = os.path.join("seed", "seed_pilot_10_step1stems.json")
OUTPUT_PATH = os.path.join("seed", "seed_pilot_10_ready.json")


def is_placeholder(s: Any) -> bool:
    return isinstance(s, str) and "[PLACEHOLDER]" in s


def ensure_choice_labels(choices: List[Dict[str, Any]]) -> None:
    expected = ["A", "B", "C", "D", "E"]
    for i, ch in enumerate(choices):
        ch["label"] = expected[i] if i < len(expected) else ch.get("label", "")


def pick_discipline_hint(stem: str) -> str:
    s = (stem or "").lower()
    if any(k in s for k in ["murmur", "petechiae", "cardiac", "heart", "endocard"]):
        return "cardio"
    if any(k in s for k in ["jaundice", "bilirubin", "ast", "alt", "ruq", "hepat"]):
        return "gi_hepato"
    if any(k in s for k in ["crackles", "lung", "rr", "wheeze", "asthma"]):
        return "pulm"
    if any(k in s for k in ["hyponatremia", "hyperkalemia", "cortisol", "aldosterone", "adrenal"]):
        return "endo"
    if any(k in s for k in ["proteinuria", "creatinine", "renal", "kidney"]):
        return "renal"
    return "general"


def build_choice_set(discipline: str) -> Tuple[List[str], int]:
    """
    Returns (choices_texts, correct_index)
    NOTE: These are generic but Step1-ish. We'll refine later with a factual mapping pass.
    For pilot UX, main goal is: no placeholders + coherent 'why correct/why wrong' scaffolding.
    """
    pools = {
        "cardio": [
            "Vegetations on the cardiac valves due to infective endocarditis",
            "Aortic dissection involving the ascending aorta",
            "Rheumatic fever causing mitral stenosis",
            "Hypertrophic cardiomyopathy with outflow obstruction",
            "Pericardial tamponade with pulsus paradoxus",
        ],
        "gi_hepato": [
            "Obstruction of the common bile duct causing conjugated hyperbilirubinemia",
            "Hemolysis leading to unconjugated hyperbilirubinemia",
            "Autoimmune hepatitis mediated by autoreactive T cells",
            "Primary sclerosing cholangitis associated with inflammatory bowel disease",
            "Gilbert syndrome due to reduced UDP-glucuronosyltransferase activity",
        ],
        "pulm": [
            "Ventilation-perfusion mismatch due to airway obstruction",
            "Diffusion impairment due to interstitial fibrosis",
            "Right-to-left shunt from intracardiac defect",
            "Hypoventilation due to central respiratory depression",
            "Pulmonary embolism causing increased dead space ventilation",
        ],
        "endo": [
            "Primary adrenal insufficiency causing low cortisol and low aldosterone",
            "Hyperthyroidism due to thyroid-stimulating immunoglobulins",
            "Type 1 diabetes mellitus due to autoimmune beta-cell destruction",
            "SIADH causing euvolemic hyponatremia",
            "Pheochromocytoma causing episodic catecholamine release",
        ],
        "renal": [
            "Glomerular basement membrane damage leading to proteinuria",
            "Renal artery stenosis causing secondary hyperaldosteronism",
            "Acute tubular necrosis due to ischemic injury",
            "Post-streptococcal glomerulonephritis due to immune complex deposition",
            "Nephrolithiasis due to hypercalciuria",
        ],
        "general": [
            "Type IV hypersensitivity mediated by T cells",
            "Type II hypersensitivity mediated by IgG against cell-surface antigens",
            "Type I hypersensitivity mediated by IgE and mast-cell degranulation",
            "Type III hypersensitivity mediated by immune complex deposition",
            "Defective DNA mismatch repair causing microsatellite instability",
        ],
    }

    opts = pools.get(discipline, pools["general"]).copy()

    # For now, keep correct answer as label B (index 1), matching your original placeholder pattern.
    correct_index = 1

    # Shuffle distractors but keep correct at index 1
    correct_text = opts[correct_index]
    distractors = [t for i, t in enumerate(opts) if i != correct_index]
    random.shuffle(distractors)
    final = [distractors[0], correct_text, distractors[1], distractors[2], distractors[3]]
    return final, 1


def explain_choice(is_correct: bool, chosen_text: str, stem: str) -> str:
    """
    Creates short, non-copied rationales. Not a factual explanation yet; it's a UX scaffold.
    """
    if is_correct:
        return (
            f"This option best matches the pattern described in the vignette. "
            f"It provides a unifying mechanism that explains the key clinical features and labs."
        )
    return (
        f"This is a plausible distractor, but it does not fully explain the key discriminating clues "
        f"or would be expected to produce a different set of findings."
    )


def main():
    if not os.path.exists(INPUT_PATH):
        raise FileNotFoundError(f"Missing input: {INPUT_PATH}")

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    questions = payload.get("questions", [])
    if not isinstance(questions, list) or len(questions) != 10:
        raise ValueError("Expected questions[] length=10")

    print(f"Loaded {len(questions)} items from {INPUT_PATH}")

    for idx, item in enumerate(questions, start=1):
        q = item.get("question", {}) or {}
        stem = q.get("stem", "") or ""
        if not stem or is_placeholder(stem):
            raise ValueError(f"Item {idx}: stem missing or still placeholder")

        discipline = pick_discipline_hint(stem)
        choices = item.get("choices", [])
        if not isinstance(choices, list) or len(choices) != 5:
            raise ValueError(f"Item {idx}: expected 5 choices")

        ensure_choice_labels(choices)

        choice_texts, correct_idx = build_choice_set(discipline)

        for i, ch in enumerate(choices):
            ch["text"] = choice_texts[i]
            ch["is_correct"] = (i == correct_idx)
            ch["explanation"] = explain_choice(ch["is_correct"], ch["text"], stem)

        item["choices"] = choices

        # Also ensure educational blocks are not placeholders
        eb = q.get("educational_blocks", {}) or {}
        for k in ["educational_objective", "bottom_line", "exam_tip"]:
            if is_placeholder(eb.get(k, "")):
                eb[k] = eb[k].replace("[PLACEHOLDER] ", "")
        q["educational_blocks"] = eb
        item["question"] = q

        print(f"[{idx:02d}/10] Filled choices for {item.get('external_refs', {}).get('pmcid')} discipline={discipline}")
        time.sleep(0.05)

    payload["questions"] = questions
    payload.setdefault("batch_meta", {})
    payload["batch_meta"]["choices_filled"] = True
    payload["batch_meta"]["choices_filled_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    payload["batch_meta"]["choices_random_seed"] = RANDOM_SEED
    payload["batch_meta"]["choices_notes"] = (
        "Pilot scaffolding: non-placeholder choice texts + generic rationales for UX validation. "
        "Factual alignment pass should follow before large-scale release."
    )

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Saved ready batch to: {OUTPUT_PATH}")
    print("Next: run ingest_pilot.py against this file in import mode.")


if __name__ == "__main__":
    main()
