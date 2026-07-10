# Retention Analytics Event Contract

All retention events use this envelope:

```ts
interface GameAnalyticsEventPayload {
  eventName: string;
  eventVersion: 1;
  sessionId: string;
  occurredAt?: string;
  source: 'web' | 'api' | 'worker';
  properties: Record<string, string | number | boolean | null>;
}
```

## Rules

- The API assigns `userId` from authentication; clients never submit another user ID.
- The server assigns the canonical receipt time.
- `occurredAt` may be accepted only within a bounded clock-skew window.
- Sensitive values, JWTs, chat content, email addresses, and raw error stacks are prohibited.
- Analytics ingestion must never block the gameplay response path.
- Domain-critical events such as match completion, reward claims, and journey completion are emitted by the server, not trusted from the client.
- Event names and property meanings are versioned. Do not silently repurpose an existing property.

## Core events

### `session_started`

Properties: `entry_surface`, `returning_user`, `days_since_last_qualifying_session`.

### `first_match_started`

Properties: `team_id`, `match_id`, `opponent_type`, `minutes_since_registration`.

### `first_match_completed`

Properties: `team_id`, `match_id`, `result`, `duration_seconds`, `minutes_since_registration`.

### `journey_stage_completed`

Properties: `date_key`, `stage`, `trigger_type`, `trigger_id`, `stage_index`.

### `journey_completed`

Properties: `date_key`, `current_streak`, `best_streak`, `completion_seconds`.

### `daily_chest_claimed`

Properties: `date_key`, `reward_table_version`, `cash`, `item_code`, `streak`.

### `weekly_objective_completed`

Properties: `week_key`, `objective_code`, `season_xp`, `progress_source`.

### `rivalry_rematch_started`

Properties: `rivalry_id`, `previous_match_id`, `meetings`, `minutes_since_previous_match`.

### `post_match_recommendation_viewed`

Properties: `recommendation_id`, `match_id`, `recommendation_type`, `rank`.

### `post_match_recommendation_acted`

Properties: `recommendation_id`, `match_id`, `recommendation_type`, `action_surface`, `seconds_to_action`.

### `facility_event_joined`

Properties: `event_id`, `facility_type`, `modifier_code`, `hours_remaining`.

### `season_milestone_claimed`

Properties: `season_id`, `milestone`, `track`, `reward_code`, `season_xp`.

### `session_ended`

Properties: `duration_seconds`, `meaningful_actions`, `last_gameplay_event`, `exit_surface`.
