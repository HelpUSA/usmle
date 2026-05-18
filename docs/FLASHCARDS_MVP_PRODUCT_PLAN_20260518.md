# Flashcards MVP Product Plan - 2026-05-18

## Status
This document starts the Flashcards module planning track for the USMLE platform.

The requested product direction is a mobile-first, game-like active-recall flashcard experience:
- the front of the card presents an incomplete concept, cloze prompt, or rapid recall question;
- the learner thinks before revealing the answer;
- the back of the card reveals the missing term, explanation, and optional clinical pearl;
- the learner rates recall quality using Again, Hard, Good, or Easy;
- the system uses the rating to schedule the next review and reinforce spaced repetition.

## Product rationale
Flashcards fit the USMLE platform because they reinforce:
- active recall;
- spaced repetition;
- short mobile study sessions;
- weak-area reinforcement after question sessions;
- gamified daily consistency.

## Reference UX direction
The RD Medicine screenshots provided by the user are a useful UX reference for:
- a focused central card;
- mobile-first session layout;
- visible progress such as 2/20;
- tap-to-flip behavior;
- four recall-rating buttons;
- simple navigation back to dashboard;
- distraction-free study mode.

The implementation should use this as product inspiration only. It must not copy brand assets, logos, proprietary styling, or exact visual identity.

## Recommended USMLE adaptation
The USMLE version should keep the same learning logic but use platform-native identity and UX:
- clean USMLE platform visual system;
- high readability on mobile;
- front/back distinction;
- clear tap-to-reveal affordance;
- persistent progress indicator;
- accessible buttons and keyboard support;
- integration with existing engagement events and user progress.

## MVP learning flow
1. User opens Flashcards from the platform navigation.
2. User selects a deck or starts due cards.
3. Session opens with a card counter.
4. Front shows an incomplete prompt.
5. User taps the card or presses Space to reveal.
6. Back shows the answer, short explanation, and optional clinical pearl.
7. User selects Again, Hard, Good, or Easy.
8. The system records the review and schedules the next due date.
9. User continues until session complete.
10. Session completion updates engagement metrics.

## Card types for MVP
### Cloze recall
Front:
The antidote for acetaminophen overdose is [...].

Back:
N-acetylcysteine.

Explanation:
It replenishes glutathione and helps prevent hepatic injury.

### Concept recall
Front:
Aortic stenosis murmur classically radiates to the [...].

Back:
Carotids.

### Clinical association
Front:
A young woman with episodic hypertension, headaches, sweating, and palpitations likely has [...].

Back:
Pheochromocytoma.

## Rating model
The MVP should expose four rating actions:
- Again: failed recall; short repeat interval.
- Hard: recalled with difficulty; short interval.
- Good: recalled adequately; standard interval.
- Easy: recalled confidently; longer interval.

The initial scheduling algorithm can be simple and deterministic, then upgraded later:
- Again: due in 20 minutes.
- Hard: due in 1 day.
- Good: due in 3 days.
- Easy: due in 7 days.

Future versions may replace this with FSRS or an SM-2 variant.

## Gamification
MVP gamification should stay lightweight:
- daily card count;
- current session progress;
- XP for completed reviews;
- streak event integration;
- session completion event;
- due cards count.

Avoid adding complex leaderboards or social features before the core learning loop is validated.

## Initial navigation proposal
Add a Flashcards entry under the USMLE study area:
- Dashboard quick action: Start Flashcards.
- Main nav: Flashcards.
- Optional subject filter: Step 1, Step 2, systems, discipline, weak areas.

## MVP screens
### Flashcards dashboard
Purpose:
- show due cards;
- show available decks;
- show progress summary;
- start quick review.

### Flashcards session
Purpose:
- focused review;
- one card at a time;
- tap to reveal;
- rating buttons after reveal;
- progress counter;
- back to dashboard.

### Session complete
Purpose:
- summarize cards reviewed;
- XP gained;
- accuracy/rating distribution;
- next due estimate.

## Integration points
- Authentication: user-specific scheduling and review state require authenticated user identity.
- Database: cards, decks, review events, and per-user card state.
- Engagement: record events such as flashcards_opened, flashcard_revealed, flashcard_reviewed, and flashcards_session_completed.
- Progress: future integration can generate cards from missed questions or weak topics.

## Non-goals for MVP
- Do not generate AI flashcards automatically yet.
- Do not import large third-party decks yet.
- Do not add marketplace/community deck sharing yet.
- Do not add image/audio cards yet.
- Do not copy RD Medicine assets or branding.
- Do not build complex spaced-repetition tuning before the core loop is live.

## Acceptance criteria for first implementation
- Mobile session UI works at common phone widths.
- Card front and back render correctly.
- Tap/click and Space reveal the answer.
- Again/Hard/Good/Easy actions persist a review.
- User card state updates due_at and interval.
- Session counter advances.
- Protected API routes enforce authentication for user state.
- Public sample deck can be viewed or seeded safely.
- Lint and build pass.
