# Page-View Engagement Event Status - 2026-05-16

## Scope

Phase 3H adds persisted engagement capture for authenticated page-view actions backed by actual user navigation.

## Captured events

- `progress_opened`: recorded when a signed-in user loads the Progress page.
- `results_opened`: recorded when a signed-in user loads the Results page.

Both events are recorded through `POST /api/me/engagement`.
Both events are idempotent per user and UTC day using `{event_type}:{userId}:{eventDate}`.
Client pages ignore tracking failures so page loading is not blocked by engagement telemetry.

## Aggregation

- Page-view events use the existing XP default map.
- Daily activity and user engagement summary updates flow through the central engagement helper.
- Daily idempotency prevents reloads and React development double-invokes from inflating activity.

## Guardrails

- XP reflects activity only.
- XP is not a USMLE score prediction.
- Level is not readiness, rank, or percentile.
- No cohort ranking or percentile logic is introduced.
- No official-readiness representation is introduced.

## Files changed

- `src/app/api/me/engagement/route.ts`
- `src/app/progress/page.tsx`
- `src/app/results/page.tsx`
- `docs/PAGE_VIEW_ENGAGEMENT_EVENTS_STATUS_20260516.md`
