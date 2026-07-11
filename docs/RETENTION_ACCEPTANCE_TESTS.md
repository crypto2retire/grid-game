# Retention Systems Acceptance Tests

## Daily journey and streak

- A new authenticated user receives exactly one journey for the server UTC date.
- Completing the same trusted action twice does not duplicate stage completion.
- Client-only building visits do not complete a stage.
- Completing all four stages increments the streak once.
- Replaying completion events does not increment the streak again.
- Completing journeys on consecutive server dates increments the streak.
- Missing a server date resets current streak to one on the next completion.
- Best streak never decreases.
- Journey rollover works correctly around UTC midnight.

## Daily chest

- Chest is unavailable before journey completion.
- Eligible user can claim once.
- Duplicate concurrent claims produce one reward transaction.
- Reward and wallet ledger commit atomically.
- Reward table version and generated reward are persisted.
- Reward stays within configured daily caps.
- Failed wallet mutation does not mark the chest claimed.

## Weekly objectives and season XP

- Objective templates are selected according to franchise eligibility.
- Progress is emitted only from trusted gameplay events.
- Progress cannot exceed the target.
- Objective reward is granted once.
- Weekly rollover creates a new set without mutating history.
- Season XP milestone claims are idempotent.
- Login without gameplay grants no season XP.

## Rivalries and rematches

- Eligible completed matches update one rivalry record for the team pair.
- Team order does not create duplicate rivalry records.
- Rematch preserves opponent and appropriate match settings.
- Cooldown and eligibility rules are enforced server-side.
- Repeated-pair reward decay is applied and recorded.

## Post-match recommendations

- Recommendations reference match evidence.
- No more than three active recommendations are returned.
- Recommendations are ranked deterministically for the same evidence.
- Acting on a recommendation records conversion once.
- Expired recommendations cannot be counted as acted.

## Facility events

- Only active events affect gameplay.
- Modifier is visible before the user commits the affected action.
- Start and end boundaries use server time.
- Match and economy records include applied modifier metadata.
- Incompatible modifiers cannot be active together.

## Analytics

- Authenticated events derive user ID from the token.
- Invalid names, oversized properties, or prohibited sensitive keys are rejected.
- Analytics outage does not block gameplay endpoints.
- Server-critical events cannot be spoofed through the client ingestion endpoint.
- First-match, journey, chest, rivalry, recommendation, facility, and season events contain required properties.
- D1 and D7 calculations use first completed match as the activation date and require meaningful gameplay activity.
