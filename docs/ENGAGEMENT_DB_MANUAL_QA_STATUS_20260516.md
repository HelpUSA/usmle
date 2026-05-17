# Engagement DB and Manual QA Status - 2026-05-16

## Status
Phase 3J documents the database-backed engagement event model and the manual QA checklist for the Phase 3D through Phase 3I engagement work.

## Database coverage
- Migration db/migrations/20260515_001_persisted_gamification.sql creates user_activity_events and user_engagement_summary.
- user_activity_events has a user plus idempotency key unique index for event idempotency.
- Session-level and session-item-level event indexes support engagement audit queries.
- The engagement API and page handlers record explicit activity events through recordActivityEvent.

## Event coverage to verify
- session_started
- study_opened
- question_answered
- progress_opened
- results_opened
- review_opened
- review_completed

## Manual QA checklist
1. Sign in as a test user.
2. Start and submit a session.
3. Open Study, Progress, Results, and Review pages.
4. Click Mark review complete on the Review page.
5. Confirm the review_completed event is recorded once for the session.
6. Refresh the Review page and navigate Prev or Next; confirm no additional review_completed event is recorded without the explicit button action.
7. Query user_activity_events for the test user and session to confirm expected event_type values and idempotency_key values.
8. Query user_engagement_summary or the engagement API to confirm persisted totals remain nonnegative and consistent.

## Suggested SQL checks
sql
SELECT event_type, idempotency_key, session_id, session_item_id, event_date, xp_delta
FROM user_activity_events
WHERE user_id = :user_id
ORDER BY created_at DESC
LIMIT 50;

SELECT event_type, COUNT(*)
FROM user_activity_events
WHERE user_id = :user_id
GROUP BY event_type
ORDER BY event_type;

SELECT *
FROM user_engagement_summary
WHERE user_id = :user_id;


## Validation
- Repository status was clean before this documentation step.
- Phase 3I build validation passed before commit 0d030b2.
- This Phase 3J step is documentation-only and does not change runtime behavior.
