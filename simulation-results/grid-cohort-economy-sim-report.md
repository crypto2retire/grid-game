# GRID Kintara-Style Cohort Economy Stress Simulation — 50/25/25 Player Mix

**Run date:** 2026-07-04  
**Environment:** local repo simulation script, no production database writes  
**Data type:** hypothetical in-game economy simulation using current source-code constants plus Kevin's corrected Kintara-style payout rules, **not real financial/accounting data**  
**Source coverage:** game-day rewards/expenses, venue/transport constants, training/equipment cost ranges, current daily quest values as a legacy comparison only  
**Output JSON:** `simulation-results/grid-cohort-economy-sim.json`

## Important correction from Kevin

The previous simulation treated daily quests as direct CASH rewards. Production code has now been corrected so daily quests use `rewardCash: 0` and function as payout eligibility gates instead of wallet credits.

Correct target design:

1. **CASH should only be awarded for playing games / game-economy actions.**
2. **Daily quests should be required to become eligible to redeem CASH rewards.**
3. **Completing daily tasks unlocks access to a daily payout.**
4. **That daily payout scales based on holdings / DYN status.**
5. **The traveling merchant gives additional gold/CASH access only after donating materials, then selling to the merchant.**

This revised sim models the same rule now enforced for daily quests in production code: tasks unlock access; they do not credit CASH.

## Source files used

- `apps/api/src/modules/daily-quests/daily-quests.service.ts`
- `apps/api/src/modules/economy/teamEconomy.config.ts`
- `apps/api/src/modules/economy/gameEconomics.ts`
- `apps/api/src/modules/testing/mega-simulation.service.ts`

## Scenario design

Cohort mix requested:

| Cohort | Share | Revised modeled behavior |
|---|---:|---|
| Payout extractors | 50% | Complete eligibility tasks + 1 LOCAL_REC match, low DYN holdings, optional tiny merchant sale, redeem only up to holder cap, no upgrades. |
| Free grinders | 25% | Complete eligibility tasks + 2 matches/day, donate materials to merchant often, no external purchases, reinvest up to 75% into training. |
| Payer-holders | 25% | Complete eligibility tasks + 3 matches/day, higher DYN holdings, external purchase equivalent 5k-25k CASH/day, spend on training/equipment/upgrades, no extraction in this base case. |

Simulation parameters:

```txt
Player counts: 100, 500, 1,000, 5,000, 10,000
Days: 30
Trials per player count: 25
Seed: 20260704
```

25 trials were used for the revised model because the 100-trial run exceeded the 10-minute local execution cap after adding holder and merchant behavior. Results are stable enough for directional stress modeling; rerun with more trials in a longer-running job before locking final tokenomics.

## Holder-scaled daily redemption caps modeled

These are design assumptions for the sim, not production constants yet:

| DYN held | Daily redeem cap |
|---:|---:|
| 0 | 500 CASH |
| 100 | 1,000 CASH |
| 500 | 2,000 CASH |
| 1,000 | 3,500 CASH |
| 2,500 | 5,000 CASH |
| 5,000+ | 7,500 CASH |

## Main revised result table

| Players | Extracted/day | Claimable unlocked/day | Game CASH/day | Merchant CASH/day | Direct quest CASH avoided/day | Sinks/day | Net CASH created/day | External / Extracted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 28,505 | 181,783 | 1,318,764 | 55,250 | 275,000 | 720,543 | 653,470 | 10.98x |
| 500 | 142,456 | 907,999 | 6,580,764 | 276,864 | 1,375,000 | 3,586,771 | 3,270,858 | 10.94x |
| 1,000 | 284,967 | 1,815,516 | 13,162,790 | 552,432 | 2,750,000 | 7,171,814 | 6,543,407 | 10.98x |
| 5,000 | 1,425,673 | 9,076,605 | 65,839,083 | 2,761,915 | 13,750,000 | 35,855,696 | 32,745,303 | 10.96x |
| 10,000 | 2,849,501 | 18,155,276 | 131,601,431 | 5,526,209 | 27,500,000 | 71,692,270 | 65,435,371 | 10.96x |

## Per-player/day averages

| Players | Game CASH/player/day | Merchant/player/day | Claimable/player/day | Extracted/player/day | Direct quest CASH avoided/player/day |
|---:|---:|---:|---:|---:|---:|
| 100 | 13,188 | 552 | 1,818 | 285 | 2,750 |
| 500 | 13,162 | 554 | 1,816 | 285 | 2,750 |
| 1,000 | 13,163 | 552 | 1,816 | 285 | 2,750 |
| 5,000 | 13,168 | 552 | 1,815 | 285 | 2,750 |
| 10,000 | 13,160 | 553 | 1,816 | 285 | 2,750 |

## Difference versus the old direct-daily-CASH assumption

| Players | Revised extracted/day | Old direct-daily-CASH extracted/day | Reduction | Direct quest CASH avoided/day |
|---:|---:|---:|---:|---:|
| 100 | 28,505 | 251,145 | 88.6% | 275,000 |
| 500 | 142,456 | 1,255,763 | 88.7% | 1,375,000 |
| 1,000 | 284,967 | 2,512,747 | 88.7% | 2,750,000 |
| 5,000 | 1,425,673 | 12,562,222 | 88.7% | 13,750,000 |
| 10,000 | 2,849,501 | 25,122,138 | 88.7% | 27,500,000 |

## 30-day totals for reference

| Players | Game CASH awarded | Merchant CASH awarded | Direct quest CASH avoided | Claimable unlocked | Extracted CASH | External purchase equiv | Net CASH created after sinks |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 394,883,686 | 16,572,954 | 82,500,000 | 54,465,470 | 8,549,018 | 93,840,000 | 196,302,213 |
| 10,000 | 3,948,042,945 | 165,786,280 | 825,000,000 | 544,658,280 | 85,485,027 | 937,235,800 | 1,963,061,129 |

## Readout

1. **Kevin's corrected Kintara-style rule fixes the biggest extraction faucet.**  
   Removing direct daily quest CASH lowers modeled extractor withdrawals by about **88.7%** across the tested player counts.

2. **Daily quests should be eligibility, not payment.**  
   The task loop should answer: `Did you earn access to claim today?` not `Here is 2,750 CASH for clicking tasks.`

3. **Holder-scaled redemption creates the right incentive.**  
   Low-holding extractors can only redeem small amounts. Active holders unlock more claimable value, but they are also the users funding upgrades and keeping DYN in the economy.

4. **Traveling merchant works as an active-grind bridge.**  
   Free grinders can create additional CASH access by donating materials, but this requires active participation and can be throttled by merchant inventory, daily caps, resource type, and event timing.

5. **The remaining issue is total CASH creation from game play.**  
   The sim still shows large net CASH creation because games, fan revenue, sponsor revenue, and merchant sales all emit CASH. That can be fine if CASH is game-only operating currency, but it is dangerous if CASH becomes broadly redeemable without source-funded caps.

## Implementation implications

Daily quest production code now aligns with this model: `daily-quests.service.ts` seeds `rewardCash: 0`, claim/unlock no longer calls `creditCurrency`, and the route response says daily payout eligibility was unlocked. Remaining mechanics to build next:

1. **Daily payout claim records**
   - Store `dailyPayoutEligible = true` or equivalent after required tasks are complete.
   - Add a dedicated claim model/table when holder-scaled payout redemption is implemented.
   - Keep XP/items/tickets as daily quest rewards if desired.

2. **Game CASH**
   - Award CASH only from completed games and safe game-economy sources.
   - Keep all credits/debits through central `currency.service.ts` and ledger rows.

3. **Claimable payout**
   - Add a `ClaimableReward` / `DailyPayoutClaim` concept separate from wallet CASH.
   - Daily claim amount should be capped by DYN holdings / luck tier / status.
   - Claimable payout should be funded by treasury/source-of-funds, not unlimited emissions.

4. **Traveling merchant**
   - Add donated material counters.
   - Unlock merchant sale offers only after donation thresholds.
   - Give merchant daily inventory/caps so grinders cannot farm unlimited CASH.

5. **Anti-extractor rules**
   - No direct payout without completing daily tasks.
   - No high payout without holdings.
   - No merchant boost without material donation.
   - Add streak/retention and bot/fraud throttles before any real-value redemption.

## Caveats

- This is not a real financial audit. It does not use production transaction history, real deposits, real token purchases, or real payout records.
- It is a stress model from source-code constants and explicit design assumptions.
- Daily quests now align with the corrected production rule: they gate payout eligibility and do not credit wallet CASH.
- Real outcomes depend on actual payout caps, DYN pricing, retention, fraud controls, bot resistance, payer conversion, and whether CASH is ever redeemable.
