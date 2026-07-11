# Retention Rewards Testing

## Migration

```bash
npm run db:migrate --workspace=@grid/api
```

The migration creates server-authoritative journey, reward-claim, season, milestone, progress, and facility-modifier tables. It also seeds the Founders Season and three scheduled facility events.

## Automated tests

```bash
npm run test --workspace=@grid/api -- retention.service.test.ts
```

## API smoke test

All endpoints require a valid JWT. Retention endpoints are currently mounted below the existing daily-quest router:

- `GET /api/daily-quests/retention/state`
- `POST /api/daily-quests/retention/journey/stages`
- `POST /api/daily-quests/retention/daily-chest/claim`
- `GET /api/daily-quests/retention/season`
- `POST /api/daily-quests/retention/season/milestones/claim`
- `GET /api/daily-quests/retention/facility-modifiers`

Example journey progress body:

```json
{ "stage": "PREPARE" }
```

Valid stages are `PREPARE`, `DEVELOP`, `COMPETE`, and `GROW`.

Reward claims require a unique request header:

```text
Idempotency-Key: test-user-2026-07-10-daily-chest
```

Replaying the same key returns the original claim result and must not change wallet balances or create additional ledger entries.

## Required database assertions

After a daily chest or season milestone claim:

1. Exactly one `RewardClaim` exists for the claim key.
2. The wallet changed by exactly the returned reward amounts.
3. One `CurrencyLedger` row exists per non-zero rewarded currency.
4. Ledger `sourceType` is `DAILY_CHEST` or `SEASON_MILESTONE`.
5. Ledger `sourceId` matches the claim ID.
6. A second request using the same idempotency key does not change balances.

## Economy controls

Daily chest CASH starts at 1,500, increases by 100 per consecutive completion day, and caps at 2,500. DYN is only awarded on each seventh streak day. Journey completion grants 100 season XP once per UTC day. Facility modifiers currently affect progression or season XP only; they do not multiply currency rewards.

## Current validation limitation

GitHub has not attached a CI workflow run to the latest branch commits yet. The code and test commands are ready, but migration execution and Jest results still need to be observed in an environment with PostgreSQL and installed dependencies before the PR should be marked ready for review.
