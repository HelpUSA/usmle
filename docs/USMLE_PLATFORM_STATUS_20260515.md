# USMLE Platform Status — 2026-05-15

## Current production status

- Production domain: https://usmle.helpusbr.com
- Latest confirmed branch: main
- Latest confirmed commit: 64ffdfa Ignore local working artifacts
- Production health endpoint validated: /api/health returned 200 and db=up.
- Main production pages validated with HTTP 200:
  - /
  - /progress
  - /results
  - /settings
  - /study

## Completed in this cycle

### USMLE 2026 partial simulation

- Clarified that current exam simulation is a partial simulation, not a full-length exam.
- /study now presents "USMLE 2026 partial simulation".
- Session player now labels exam_sim as "Partial simulation".
- UI labels were aligned across:
  - Dashboard
  - Progress
  - Results
  - Settings
  - Study
  - Session player

### Results metrics

- /api/sessions now returns per-session metrics for results display.
- /results now displays session-level metrics:
  - answered
  - correct
  - wrong
  - skipped
  - flagged
  - accuracy
  - average time per question

### Local working artifacts

- .gitignore now ignores local working artifacts:
  - backups/
  - temp/
  - *.bak_*
  - *.err.log
  - *.log

## Confirmed question pool

Read-only database inventory confirmed published active question versions:

- Step 1: 30
- Step 2 CK: 20
- Step 3: 30

Current product implication:

- Only one 20-question / 30-minute official-format partial simulation block should be offered.
- Full-length and multi-block simulation should remain locked/planned until the pool grows.

## Recent commits

- 16fa125 Show session metrics on results page
- d1a0010 Clarify partial USMLE 2026 exam simulation
- 8a32ba7 Align session player partial simulation label
- 5538cf9 Use partial simulation labels across UI
- 64ffdfa Ignore local working artifacts

## Current safe next steps

1. Keep partial simulation as one 20-question / 30-minute block.
2. Do not implement multi-block simulation until the question pool reaches at least 40 published active questions per exam.
3. Continue generating curated question batches.
4. Re-run build and production smoke after every committed UI/API change.
5. Avoid manual broad replacements in src/app/study/page.tsx; use targeted patches only after line-context readback.

## Risk notes

- Encoding corruption was observed during manual PowerShell rewrites of src/app/study/page.tsx.
- Avoid Set-Content/Get-Content rewrites on TSX files containing Unicode punctuation unless using a carefully validated UTF-8 writer.
- Do not mutate production database during UI/API validation.
- Do not print DATABASE_URL or secrets in logs.
