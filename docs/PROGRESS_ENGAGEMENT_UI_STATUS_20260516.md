# Progress Engagement UI Status - 2026-05-16

## Scope

Phase 3E.2 surfaces persisted engagement data on `/progress` while preserving the existing session, completion, accuracy, and block analytics views.

## User-visible behavior

`/progress` now attempts to read `GET /api/me/engagement` after the core sessions and stats requests succeed. When available, persisted engagement adds:

- current level;
- total XP;
- current streak;
- today's answered-question count;
- a 30-day persisted activity series derived from `recent_days`.

When engagement data is unavailable, the page keeps the existing fallback behavior based on `/api/sessions` and `GET /api/me/stats?range=365`.

## Guardrails

- No ranking.
- No percentile.
- No score prediction.
- No official-readiness claim.
- Accuracy and block analytics remain descriptive study signals only.

## Next step

Phase 3E.3 should decide whether persisted engagement also belongs on `/results` or whether the next priority is recording more event types such as review actions and submitted sessions.
