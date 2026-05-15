# USMLE Frontend Engagement Redesign Plan

Date: 2026-05-15

## Goal

Transform the platform from a functional study tool into a mobile-first daily study product with habit loops, progress emotion, and lightweight game mechanics.

Primary target: frequent mobile users.

## Product principles

- One obvious next action.
- Mobile thumb-first layout.
- Less reading, more visual progress.
- Reward effort immediately.
- Make daily return feel valuable.
- Prefer encouraging comparison over punitive ranking.
- Keep medical seriousness while adding game-like motivation.

## Study page direction

The Study page should become the user's daily action hub.

### Current problem

The current /study page is operational and configuration-heavy:
- "Study" hero is generic.
- "Use my defaults" appears before emotional progress.
- Continue action is not visually dominant enough.
- Cards look similar and become tiring.
- Too much explanatory text for mobile.
- Progress and motivation are not prominent.

### Target v1 layout

1. Hero / habit card
   - streak
   - level
   - XP this week
   - next badge

2. Today's mission
   - e.g. 12 / 20 questions
   - visual progress bar
   - "Finish today's block" CTA

3. Continue studying
   - if active session exists: make it the main button
   - sticky mobile bottom action

4. Quick actions
   - Practice
   - Timed block
   - Partial simulation
   - Review mistakes

5. Weekly growth
   - questions answered
   - accuracy trend
   - study time
   - strongest / weakest area later

6. Community / ranking preview
   - weekly XP rank
   - percentile among same exam users
   - anonymous comparison
   - avoid discouraging low-ranked users

## Dashboard direction

The dashboard should tell a growth story.

### Target cards

- "You are improving"
- weekly XP
- streak
- accuracy change
- questions completed
- rank / percentile
- active mission
- weak topics to attack

## Gamification concepts

### XP

Initial formula can be derived without new DB tables:

- answered question: +2 XP
- correct answer: +8 XP
- completed timed block: +25 XP
- completed daily mission: +50 XP

Later, persist XP events in a dedicated table.

### Levels

Simple level thresholds:

- Level 1: 0 XP
- Level 2: 250 XP
- Level 3: 600 XP
- Level 4: 1000 XP
- Level 5+: progressive scale

### Streak

Initial approximation:
- derive from sessions started_at or submitted_at by day.

Later:
- persist user_daily_activity.

### Badges

Examples:
- First 20Q Block
- 3-Day Streak
- Cardiology Climber
- Accuracy Comeback
- Timed Block Warrior
- Step 3 Starter

### Missions

Examples:
- Answer 20 questions today.
- Complete 1 timed block.
- Review 10 missed questions.
- Improve one weak area.

## Leaderboard strategy

Avoid raw global ranking only.

Use:
- weekly XP leaderboard
- same exam leaderboard
- percentile among active learners
- anonymous rank labels
- optional friend/class leaderboard later

Good examples:
- "Ahead of 63% of Step 1 learners this week"
- "#12 among active Step 3 learners today"
- "Top 20% weekly consistency"

## Implementation phases

### Phase 1: UI-only / derived metrics

No database schema changes.

- Add frontend-derived study stats from existing sessions.
- Redesign /study mobile-first.
- Add XP/streak visual placeholders derived from available data.
- Add sticky mobile CTA.
- Fix remaining mojibake in /study visible copy.

### Phase 2: Dashboard engagement layer

- Add growth cards to dashboard.
- Add weekly progress and percentile-style presentation.
- Reuse derived metrics where possible.

### Phase 3: Persisted gamification

Add database tables:

- user_xp_events
- user_daily_activity
- user_achievements
- user_missions
- leaderboard_weekly

### Phase 4: Social and ranking

- same-exam weekly leaderboard
- optional friend groups
- class/cohort leaderboard
- public anonymous handles

## Technical approach

- Create src/components/ as the new UI component home.
- Start with src/components/study/.
- Do not rewrite the whole /study page in one step.
- Extract small reusable UI cards first.
- Preserve current create session behavior.
- Run npm build after every phase.
- Avoid broad PowerShell text rewrites on TSX files with Unicode punctuation.

## First implementation target

Create:

- src/components/study/StudyHero.tsx
- src/components/study/StudyMissionCard.tsx
- src/components/study/StudyQuickActions.tsx
- src/components/study/StudyStickyAction.tsx

Then integrate into /study while keeping existing session creation functions unchanged.
