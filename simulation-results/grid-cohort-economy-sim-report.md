# GRID Cohort Economy Stress Simulation — 50/25/25 Player Mix

**Run date:** 2026-07-04  
**Environment:** local repo simulation script, no production database writes  
**Data type:** hypothetical in-game economy simulation using current source-code constants, **not real financial/accounting data**  
**Source coverage:** daily quests, game-day rewards/expenses, venue/transport constants, training/equipment cost ranges  
**Output JSON:** `simulation-results/grid-cohort-economy-sim.json`

## Source files used

- `apps/api/src/modules/daily-quests/daily-quests.service.ts`
- `apps/api/src/modules/economy/teamEconomy.config.ts`
- `apps/api/src/modules/economy/gameEconomics.ts`
- `apps/api/src/modules/testing/mega-simulation.service.ts`

## Scenario design

Cohort mix requested:

| Cohort | Share | Modeled behavior |
|---|---:|---|
| Payout extractors | 50% | Complete all daily quests + 1 LOCAL_REC match, then extract/hoard all positive daily retained CASH. No upgrades. |
| Free grinders | 25% | Complete all daily quests + 2 active matches/day. No external purchases. Reinvest up to 70% of retained CASH into training. |
| Payer-holders | 25% | Complete all daily quests + 3 active matches/day. Buy/hold DYN/upgrades. Spend on training/equipment. No extraction in this model. |

Current daily quest CASH reward from source code:

```txt
Complete 3 team drills:       750 CASH
Play 1 stadium scrimmage:   1,500 CASH
Scout 2 athletes:             500 CASH
TOTAL:                      2,750 CASH/player/day
```

Simulation parameters:

```txt
Player counts: 100, 500, 1,000, 5,000, 10,000
Days: 30
Trials per player count: 100
Seed: 20260704
```

## Main result table

| Players | Extracted / day | CASH emissions / day | Sinks / day | Net CASH created / day | External purchase equiv / day | Sink coverage | External / Extracted |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 251,145 | 1,594,631 | 746,622 | 848,009 | 311,673 | 46.8% | 1.24x |
| 500 | 1,255,763 | 7,945,579 | 3,736,462 | 4,209,117 | 1,560,750 | 47.0% | 1.24x |
| 1,000 | 2,512,747 | 15,903,878 | 7,474,595 | 8,429,283 | 3,124,369 | 47.0% | 1.24x |
| 5,000 | 12,562,222 | 79,550,928 | 37,361,534 | 42,189,394 | 15,620,993 | 47.0% | 1.24x |
| 10,000 | 25,122,138 | 159,086,911 | 74,732,439 | 84,354,472 | 31,242,576 | 47.0% | 1.24x |

## Per-player/day averages

| Players | Emission / player / day | Extracted / player / day | Net-created / player / day | External purchase equiv / player / day |
|---:|---:|---:|---:|---:|
| 100 | 15,946 | 2,511 | 8,480 | 3,117 |
| 500 | 15,891 | 2,512 | 8,418 | 3,122 |
| 1,000 | 15,904 | 2,513 | 8,429 | 3,124 |
| 5,000 | 15,910 | 2,512 | 8,438 | 3,124 |
| 10,000 | 15,909 | 2,512 | 8,435 | 3,124 |

## Daily quest extraction pressure

| Players | Daily quest CASH if all active | Extractor cohort daily quest CASH | Extracted/day total | Match/business extra extracted/day |
|---:|---:|---:|---:|---:|
| 100 | 275,000 | 137,500 | 251,145 | 113,645 |
| 500 | 1,375,000 | 687,500 | 1,255,763 | 568,263 |
| 1,000 | 2,750,000 | 1,375,000 | 2,512,747 | 1,137,747 |
| 5,000 | 13,750,000 | 6,875,000 | 12,562,222 | 5,687,222 |
| 10,000 | 27,500,000 | 13,750,000 | 25,122,138 | 11,372,138 |

## 30-day totals for reference

| Players | CASH emissions | Operating sinks | Upgrade sinks | Extracted CASH | External purchase equiv | Net CASH created after sinks |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 477,116,336 | 31,208,962 | 193,028,886 | 75,382,420 | 93,731,075 | 252,878,487 |
| 10,000 | 4,772,607,327 | 312,173,800 | 1,929,799,381 | 753,664,152 | 937,277,275 | 2,530,634,145 |

## Readout

1. **The current daily reward loop is too extractable if CASH has any real-value payout path.**  
   At 10,000 active players, daily quests alone emit 27.5M CASH/day. With 50% extractors plus one match, the extractor cohort pulls about 25.1M CASH/day out of the active economy.

2. **Payer-holder external purchase activity covers extractor withdrawals in this model, but not total CASH emissions.**  
   External purchase equivalent is about 1.24x extracted CASH, but total net CASH created after sinks remains large because grinders and payers also receive rewards.

3. **Sinks cover only about 47% of CASH emissions.**  
   That leaves roughly 53% net new CASH after modeled operating/training/equipment sinks.

4. **Scaling is nearly linear.**  
   The per-player averages barely change from 100 to 10,000 players, meaning the economy does not naturally self-balance as population grows.

## Recommendations before any real payout/redemption path

1. **Do not make daily CASH directly redeemable.**  
   Daily quest CASH should be game operating money, not something a minimum-effort user can claim and withdraw.

2. **Split rewards into spend-bound vs withdrawable buckets.**  
   Suggested buckets:
   - `CASH`: game-only operating currency.
   - `DYN`: holder/ownership/status currency.
   - `CLAIMABLE`: scarce, capped, delayed, and funded only by actual treasury/revenue.

3. **Move extractor rewards toward non-cash progression.**  
   Convert much of the daily quest value to XP, training tickets, scouting tickets, fatigue recovery, item fragments, or non-transferable boosts.

4. **Add daily claim throttles.**  
   Examples:
   - first 1-3 days: no withdrawable reward
   - claimable reward unlocks after retention streak + minimum team upgrade spend
   - lower payout if user sells/extracts without reinvesting

5. **Make payouts treasury-funded, not emissions-funded.**  
   Claimable value should be capped by real inflows: marketplace fees, upgrade purchases, sponsor/season budgets, and token-sale treasury allocations.

6. **Add a source-of-funds simulation gate to CI/admin tools.**  
   Before launch, every reward type should answer: `who funded this? platform, sponsor, treasury, user spend, or minted?`

## Caveats

- This is not a real financial audit. It does not use production transaction history, real deposits, real token purchases, or real payout records.
- It is a stress model from current source-code constants and explicit behavioral assumptions.
- The model intentionally treats 50% of users as extractive because that was the requested stress case.
- Real outcomes will depend on retention, fraud controls, bot resistance, actual payer conversion, actual payout rules, and whether CASH is ever redeemable.
