# Flashcards Implementation Roadmap - 2026-05-18

## Status
Planning approved by user. Begin with documentation, inventory, and a small MVP implementation path.

## Implementation strategy
Implement the module incrementally:
1. inventory current app structure;
2. add database schema and seedable starter deck;
3. add API endpoints;
4. add mobile-first UI;
5. add review scheduling;
6. add engagement events;
7. validate with lint/build and production smoke.

## Phase FC-1 - Documentation and repository inventory
Goal:
Establish product plan, implementation roadmap, and inspect existing routes/components.

Deliverables:
- docs/FLASHCARDS_MVP_PRODUCT_PLAN_20260518.md
- docs/FLASHCARDS_IMPLEMENTATION_ROADMAP_20260518.md
- inventory of current navigation, dashboard, auth, db helpers, and engagement helpers.

Validation:
- git status clean before work;
- docs committed before code changes.

## Phase FC-2 - Data model
Goal:
Add minimal database model for decks, cards, review events, and per-user scheduling state.

Candidate tables:
- flashcard_decks
- flashcards
- user_flashcard_state
- flashcard_reviews

Candidate fields:
flashcard_decks:
- id
- slug
- title
- description
- step
- subject
- system
- is_public
- owner_user_id nullable
- created_at
- updated_at

flashcards:
- id
- deck_id
- card_type
- front
- back
- cloze_text
- answer
- explanation
- clinical_pearl
- tags jsonb
- status
- created_at
- updated_at

user_flashcard_state:
- user_id
- card_id
- due_at
- interval_days
- ease_factor
- repetitions
- lapses
- last_rating
- last_reviewed_at
- created_at
- updated_at

flashcard_reviews:
- id
- user_id
- card_id
- deck_id
- rating
- response_ms
- previous_due_at
- next_due_at
- previous_interval_days
- next_interval_days
- created_at

Constraints:
- unique user_flashcard_state(user_id, card_id)
- rating limited to again, hard, good, easy
- protect user rows by authenticated user id

Validation:
- migration is idempotent where practical;
- no secrets;
- database health remains OK.

## Phase FC-3 - API
Goal:
Expose minimal authenticated endpoints.

Candidate routes:
- GET /api/flashcards/decks
- GET /api/flashcards/decks/:deckId/cards
- POST /api/flashcards/session/start
- POST /api/flashcards/cards/:cardId/review
- GET /api/flashcards/due

Behavior:
- deck listing may include public decks;
- due/review state requires authentication;
- review endpoint records rating and updates scheduling;
- avoid duplicate side effects on reveal or page load.

Validation:
- unauthenticated protected endpoints return 401;
- malformed ids return 400;
- review updates are transactional.

## Phase FC-4 - Mobile-first UI
Goal:
Add a focused flashcard session UI inspired by the reference pattern while keeping platform-native branding.

Candidate routes:
- /flashcards
- /flashcards/session

UI requirements:
- centered card;
- front/back state;
- tap/click to reveal;
- Space to reveal on desktop;
- progress counter;
- Again/Hard/Good/Easy buttons after reveal;
- back to dashboard;
- mobile-first spacing and readable typography.

Validation:
- responsive mobile smoke;
- no proprietary copied assets;
- lint/build pass.

## Phase FC-5 - Engagement integration
Goal:
Integrate with existing engagement events without creating noisy event inflation.

Candidate events:
- flashcards_opened
- flashcards_session_started
- flashcard_revealed
- flashcard_reviewed
- flashcards_session_completed

Rules:
- do not record review on page load;
- do not record review on mere reveal unless intentional event type is separate;
- review rating should be the durable learning event;
- session completion should be idempotent per session if a session id exists.

Validation:
- activity events recorded for authenticated user;
- user_engagement_summary remains coherent.

## Phase FC-6 - Production QA
Goal:
Deploy and validate the module.

Smoke checks:
- /flashcards loads;
- /flashcards/session loads with starter cards;
- protected APIs block unauthenticated users;
- authenticated review persists;
- card state due_at changes after rating;
- mobile layout is usable;
- lint/build pass;
- production health remains db up.

## MVP stop point
Stop and report to user after completing one large activity:
- documentation and roadmap committed;
- initial code scaffold committed;
- database/API MVP committed;
- UI MVP committed;
- production smoke documented.

## Known risks
- Authenticated production QA requires browser Google OAuth session or valid production session cookie.
- Production DB verification requires secure DB access through the existing ops channel.
- Existing engagement implementation must not be regressed.
- The UI should be inspired by the screenshots, not copied.
- Initial spaced repetition should be simple and explainable before adopting advanced algorithms.

## Next safe action
Run repository inventory for current navigation, route structure, db helpers, auth helpers, and engagement helpers, then implement FC-1 documentation commit.
