# Study Engagement Status - 2026-05-15

## Current production baseline

- Production app: https://usmle.helpusbr.com
- Latest validated commit: be501a9 Add results to study loop
- Production validation status: OK_PRODUCTION_VALIDATED

Validated production pages:

- /study returns HTTP 200 and includes weekly real metrics, momentum CTA, and review CTA.
- /progress returns HTTP 200 and includes the engagement dashboard cockpit.
- /results returns HTTP 200 and includes the results-to-study loop.

## Phase 2 summary

Phase 2 converted the frontend from operational screens into a more engaging study loop while keeping all metrics honest and derived from existing data.

Completed pages:

- /study
- /progress
- /results

Schema changes:

- None.

New endpoints:

- None.

Existing API reused:

- /api/me/stats?range=7 for /study weekly metrics.
- /api/me/stats?range=365 for /progress dashboard metrics.

## Completed study engagement phases

### Phase 2A - Real weekly metrics on /study

Implemented:

- /study fetches /api/me/stats?range=7.
- Weekly answered questions are derived from real submitted-session stats.
- Weekly accuracy is derived from real stats.
- Study time is derived from average time and answered count.
- Flag count uses real stats.
- The page keeps exactly one stats fetch.

Validated in production:

- /api/me/stats?range=7 present in the /study JavaScript chunk.
- Fake labels removed from production JavaScript.

### Phase 2B - Level progress clarity on /study

Implemented:

- Derived Level based on weekly answered questions and default block size.
- Explicit progress text: X / N to next level.
- Explicit block-complete text: N / N block complete.
- No persisted gamification table.

Validated in production:

- to next level present.
- block complete present.
- No fake Level 6, 7 days, +120 XP, or Top rank.

### Phase 2C - Actionable weekly momentum on /study

Implemented:

- momentumHeadline.
- Next action.
- Review queue.
- Weekly Growth converted from passive metrics into actionable guidance.
- Values remain derived from existing session and stats data.

Validated in production:

- Next action present.
- Review queue present.
- questions to next level present.
- Start one focused block present.

### Phase 2D - Momentum action CTA on /study

Implemented:

- CTA inside the Weekly Growth / Momentum block.
- CTA resumes the active session when one exists.
- CTA starts a new default session when no active session exists.
- Reuses existing createAndStartSession flow.

Validated in production:

- Momentum action present.
- Starting... present.
- /api/me/stats?range=7 still present.

### Phase 2E - Review action CTA on /study

Implemented:

- Secondary review/progress CTA.
- Uses /progress as the review destination.
- Shows Review flags when flagged questions exist.
- Shows Open progress when there are no flagged questions.
- Adds guidance for flagged review or general progress tracking.

Validated in production:

- Review action present.
- Review flags present.
- Open progress present.
- /progress present.

### Phase 2F - Dashboard engagement cockpit on /progress

Implemented:

- Dashboard engagement cockpit section.
- 365-day real stats badge.
- Continue studying CTA.
- Review results CTA.
- Review queue card.
- Next focus card.
- Uses existing /api/me/stats?range=365 data.

Validated in production:

- /progress returned HTTP 200.
- Dashboard engagement cockpit present.
- 365-day real stats present.
- Continue studying present.
- Review results present.
- Review queue present.
- Next focus present.
- /api/me/stats?range=365 present.

### Phase 2G - Results-to-study loop on /results

Implemented:

- Results-to-study loop section.
- Turn every result into the next block message.
- Continue studying CTA to /study.
- Open progress CTA to /progress.
- Study next card.
- Review trends card.
- Simulation guardrail card.
- Cleaned existing /results mojibake.

Validated in production:

- /results returned HTTP 200.
- Results-to-study loop present.
- Turn every result into the next block present.
- Continue studying present.
- Open progress present.
- /study present.
- /progress present.
- No fake engagement labels.
- No mojibake markers.

## Files touched during Phase 2

Primary files:

- src/app/study/page.tsx
- src/components/study/StudyEngagementHero.tsx
- src/app/progress/page.tsx
- src/app/results/page.tsx

Supporting existing API:

- src/app/api/me/stats/route.ts

Documentation:

- docs/STUDY_ENGAGEMENT_STATUS_20260515.md
- docs/FRONTEND_ENGAGEMENT_REDESIGN_PLAN_20260515.md
- docs/USMLE_PLATFORM_STATUS_20260515.md

## Current product behavior

The frontend now has a basic engagement loop:

1. /study encourages starting or resuming a focused block.
2. /study shows real weekly momentum and review actions.
3. /progress gives a dashboard-style summary using real 365-day stats.
4. /results routes the user back to study or progress after reviewing outcomes.

## Guardrails still active

- Do not imply full USMLE simulation with the current question pool.
- Keep using partial simulation language.
- Do not add fake rankings.
- Do not add fake percentiles.
- Do not add fake XP.
- Do not persist gamification until a real schema/API is designed.
- Use /api/me/stats as the source for derived metrics until Phase 3.

## Production validation evidence

Production chunks confirmed presence of:

- /api/me/stats?range=7
- /api/me/stats?range=365
- Weekly growth
- Momentum action
- Review action
- Review flags
- Open progress
- Dashboard engagement cockpit
- 365-day real stats
- Results-to-study loop
- Continue studying
- /study
- /progress

Production chunks confirmed absence of:

- Level 6
- 7 days
- +120 XP
- Top rank
- StudyHeroV2
- userStats
- mojibake markers

## Recommended next phase

### Phase 3 - Persisted gamification design

Design before coding:

- User daily activity table.
- Streak model.
- XP/event model.
- Review queue model.
- Safe aggregation model for future ranking.
- Ranking or percentile only after real cohort data exists.

Suggested implementation order:

1. Draft schema and API contract.
2. Add migrations.
3. Add event capture for session start, answer attempt, session submit, and review activity.
4. Add persisted streak and XP summaries.
5. Surface persisted data in /study and /progress.
6. Consider ranking only after enough real users and privacy safeguards exist.
