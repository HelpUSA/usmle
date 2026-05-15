# Study Engagement Status - 2026-05-15

## Current production baseline

- Production URL: https://usmle.helpusbr.com/study
- Latest validated commit: 8dbc13a Add weekly review action CTA
- Production validation: OK_PRODUCTION_VALIDATED
- /study returns HTTP 200.
- Production JavaScript includes /api/me/stats?range=7.
- Production JavaScript includes weekly momentum and review CTA language.
- Production JavaScript includes /progress.

## Removed fake or unsafe tokens

- Level 6
- 7 days
- +120 XP
- Top rank
- StudyHeroV2
- userStats
- mojibake tokens such as Ã¢ and â€

## Completed study engagement phases

### Phase 2A - Real weekly metrics

- /study fetches /api/me/stats?range=7.
- Weekly answered questions are derived from real submitted-session stats.
- Weekly accuracy is derived from real stats.
- Study time is derived from average time and answered count.
- Flag count uses real stats.
- The page keeps exactly one stats fetch.

### Phase 2B - Level progress clarity

- Added derived Level based on weekly answered questions and default block size.
- Added explicit progress text: X / N to next level.
- Added explicit block-complete text: N / N block complete.
- No persisted gamification schema was added.

### Phase 2C - Actionable weekly momentum

- Added momentumHeadline.
- Added Next action.
- Added Review queue.
- Converted Weekly Growth from passive metrics into actionable guidance.
- Values remain derived from existing session and stats data.

### Phase 2D - Momentum action CTA

- Added a CTA inside the Weekly Growth / Momentum block.
- CTA resumes the active session when one exists.
- CTA starts a new default session when no active session exists.
- Reuses the existing createAndStartSession flow.
- No new endpoint was introduced.

### Phase 2E - Review action CTA

- Added a secondary review/progress CTA.
- Uses /progress as the review destination.
- Shows Review flags when flagged questions exist.
- Shows Open progress when there are no flagged questions.
- Adds guidance for flagged review or general progress tracking.

## Files touched by Phase 2

- src/app/study/page.tsx
- src/components/study/StudyEngagementHero.tsx
- src/app/api/me/stats/route.ts is the existing supporting API.

## Current product behavior

- /study now behaves more like a daily study cockpit.
- Hero encourages continuing the current or default study flow.
- Weekly metrics are real, not fake.
- The user sees level progress and remaining questions to the next level.
- The user sees a direct next action.
- The user sees a review/progress action.
- The page remains compatible with the existing session engine and partial simulation positioning.

## Guardrails

- Do not imply full USMLE simulation with the current question pool.
- Keep using partial simulation language.
- Do not add fake rankings, fake percentiles, or fake XP.
- Do not persist gamification until a real schema/API is designed.
- Keep /api/me/stats as the source for derived weekly metrics until Phase 3.

## Recommended next phases

### Phase 2F - Dashboard engagement layer

- Improve /progress using existing stats.
- Add a clear top summary card.
- Add weekly momentum summary.
- Add review queue emphasis.
- Keep all metrics derived from /api/me/stats?range=365.

### Phase 2G - Results-to-study loop

- Improve /results and session review flows.
- Add CTA from results to review missed or flagged questions.
- Add CTA from results back to /study.
- Keep messaging focused on partial practice blocks.

### Phase 3 - Persisted gamification

- Design user daily activity table.
- Design streak model.
- Design XP/event model.
- Design review queue model.
- Add ranking/percentile only after real cohort data exists.

## Validation evidence

- Production chunk included /api/me/stats?range=7.
- Production chunk included Weekly growth.
- Production chunk included Momentum action.
- Production chunk included Review action.
- Production chunk included Review flags.
- Production chunk included Open progress.
- Production chunk included /progress.
- Production chunk did not include Level 6, 7 days, +120 XP, Top rank, StudyHeroV2, userStats, Ã¢, or â€.
