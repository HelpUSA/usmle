import csv
import json
import os
import time
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

import requests

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

    # quick HTML error check
    if b"<html" in content[:200].lower():
        raise RuntimeError(f"NCBI efetch returned HTML error payload for {pmcid}")

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


def extract_abstract(root: ET.Element) -> str:
    abstracts = root.findall(".//abstract")
    if abstracts:
        return collect_text(abstracts)
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


def wc(s: str) -> int:
    return len(s.split()) if s else 0


def main():
    in_path = os.path.join("seed", "seed_pilot_10_enriched.json")
    if not os.path.exists(in_path):
        raise FileNotFoundError(f"Missing input: {in_path}")

    with open(in_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    questions = payload.get("questions", [])
    if not isinstance(questions, list) or not questions:
        raise ValueError("Input has no questions[]")

    out_csv = os.path.join("tmp", "pilot_fulltext_coverage.csv")
    out_json = os.path.join("tmp", "pilot_fulltext_coverage.json")

    results: List[Dict[str, Any]] = []

    print(f"Auditing {len(questions)} items from {in_path}")
    print(f"Contact email: {CONTACT_EMAIL}")

    for i, item in enumerate(questions, start=1):
        ext = item.get("external_refs", {}) or {}
        pmcid = normalize_pmcid(ext.get("pmcid"))
        doi = ext.get("doi")

        print(f"[{i:02d}/{len(questions)}] PMCID={pmcid} ...")

        row: Dict[str, Any] = {
            "index": i,
            "pmcid": pmcid,
            "doi": doi,
            "ncbi_xml_kb": None,
            "abstract_words": None,
            "body_words": None,
            "status": None,
            "error": None,
        }

        try:
            if not pmcid:
                raise ValueError("missing_pmcid")

            xml_path, size_kb = fetch_ncbi_xml(pmcid)
            row["ncbi_xml_kb"] = round(size_kb, 1)

            root = load_xml(xml_path)
            abstract = extract_abstract(root)
            body = extract_body(root)

            row["abstract_words"] = wc(abstract)
            row["body_words"] = wc(body)

            # classify
            if row["body_words"] >= 200:
                row["status"] = "OK_FULLTEXT"
            elif row["abstract_words"] >= 80 or row["body_words"] >= 80:
                row["status"] = "SHORT_TEXT"
            else:
                row["status"] = "TOO_LITTLE_TEXT"

        except Exception as e:
            row["status"] = "ERROR"
            row["error"] = str(e)

        results.append(row)
        time.sleep(0.25)

    os.makedirs("tmp", exist_ok=True)

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["index", "pmcid", "doi", "ncbi_xml_kb", "abstract_words", "body_words", "status", "error"],
        )
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    # summary
    ok = [r for r in results if r["status"] == "OK_FULLTEXT"]
    short = [r for r in results if r["status"] == "SHORT_TEXT"]
    little = [r for r in results if r["status"] == "TOO_LITTLE_TEXT"]
    err = [r for r in results if r["status"] == "ERROR"]

    print("\n=== SUMMARY ===")
    print(f"OK_FULLTEXT: {len(ok)}")
    print(f"SHORT_TEXT: {len(short)}")
    print(f"TOO_LITTLE_TEXT: {len(little)}")
    print(f"ERROR: {len(err)}")
    print(f"\nSaved report JSON: {out_json}")
    print(f"Saved report CSV : {out_csv}")

    if little:
        print("\nItems to REPLACE (TOO_LITTLE_TEXT):")
        for r in little:
            print(f"  - idx={r['index']} pmcid={r['pmcid']} body_words={r['body_words']} xml_kb={r['ncbi_xml_kb']}")


if __name__ == "__main__":
    main()
