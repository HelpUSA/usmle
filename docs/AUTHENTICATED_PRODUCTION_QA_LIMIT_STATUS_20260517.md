# Authenticated Production QA Limit Status - 2026-05-17

## Status
Authenticated production QA remains pending. The production smoke checks completed successfully for public routes, health, database health, and unauthenticated API boundaries, but the final authenticated flow cannot be completed from the watcher environment without an authenticated browser/OAuth session or a valid production session cookie.

## Probe results
- Repository state at probe time: `HEAD = origin/main = af8b289`.
- Local working tree was clean.
- Auth stack uses NextAuth v4.
- Production auth provider exposed by `/api/auth/providers`: Google OAuth only.
- `/api/auth/session` returned `{}` without an authenticated browser session.
- Code probe found:
  - Google provider present.
  - JWT session strategy present.
  - `getServerSession` present.
  - deterministic stable UUID from email present.
  - NextAuth route present.
  - no CredentialsProvider.
  - no local auth bypass markers.
  - no test-user header bypass markers.
  - no local password-based test auth flow.
- Local process environment did not expose production database or auth secrets.

## Interpretation
The watcher can verify unauthenticated production behavior and public availability, but it cannot complete a Google OAuth login flow or inspect production engagement rows without a real authenticated session and database access.

## Remaining authenticated production QA
1. Sign in at `https://usmle.helpusbr.com` with a test Google account.
2. Create and submit a session.
3. Open Study, Progress, Results, and Review.
4. Click `Mark review complete`.
5. Confirm the UI displays `Review completion saved.`
6. Verify `user_activity_events` contains the expected persisted engagement events.
7. Verify `review_completed` is recorded exactly once for the session.
8. Verify the idempotency key remains `review_completed:${sessionId}`.
9. Refresh and use Prev/Next navigation and confirm no extra `review_completed` event is created.
10. Verify `user_engagement_summary` remains coherent and nonnegative.

## Safe ways to complete the remaining QA
- Use a browser-authenticated production session and provide only a short-lived session cookie to the QA runner, if acceptable.
- Run the manual browser steps directly and provide the observed session id for database verification.
- Provide secure production database access through the existing deployment/ops channel, without committing secrets to the repository.

## Scope note
No application code changes were made for this status. This document records the operational boundary discovered during production QA.
