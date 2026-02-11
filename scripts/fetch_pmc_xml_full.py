import os
import sys
import time
from typing import Optional, Tuple

import requests

EUROPE_PMC_FULLTEXT_XML = "https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
NCBI_EFETCH_PMC = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "helpus.ecommerce@gmail.com")


def headers() -> dict:
    return {
        "User-Agent": f"USMLE-Ingestion-Pilot/1.0 (contact={CONTACT_EMAIL})",
        "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.1",
    }


def normalize_pmcid(pmcid: str) -> str:
    pmcid = pmcid.strip().upper()
    if not pmcid.startswith("PMC"):
        pmcid = f"PMC{pmcid}"
    return pmcid


def save_bytes(path: str, content: bytes) -> float:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    return os.path.getsize(path) / 1024.0


def is_probably_xml(content: bytes) -> bool:
    head = content[:500].lower()
    return (b"<article" in head) or (b"<pmc-articleset" in head) or (b"<?xml" in head) or (b"<xml" in head)


def fetch_europe_pmc(pmcid: str, timeout: int = 60) -> Tuple[bool, Optional[bytes], str]:
    url = EUROPE_PMC_FULLTEXT_XML.format(pmcid=pmcid)
    r = requests.get(url, headers=headers(), timeout=timeout)
    if r.status_code == 200 and r.content and is_probably_xml(r.content):
        return True, r.content, url
    return False, None, f"Europe PMC HTTP {r.status_code} ({url})"


def fetch_ncbi_efetch(pmcid: str, timeout: int = 60) -> Tuple[bool, Optional[bytes], str]:
    params = {
        "db": "pmc",
        "id": pmcid,
        "retmode": "xml",
        # Tool & email ajudam o NCBI a identificar o cliente (boa prática)
        "tool": "usmle-ingestion-pilot",
        "email": CONTACT_EMAIL,
    }
    r = requests.get(NCBI_EFETCH_PMC, params=params, headers=headers(), timeout=timeout)
    if r.status_code == 200 and r.content:
        # às vezes o NCBI devolve HTML de erro; checagem rápida
        if b"<html" in r.content[:200].lower():
            return False, None, f"NCBI efetch returned HTML error ({r.url})"
        if not is_probably_xml(r.content):
            return False, None, f"NCBI efetch returned non-XML ({r.url})"
        return True, r.content, r.url
    return False, None, f"NCBI efetch HTTP {r.status_code} ({r.url})"


def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_pmc_xml_full.py PMC10464289")
        sys.exit(1)

    pmcid = normalize_pmcid(sys.argv[1])

    out_dir = "tmp"
    out_epmc = os.path.join(out_dir, f"{pmcid}.europepmc.xml")
    out_ncbi = os.path.join(out_dir, f"{pmcid}.ncbi.xml")

    print(f"PMCID: {pmcid}")
    print(f"Contact email: {CONTACT_EMAIL}")

    print("\n[1/2] Fetching Europe PMC fullTextXML ...")
    ok1, content1, msg1 = fetch_europe_pmc(pmcid)
    if ok1 and content1:
        size1 = save_bytes(out_epmc, content1)
        print(f"  SUCCESS Europe PMC: saved {out_epmc} ({size1:.1f} KB)")
        print(f"  Source: {msg1}")
    else:
        print(f"  FAIL Europe PMC: {msg1}")

    time.sleep(0.25)

    print("\n[2/2] Fetching NCBI efetch (db=pmc, retmode=xml) ...")
    ok2, content2, msg2 = fetch_ncbi_efetch(pmcid)
    if ok2 and content2:
        size2 = save_bytes(out_ncbi, content2)
        print(f"  SUCCESS NCBI efetch: saved {out_ncbi} ({size2:.1f} KB)")
        print(f"  Source: {msg2}")
    else:
        print(f"  FAIL NCBI efetch: {msg2}")

    print("\nDone.")
    print("Next: run extractor against the NCBI file:")
    print(f"  python .\\scripts\\extract_pmc_text.py {pmcid} tmp\\{pmcid}.ncbi.xml")


if __name__ == "__main__":
    main()
