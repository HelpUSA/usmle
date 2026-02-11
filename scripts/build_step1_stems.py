import json
import os
import random
import re
import time
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

import requests

NCBI_EFETCH_PMC = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "helpus.ecommerce@gmail.com")
TOOL_NAME = "usmle-ingestion-pilot"

RANDOM_SEED = 42
random.seed(RANDOM_SEED)


def headers() -> dict:
    return {
        "User-Agent": f"USMLE-Ingestion-Pilot/1.0 (contact={CONTACT_EMAIL})",
        "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.1",
    }


def normalize_pmcid(pmcid: str) -> str:
    pmcid = (pmcid or "").strip().upper()
    if not pmcid:
        return ""
    if not pmcid.startswith("PMC"):
        pmcid = f"PMC{pmcid}"
    return pmcid


def fetch_ncbi_xml(pmcid: str, out_dir: str = "tmp", timeout: int = 60) -> str:
    pmcid = normalize_pmcid(pmcid)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{pmcid}.ncbi.xml")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        return out_path

    params = {
        "db": "pmc",
        "id": pmcid,
        "retmode": "xml",
        "tool": TOOL_NAME,
        "email": CONTACT_EMAIL,
    }
    r = requests.get(NCBI_EFETCH_PMC, params=params, headers=headers(), timeout=timeout)
    r.raise_for_status()
    content = r.content
    if b"<html" in content[:200].lower():
        raise RuntimeError(f"NCBI efetch returned HTML error payload for {pmcid}")

    with open(out_path, "wb") as f:
        f.write(content)
    return out_path


def load_xml(xml_path: str) -> ET.Element:
    with open(xml_path, "rb") as f:
        data = f.read()
    data = re.sub(br"<!DOCTYPE[^>]*>", b"", data)
    return ET.fromstring(data)


def clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s


def collect_text(nodes: List[ET.Element]) -> str:
    parts: List[str] = []
    for n in nodes:
        txt = "".join(n.itertext())
        txt = clean_text(txt)
        if txt:
            parts.append(txt)
    return "\n\n".join(parts).strip()


def extract_title(root: ET.Element) -> str:
    t = root.findall(".//article-title")
    if t:
        return clean_text("".join(t[0].itertext()))
    return ""


def extract_abstract(root: ET.Element) -> str:
    abs_nodes = root.findall(".//abstract")
    if abs_nodes:
        return collect_text(abs_nodes)
    return ""


def extract_body(root: ET.Element) -> str:
    body = root.findall(".//body")
    if body:
        ps: List[ET.Element] = []
        for b in body:
            ps.extend(b.findall(".//p"))
        if ps:
            return collect_text(ps)
        return collect_text(body)

    secs = root.findall(".//sec")
    if secs:
        ps = []
        for s in secs:
            ps.extend(s.findall(".//p"))
        if ps:
            return collect_text(ps)
    return ""


def extract_keywords_from_text(text: str, max_terms: int = 12) -> List[str]:
    """
    Simple heuristic: pull frequent capitalized / medical-ish tokens.
    This is NOT NLP; it's a lightweight way to get anchors for vignette writing.
    """
    if not text:
        return []

    # pick words that look like biomedical terms
    tokens = re.findall(r"\b[A-Za-z][A-Za-z\-]{3,}\b", text)
    stop = set([
        "with","that","this","from","were","have","has","been","into","their","than","then","also","using",
        "used","use","between","among","during","after","before","over","under","within","without","about",
        "study","studies","results","method","methods","conclusion","conclusions","patients","patient",
        "significant","significantly","data","analysis","clinical","group","groups","treatment","therapy",
        "disease","model","models","levels","increase","increased","decrease","decreased","associated",
        "including","however","therefore","these","those","which","when","where","while","because"
    ])

    norm = []
    for w in tokens:
        lw = w.lower()
        if lw in stop:
            continue
        if len(lw) < 5:
            continue
        norm.append(lw)

    # frequency
    freq: Dict[str, int] = {}
    for w in norm:
        freq[w] = freq.get(w, 0) + 1

    # pick top
    top = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)[: max_terms * 2]
    terms = [t for t, _ in top]

    # de-duplicate with original casing simplified (capitalize first letter)
    out = []
    seen = set()
    for t in terms:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= max_terms:
            break
    return out


def build_step1_like_stem(pmcid: str, title: str, abstract: str, body: str) -> str:
    """
    Generates an ORIGINAL Step1-like vignette (template + recomposed facts).
    Does NOT copy sentences; uses extracted keywords as anchors.
    """
    text_for_terms = " ".join([title, abstract, body])
    terms = extract_keywords_from_text(text_for_terms, max_terms=10)

    # Light "case generator" elements
    age = random.choice([19, 22, 27, 34, 41, 49, 56, 63, 71])
    sex = random.choice(["man", "woman"])
    duration = random.choice(["2 weeks", "1 month", "3 months", "6 months"])
    vitals = random.choice([
        "Temp 38.3°C (101°F), BP 112/70 mmHg, HR 104/min, RR 18/min",
        "Temp 37.6°C (99.7°F), BP 128/78 mmHg, HR 92/min, RR 16/min",
        "Temp 39.0°C (102.2°F), BP 98/62 mmHg, HR 118/min, RR 22/min",
    ])
    hx = random.choice([
        "no significant past medical history",
        "history of poorly controlled diabetes mellitus",
        "history of asthma treated intermittently with inhaled bronchodilators",
        "history of autoimmune thyroid disease",
        "recent course of broad-spectrum antibiotics",
    ])
    exam = random.choice([
        "Physical examination shows mild dehydration and diffuse abdominal tenderness without guarding.",
        "Physical examination shows scattered crackles on lung auscultation and mild tachycardia.",
        "Physical examination shows jaundice and right upper quadrant tenderness.",
        "Physical examination shows a new cardiac murmur and petechiae on the lower extremities.",
        "Physical examination shows proximal muscle weakness and hyperpigmented skin lesions.",
    ])
    labs = random.choice([
        "Laboratory studies show leukocytosis and elevated C-reactive protein.",
        "Laboratory studies show normocytic anemia and elevated LDH.",
        "Laboratory studies show elevated AST/ALT and conjugated hyperbilirubinemia.",
        "Laboratory studies show hyponatremia and hyperkalemia.",
        "Laboratory studies show elevated creatinine and proteinuria.",
    ])
    question_prompt = random.choice([
        "Which of the following best explains the underlying mechanism?",
        "Which of the following is the most likely diagnosis?",
        "Which of the following is the most appropriate next step in management?",
        "Which of the following findings is most likely to also be present?",
        "Which of the following pathways is most directly involved?",
    ])

    # Choose a "topic anchor" from terms if available
    anchor = ", ".join(terms[:3]) if terms else "a relevant molecular and physiologic process"

    stem = (
        f"A {age}-year-old {sex} presents with symptoms that have progressed over {duration}. "
        f"The patient has {hx}. {exam} Vital signs: {vitals}. {labs} "
        f"Recent literature on {anchor} has highlighted clinically important patterns that can be tested at the bedside. "
        f"{question_prompt}"
    )

    # Ensure Step1-like length: add a second paragraph with structured reasoning cues
    addendum = (
        "Additional history reveals intermittent constitutional symptoms and a partial response to symptomatic therapy. "
        "A targeted diagnostic workup is performed to distinguish between competing etiologies based on physiology, pathology, and pharmacology principles."
    )

    return stem + "\n\n" + addendum


def build_educational_blocks(pmcid: str, title: str, terms: List[str]) -> Dict[str, str]:
    topic = terms[0] if terms else "key mechanism"
    objective = f"Connect a clinical presentation to the underlying {topic} mechanism and distinguish key alternatives."
    bottom_line = f"Use core pathophysiology to map symptoms and labs to a single best explanation; avoid distractors that do not fit the mechanism."
    exam_tip = f"On Step 1, look for one or two discriminating clues (timing, labs, classic association) that align with {topic}."

    return {
        "educational_objective": objective,
        "bottom_line": bottom_line,
        "exam_tip": exam_tip,
    }


def main():
    in_path = os.path.join("seed", "seed_pilot_10_enriched.json")
    out_path = os.path.join("seed", "seed_pilot_10_step1stems.json")

    if not os.path.exists(in_path):
        raise FileNotFoundError(f"Missing input: {in_path}")

    with open(in_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    questions = payload.get("questions", [])
    if not isinstance(questions, list) or len(questions) != 10:
        raise ValueError("Expected questions[] length=10")

    print(f"Loaded {len(questions)} items from {in_path}")
    print(f"Contact email: {CONTACT_EMAIL}")

    updated = []
    for idx, item in enumerate(questions, start=1):
        ext = item.get("external_refs", {}) or {}
        pmcid = normalize_pmcid(ext.get("pmcid"))
        if not pmcid:
            raise ValueError(f"Item {idx} missing external_refs.pmcid")

        print(f"[{idx:02d}/10] Building Step1 stem for {pmcid} ...")

        xml_path = fetch_ncbi_xml(pmcid)
        root = load_xml(xml_path)

        title = extract_title(root)
        abstract = extract_abstract(root)
        body = extract_body(root)

        # terms for educational blocks
        terms = extract_keywords_from_text(" ".join([title, abstract, body]), max_terms=8)

        # build stem (original recomposition)
        stem = build_step1_like_stem(pmcid, title, abstract, body)

        # update item.question.stem + educational_blocks
        q = item.get("question", {})
        q["stem"] = stem
        q.setdefault("educational_blocks", {})
        q["educational_blocks"] = build_educational_blocks(pmcid, title, terms)
        item["question"] = q

        updated.append(item)
        time.sleep(0.15)

    payload["questions"] = updated
    payload.setdefault("batch_meta", {})
    payload["batch_meta"]["step1_stems_built"] = True
    payload["batch_meta"]["step1_stems_built_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    payload["batch_meta"]["step1_stems_random_seed"] = RANDOM_SEED
    payload["batch_meta"]["step1_stems_notes"] = "Template-based Step1-like stems generated from PMC XML anchors; no verbatim copying."

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Saved Step1 stem version to: {out_path}")
    print("Next: inspect 1-2 stems, then proceed to choices/explanations authoring pass.")


if __name__ == "__main__":
    main()
