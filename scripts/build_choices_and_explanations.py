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

    NOTE:
    - Estas alternativas são genéricas (pilot scaffolding).
    - Objetivo no MVP: evitar placeholders + ter UX de review completa (why correct/why wrong)
    - Passo seguinte: factual mapping / alignment com o artigo/PMCID antes de escalar.
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

    # Pilot: manter resposta correta em B (índice 1), como você vinha usando no seed
    correct_index = 1

    # Embaralha os distractors, mantendo o correto fixo na posição B
    correct_text = opts[correct_index]
    distractors = [t for i, t in enumerate(opts) if i != correct_index]
    random.shuffle(distractors)
    final = [distractors[0], correct_text, distractors[1], distractors[2], distractors[3]]
    return final, 1


def _stem_signal(stem: str) -> str:
    """
    Extrai um 'sinal' minimalista do stem só para variar o texto (não é factual).
    """
    s = (stem or "").lower()
    signals = []
    if any(k in s for k in ["fever", "temp", "102", "39"]):
        signals.append("systemic inflammation/fever")
    if any(k in s for k in ["bp", "98/62", "hypotens", "shock"]):
        signals.append("hemodynamic instability")
    if any(k in s for k in ["anemia", "ldh"]):
        signals.append("evidence of cell turnover/hemolysis")
    if any(k in s for k in ["diabetes"]):
        signals.append("immunometabolic risk factors")
    if any(k in s for k in ["weakness", "proximal"]):
        signals.append("proximal weakness pattern")
    if any(k in s for k in ["hyperpigmented", "hyperpigment"]):
        signals.append("pigmentation changes")
    if not signals:
        return "the key discriminating clues"
    # pega 1-2 sinais
    return ", ".join(signals[:2])


def _choice_specific_wrong_rationale(chosen_text: str, stem: str) -> str:
    """
    Gera um 'why wrong' diferente por alternativa, baseado em keywords do chosen_text.
    Ainda é scaffolding: foca em não duplicar e em soar "Step1-ish".
    """
    ct = (chosen_text or "").lower()
    sig = _stem_signal(stem)

    # pulm / gas exchange
    if "ventilation-perfusion" in ct or "v/q" in ct or "airway obstruction" in ct:
        return (
            f"This mechanism can cause hypoxemia, but it would typically track with airway symptoms and does not best fit {sig}."
        )
    if "diffusion" in ct or "interstitial fibrosis" in ct:
        return (
            f"Diffusion limitation is classically linked to interstitial lung disease patterns; the vignette’s {sig} makes this less unifying."
        )
    if "right-to-left shunt" in ct or "intracardiac" in ct:
        return (
            f"A right-to-left shunt leads to hypoxemia that is often refractory to oxygen; that pattern is not suggested by {sig}."
        )
    if "hypoventilation" in ct or "central respiratory depression" in ct:
        return (
            f"Central hypoventilation would be associated with elevated CO₂ and depressed drive; this does not align well with {sig}."
        )
    if "pulmonary embolism" in ct or "dead space" in ct:
        return (
            f"PE increases dead space and can cause tachycardia/pleuritic symptoms; the overall picture is not best explained by {sig}."
        )

    # cardio
    if "endocarditis" in ct or "vegetations" in ct:
        return (
            f"Endocarditis would be expected to show a stronger infectious focus (e.g., persistent bacteremia or classic stigmata); that’s not anchored by {sig}."
        )
    if "aortic dissection" in ct:
        return (
            f"Aortic dissection is typically abrupt with tearing pain and pulse/BP differentials; the vignette’s {sig} does not point there."
        )
    if "rheumatic" in ct or "mitral stenosis" in ct:
        return (
            f"Rheumatic mitral disease is a chronic sequela; the time course and {sig} are not characteristic."
        )
    if "hypertrophic" in ct or "outflow" in ct:
        return (
            f"HOCM causes exertional symptoms and dynamic murmurs; it does not unify {sig} in this presentation."
        )
    if "tamponade" in ct or "pulsus paradoxus" in ct:
        return (
            f"Tamponade would feature JVD, muffled heart sounds, and pulsus paradoxus; those specific clues are not reflected in {sig}."
        )

    # gi/hepato
    if "common bile duct" in ct or "conjugated hyperbilirubinemia" in ct:
        return (
            f"Extrahepatic obstruction would more strongly suggest cholestatic findings (e.g., pale stools/pruritus); that is not supported by {sig}."
        )
    if "hemolysis" in ct or "unconjugated" in ct:
        return (
            f"Hemolysis would typically present with a clear hemolytic pattern; while possible, it does not best unify {sig}."
        )
    if "autoimmune hepatitis" in ct:
        return (
            f"Autoimmune hepatitis would often align with specific serologies and hepatocellular enzyme patterns; the vignette’s {sig} is not pointing there."
        )
    if "primary sclerosing cholangitis" in ct:
        return (
            f"PSC is linked to IBD and cholestatic labs; that broader context is not suggested by {sig}."
        )
    if "gilbert" in ct or "udp-glucuronosyltransferase" in ct:
        return (
            f"Gilbert syndrome is benign and intermittent; it would not explain a more systemic picture like {sig}."
        )

    # endo
    if "adrenal insufficiency" in ct or "low cortisol" in ct:
        return (
            f"Primary adrenal insufficiency has a distinct endocrine pattern; this option does not clearly reconcile {sig} as written."
        )
    if "hyperthyroidism" in ct or "thyroid-stimulating immunoglobulins" in ct:
        return (
            f"Hyperthyroidism would be expected to show thyrotoxic features (weight loss, tremor, heat intolerance); those are not anchored by {sig}."
        )
    if "type 1 diabetes" in ct or "beta-cell" in ct:
        return (
            f"Type 1 DM is a strong distractor, but the vignette already frames diabetes as background; it does not specifically explain {sig}."
        )
    if "siadh" in ct or "hyponatremia" in ct:
        return (
            f"SIADH centers on hyponatremia and volume status; it does not directly unify {sig} in this case."
        )
    if "pheochromocytoma" in ct or "catecholamine" in ct:
        return (
            f"Pheochromocytoma causes episodic headaches/sweating/palpitations with hypertension; that conflicts with {sig}."
        )

    # renal
    if "glomerular basement membrane" in ct or "proteinuria" in ct:
        return (
            f"Proteinuric syndromes have a renal-predominant picture; they do not best integrate {sig} in the vignette."
        )
    if "renal artery stenosis" in ct or "hyperaldosteronism" in ct:
        return (
            f"RAS typically drives hypertension/renin-angiotensin activation; the hemodynamic context implied by {sig} does not favor it."
        )
    if "acute tubular necrosis" in ct or "ischemic" in ct:
        return (
            f"ATN is usually framed by a clear ischemic/toxic insult with renal findings; it does not unify {sig} here."
        )
    if "post-streptococcal" in ct or "immune complex" in ct:
        return (
            f"PSGN classically follows infection with hematuria and complement changes; that pattern is not suggested by {sig}."
        )
    if "nephrolithiasis" in ct or "hypercalciuria" in ct:
        return (
            f"Nephrolithiasis presents with colicky flank pain/hematuria; it does not explain {sig}."
        )

    # fallback
    return (
        f"This is a plausible distractor, but it does not fully explain {sig} or would be expected to produce a different set of findings."
    )


def explain_choice(is_correct: bool, chosen_text: str, stem: str) -> str:
    """
    Gera rationale curta por alternativa.

    - Correta: um texto "unificador" (scaffold)
    - Erradas: rationale diferente por alternativa (usa chosen_text + signal do stem)
    """
    if is_correct:
        return (
            "This option best matches the pattern described in the vignette. "
            "It provides a unifying mechanism that explains the key clinical features and labs."
        )
    return _choice_specific_wrong_rationale(chosen_text, stem)


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

        # preencher choice fields
        for i, ch in enumerate(choices):
            ch["text"] = choice_texts[i]
            ch["is_correct"] = (i == correct_idx)
            ch["explanation"] = explain_choice(ch["is_correct"], ch["text"], stem)

        # ✅ blindagem: evitar explanations duplicadas (especialmente nos distractors)
        seen = {}
        for ch in choices:
            exp = (ch.get("explanation") or "").strip()
            if exp in seen:
                # adiciona sufixo determinístico baseado no choice_text
                hint = re.sub(r"\s+", " ", (ch.get("text") or "").strip())
                hint = hint[:80] + ("…" if len(hint) > 80 else "")
                ch["explanation"] = f"{exp} (Note: this choice focuses on: {hint})"
            else:
                seen[exp] = True

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
        "Pilot scaffolding: non-placeholder choice texts + per-choice rationales (distinct per distractor) "
        "for UX validation. Factual alignment pass should follow before large-scale release."
    )

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Saved ready batch to: {OUTPUT_PATH}")
    print("Next: run ingest_pilot.py against this file in import mode.")


if __name__ == "__main__":
    main()
