# Review Completed Engagement Event Status - 2026-05-16

## Status
Phase 3I implemented review_completed engagement capture.

## Behavior
- Review completion is captured only from an explicit user action on the review page.
- The review page provides a Mark review complete button.
- POST /api/sessions/:sessionId/review records review_completed only for the authenticated owner of a submitted session.
- The event uses idempotencyKey review_completed:${sessionId}.
- Passive page load, Prev navigation, and Next navigation do not record review_completed.

## Validation
- git diff --check passed.
- npm run lint -- --quiet passed.
- npm run build passed.
