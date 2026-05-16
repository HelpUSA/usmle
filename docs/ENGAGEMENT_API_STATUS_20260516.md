# Engagement API Status - 2026-05-16

## Scope

Phase 3D adds the first read API for persisted engagement data.

## Endpoint

`GET /api/me/engagement`

## Source tables

- `user_engagement_summary`
- `user_daily_activity`
- `users_profile`

## Response shape

The endpoint returns:

- `summary`: streak, XP, level, progress, and last activity timestamps.
- `today`: zero-safe current UTC day activity.
- `recent_days`: up to 30 recent daily activity rows.
- `generated_at`: response generation timestamp.

## Guardrails

- No ranking.
- No percentile.
- No score prediction.
- No official-readiness claim.
- Missing engagement rows return zero-safe defaults.

## Authentication

The endpoint uses `getUserIdForApi(req)` and returns `401` for unauthenticated requests.

## Implementation notes

- The endpoint inserts a `users_profile` row for the authenticated user if needed.
- The endpoint does not accept client-side event writes.
- Event capture remains server-side only.
- The first captured event currently in production is `session_started`.

## Next phase

Phase 3E can surface this endpoint on `/study` and `/progress` after production deploy validation.
