# GRID Retention Systems Roadmap

## Product goal

Build a repeatable sports-management loop that gives every session a clear purpose, meaningful decisions, visible progress, and a reason to return without relying on passive login rewards.

## Core player loop

1. **Assess** — review roster health, form, objectives, rivals, and active facility events.
2. **Prepare** — train, recover, equip, scout, or adjust tactics.
3. **Compete** — play a match, rivalry, league fixture, or limited event.
4. **React** — receive post-match recommendations and make one consequential management decision.
5. **Progress** — advance daily journey, weekly objectives, season milestones, facilities, and franchise prestige.
6. **Return** — see tomorrow's chest progress, upcoming rivalry, rotating modifier, and next season milestone.

## Design principles

- Reward gameplay, not opening the app.
- Every reward must have a server-authoritative eligibility record and idempotent claim.
- Keep daily sessions completable in 10–20 minutes while supporting deeper play.
- Show one recommended next action at all times.
- Use losses to create recovery and improvement decisions rather than dead ends.
- Avoid inflation by preferring choices, temporary boosts, cosmetics, recovery items, and bounded rewards.
- Instrument every funnel before tuning rewards.

## Phase 1 — Foundation

### Server-backed franchise journey and streak

Persist one daily journey per user and UTC date with four stages:

- PREPARE_SQUAD
- DEVELOP_ADVANTAGE
- COMPETE
- IMPROVE_FRANCHISE

Each stage is completed by trusted domain events from team, training, medical, matches, marketplace, stadium, wallet, or dashboard services. The streak increments only when the full journey is completed. Missing one day resets the current streak but preserves best streak.

Required protections:

- unique `(userId, dateKey)` journey record
- idempotent event processing
- server-generated date keys
- no progress from client-only building visits
- backfill-safe event metadata

### Controlled daily completion chest

Eligibility requires all daily journey stages. One claim per date. Reward is generated server-side from a versioned reward table and stored before wallet mutation.

Initial reward composition:

- guaranteed bounded CASH reward
- one weighted utility item or recovery consumable
- small chance of cosmetic or temporary facility boost
- no unbounded DYN faucet

Use a transaction and ledger entry with a stable idempotency key such as `daily-chest:<userId>:<dateKey>`.

### Analytics event foundation

Create a first-party `GameAnalyticsEvent` record with:

- userId nullable for pre-auth events
- sessionId
- eventName
- eventVersion
- occurredAt
- properties JSON
- source

Initial events:

- session_started
- onboarding_started
- team_created
- first_match_started
- first_match_completed
- journey_stage_completed
- journey_completed
- daily_chest_claimed
- weekly_objective_completed
- rivalry_rematch_started
- post_match_recommendation_viewed
- post_match_recommendation_acted
- facility_event_joined
- season_milestone_claimed
- session_ended

## Phase 2 — Weekly structure

### Weekly season objectives

Generate a weekly objective set from templates based on franchise state. Include three standard objectives and one stretch objective. Examples:

- play 5 matches
- win 2 matches
- complete 3 training sessions
- recover 2 injured or fatigued players
- improve one lineup position
- complete one marketplace transaction
- defeat a rival

Objectives grant season XP and bounded rewards. Weekly completion grants a choice between two reward bundles.

### Season pass

The pass advances through season XP earned from matches, objectives, rivalries, and facility events. Login alone grants no XP.

Recommended structure:

- free track only for first release
- 20–30 milestones per season
- utility items, cosmetics, stadium themes, banners, titles, and bounded currency
- catch-up objectives late in the season
- no pay-to-win stat bonuses

## Phase 3 — Competitive return hooks

### Rivalries and one-click rematches

After eligible matches, create or update a rivalry between the two teams. Track meetings, wins, streak, aggregate score, and last match.

The post-match screen should offer:

- rematch now when both teams are eligible
- challenge later
- add to rivalry watchlist
- view matchup history

Apply cooldowns and anti-farming reward decay for repeated pairings.

### Post-match recommendations

Generate a maximum of three ranked recommendations from match evidence:

- recover a fatigued or injured player
- train the weakest relevant position group
- replace an underperforming starter
- adjust tactics against the opponent archetype
- repair or upgrade a facility
- scout a position need

Each recommendation contains evidence, expected benefit, destination action, expiration, and whether the user acted.

## Phase 4 — Rotating world activity

### Facility events and temporary modifiers

Run one or two active events at a time with clear start/end times. Examples:

- Training Combine: faster development for one position group
- Recovery Week: reduced treatment cost
- Rivalry Weekend: extra season XP for rivalry matches
- Market Showcase: reduced listing fee for a category
- Stadium Festival: ticket bonus with increased wear
- Scout Summit: improved candidate visibility

Modifiers must be server-authoritative, visible before commitment, and recorded in match/economy metadata.

## Analytics and retention reporting

### Primary funnels

**Activation**

registration → team created → first lineup ready → first match started → first match completed → first post-match action

**Daily journey**

journey viewed → stage 1 → stage 2 → match → stage 4 → chest eligible → chest claimed

**Competitive return**

match completed → rivalry shown → rematch selected → rematch completed

### Retention definitions

- D1: user has any qualifying gameplay session on the calendar day after first activation.
- D7: user has any qualifying gameplay session seven calendar days after first activation.
- Qualifying session: at least one meaningful gameplay event, not merely authentication.
- Activation cohort date: date of first completed match.

### Required dashboards

- registration-to-first-match conversion
- median time to first match
- first-match completion rate
- first post-match action rate
- daily journey stage drop-off
- chest eligibility and claim rate
- D1 and D7 retention by activation cohort
- rivalry rematch conversion
- recommendation action conversion
- weekly objective completion
- season milestone distribution
- common last event before session exit

## Delivery order

1. Analytics event store and event contract.
2. Daily journey persistence and trusted domain event mapping.
3. Daily chest transaction and reward table.
4. Frontend journey API integration.
5. Weekly objectives and season XP.
6. Post-match recommendations.
7. Rivalries and rematches.
8. Rotating facility events.
9. Season pass UI and milestone claims.
10. Retention dashboards and reward tuning.

## Launch guardrails

- All claims idempotent.
- Economy changes have ledger entries.
- Feature flags for each system.
- Reward tables versioned and auditable.
- No client-authoritative progress.
- Repeated opponent rewards decay.
- Daily and weekly caps enforced server-side.
- Analytics failures never block gameplay.
- Minimum test coverage for eligibility, rollover, duplicate claims, streak reset, timezone boundaries, and reward transactions.
