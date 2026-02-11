import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
import xml.etree.ElementTree as ET

EUROPE_PMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
NCBI_EFETCH_PMC = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "helpus.ecommerce@gmail.com")
TOOL_NAME = "usmle-ingestion-pilot"

PMC_ID_RE = re.compile(r"^PMC[0-9]+$", re.IGNORECASE)


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


def is_valid_pmcid(pmcid: str) -> bool:
    return bool(PMC_ID_RE.match(pmcid or ""))


def europe_pmc_find_candidates(page_size: int = 25) -> List[Dict[str, Any]]:
    """
    Finds candidate OA articles that are in PMC.
    Query aims for 'safe' candidates; we'll still validate via NCBI body_words.
    """
    params = {
        "query": "OPEN_ACCESS:Y AND IN_PMC:Y",
        "format": "json",
        "pageSize": page_size,
        "resultType": "core",
        "sort": "FIRST_PDATE_D desc",
    }
    r = requests.get(EUROPE_PMC_SEARCH_URL, params=params, headers=headers(), timeout=60)
    r.raise_for_status()
    data = r.json()
    return data.get("resultList", {}).get("result", [])


def fetch_ncbi_xml(pmcid: str, out_dir: str = "tmp", timeout: int = 60) -> Tuple[str, float]:
    pmcid = normalize_pmcid(pmcid)
    if not is_valid_pmcid(pmcid):
        raise ValueError(f"Invalid PMCID: {pmcid}")

    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{pmcid}.ncbi.xml")

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
        raise RuntimeError("NCBI efetch returned HTML error payload")

    with open(out_path, "wb") as f:
        f.write(content)

    size_kb = os.path.getsize(out_path) / 1024.0
    return out_path, size_kb


def load_xml(xml_path: str) -> ET.Element:
    with open(xml_path, "rb") as f:
        data = f.read()
    data = re.sub(br"<!DOCTYPE[^>]*>", b"", data)
    return ET.fromstring(data)


def collect_text(nodes: List[ET.Element]) -> str:
    parts: List[str] = []
    for n in nodes:
        txt = "".join(n.itertext())
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt:
            parts.append(txt)
    return "\n\n".join(parts).strip()


def extract_body_words(root: ET.Element) -> int:
    body = root.findall(".//body")
    if body:
        ps: List[ET.Element] = []
        for b in body:
            ps.extend(b.findall(".//p"))
        text = collect_text(ps) if ps else collect_text(body)
        return len(text.split()) if text else 0

    secs = root.findall(".//sec")
    if secs:
        ps = []
        for s in secs:
            ps.extend(s.findall(".//p"))
        text = collect_text(ps)
        return len(text.split()) if text else 0

    return 0


def build_item_from_candidate(pmcid: str, doi: Optional[str]) -> Dict[str, Any]:
    pmcid = normalize_pmcid(pmcid)
    url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/"

    return {
        "external_refs": {
            "source": "pmc_oa",
            "pmcid": pmcid,
            "doi": doi,
            "license": "UNKNOWN",
            "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        },
        "question": {
            "stem": f"[PLACEHOLDER] Rewrite a Step1-like vignette for {pmcid}. Add history, exam, labs, and a clear question prompt.",
            "difficulty": 3,
            "prompt": None,
            "bibliography": [
                {"label": "Primary OA Source", "url": url}
            ],
            "educational_blocks": {
                "educational_objective": "[PLACEHOLDER] Educational Objective",
                "bottom_line": "[PLACEHOLDER] Bottom Line",
                "exam_tip": "[PLACEHOLDER] Exam Tip",
            },
        },
        "choices": [
            {"label": "A", "text": "[PLACEHOLDER] Option A", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
            {"label": "B", "text": "[PLACEHOLDER] Option B", "is_correct": True,  "explanation": "[PLACEHOLDER] Why correct"},
            {"label": "C", "text": "[PLACEHOLDER] Option C", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
            {"label": "D", "text": "[PLACEHOLDER] Option D", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
            {"label": "E", "text": "[PLACEHOLDER] Option E", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
        ],
    }


def main():
    in_path = os.path.join("seed", "seed_pilot_10_enriched.json")
    if not os.path.exists(in_path):
        raise FileNotFoundError(f"Missing input: {in_path}")

    with open(in_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    questions = payload.get("questions", [])
    if not isinstance(questions, list) or len(questions) != 10:
        raise ValueError("Expected questions[] with length=10")

    # We replace idx=1 (0-based index 0), because audit reported idx=1 as bad.
    bad_index = 0

    existing = set()
    for it in questions:
        ext = it.get("external_refs", {}) or {}
        pmcid = normalize_pmcid(ext.get("pmcid"))
        if pmcid:
            existing.add(pmcid)

    print(f"Existing PMCIDs in batch: {len(existing)}")
    print(f"Replacing item index={bad_index+1} ...")

    candidates = europe_pmc_find_candidates(page_size=30)
    print(f"Fetched {len(candidates)} candidates from Europe PMC")

    chosen = None
    for c in candidates:
        pmcid = normalize_pmcid(c.get("pmcid"))
        doi = c.get("doi")
        if not pmcid or not is_valid_pmcid(pmcid):
            continue
        if pmcid in existing:
            continue

        print(f"Testing candidate {pmcid} (doi={doi}) ...")
        try:
            xml_path, size_kb = fetch_ncbi_xml(pmcid)
            root = load_xml(xml_path)
            body_words = extract_body_words(root)
            print(f"  -> ncbi_xml_kb={size_kb:.1f}, body_words={body_words}")

            if body_words >= 200:
                chosen = (pmcid, doi, size_kb, body_words)
                break

        except Exception as e:
            print(f"  -> skip {pmcid}: {e}")

        time.sleep(0.25)

    if not chosen:
        raise RuntimeError("No suitable replacement found (body_words>=200) within candidate set.")

    pmcid, doi, size_kb, body_words = chosen
    print(f"CHOSEN replacement: {pmcid} (doi={doi}) xml_kb={size_kb:.1f} body_words={body_words}")

    # Backup
    backup_path = in_path + ".bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Backup saved: {backup_path}")

    # Replace item
    questions[bad_index] = build_item_from_candidate(pmcid, doi)
    payload["questions"] = questions
    payload.setdefault("batch_meta", {})
    payload["batch_meta"]["replaced_bad_item"] = {
        "old_index": bad_index + 1,
        "new_pmcid": pmcid,
        "new_doi": doi,
        "measured_body_words": body_words,
        "measured_ncbi_xml_kb": round(size_kb, 1),
    }

    with open(in_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Updated batch saved: {in_path}")
    print("Next: rerun audit_fulltext_coverage.py to confirm 10/10 OK_FULLTEXT.")


if __name__ == "__main__":
    main()
