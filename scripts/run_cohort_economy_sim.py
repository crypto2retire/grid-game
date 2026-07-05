#!/usr/bin/env python3
"""
GRID unified-CASH cohort economy stress simulation.

This is a deterministic Monte Carlo model using current source-code economy
constants and the unified-CASH product rule:

  - There is one wallet CASH balance.
  - All CASH can be requested for withdrawal/exchange.
  - Withdrawal throughput is limited by account/day/DYN/age/team-investment/
    economy-health/treasury-reserve rules, not by claimable/unclaimable buckets.
  - Withdrawal removes CASH from the wallet; fees are burned/routed to treasury.

This is NOT live financial/accounting data. It is a stress model for in-game
currency design and payout-extraction pressure.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

LEGACY_DAILY_QUEST_REWARD_CASH = 750 + 1500 + 500

# Mirrored from apps/api/src/modules/economy/teamEconomy.config.ts and
# apps/api/src/modules/economy/balance.service.ts after the unified-CASH rebalance.
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

LOCAL_MATCH_FAUCET_CUT_PCT = 0.40
LOSS_REWARD_CUT_PCT = 0.75
MATCH_EQUIPMENT_WEAR_RESERVE = 120
TRAINING_EQUIPMENT_WEAR_RESERVE = 60
BASE_DAILY_WITHDRAWAL_LIMIT = 500
MAX_TREASURY_RESERVE_PAYOUT_PCT_PER_DAY = 0.02
INITIAL_TREASURY_RESERVE_PER_PLAYER = 900
WITHDRAWAL_FEE_MIN = 0.03
WITHDRAWAL_FEE_MAX = 0.40
MERCHANT_DAILY_CASH_POOL_PER_PLAYER = 125

TRAINING_CASH_COSTS = [1000, 1000, 3000, 3000, 3000, 3000, 10000, 15000]
EQUIPMENT_CASH_COSTS = [5000, 4000, 3000, 20000, 15000, 12000, 8000, 60000, 50000, 35000]


@dataclass
class PlayerDay:
    game_cash_awarded: float = 0.0
    merchant_cash_awarded: float = 0.0
    operating_sinks: float = 0.0
    upgrade_sinks: float = 0.0
    withdrawal_requested: float = 0.0
    withdrawal_gross_removed: float = 0.0
    withdrawal_fee: float = 0.0
    net_paid_out: float = 0.0
    retained: float = 0.0
    external_purchase_cash_equiv: float = 0.0
    dyn_held: float = 0.0
    account_age_days: float = 0.0
    team_investment_score: float = 0.0
    daily_tasks_completed: int = 0
    merchant_donations: int = 0
    matches: int = 0
    trainings: int = 0
    upgrades: int = 0

    def add(self, other: "PlayerDay") -> None:
        for key in self.__dataclass_fields__:
            setattr(self, key, getattr(self, key) + getattr(other, key))


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def attendance(capacity: int, team_form: float, league_tier: str) -> int:
    base_rate = 0.4 + team_form / 200.0
    tier_multiplier = LEAGUE_REWARD_MULTIPLIER[league_tier] / 2.0
    capped_rate = min(base_rate * tier_multiplier, 0.95)
    return round(capacity * capped_rate)


def balanced_result_reward(base_reward: float, outcome: str) -> float:
    if outcome == "LOSS":
        return round(base_reward * (1.0 - LOSS_REWARD_CUT_PCT))
    return round(base_reward * (1.0 - LOCAL_MATCH_FAUCET_CUT_PCT))


def reward_multiplier_from_snapshot(cash_emitted: float, cash_sunk: float, treasury_reserve: float) -> float:
    sink_coverage = (cash_sunk / cash_emitted) if cash_emitted > 0 else 1.0
    if sink_coverage >= 0.90:
        multiplier = 1.00
    elif sink_coverage >= 0.75:
        multiplier = 0.90
    elif sink_coverage >= 0.60:
        multiplier = 0.75
    elif sink_coverage >= 0.45:
        multiplier = 0.65
    else:
        multiplier = 0.55
    if treasury_reserve < 10_000:
        multiplier = min(multiplier, 0.75)
    if treasury_reserve < 1_000:
        multiplier = min(multiplier, 0.60)
    return clamp(multiplier, 0.25, 1.0)


def dyn_withdrawal_multiplier(dyn_held: float) -> float:
    if dyn_held >= 10_000:
        return 5.0
    if dyn_held >= 5_000:
        return 3.5
    if dyn_held >= 2_500:
        return 2.5
    if dyn_held >= 1_000:
        return 1.8
    if dyn_held >= 500:
        return 1.4
    if dyn_held >= 100:
        return 1.15
    return 0.50


def age_withdrawal_multiplier(account_age_days: float) -> float:
    if account_age_days >= 180:
        return 2.0
    if account_age_days >= 90:
        return 1.6
    if account_age_days >= 30:
        return 1.25
    if account_age_days >= 7:
        return 0.75
    return 0.35


def investment_withdrawal_multiplier(score: float) -> float:
    if score >= 5_000:
        return 2.0
    if score >= 2_500:
        return 1.6
    if score >= 1_000:
        return 1.25
    if score >= 250:
        return 0.9
    return 0.55


def withdrawal_fee_rate(dyn_held: float, account_age_days: float, team_investment_score: float, economy_multiplier: float) -> float:
    rate = 0.28
    if dyn_held >= 500:
        rate -= 0.04
    if dyn_held >= 2_500:
        rate -= 0.05
    if dyn_held >= 5_000:
        rate -= 0.04
    if account_age_days >= 30:
        rate -= 0.04
    if account_age_days >= 90:
        rate -= 0.03
    if team_investment_score >= 1_000:
        rate -= 0.04
    if team_investment_score >= 2_500:
        rate -= 0.03
    if economy_multiplier < 0.75:
        rate += 0.06
    if economy_multiplier < 0.60:
        rate += 0.08
    return clamp(rate, WITHDRAWAL_FEE_MIN, WITHDRAWAL_FEE_MAX)


def withdrawal_limit(dyn_held: float, account_age_days: float, team_investment_score: float, economy_multiplier: float, treasury_reserve: float) -> float:
    raw = BASE_DAILY_WITHDRAWAL_LIMIT
    raw *= dyn_withdrawal_multiplier(dyn_held)
    raw *= age_withdrawal_multiplier(account_age_days)
    raw *= investment_withdrawal_multiplier(team_investment_score)
    raw *= economy_multiplier
    reserve_limit = treasury_reserve * MAX_TREASURY_RESERVE_PAYOUT_PCT_PER_DAY
    return max(0.0, math.floor(min(raw, reserve_limit)))


def cohort_profile(rng: random.Random, cohort: str) -> tuple[int, int, int]:
    if cohort == "extractor":
        dyn = rng.choices([0, 50, 100, 250], weights=[0.55, 0.25, 0.15, 0.05])[0]
        age = rng.choices([3, 10, 30, 90], weights=[0.35, 0.35, 0.20, 0.10])[0]
        investment = rng.choices([25, 100, 250, 500], weights=[0.45, 0.35, 0.15, 0.05])[0]
        return dyn, age, investment
    if cohort == "free_grinder":
        dyn = rng.choices([50, 100, 250, 500, 1000], weights=[0.20, 0.30, 0.25, 0.20, 0.05])[0]
        age = rng.choices([10, 30, 90, 180], weights=[0.25, 0.35, 0.30, 0.10])[0]
        investment = rng.choices([250, 500, 1000, 2500], weights=[0.30, 0.35, 0.25, 0.10])[0]
        return dyn, age, investment
    if cohort == "payer_holder":
        dyn = rng.choices([500, 1000, 2500, 5000, 10000], weights=[0.15, 0.25, 0.30, 0.20, 0.10])[0]
        age = rng.choices([30, 90, 180, 365], weights=[0.20, 0.35, 0.30, 0.15])[0]
        investment = rng.choices([1000, 2500, 5000, 10000], weights=[0.25, 0.35, 0.30, 0.10])[0]
        return dyn, age, investment
    raise ValueError(cohort)


def simulate_game(rng: random.Random, league_tier: str, venue_tier: str, transport_tier: str, economy_multiplier: float, sponsor_per_game: float = 0.0) -> PlayerDay:
    roll = rng.random()
    if roll < 0.42:
        outcome = "WIN"
        base_reward = GAME_DAY_FIXED_REWARDS["WIN_BASE"]
        did_win = True
    elif roll < 0.84:
        outcome = "LOSS"
        base_reward = GAME_DAY_FIXED_REWARDS["LOSS_BASE"]
        did_win = False
    else:
        outcome = "DRAW"
        base_reward = GAME_DAY_FIXED_REWARDS["DRAW_BASE"]
        did_win = False

    result_reward = balanced_result_reward(base_reward, outcome) * LEAGUE_REWARD_MULTIPLIER[league_tier]
    result_reward = round(result_reward * economy_multiplier)

    is_home = rng.random() < 0.5
    score_for = max(0, round(rng.gauss(3.0 if did_win else 1.8, 1.5)))
    score_against = 0 if rng.random() < 0.08 else max(0, round(rng.gauss(2.2, 1.4)))

    day = PlayerDay(matches=1)
    revenue = result_reward
    expenses = 0.0

    if is_home:
        cap = VENUE_CAPACITY[venue_tier]
        price = VENUE_TICKET_PRICE[venue_tier]
        fans = attendance(cap, 50, league_tier)
        tickets = round(fans * price * economy_multiplier)
        concessions = round(fans * 3 * economy_multiplier)
        merch = round(fans * 1.5 * economy_multiplier)
        venue_staff = round((cap * 0.5 + 200) * 1.3)
        revenue += tickets + concessions + merch + round(GAME_DAY_FIXED_REWARDS["HOME_FIELD_ADVANTAGE_BONUS"] * economy_multiplier)
        expenses += venue_staff
    else:
        revenue += round(150 * economy_multiplier)

    revenue += round(sponsor_per_game * economy_multiplier)
    if score_for >= 3:
        revenue += round(GAME_DAY_FIXED_REWARDS["HIGH_SCORING_BONUS"] * economy_multiplier)
    if score_against == 0:
        revenue += round(GAME_DAY_FIXED_REWARDS["CLEAN_SHEET_BONUS"] * economy_multiplier)

    base_travel = TRANSPORT_OPERATING_COST[transport_tier]
    expenses += round(base_travel * (1.95 if not is_home else 1.3))
    expenses += 175  # recovery/medical staff
    expenses += 65   # league dues
    expenses += MATCH_EQUIPMENT_WEAR_RESERVE

    day.game_cash_awarded += revenue
    day.operating_sinks += expenses
    day.retained += revenue - expenses
    return day


def simulate_merchant(rng: random.Random, cohort: str, merchant_pool: dict[str, float]) -> PlayerDay:
    day = PlayerDay()
    if merchant_pool["remaining"] <= 0:
        return day
    proposed = 0.0
    if cohort == "extractor" and rng.random() < 0.15:
        proposed = rng.choice([100, 150, 250, 300])
    elif cohort == "free_grinder" and rng.random() < 0.65:
        proposed = rng.choice([250, 500, 750, 1000])
    elif cohort == "payer_holder" and rng.random() < 0.75:
        proposed = rng.choice([500, 750, 1000, 1500, 2000])
    if proposed > 0:
        payout = min(proposed, merchant_pool["remaining"])
        merchant_pool["remaining"] -= payout
        day.merchant_cash_awarded = payout
        day.merchant_donations = 1
        day.retained += payout
    return day


def simulate_training_spend(rng: random.Random, max_sessions: int, cash_available: float, intensity: float) -> tuple[float, int]:
    spent = 0.0
    sessions = 0
    for _ in range(max_sessions):
        if rng.random() > intensity:
            continue
        cost = rng.choice(TRAINING_CASH_COSTS) + TRAINING_EQUIPMENT_WEAR_RESERVE
        if cash_available - spent >= cost:
            spent += cost
            sessions += 1
    return spent, sessions


def simulate_upgrade_spend(rng: random.Random, cash_available: float, chance: float) -> tuple[float, int]:
    if rng.random() > chance:
        return 0.0, 0
    cost = rng.choice(EQUIPMENT_CASH_COSTS)
    # 2% listing/upgrade/market fee pressure modeled as extra marketplace friction.
    cost *= 1.02
    if cash_available >= cost:
        return float(cost), 1
    return 0.0, 0


def apply_withdrawal(day: PlayerDay, requested_amount: float, economy_multiplier: float, treasury_reserve: float) -> float:
    request = max(0.0, min(requested_amount, max(0.0, day.retained)))
    limit = withdrawal_limit(day.dyn_held, day.account_age_days, day.team_investment_score, economy_multiplier, treasury_reserve)
    gross = min(request, limit)
    fee_rate = withdrawal_fee_rate(day.dyn_held, day.account_age_days, day.team_investment_score, economy_multiplier)
    fee = math.floor(gross * fee_rate)
    net = max(0.0, gross - fee)
    day.withdrawal_requested += request
    day.withdrawal_gross_removed += gross
    day.withdrawal_fee += fee
    day.net_paid_out += net
    day.retained = max(0.0, day.retained - gross)
    return gross


def simulate_player_day(rng: random.Random, cohort: str, economy_multiplier: float, treasury_reserve: float, merchant_pool: dict[str, float]) -> PlayerDay:
    dyn, age, investment = cohort_profile(rng, cohort)
    day = PlayerDay(dyn_held=dyn, account_age_days=age, team_investment_score=investment, daily_tasks_completed=3)

    if cohort == "extractor":
        day.add(simulate_game(rng, "LOCAL_REC", "PARK_FIELD", "CARPOOL", economy_multiplier, sponsor_per_game=0))
        day.add(simulate_merchant(rng, cohort, merchant_pool))
        apply_withdrawal(day, requested_amount=max(0.0, day.retained), economy_multiplier=economy_multiplier, treasury_reserve=treasury_reserve)
        return day

    if cohort == "free_grinder":
        for _ in range(2):
            league = "REGIONAL" if rng.random() < 0.30 else "LOCAL_REC"
            venue = "COMMUNITY_FIELD" if league == "REGIONAL" else "PARK_FIELD"
            day.add(simulate_game(rng, league, venue, "CARPOOL", economy_multiplier, sponsor_per_game=0))
        day.add(simulate_merchant(rng, cohort, merchant_pool))
        training_spend, sessions = simulate_training_spend(rng, max_sessions=3, cash_available=max(0, day.retained), intensity=0.85)
        spend = min(training_spend, max(0, day.retained) * 0.75)
        day.upgrade_sinks += spend
        day.trainings += sessions
        day.retained -= spend
        if rng.random() < 0.10:
            apply_withdrawal(day, requested_amount=max(0.0, day.retained * 0.25), economy_multiplier=economy_multiplier, treasury_reserve=treasury_reserve)
        return day

    if cohort == "payer_holder":
        day.external_purchase_cash_equiv += rng.choice([5000, 7500, 10000, 15000, 25000])
        for _ in range(3):
            league = rng.choices(["REGIONAL", "SEMI_PRO", "LOCAL_REC"], weights=[0.55, 0.25, 0.20])[0]
            venue = "SMALL_STADIUM" if league == "SEMI_PRO" else ("COMMUNITY_FIELD" if league == "REGIONAL" else "PARK_FIELD")
            transport = "USED_BUS" if league in ("REGIONAL", "SEMI_PRO") else "CARPOOL"
            sponsor = rng.choice([250, 500, 750, 1000])
            day.add(simulate_game(rng, league, venue, transport, economy_multiplier, sponsor_per_game=sponsor))
        day.add(simulate_merchant(rng, cohort, merchant_pool))
        available = max(0, day.retained + day.external_purchase_cash_equiv * 0.5)
        training_spend, sessions = simulate_training_spend(rng, max_sessions=5, cash_available=available, intensity=0.90)
        upgrade_spend, upgrades = simulate_upgrade_spend(rng, cash_available=max(0, available - training_spend), chance=0.45)
        spend = training_spend + upgrade_spend
        day.upgrade_sinks += spend
        day.trainings += sessions
        day.upgrades += upgrades
        day.retained = max(0, day.retained - min(spend, day.retained))
        if rng.random() < 0.04:
            apply_withdrawal(day, requested_amount=max(0.0, day.retained * 0.10), economy_multiplier=economy_multiplier, treasury_reserve=treasury_reserve)
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
    cohort_counts = {"extractor": int(round(players * 0.50)), "free_grinder": int(round(players * 0.25))}
    cohort_counts["payer_holder"] = players - cohort_counts["extractor"] - cohort_counts["free_grinder"]

    trial_totals: list[PlayerDay] = []
    daily_net_paid_values: list[float] = []
    daily_gross_withdrawal_values: list[float] = []
    daily_net_emission_values: list[float] = []
    daily_external_values: list[float] = []
    daily_multiplier_values: list[float] = []
    daily_treasury_values: list[float] = []

    for _ in range(trials):
        rng = random.Random(rng_master.randint(1, 2_000_000_000))
        total = PlayerDay()
        treasury_reserve = players * INITIAL_TREASURY_RESERVE_PER_PLAYER
        previous_emissions = 0.0
        previous_sinks = 0.0
        for _day_idx in range(days):
            economy_multiplier = reward_multiplier_from_snapshot(previous_emissions, previous_sinks, treasury_reserve)
            merchant_pool = {"remaining": players * MERCHANT_DAILY_CASH_POOL_PER_PLAYER}
            day_total = PlayerDay()
            for cohort, count in cohort_counts.items():
                for _ in range(count):
                    day_total.add(simulate_player_day(rng, cohort, economy_multiplier, treasury_reserve, merchant_pool))

            emissions = day_total.game_cash_awarded + day_total.merchant_cash_awarded
            sinks = day_total.operating_sinks + day_total.upgrade_sinks + day_total.withdrawal_fee
            net_created = emissions - day_total.operating_sinks - day_total.upgrade_sinks - day_total.withdrawal_fee - day_total.withdrawal_gross_removed
            # External purchases fund treasury reserves; gross withdrawals draw it down; fees partly refill reserves.
            treasury_reserve += day_total.external_purchase_cash_equiv * 0.25
            treasury_reserve += day_total.withdrawal_fee * 0.50
            treasury_reserve -= day_total.net_paid_out
            treasury_reserve = max(0.0, treasury_reserve)

            total.add(day_total)
            previous_emissions = emissions
            previous_sinks = sinks
            daily_net_paid_values.append(day_total.net_paid_out)
            daily_gross_withdrawal_values.append(day_total.withdrawal_gross_removed)
            daily_net_emission_values.append(net_created)
            daily_external_values.append(day_total.external_purchase_cash_equiv)
            daily_multiplier_values.append(economy_multiplier)
            daily_treasury_values.append(treasury_reserve)
        trial_totals.append(total)

    def avg_field(field: str) -> float:
        return mean(getattr(x, field) for x in trial_totals)

    game_cash = avg_field("game_cash_awarded")
    merchant_cash = avg_field("merchant_cash_awarded")
    emissions = game_cash + merchant_cash
    operating_sinks = avg_field("operating_sinks")
    upgrade_sinks = avg_field("upgrade_sinks")
    withdrawal_gross = avg_field("withdrawal_gross_removed")
    withdrawal_fee = avg_field("withdrawal_fee")
    net_paid = avg_field("net_paid_out")
    retained = avg_field("retained")
    external = avg_field("external_purchase_cash_equiv")
    total_sinks = operating_sinks + upgrade_sinks + withdrawal_fee
    net_cash_created_after_sinks = emissions - total_sinks - withdrawal_gross
    sink_coverage = total_sinks / emissions if emissions else 0
    external_to_net_paid = external / net_paid if net_paid else math.inf
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
            "withdrawal_gross_removed": withdrawal_gross,
            "withdrawal_fees": withdrawal_fee,
            "net_paid_out": net_paid,
            "retained_cash": retained,
            "external_purchase_cash_equiv": external,
            "net_cash_created_after_sinks_and_withdrawals": net_cash_created_after_sinks,
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
            "withdrawal_gross_removed": withdrawal_gross / days,
            "withdrawal_fees": withdrawal_fee / days,
            "net_paid_out": net_paid / days,
            "retained_cash": retained / days,
            "external_purchase_cash_equiv": external / days,
            "net_cash_created_after_sinks_and_withdrawals": net_cash_created_after_sinks / days,
        },
        "avg_per_player_per_day": {
            "game_cash_awarded": game_cash / days / players,
            "merchant_cash_awarded": merchant_cash / days / players,
            "cash_emissions": emissions / days / players,
            "legacy_direct_daily_quest_cash_avoided": old_direct_daily_quest_emission / days / players,
            "withdrawal_gross_removed": withdrawal_gross / days / players,
            "withdrawal_fees": withdrawal_fee / days / players,
            "net_paid_out": net_paid / days / players,
            "net_cash_created_after_sinks_and_withdrawals": net_cash_created_after_sinks / days / players,
            "external_purchase_cash_equiv": external / days / players,
        },
        "risk_metrics": {
            "sink_coverage_pct": sink_coverage * 100,
            "external_purchase_to_net_paid_ratio": external_to_net_paid,
            "daily_net_paid_p50": percentile(daily_net_paid_values, 50),
            "daily_net_paid_p95": percentile(daily_net_paid_values, 95),
            "daily_gross_withdrawal_p50": percentile(daily_gross_withdrawal_values, 50),
            "daily_gross_withdrawal_p95": percentile(daily_gross_withdrawal_values, 95),
            "daily_net_emission_p50": percentile(daily_net_emission_values, 50),
            "daily_net_emission_p95": percentile(daily_net_emission_values, 95),
            "daily_external_purchase_p50": percentile(daily_external_values, 50),
            "daily_external_purchase_p95": percentile(daily_external_values, 95),
            "economy_multiplier_avg": mean(daily_multiplier_values) if daily_multiplier_values else 1.0,
            "treasury_reserve_p50": percentile(daily_treasury_values, 50),
            "treasury_reserve_p95": percentile(daily_treasury_values, 95),
        },
    }


def write_report(payload: dict, report_path: Path) -> None:
    lines = [
        "# GRID Unified-CASH Cohort Economy Stress Simulation",
        "",
        "Data source: deterministic source-code/model simulation from the local repo, not live financial/accounting records.",
        "Freshness: generated by `scripts/run_cohort_economy_sim.py` from the current working tree.",
        "Coverage: match/mini merchant-style faucets, unified withdrawal rails, gameplay sinks, fees, and cohort assumptions; excludes real deposits, bank payouts, on-chain settlement, and live user behavior.",
        "",
        "## Policy modeled",
        "",
        "- One wallet CASH balance; no claimable/unclaimable buckets.",
        "- 40% cut to win/draw local match CASH value; 75% cut to loss reward value.",
        "- Economy-health multiplier driven by prior-day sink coverage and treasury reserve.",
        "- Higher medical, wage/facility, transport/fuel, equipment-wear, training, marketplace, and withdrawal-fee sinks.",
        "- Merchant-style CASH capped by a daily event pool.",
        "- Withdrawals limited by DYN held, account age, team investment, economy health, treasury reserve, and fees.",
        "",
        "## Results",
        "",
        "| Players | Net paid/day | Gross withdrawn/day | Fees/day | Emissions/day | Sinks/day | Net CASH after sinks+withdrawals/day | Avg econ multiplier | External/net paid |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in payload["results"]:
        d = r["avg_per_day"]
        m = r["risk_metrics"]
        sinks = d["operating_sinks"] + d["upgrade_sinks"] + d["withdrawal_fees"]
        ratio = m["external_purchase_to_net_paid_ratio"]
        ratio_text = "∞" if math.isinf(ratio) else f"{ratio:.2f}x"
        lines.append(
            f"| {r['players']:,} | {d['net_paid_out']:,.0f} | {d['withdrawal_gross_removed']:,.0f} | "
            f"{d['withdrawal_fees']:,.0f} | {d['cash_emissions']:,.0f} | {sinks:,.0f} | "
            f"{d['net_cash_created_after_sinks_and_withdrawals']:,.0f} | {m['economy_multiplier_avg']:.2f} | {ratio_text} |"
        )
    lines += [
        "",
        "## Caveat",
        "",
        "This is an economy stress model, not a financial audit. It should guide balancing, but it is not evidence of actual revenue, liabilities, or payout obligations.",
        "",
    ]
    report_path.write_text("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--players", default="100,500,1000,5000,10000", help="comma-separated player counts")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--trials", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260705)
    parser.add_argument("--out", default="simulation-results/grid-cohort-economy-sim-20260705.json")
    parser.add_argument("--report", default="simulation-results/grid-cohort-economy-sim-20260705-report.md")
    args = parser.parse_args()

    player_counts = [int(x.strip()) for x in args.players.split(",") if x.strip()]
    results = [run_scenario(p, args.days, args.trials, args.seed) for p in player_counts]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model_type": "hypothetical_unified_cash_in_game_economy_simulation_not_real_financial_data",
        "source_files": [
            "apps/api/src/modules/economy/balance.service.ts",
            "apps/api/src/modules/economy/teamEconomy.config.ts",
            "apps/api/src/modules/economy/gameEconomics.ts",
            "apps/api/src/modules/economy/maintenance.service.ts",
            "apps/api/src/modules/mini-games/mini-games.service.ts",
        ],
        "cohort_mix": {"extractor": 0.50, "free_grinder": 0.25, "payer_holder": 0.25},
        "unified_cash_rules": {
            "one_wallet_cash_balance": True,
            "cash_directly_awarded_by_daily_quests": False,
            "all_cash_eligible_for_withdrawal_request": True,
            "claimable_unclaimable_split": False,
            "local_match_faucet_cut_pct": LOCAL_MATCH_FAUCET_CUT_PCT,
            "loss_reward_cut_pct": LOSS_REWARD_CUT_PCT,
            "withdrawal_limits": ["daily account limit", "DYN holding", "account age", "team investment score", "economy health", "treasury reserve availability"],
            "withdrawal_fee_range": [WITHDRAWAL_FEE_MIN, WITHDRAWAL_FEE_MAX],
            "merchant_daily_cash_pool_per_player": MERCHANT_DAILY_CASH_POOL_PER_PLAYER,
            "legacy_daily_quest_cash_now_avoided_per_player_day": LEGACY_DAILY_QUEST_REWARD_CASH,
        },
        "key_assumptions": {
            "extractors": "1 LOCAL_REC match; low DYN/age/investment; optional small merchant sale; requests all retained CASH through withdrawal rail; no upgrades",
            "free_grinders": "2 matches; frequent merchant sale; spend up to 75% of retained CASH on training; occasional small withdrawal",
            "payer_holders": "3 matches; external purchase equivalent 5k-25k CASH/day; higher DYN/age/investment; spend on training/equipment/upgrades; rare small withdrawal",
        },
        "results": results,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    write_report(payload, Path(args.report))

    print(f"Wrote {out_path}")
    print(f"Wrote {args.report}")
    print("\nGRID unified-CASH cohort economy stress simulation")
    print("Data type: hypothetical simulation from source-code constants, NOT real financial/audit data")
    print(f"Days={args.days} Trials={args.trials} Cohorts=50% extractor / 25% free grinder / 25% payer-holder")
    print("\nplayers | net paid/day | gross withdrawn/day | fees/day | cash emissions/day | sinks/day | net created/day | avg multiplier | external/net paid")
    print("-" * 158)
    for r in results:
        d = r["avg_per_day"]
        m = r["risk_metrics"]
        sinks = d["operating_sinks"] + d["upgrade_sinks"] + d["withdrawal_fees"]
        ratio = m["external_purchase_to_net_paid_ratio"]
        ratio_text = "inf" if math.isinf(ratio) else f"{ratio:.2f}x"
        print(
            f"{r['players']:>7,} | "
            f"{d['net_paid_out']:>12,.0f} | "
            f"{d['withdrawal_gross_removed']:>19,.0f} | "
            f"{d['withdrawal_fees']:>8,.0f} | "
            f"{d['cash_emissions']:>18,.0f} | "
            f"{sinks:>9,.0f} | "
            f"{d['net_cash_created_after_sinks_and_withdrawals']:>15,.0f} | "
            f"{m['economy_multiplier_avg']:>14.2f} | "
            f"{ratio_text:>17}"
        )

    print("\nPer-player/day averages")
    print("players | game cash/player/day | merchant/player/day | gross withdrawn/player/day | net paid/player/day | direct quest cash avoided/player/day")
    print("-" * 145)
    for r in results:
        pp = r["avg_per_player_per_day"]
        print(
            f"{r['players']:>7,} | "
            f"{pp['game_cash_awarded']:>20,.0f} | "
            f"{pp['merchant_cash_awarded']:>19,.0f} | "
            f"{pp['withdrawal_gross_removed']:>26,.0f} | "
            f"{pp['net_paid_out']:>19,.0f} | "
            f"{pp['legacy_direct_daily_quest_cash_avoided']:>36,.0f}"
        )


if __name__ == "__main__":
    main()
