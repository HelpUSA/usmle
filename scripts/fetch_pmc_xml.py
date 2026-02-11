import os
import sys
import time
from typing import Optional, Tuple

import requests

# Primary: Europe PMC full text XML (may be metadata-only or partial body)
EUROPE_PMC_FULLTEXT_XML = "https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"

# Official NCBI E-utilities efetch for PMC (often full body)
NCBI_EFETCH_PMC = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

# Fallback: PMC site parameter (sometimes blocked)
PMC_SITE_XML = "https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/?format=xml"

CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "helpus.ecommerce@gmail.com")


def build_headers() -> dict:
    ua = f"USMLE-Ingestion-Pilot/1.0 (contact={CONTACT_EMAIL})"
    return {
        "User-Agent": ua,
        "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.1",
    }


def normalize_pmcid(pmcid: str) -> str:
    pmcid = pmcid.strip().upper()
    if not pmcid.startswith("PMC"):
        pmcid = f"PMC{pmcid}"
    return pmcid


def save_xml(content: bytes, out_path: str) -> float:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(content)
    return os.path.getsize(out_path) / 1024.0


def try_fetch(url: str, params: Optional[dict] = None, timeout: int = 60) -> requests.Response:
    return requests.get(url, params=params, headers=build_headers(), timeout=timeout)


def fetch_from_europe_pmc(pmcid: str, timeout: int = 60) -> Tuple[bool, Optional[bytes], str]:
    url = EUROPE_PMC_FULLTEXT_XML.format(pmcid=pmcid)
    resp = try_fetch(url, timeout=timeout)
    if resp.status_code == 200 and resp.content:
        return True, resp.content, f"Europe PMC fullTextXML ({url})"
    return False, None, f"Europe PMC failed: HTTP {resp.status_code} ({url})"


def fetch_from_ncbi_efetch(pmcid: str, timeout: int = 60) -> Tuple[bool, Optional[bytes], str]:
    params = {
        "db": "pmc",
        "id": pmcid,
        "retmode": "xml",
    }
    resp = try_fetch(NCBI_EFETCH_PMC, params=params, timeout=timeout)
    if resp.status_code == 200 and resp.content:
        if b"<html" in resp.content[:200].lower():
            return False, None, "NCBI efetch returned HTML error payload"
        return True, resp.content, f"NCBI efetch ({resp.url})"
    return False, None, f"NCBI efetch failed: HTTP {resp.status_code} ({resp.url})"


def fetch_from_pmc_site(pmcid: str, timeout: int = 60) -> Tuple[bool, Optional[bytes], str]:
    url = PMC_SITE_XML.format(pmcid=pmcid)
    resp = try_fetch(url, timeout=timeout)
    if resp.status_code == 200 and resp.content:
        return True, resp.content, f"PMC site format=xml ({url})"
    return False, None, f"PMC site failed: HTTP {resp.status_code} ({url})"


def is_valid_xml(content: bytes) -> bool:
    head = content[:500].lower()
    return b"<xml" in head or b"<article" in head or b"<pmc-articleset" in head


def fetch_pmc_xml(pmcid: str, out_dir: str = "tmp", timeout: int = 60) -> str:
    pmcid = normalize_pmcid(pmcid)
    out_path = os.path.join(out_dir, f"{pmcid}.xml")

    attempts = [
        ("EuropePMC", fetch_from_europe_pmc, 2.0),   # KB threshold
        ("NCBIefetch", fetch_from_ncbi_efetch, 10.0),
        ("PMCsite", fetch_from_pmc_site, 10.0),
    ]

    last_msg = ""
    for name, fn, min_kb in attempts:
        print(f"Trying {name} for {pmcid} ...")
        ok, content, msg = fn(pmcid, timeout=timeout)
        last_msg = msg

        if ok and content and is_valid_xml(content):
            size_kb = save_xml(content, out_path)
            print(f"SUCCESS via {name}: {msg}")
            print(f"Saved XML to {out_path} ({size_kb:.1f} KB)")

            if size_kb < min_kb:
                print(
                    f"NOTE: XML size {size_kb:.1f} KB < expected {min_kb:.1f} KB "
                    f"for {name}. Content may be metadata-only, but is ACCEPTED."
                )
            return out_path

        print(f"  -> {msg}")
        time.sleep(0.25)

    raise RuntimeError(f"All fetch methods failed for {pmcid}. Last: {last_msg}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_pmc_xml.py PMC10464289")
        sys.exit(1)

    pmcid = sys.argv[1]
    fetch_pmc_xml(pmcid)


if __name__ == "__main__":
    main()
