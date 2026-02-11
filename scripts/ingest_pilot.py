import os
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests

EUROPE_PMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


# -----------------------------
# Configuration
# -----------------------------
@dataclass
class Config:
    import_api_url: str              # e.g. https://your-backend/api/admin/import
    import_api_token: Optional[str]  # if your API is protected (Bearer token)
    max_candidates_per_topic: int = 10
    sleep_seconds: float = 0.25      # polite pacing
    require_pmcid: bool = True       # prefer PMCID to retrieve from PMC OA
    pilot_topics: List[str] = None
    validation_profile: str = "dryrun"  # "dryrun" | "strict"


def load_config() -> Config:
    # Pilot topic pack: discovery queries (can be refined later)
    topics = [
        "metabolic acidosis case report",
        "microcytic anemia iron deficiency thalassemia case report",
        "septic shock differential diagnosis case report",
        "congestive heart failure RAAS edema case report",
        "diabetic ketoacidosis vs HHS case report",
        "aspiration pneumonia case report",
        "Graves disease vs Hashimoto thyroiditis case report",
        "nephritic vs nephrotic syndrome case report",
        "upper motor neuron vs lower motor neuron lesion case report",
        "aminoglycoside ototoxicity nephrotoxicity case report",
    ]

    profile = os.getenv("VALIDATION_PROFILE", "dryrun").strip().lower()
    if profile not in ("dryrun", "strict"):
        profile = "dryrun"

    return Config(
        import_api_url=os.getenv("IMPORT_API_URL", "").strip(),
        import_api_token=os.getenv("IMPORT_API_TOKEN", "").strip() or None,
        pilot_topics=topics,
        validation_profile=profile,
    )


# -----------------------------
# Europe PMC discovery
# -----------------------------
def europe_pmc_search(query: str, page_size: int = 10) -> List[Dict[str, Any]]:
    """
    Uses Europe PMC REST search to discover candidate articles.
    Returns a list of result dicts.
    """
    params = {
        "query": query,
        "format": "json",
        "pageSize": page_size,
        "resultType": "core",
    }
    r = requests.get(EUROPE_PMC_SEARCH_URL, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data.get("resultList", {}).get("result", [])


def pick_pmcids(results: List[Dict[str, Any]]) -> List[str]:
    """
    Extract PMCID if present.
    Field names can vary; we defensively check common keys.
    """
    pmcids: List[str] = []
    for item in results:
        pmcid = item.get("pmcid") or item.get("pmcId") or item.get("pmc_id")
        if pmcid:
            pmcid_str = str(pmcid).upper()
            if not pmcid_str.startswith("PMC"):
                pmcid_str = f"PMC{pmcid_str}"
            pmcids.append(pmcid_str)

    # Deduplicate preserving order
    seen = set()
    out = []
    for x in pmcids:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# -----------------------------
# Transformation stub
# -----------------------------
def transform_to_question(pmcid: str) -> Dict[str, Any]:
    """
    TODO: Fetch full text (via PMC OA channels) and transform into an original Step1-like question.
    This stub is intentionally simple so the pipeline can run end-to-end in DRYRUN mode.
    Replace with your editorial/LLM layer before STRICT import.
    """
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")

    return {
        "external_refs": {
            "source": "pmc_oa",
            "pmcid": pmcid,
            "doi": None,
            "license": "UNKNOWN",
            "retrieved_at": now,
        },
        "question": {
            "stem": f"[PLACEHOLDER] Rewrite a Step1-like vignette for {pmcid}. "
                    f"Add history, exam, labs, and a clear question prompt.",
            "difficulty": 3,
            "prompt": None,
            "bibliography": [
                {"label": "Primary OA Source", "url": f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/"}
            ],
            "educational_blocks": {
                "educational_objective": "[PLACEHOLDER] Educational Objective",
                "bottom_line": "[PLACEHOLDER] Bottom Line",
                "exam_tip": "[PLACEHOLDER] Exam Tip"
            }
        },
        "choices": [
            {"label": "A", "text": "[PLACEHOLDER] Option A", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
            {"label": "B", "text": "[PLACEHOLDER] Option B", "is_correct": True,  "explanation": "[PLACEHOLDER] Why correct"},
            {"label": "C", "text": "[PLACEHOLDER] Option C", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
            {"label": "D", "text": "[PLACEHOLDER] Option D", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
            {"label": "E", "text": "[PLACEHOLDER] Option E", "is_correct": False, "explanation": "[PLACEHOLDER] Why wrong"},
        ]
    }


# -----------------------------
# Validation
# -----------------------------
def validate_item(item: Dict[str, Any], profile: str = "dryrun") -> None:
    """
    DRYRUN: Validate only structural invariants so we can test discovery + JSON generation.
    STRICT: Enforce Step1-like constraints (vignette length etc.) before real import.
    """
    # Basic structure checks (always)
    choices = item.get("choices", [])
    if len(choices) != 5:
        raise ValueError("Each question must have exactly 5 choices.")

    correct = [c for c in choices if c.get("is_correct") is True]
    if len(correct) != 1:
        raise ValueError("Each question must have exactly 1 correct choice.")

    for c in choices:
        if not c.get("text") or not str(c["text"]).strip():
            raise ValueError("Every choice must have non-empty text.")
        if not c.get("explanation") or not str(c["explanation"]).strip():
            raise ValueError("Every choice must have a non-empty explanation.")

    # STRICT-only Step1-like constraints
    if profile == "strict":
        stem = item.get("question", {}).get("stem", "") or ""
        word_count = len(stem.split())
        # Step1-like vignettes are typically long; set a stronger threshold for production
        if word_count < 120:
            raise ValueError(
                f"Stem too short for Step1-like in STRICT mode "
                f"(words={word_count}, required>=120)."
            )


# -----------------------------
# Import
# -----------------------------
def post_import(cfg: Config, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not cfg.import_api_url:
        raise ValueError("IMPORT_API_URL is not set. Set it in env before importing.")

    headers = {"Content-Type": "application/json"}
    if cfg.import_api_token:
        headers["Authorization"] = f"Bearer {cfg.import_api_token}"

    r = requests.post(cfg.import_api_url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "")
    if ctype.startswith("application/json"):
        return r.json()
    return {"status": "ok"}


# -----------------------------
# Main
# -----------------------------
def main() -> None:
    cfg = load_config()

    batch = {
        "batch_meta": {
            "batch_id": "pilot-10-2026-02-02",
            "source_policy": "pmc_oa_only",
            "created_at": "2026-02-02T09:30:00-03:00",
            "notes": f"Step1-like pilot batch; validation_profile={cfg.validation_profile}; "
                     f"choice-level explanations required."
        },
        "questions": []
    }

    # 1) Discover candidate PMCIDs per topic
    selected_pmcids: List[str] = []
    for topic in cfg.pilot_topics:
        results = europe_pmc_search(topic, page_size=cfg.max_candidates_per_topic)
        pmcids = pick_pmcids(results)
        for pmcid in pmcids:
            if pmcid not in selected_pmcids:
                selected_pmcids.append(pmcid)
        time.sleep(cfg.sleep_seconds)

    # 2) Take first N unique PMCIDs for pilot
    selected_pmcids = selected_pmcids[:10]

    if cfg.require_pmcid and len(selected_pmcids) < 10:
        raise RuntimeError(f"Not enough PMCID candidates found. Found={len(selected_pmcids)}")

    # 3) Transform + validate + add to batch
    for pmcid in selected_pmcids:
        item = transform_to_question(pmcid)
        validate_item(item, cfg.validation_profile)
        batch["questions"].append(item)

    # 4) Save JSON for audit/repro
    out_path = "pilot_batch_10.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(batch, f, ensure_ascii=False, indent=2)

    print(f"Generated {out_path} with {len(batch['questions'])} items.")
    print(f"Validation profile: {cfg.validation_profile}")

    # 5) Optional import
    if cfg.import_api_url:
        resp = post_import(cfg, batch)
        print("Import response:", resp)
    else:
        print("IMPORT_API_URL not set; skipping import. Set env to import to Railway.")


if __name__ == "__main__":
    main()
