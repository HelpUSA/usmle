import json
from pathlib import Path

# =========================================
# convert_ready_to_seed_minimal.py
# =========================================
# Purpose:
# - Convert pipeline "ready" format into the backend import contract
#   expected by:
#     POST /api/dev/seed-minimal
# - Ensures:
#   - difficulty is mapped to: easy|medium|hard
#   - explanation_short / explanation_long are populated
#   - choices are normalized to fields: label, text, correct, explanation
#   - prompt is NEVER null (backend Zod rejects null)
#
# Inputs:
#   seed/seed_pilot_10_ready.json
#
# Outputs:
#   seed/seed_pilot_10_seed_minimal.json
#
# Notes:
# - If prompt is missing or null -> omit the field OR set to ""
#   (This script sets to "" by default to be explicit)
# =========================================

IN_PATH = Path("seed/seed_pilot_10_ready.json")
OUT_PATH = Path("seed/seed_pilot_10_seed_minimal.json")


def map_difficulty(n: int) -> str:
    """
    Stable mapping:
      1-2 -> easy
      3   -> medium
      4-5 -> hard
    """
    if n <= 2:
        return "easy"
    if n == 3:
        return "medium"
    return "hard"


def build_explanations(blocks: dict) -> tuple[str, str]:
    """
    Build:
      explanation_short: bottom_line (fallback default)
      explanation_long : objective + bottom_line + exam_tip (joined)
    """
    obj = (blocks.get("educational_objective") or "").strip()
    bottom = (blocks.get("bottom_line") or "").strip()
    tip = (blocks.get("exam_tip") or "").strip()

    # minimal fallback so endpoint never breaks
    if not bottom:
        bottom = "Review the core mechanism and use discriminating clues to eliminate distractors."

    short = bottom
    parts = [p for p in (obj, bottom, tip) if p]
    long = "\n\n".join(parts) if parts else bottom
    return short, long


def normalize_prompt(raw_prompt) -> str:
    """
    Backend schema:
      prompt: string | undefined
    It rejects:
      prompt: null

    Strategy:
      - If null/None/missing -> return "" (explicit non-null string)
      - Else -> str(prompt).strip()
    """
    if raw_prompt is None:
        return ""
    # In case prompt is not a string for any reason
    return str(raw_prompt).strip()


def assert_valid_question(q: dict):
    """
    Mirrors backend rules:
      - 4 or 5 choices
      - exactly 1 correct
      - unique labels
      - non-empty explanation for each choice
    """
    choices = q["choices"]

    if not (4 <= len(choices) <= 5):
        raise ValueError("Question must have 4 or 5 choices.")

    correct_count = sum(1 for c in choices if c["correct"])
    if correct_count != 1:
        raise ValueError("Question must have exactly 1 correct choice.")

    labels = [c["label"] for c in choices]
    if len(set(labels)) != len(labels):
        raise ValueError("Choice labels must be unique.")

    for c in choices:
        if not c["explanation"].strip():
            raise ValueError("Each choice must include a non-empty explanation.")


def main():
    data = json.loads(IN_PATH.read_text(encoding="utf-8"))
    items = data["questions"]

    out_questions = []
    for item in items:
        q = item["question"]
        blocks = q.get("educational_blocks") or {}

        explanation_short, explanation_long = build_explanations(blocks)

        # prompt can be missing/null in ready.json; backend rejects null
        prompt_str = normalize_prompt(q.get("prompt"))

        out_q = {
            "stem": q["stem"].strip(),
            "difficulty": map_difficulty(int(q.get("difficulty", 3))),
            "explanation_short": explanation_short,
            "explanation_long": explanation_long,
            "bibliography": q.get("bibliography"),
            # keep it explicit but safe:
            "prompt": prompt_str,
            "choices": [
                {
                    "label": c["label"],
                    "text": c["text"].strip(),
                    "correct": bool(c["is_correct"]),
                    "explanation": c["explanation"].strip(),
                }
                for c in item["choices"]
            ],
        }

        assert_valid_question(out_q)
        out_questions.append(out_q)

    payload = {
        "questions": out_questions,
        "chunkSize": 10,
        "requireExactlyTen": True,
    }

    OUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"OK: wrote {OUT_PATH} with {len(out_questions)} questions")


if __name__ == "__main__":
    main()
