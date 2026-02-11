import json
import random

# pip install datasets
from datasets import load_dataset

def letter(i: int) -> str:
    return ["A", "B", "C", "D", "E"][i]

def main(out_path="seed_pilot_10.json", n=10, seed=42):
    random.seed(seed)

    # MedMCQA (HuggingFace)
    ds = load_dataset("openlifescienceai/medmcqa", split="train")

    # pega amostras aleatórias
    idxs = random.sample(range(len(ds)), n)

    questions = []
    for idx in idxs:
        row = ds[int(idx)]

        # Estrutura típica: question + opa/ opb/opc/opd + cop (índice do correto) + exp (explicação)
        qtext = (row.get("question") or "").strip()
        options = [
            (row.get("opa") or "").strip(),
            (row.get("opb") or "").strip(),
            (row.get("opc") or "").strip(),
            (row.get("opd") or "").strip(),
        ]
        correct_idx = int(row.get("cop")) if row.get("cop") is not None else -1
        explanation = (row.get("exp") or "").strip()

        # validações mínimas
        if not qtext or any(not o for o in options) or correct_idx not in [0, 1, 2, 3]:
            continue

        # Aqui vai o “modelo híbrido” simples:
        # - Mantemos a ideia, mas já colocamos "choice-level explanations" geradas heurísticamente
        #   (depois você pode trocar por reescrita profunda via LLM)
        choices = []
        for i, opt in enumerate(options):
            is_correct = (i == correct_idx)
            choices.append({
                "label": letter(i),
                "text": opt,
                "correct": is_correct,
                "explanation": (
                    explanation if is_correct
                    else "This option is not the best answer given the stem; it does not match the key mechanism or clinical pattern."
                )
            })

        questions.append({
            "stem": qtext,
            "difficulty": "medium",
            "explanation_short": explanation[:240] if explanation else "See explanation.",
            "explanation_long": explanation if explanation else "Explanation not provided in source dataset.",
            "bibliography": {
                "sources": [
                    {
                        "title": "MedMCQA dataset (HuggingFace)",
                        "url": "https://huggingface.co/datasets/openlifescienceai/medmcqa",
                        "license": "apache-2.0 (per dataset card)"
                    }
                ],
                "provenance_note": "Imported from an open dataset for development; consider deep rewrite to produce fully original Step1-like items."
            },
            "prompt": "Imported item; recommended: deep rewrite into Step1-like vignette with new explanations.",
            "choices": choices
        })

    payload = {"chunkSize": 10, "questions": questions}

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"OK: wrote {len(questions)} questions to {out_path}")

if __name__ == "__main__":
    main()
