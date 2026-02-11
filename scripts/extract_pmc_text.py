import os
import re
import sys
import xml.etree.ElementTree as ET
from typing import List, Tuple


def normalize_pmcid(pmcid: str) -> str:
    pmcid = pmcid.strip().upper()
    if not pmcid.startswith("PMC"):
        pmcid = f"PMC{pmcid}"
    return pmcid


def load_xml(xml_path: str) -> ET.Element:
    with open(xml_path, "rb") as f:
        data = f.read()

    # Remove DOCTYPE defensivamente
    data = re.sub(br"<!DOCTYPE[^>]*>", b"", data)

    return ET.fromstring(data)


def collect_text_from_nodes(nodes: List[ET.Element]) -> str:
    parts: List[str] = []
    for n in nodes:
        txt = "".join(n.itertext())
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt:
            parts.append(txt)
    return "\n\n".join(parts).strip()


def find_abstract(root: ET.Element) -> str:
    abstracts = root.findall(".//abstract")
    if abstracts:
        return collect_text_from_nodes(abstracts)

    abs_like = [el for el in root.iter() if "abstract" in el.tag.lower()]
    if abs_like:
        return collect_text_from_nodes(abs_like)

    return ""


def find_body_paragraphs(root: ET.Element) -> str:
    body = root.findall(".//body")
    if body:
        ps: List[ET.Element] = []
        for b in body:
            ps.extend(b.findall(".//p"))
        if ps:
            return collect_text_from_nodes(ps)
        return collect_text_from_nodes(body)

    secs = root.findall(".//sec")
    if secs:
        ps = []
        for s in secs:
            ps.extend(s.findall(".//p"))
        if ps:
            return collect_text_from_nodes(ps)

    return ""


def find_title(root: ET.Element) -> str:
    title_nodes = root.findall(".//article-title")
    if title_nodes:
        t = "".join(title_nodes[0].itertext()).strip()
        t = re.sub(r"\s+", " ", t)
        return t
    return ""


def word_count(s: str) -> int:
    return len(s.split()) if s else 0


def summarize_extraction(abstract: str, body: str) -> str:
    abs_wc = word_count(abstract)
    body_wc = word_count(body)

    if body_wc >= 200:
        quality = "body_text_available"
    elif abs_wc >= 80 or body_wc >= 80:
        quality = "abstract_only_or_short_body"
    else:
        quality = "too_little_text"

    return f"abstract_words={abs_wc}, body_words={body_wc}, quality={quality}"


def extract_pmc_text(pmcid: str, xml_path: str = "", out_dir: str = "tmp") -> Tuple[str, str]:
    pmcid = normalize_pmcid(pmcid)

    if not xml_path:
        xml_path = os.path.join("tmp", f"{pmcid}.xml")

    if not os.path.exists(xml_path):
        raise FileNotFoundError(f"XML not found: {xml_path}")

    root = load_xml(xml_path)

    title = find_title(root)
    abstract = find_abstract(root)
    body = find_body_paragraphs(root)

    report = summarize_extraction(abstract, body)

    chunks: List[str] = []
    chunks.append(f"SOURCE_XML:\n{xml_path}")
    if title:
        chunks.append(f"TITLE:\n{title}")
    if abstract:
        chunks.append(f"ABSTRACT:\n{abstract}")
    if body:
        chunks.append(f"BODY:\n{body}")

    combined = ("\n\n" + ("-" * 80) + "\n\n").join(chunks).strip()

    os.makedirs(out_dir, exist_ok=True)
    out_txt = os.path.join(out_dir, f"{pmcid}.txt")
    out_report = os.path.join(out_dir, f"{pmcid}.report.txt")

    with open(out_txt, "w", encoding="utf-8") as f:
        f.write(combined)

    with open(out_report, "w", encoding="utf-8") as f:
        f.write(report + "\n")

    print(f"Saved text to: {out_txt}")
    print(f"Saved report to: {out_report}")
    print("REPORT:", report)

    return out_txt, out_report


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python extract_pmc_text.py PMC10464289")
        print("  python extract_pmc_text.py PMC10464289 tmp\\PMC10464289.ncbi.xml")
        sys.exit(1)

    pmcid = sys.argv[1]
    xml_path = sys.argv[2] if len(sys.argv) >= 3 else ""
    extract_pmc_text(pmcid, xml_path=xml_path)


if __name__ == "__main__":
    main()
