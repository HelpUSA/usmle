# Engagement Event Capture Status — 2026-05-16

## Scope

Phase 3F expands persisted engagement capture from session creation into the core study loop. The implementation records auditable activity events from real user actions only.

## Captured events

- `session_started`: recorded when an authenticated session is created.
- `answer_submitted`: recorded once for the first attempt on a session item.
- `answer_correct`: recorded once for the first attempt when the submitted answer is correct.
- `answer_incorrect`: recorded once for the first attempt when the submitted answer is wrong.
- `question_flagged`: recorded once for the first attempt when the item is flagged for review.
- `session_submitted`: recorded when an in-progress session is successfully transitioned to submitted.

## Idempotency model

- Session creation uses `session_started:{sessionId}`.
- Session submission uses `session_submitted:{sessionId}`.
- Attempt-level events use the persisted `attempt_id` in the idempotency key, for example `answer_submitted:{attemptId}`.
- Existing attempt updates do not create additional attempt-level engagement events.
- Already submitted sessions return the submitted payload without recording a duplicate submission event.

## Aggregation behavior

- Daily activity increments `sessions_submitted` from `session_submitted`.
- Daily activity increments `questions_answered` from `answer_submitted`.
- Daily activity increments `questions_correct` from `answer_correct`.
- Daily activity increments `questions_flagged` from `question_flagged`.
- Study seconds are captured from the first attempt payload when available.
- Session submission metadata stores the submitted summary for auditability without treating it as a score prediction.

## Guardrails

- XP reflects activity only.
- XP is not a USMLE score prediction.
- Level is not readiness, rank, or percentile.
- No cohort ranking or percentile logic is introduced.
- No official-readiness representation is introduced.

## Validation checklist

- `git diff --check`
- `npm run build`
- Source scan for the event names and guardrail-sensitive terms.

## Files changed

- `src/app/api/sessions/[sessionId]/submit/route.ts`
- `src/app/api/sessions/[sessionId]/items/[sessionItemId]/attempt/route.ts`
- `docs/ENGAGEMENT_EVENT_CAPTURE_STATUS_20260516.md`
