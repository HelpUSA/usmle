import json
import os
import re
import time
from typing import Any, Dict, List, Optional

import requests

EUROPE_PMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

# Regex robusta para detectar PMCID em URLs
PMC_ID_RE = re.compile(r"(PMC[0-9]+)", re.IGNORECASE)


def europe_pmc_lookup_by_pmcid(pmcid: str, timeout: int = 30) -> Optional[Dict[str, Any]]:
    pmcid = pmcid.strip().upper()
    if not pmcid.startswith("PMC"):
        pmcid = f"PMC{pmcid}"

    params = {
        "query": f"PMCID:{pmcid}",
        "format": "json",
        "pageSize": 1,
        "resultType": "core",
    }
    r = requests.get(EUROPE_PMC_SEARCH_URL, params=params, timeout=timeout)
    r.raise_for_status()

    data = r.json()
    results = data.get("resultList", {}).get("result", [])
    return results[0] if results else None


def extract_license(record: Dict[str, Any]) -> str:
    for key in ("license", "licence", "copyright"):
        val = record.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()

    if record.get("isOpenAccess") is True:
        return "OPEN_ACCESS_LICENSE_UNSPECIFIED"

    return "UNKNOWN"


def safe_int(v: Any) -> Optional[int]:
    try:
        if v is None:
            return None
        return int(str(v).strip())
    except Exception:
        return None


def get_pmcid_from_item(item: Dict[str, Any]) -> Optional[str]:
    """
    Detecta PMCID a partir de:
      1) item.external_refs.pmcid
      2) item.question.bibliography[].url
    """
    ext = item.get("external_refs")
    if isinstance(ext, dict):
        pmcid = ext.get("pmcid")
        if isinstance(pmcid, str) and pmcid.strip():
            return pmcid.strip().upper()

    question = item.get("question", {})
    bibliography = question.get("bibliography", [])
    if isinstance(bibliography, list):
        for ref in bibliography:
            if not isinstance(ref, dict):
                continue
            url = ref.get("url")
            if isinstance(url, str):
                m = PMC_ID_RE.search(url)
                if m:
                    return m.group(1).upper()

    return None


def enrich_question_item(item: Dict[str, Any], sleep_seconds: float = 0.2) -> Dict[str, Any]:
    pmcid = get_pmcid_from_item(item)

    if not pmcid:
        item.setdefault("external_refs", {})
        item["external_refs"].setdefault("meta", {})
        item["external_refs"]["meta"]["europe_pmc_lookup"] = "missing_pmcid"
        return item

    record = europe_pmc_lookup_by_pmcid(pmcid)
    time.sleep(sleep_seconds)

    ext = item.setdefault("external_refs", {})
    ext["pmcid"] = pmcid

    if not record:
        ext.setdefault("meta", {})
        ext["meta"]["europe_pmc_lookup"] = "not_found"
        return item

    doi = record.get("doi")
    if isinstance(doi, str) and doi.strip():
        ext["doi"] = doi.strip()

    ext["license"] = extract_license(record)

    meta = ext.setdefault("meta", {})
    meta.update({
        "title": record.get("title"),
        "journal": record.get("journalTitle"),
        "year": safe_int(record.get("pubYear")),
        "authorString": record.get("authorString"),
        "firstAuthor": record.get("firstAuthor"),
        "isOpenAccess": record.get("isOpenAccess"),
        "pmid": record.get("pmid"),
        "source": record.get("source"),
        "hasFullText": record.get("hasFullText"),
    })

    return item


def main():
    # ⚠️ Caminhos DEFINITIVOS (Opção B correta)
    in_path = os.path.join("seed", "pilot_batch_10.json")
    out_path = os.path.join("seed", "seed_pilot_10_enriched.json")

    if not os.path.exists(in_path):
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {in_path}")

    with open(in_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    questions: List[Dict[str, Any]] = payload.get("questions", [])
    if not questions:
        raise ValueError("Arquivo de entrada não contém questions[]")

    print(f"Loaded {len(questions)} questions from {in_path}")
    print("Preview keys of first item:", list(questions[0].keys()))
    print("Detected PMCID in first item:", get_pmcid_from_item(questions[0]))

    enriched = []
    missing = 0

    for idx, q in enumerate(questions, start=1):
        pmcid = get_pmcid_from_item(q)
        print(f"[{idx:02d}/{len(questions)}] Enriching PMCID={pmcid}")
        try:
            enriched.append(enrich_question_item(q))
            if not pmcid:
                missing += 1
        except Exception as e:
            q.setdefault("external_refs", {})
            q["external_refs"].setdefault("meta", {})
            q["external_refs"]["meta"]["europe_pmc_error"] = str(e)
            enriched.append(q)
            print(f"  -> WARN: erro ao enriquecer {pmcid}: {e}")

    payload["questions"] = enriched
    payload.setdefault("batch_meta", {})
    payload["batch_meta"]["enriched_with"] = "europe_pmc"
    payload["batch_meta"]["enriched_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    payload["batch_meta"]["missing_pmcid_count"] = missing

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Saved enriched JSON to: {out_path}")
    if missing:
        print(f"WARNING: {missing} item(s) had missing PMCID")


if __name__ == "__main__":
    main()
