#!/usr/bin/env python3
"""
GRID cohort economy stress simulation — Kintara-style redemption gate.

This is a deterministic Monte Carlo model using current source-code economy constants
plus the product rule Kevin clarified on 2026-07-04:

  - CASH should only be awarded for playing games / game-economy actions.
  - Daily quests should NOT directly award CASH.
  - Daily quests are an eligibility gate to redeem/claim CASH rewards.
  - Daily redemption capacity scales with DYN/holder status.
  - Donating materials to the traveling merchant unlocks additional CASH/gold by
    selling to the merchant.

This is NOT live financial/accounting data. It is a stress model for in-game
currency design and payout-extraction pressure.

Source assumptions mirrored from:
  - apps/api/src/modules/daily-quests/daily-quests.service.ts (current code still has direct CASH; this sim models the intended corrected rule)
  - apps/api/src/modules/economy/teamEconomy.config.ts
  - apps/api/src/modules/economy/gameEconomics.ts
  - apps/api/src/modules/testing/mega-simulation.service.ts
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

# Current source-code daily quest values. The revised model treats these as the
# legacy/direct-CASH baseline for comparison only. Daily quests now gate claims.
LEGACY_DAILY_QUEST_REWARD_CASH = 750 + 1500 + 500

# Source-code constants from teamEconomy.config.ts / gameEconomics.ts
GAME_DAY_FIXED_REWARDS = {
    "WIN_BASE": 3000,
    "DRAW_BASE": 1500,
    "LOSS_BASE": 500,
    "HOME_FIELD_ADVANTAGE_BONUS": 500,
    "CLEAN_SHEET_BONUS": 300,
    "HIGH_SCORING_BONUS": 200,
}
LEAGUE_REWARD_MULTIPLIER = {"LOCAL_REC": 1.0, "REGIONAL": 1.5, "SEMI_PRO": 2.5, "PRO": 4.0}
VENUE_CAPACITY = {"PARK_FIELD": 250, "COMMUNITY_FIELD": 800, "SMALL_STADIUM": 3000, "REGIONAL_STADIUM": 15000, "PRO_STADIUM": 65000}
VENUE_TICKET_PRICE = {"PARK_FIELD": 8, "COMMUNITY_FIELD": 12, "SMALL_STADIUM": 20, "REGIONAL_STADIUM": 35, "PRO_STADIUM": 75}
TRANSPORT_OPERATING_COST = {"CARPOOL": 100, "USED_BUS": 250, "TEAM_BUS": 500, "LUXURY_COACH": 1200}

# Training/equipment source constants from mega-simulation.service.ts
TRAINING_CASH_COSTS = [1000, 1000, 3000, 3000, 3000, 3000, 10000, 15000]
EQUIPMENT_CASH_COSTS = [5000, 4000, 3000, 20000, 15000, 12000, 8000, 60000, 50000, 35000]

# Intended Kintara-style holder-scaled redemption tiers. These are design
# assumptions for the stress model, not current production code.
HOLDER_REDEMPTION_TIERS = [
    (0, 500),
    (100, 1000),
    (500, 2000),
    (1000, 3500),
    (2500, 5000),
    (5000, 7500),
]

@dataclass
class PlayerDay:
    game_cash_awarded: float = 0.0       # CASH from game play only: league/game/fan/sponsor/merchant actions
    merchant_cash_awarded: float = 0.0   # CASH from traveling merchant after donation eligibility
    operating_sinks: float = 0.0         # travel, venue staff, recovery, league dues
    upgrade_sinks: float = 0.0           # training/equipment/upgrades paid by users
    claimable_unlocked: float = 0.0      # amount eligible to redeem today after daily tasks + holder cap
    extracted: float = 0.0               # CASH leaving active economy / hoarded by extractor behavior
    retained: float = 0.0                # CASH left in player wallet after spend/extract
    external_purchase_cash_equiv: float = 0.0
    dyn_held: float = 0.0
    daily_tasks_completed: int = 0
    merchant_donations: int = 0
    matches: int = 0
    trainings: int = 0
    upgrades: int = 0

    def add(self, other: "PlayerDay") -> None:
        for key in self.__dataclass_fields__:
            setattr(self, key, getattr(self, key) + getattr(other, key))


def attendance(capacity: int, team_form: float, league_tier: str) -> int:
    base_rate = 0.4 + team_form / 200.0
    tier_multiplier = LEAGUE_REWARD_MULTIPLIER[league_tier] / 2.0
    capped_rate = min(base_rate * tier_multiplier, 0.95)
    return round(capacity * capped_rate)


def redemption_cap_for_dyn(dyn_held: float) -> int:
    cap = 0
    for min_dyn, tier_cap in HOLDER_REDEMPTION_TIERS:
        if dyn_held >= min_dyn:
            cap = tier_cap
    return cap


def simulate_game(rng: random.Random, league_tier: str, venue_tier: str, transport_tier: str, sponsor_per_game: float = 0.0) -> PlayerDay:
    roll = rng.random()
    if roll < 0.42:
        result_reward = GAME_DAY_FIXED_REWARDS["WIN_BASE"]
        did_win = True
    elif roll < 0.84:
        result_reward = GAME_DAY_FIXED_REWARDS["LOSS_BASE"]
        did_win = False
    else:
        result_reward = GAME_DAY_FIXED_REWARDS["DRAW_BASE"]
        did_win = False
    result_reward *= LEAGUE_REWARD_MULTIPLIER[league_tier]

    is_home = rng.random() < 0.5
    score_for = max(0, round(rng.gauss(3.0 if did_win else 1.8, 1.5)))
    score_against = 0 if rng.random() < 0.08 else max(0, round(rng.gauss(2.2, 1.4)))

    day = PlayerDay(matches=1)
    revenue = result_reward
    expenses = 0

    if is_home:
        cap = VENUE_CAPACITY[venue_tier]
        price = VENUE_TICKET_PRICE[venue_tier]
        fans = attendance(cap, 50, league_tier)
        tickets = fans * price
        concessions = round(fans * 3)
        merch = round(fans * 1.5)
        venue_staff = round(cap * 0.5 + 200)
        revenue += tickets + concessions + merch + GAME_DAY_FIXED_REWARDS["HOME_FIELD_ADVANTAGE_BONUS"]
        expenses += venue_staff
    else:
        revenue += 150

    revenue += sponsor_per_game
    if score_for >= 3:
        revenue += GAME_DAY_FIXED_REWARDS["HIGH_SCORING_BONUS"]
    if score_against == 0:
        revenue += GAME_DAY_FIXED_REWARDS["CLEAN_SHEET_BONUS"]

    base_travel = TRANSPORT_OPERATING_COST[transport_tier]
    expenses += (round(base_travel * 1.5) if not is_home else base_travel) + 75 + 50

    day.game_cash_awarded += revenue
    day.operating_sinks += expenses
    day.retained += revenue - expenses
    return day


def simulate_merchant(rng: random.Random, cohort: str) -> PlayerDay:
    # Materials are not represented as CASH here. Donation unlocks a sale event;
    # merchant_cash_awarded is additional CASH generated by that sale.
    day = PlayerDay()
    if cohort == "extractor":
        if rng.random() < 0.15:
            day.merchant_cash_awarded = rng.choice([100, 150, 250, 300])
            day.merchant_donations = 1
    elif cohort == "free_grinder":
        if rng.random() < 0.65:
            day.merchant_cash_awarded = rng.choice([500, 750, 1000, 1250, 1500])
            day.merchant_donations = 1
    elif cohort == "payer_holder":
        if rng.random() < 0.75:
            day.merchant_cash_awarded = rng.choice([1000, 1500, 2000, 2500, 3000])
            day.merchant_donations = 1
    day.retained += day.merchant_cash_awarded
    return day


def simulate_training_spend(rng: random.Random, max_sessions: int, cash_available: float, intensity: float) -> tuple[float, int]:
    spent = 0.0
    sessions = 0
    for _ in range(max_sessions):
        if rng.random() > intensity:
            continue
        cost = rng.choice(TRAINING_CASH_COSTS)
        if cash_available - spent >= cost:
            spent += cost
            sessions += 1
    return spent, sessions


def simulate_upgrade_spend(rng: random.Random, cash_available: float, chance: float) -> tuple[float, int]:
    if rng.random() > chance:
        return 0.0, 0
    cost = rng.choice(EQUIPMENT_CASH_COSTS)
    if cash_available >= cost:
        return float(cost), 1
    return 0.0, 0


def dyn_holdings_for_cohort(rng: random.Random, cohort: str) -> int:
    if cohort == "extractor":
        return rng.choices([0, 50, 100, 250], weights=[0.55, 0.25, 0.15, 0.05])[0]
    if cohort == "free_grinder":
        return rng.choices([50, 100, 250, 500, 1000], weights=[0.20, 0.30, 0.25, 0.20, 0.05])[0]
    if cohort == "payer_holder":
        return rng.choices([500, 1000, 2500, 5000, 10000], weights=[0.15, 0.25, 0.30, 0.20, 0.10])[0]
    raise ValueError(cohort)


def unlock_daily_claim(day: PlayerDay, dyn_held: float) -> None:
    # Daily tasks are an eligibility gate. They grant no direct CASH.
    if day.daily_tasks_completed < 3:
        day.claimable_unlocked = 0
        return
    cap = redemption_cap_for_dyn(dyn_held)
    day.claimable_unlocked = min(max(0.0, day.retained), cap)


def simulate_player_day(rng: random.Random, cohort: str) -> PlayerDay:
    day = PlayerDay(dyn_held=dyn_holdings_for_cohort(rng, cohort), daily_tasks_completed=3)

    if cohort == "extractor":
        # Minimum Kintara-style extraction loop: complete eligibility tasks, play one game,
        # optionally donate a small amount to merchant, redeem only up to holder cap.
        day.add(simulate_game(rng, "LOCAL_REC", "PARK_FIELD", "CARPOOL", sponsor_per_game=0))
        day.add(simulate_merchant(rng, cohort))
        unlock_daily_claim(day, day.dyn_held)
        day.extracted = day.claimable_unlocked
        day.retained = max(0.0, day.retained - day.extracted)
        return day

    if cohort == "free_grinder":
        # Active free player: more games + merchant donation; no outside purchases;
        # reinvest most rewards and usually does not extract.
        for _ in range(2):
            league = "REGIONAL" if rng.random() < 0.30 else "LOCAL_REC"
            venue = "COMMUNITY_FIELD" if league == "REGIONAL" else "PARK_FIELD"
            day.add(simulate_game(rng, league, venue, "CARPOOL", sponsor_per_game=0))
        day.add(simulate_merchant(rng, cohort))
        unlock_daily_claim(day, day.dyn_held)
        target_spend, sessions = simulate_training_spend(rng, max_sessions=3, cash_available=max(0, day.retained), intensity=0.85)
        spend = min(target_spend, max(0, day.retained) * 0.75)
        day.upgrade_sinks += spend
        day.trainings += sessions
        day.retained -= spend
        return day

    if cohort == "payer_holder":
        # Active holder: buys/holds DYN, gets a higher claim cap, plays more, and spends.
        day.external_purchase_cash_equiv += rng.choice([5000, 7500, 10000, 15000, 25000])
        for _ in range(3):
            league = rng.choices(["REGIONAL", "SEMI_PRO", "LOCAL_REC"], weights=[0.55, 0.25, 0.20])[0]
            venue = "SMALL_STADIUM" if league == "SEMI_PRO" else ("COMMUNITY_FIELD" if league == "REGIONAL" else "PARK_FIELD")
            transport = "USED_BUS" if league in ("REGIONAL", "SEMI_PRO") else "CARPOOL"
            sponsor = rng.choice([250, 500, 750, 1000])
            day.add(simulate_game(rng, league, venue, transport, sponsor_per_game=sponsor))
        day.add(simulate_merchant(rng, cohort))
        unlock_daily_claim(day, day.dyn_held)
        available = max(0, day.retained + day.external_purchase_cash_equiv * 0.5)
        training_spend, sessions = simulate_training_spend(rng, max_sessions=5, cash_available=available, intensity=0.90)
        upgrade_spend, upgrades = simulate_upgrade_spend(rng, cash_available=max(0, available - training_spend), chance=0.45)
        spend = training_spend + upgrade_spend
        day.upgrade_sinks += spend
        day.trainings += sessions
        day.upgrades += upgrades
        day.retained = max(0, day.retained - min(spend, day.retained))
        return day

    raise ValueError(f"unknown cohort: {cohort}")


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round((p / 100.0) * (len(ordered) - 1))))
    return ordered[idx]


def run_scenario(players: int, days: int, trials: int, seed: int) -> dict:
    rng_master = random.Random(seed + players * 1009 + days)
    cohort_counts = {
        "extractor": int(round(players * 0.50)),
        "free_grinder": int(round(players * 0.25)),
    }
    cohort_counts["payer_holder"] = players - cohort_counts["extractor"] - cohort_counts["free_grinder"]

    trial_totals: list[PlayerDay] = []
    daily_extracted_values: list[float] = []
    daily_net_emission_values: list[float] = []
    daily_external_values: list[float] = []
    daily_claimable_values: list[float] = []

    for _ in range(trials):
        rng = random.Random(rng_master.randint(1, 2_000_000_000))
        total = PlayerDay()
        for _day_idx in range(days):
            day_total = PlayerDay()
            for cohort, count in cohort_counts.items():
                for _ in range(count):
                    day_total.add(simulate_player_day(rng, cohort))
            total.add(day_total)
            emissions = day_total.game_cash_awarded + day_total.merchant_cash_awarded
            daily_extracted_values.append(day_total.extracted)
            daily_net_emission_values.append(emissions - day_total.operating_sinks - day_total.upgrade_sinks)
            daily_external_values.append(day_total.external_purchase_cash_equiv)
            daily_claimable_values.append(day_total.claimable_unlocked)
        trial_totals.append(total)

    def avg_field(field: str) -> float:
        return mean(getattr(x, field) for x in trial_totals)

    game_cash = avg_field("game_cash_awarded")
    merchant_cash = avg_field("merchant_cash_awarded")
    emissions = game_cash + merchant_cash
    operating_sinks = avg_field("operating_sinks")
    upgrade_sinks = avg_field("upgrade_sinks")
    extracted = avg_field("extracted")
    retained = avg_field("retained")
    external = avg_field("external_purchase_cash_equiv")
    claimable = avg_field("claimable_unlocked")
    net_cash_created_after_sinks = emissions - operating_sinks - upgrade_sinks
    sink_coverage = (operating_sinks + upgrade_sinks) / emissions if emissions else 0
    external_to_extracted = external / extracted if extracted else math.inf
    old_direct_daily_quest_emission = players * LEGACY_DAILY_QUEST_REWARD_CASH * days

    return {
        "players": players,
        "days": days,
        "trials": trials,
        "cohorts": cohort_counts,
        "avg_totals": {
            "game_cash_awarded": game_cash,
            "merchant_cash_awarded": merchant_cash,
            "cash_emissions": emissions,
            "legacy_direct_daily_quest_cash_avoided": old_direct_daily_quest_emission,
            "operating_sinks": operating_sinks,
            "upgrade_sinks": upgrade_sinks,
            "claimable_unlocked": claimable,
            "extracted_cash": extracted,
            "retained_cash": retained,
            "external_purchase_cash_equiv": external,
            "net_cash_created_after_sinks": net_cash_created_after_sinks,
            "matches": avg_field("matches"),
            "training_sessions": avg_field("trainings"),
            "upgrades": avg_field("upgrades"),
            "merchant_donations": avg_field("merchant_donations"),
        },
        "avg_per_day": {
            "game_cash_awarded": game_cash / days,
            "merchant_cash_awarded": merchant_cash / days,
            "cash_emissions": emissions / days,
            "legacy_direct_daily_quest_cash_avoided": old_direct_daily_quest_emission / days,
            "operating_sinks": operating_sinks / days,
            "upgrade_sinks": upgrade_sinks / days,
            "claimable_unlocked": claimable / days,
            "extracted_cash": extracted / days,
            "retained_cash": retained / days,
            "external_purchase_cash_equiv": external / days,
            "net_cash_created_after_sinks": net_cash_created_after_sinks / days,
        },
        "avg_per_player_per_day": {
            "game_cash_awarded": game_cash / days / players,
            "merchant_cash_awarded": merchant_cash / days / players,
            "cash_emissions": emissions / days / players,
            "legacy_direct_daily_quest_cash_avoided": old_direct_daily_quest_emission / days / players,
            "claimable_unlocked": claimable / days / players,
            "extracted_cash": extracted / days / players,
            "net_cash_created_after_sinks": net_cash_created_after_sinks / days / players,
            "external_purchase_cash_equiv": external / days / players,
        },
        "risk_metrics": {
            "sink_coverage_pct": sink_coverage * 100,
            "external_purchase_to_extracted_ratio": external_to_extracted,
            "daily_extracted_p50": percentile(daily_extracted_values, 50),
            "daily_extracted_p95": percentile(daily_extracted_values, 95),
            "daily_claimable_unlocked_p50": percentile(daily_claimable_values, 50),
            "daily_claimable_unlocked_p95": percentile(daily_claimable_values, 95),
            "daily_net_emission_p50": percentile(daily_net_emission_values, 50),
            "daily_net_emission_p95": percentile(daily_net_emission_values, 95),
            "daily_external_purchase_p50": percentile(daily_external_values, 50),
            "daily_external_purchase_p95": percentile(daily_external_values, 95),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--players", default="100,500,1000,5000,10000", help="comma-separated player counts")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--trials", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260704)
    parser.add_argument("--out", default="simulation-results/grid-cohort-economy-sim.json")
    args = parser.parse_args()

    player_counts = [int(x.strip()) for x in args.players.split(",") if x.strip()]
    results = [run_scenario(p, args.days, args.trials, args.seed) for p in player_counts]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model_type": "hypothetical_kintara_style_in_game_economy_simulation_not_real_financial_data",
        "source_files": [
            "apps/api/src/modules/daily-quests/daily-quests.service.ts",
            "apps/api/src/modules/economy/teamEconomy.config.ts",
            "apps/api/src/modules/economy/gameEconomics.ts",
            "apps/api/src/modules/testing/mega-simulation.service.ts",
        ],
        "cohort_mix": {"extractor": 0.50, "free_grinder": 0.25, "payer_holder": 0.25},
        "corrected_kintara_style_rules": {
            "cash_directly_awarded_by_daily_quests": False,
            "cash_awarded_for": ["playing games", "game-day business revenue", "sponsor/game revenue", "traveling merchant material sale after donation"],
            "daily_quests_required_for_redemption": True,
            "daily_redemption_scales_with_dyn_holdings": HOLDER_REDEMPTION_TIERS,
            "legacy_daily_quest_cash_now_avoided_per_player_day": LEGACY_DAILY_QUEST_REWARD_CASH,
        },
        "key_assumptions": {
            "extractors": "complete eligibility tasks + 1 LOCAL_REC match; low DYN holdings; optional small merchant sale; redeem only up to holder cap; no upgrades",
            "free_grinders": "complete eligibility tasks + 2 matches; donate materials to merchant often; spend up to 75% of retained CASH on training; no external purchases",
            "payer_holders": "complete eligibility tasks + 3 matches; external purchase equivalent 5k-25k CASH/day; higher DYN holdings; spend on training/equipment/upgrades; no extraction in base case",
        },
        "results": results,
    }
    out_path.write_text(json.dumps(payload, indent=2))

    print(f"Wrote {out_path}")
    print("\nGRID Kintara-style cohort economy stress simulation")
    print("Data type: hypothetical simulation from source-code constants + corrected product rules, NOT real financial/audit data")
    print(f"Days={args.days} Trials={args.trials} Cohorts=50% extractor / 25% free grinder / 25% payer-holder")
    print("\nplayers | extracted/day | claimable/day | game cash/day | merchant/day | direct quest cash avoided/day | sinks/day | net created/day | external/extracted")
    print("-" * 158)
    for r in results:
        d = r["avg_per_day"]
        m = r["risk_metrics"]
        print(
            f"{r['players']:>7,} | "
            f"{d['extracted_cash']:>13,.0f} | "
            f"{d['claimable_unlocked']:>13,.0f} | "
            f"{d['game_cash_awarded']:>13,.0f} | "
            f"{d['merchant_cash_awarded']:>12,.0f} | "
            f"{d['legacy_direct_daily_quest_cash_avoided']:>29,.0f} | "
            f"{(d['operating_sinks'] + d['upgrade_sinks']):>9,.0f} | "
            f"{d['net_cash_created_after_sinks']:>15,.0f} | "
            f"{m['external_purchase_to_extracted_ratio']:>18.2f}x"
        )

    print("\nPer-player/day averages")
    print("players | game cash/player/day | merchant/player/day | claimable/player/day | extracted/player/day | direct quest cash avoided/player/day")
    print("-" * 132)
    for r in results:
        pp = r["avg_per_player_per_day"]
        print(
            f"{r['players']:>7,} | "
            f"{pp['game_cash_awarded']:>20,.0f} | "
            f"{pp['merchant_cash_awarded']:>19,.0f} | "
            f"{pp['claimable_unlocked']:>20,.0f} | "
            f"{pp['extracted_cash']:>20,.0f} | "
            f"{pp['legacy_direct_daily_quest_cash_avoided']:>36,.0f}"
        )

if __name__ == "__main__":
    main()
