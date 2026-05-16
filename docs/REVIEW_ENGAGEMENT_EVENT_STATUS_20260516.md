# Review Engagement Event Status — 2026-05-16

## Scope

Phase 3G adds persisted engagement capture for the post-submission review experience.

## Captured event


- `review_opened`: recorded when an authenticated user successfully loads the full review payload for a submitted session.
- The event is recorded only after the session exists, belongs to the authenticated user, and has `status = 'submitted'`.
- The idempotency key is `review_opened:{sessionId}`.
- Repeat loads of the same session review do not duplicate daily review activity.

## Aggregation


- `review_opened` uses the existing default engagement XP map.
- Daily activity increments `review_actions` via the central engagement helper.
- Metadata stores `items_count` and `submitted_at` for auditability.

## Guardrails

- XP reflects activity only.
- XP is not a USMLE score prediction.
- Level is not readiness, rank, or percentile.
- No cohort ranking or percentile logic is introduced.
- No official-readiness representation is introduced.

## Validation checklist

- git diff --check`
- `npm run build`
- Source scan for `review_opened`, idempotency, and guardrail-sensitive terms.

## Files changed

- `src/app/api/sessions/[sessionId]/review/route.ts`
- `docs/REVIEW_ENGAGEMENT_EVENT_STATUS_20260516.md`
