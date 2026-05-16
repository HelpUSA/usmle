# Study Engagement UI Status - 2026-05-16

## Scope

Phase 3E.1 surfaces persisted engagement on `/study` by reading `GET /api/me/engagement` from the authenticated client page.

## User-visible changes

The study hero now prefers persisted engagement data when available:

- persisted level number;
- persisted XP progress toward the next level;
- persisted total XP;
- persisted current streak or active-today state;
- zero-safe fallback to the existing weekly stats display when the engagement API is unavailable.

## Guardrails

- No ranking.
- No percentile.
- No score prediction.
- No official-readiness claim.
- Existing `/api/me/stats?range=7` remains available for weekly accuracy and review hints.

## Endpoint dependency

- `GET /api/me/engagement`
- `GET /api/me/stats?range=7`
- `GET /api/sessions`

## Next step

Phase 3E.2 can bring the same persisted engagement model to `/progress`, with the recent 30-day activity array used for a longitudinal activity panel.
