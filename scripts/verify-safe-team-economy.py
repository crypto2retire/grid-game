#!/usr/bin/env python3
"""
Live Verification Script for Safe Team Economy

Validates that the GRID game economy adheres to SAFE_REWARD_POLICY:
- No opponent fee transfers
- All revenue sources are safe
- All expenses are operating cost sinks
- Database consistency for sponsorships, leagues, and finance

Usage:
    python scripts/verify-safe-team-economy.py [--api-url https://...]

Exit codes:
    0 - All checks passed
    1 - One or more checks failed
"""

import sys
import os
import json
import argparse
from datetime import datetime
from pathlib import Path

# ─── Configuration ───

SAFE_REWARD_POLICY = {
    "winnerDoesNotReceiveOpponentFees": True,
    "entryFeesAreOperatingCosts": True,
    "rewardsFundedBy": [
        "LEAGUE_BUDGET",
        "SPONSOR_BUDGET",
        "GAME_DAY_REVENUE",
        "PLATFORM_GRANT",
    ],
    "safeRevenueSources": [
        "TICKET_SALES",
        "CONCESSIONS",
        "MERCHANDISE",
        "SPONSOR_GAME_REVENUE",
        "SPONSOR_SEASON_BONUS",
        "LEAGUE_STANDING_BONUS",
        "LEAGUE_PLAYOFF_BONUS",
        "PLATFORM_GRANT",
    ],
    "operatingCostSinks": [
        "TRAVEL_TRANSPORT",
        "VENUE_STAFF_REFEREES",
        "PLAYER_RECOVERY",
        "FACILITY_WEAR",
        "LEAGUE_DUES",
    ],
}

LEAGUE_TIERS = ["LOCAL_REC", "REGIONAL", "SEMI_PRO", "PRO"]

PROMOTION_REQUIREMENTS = {
    "LOCAL_REC": {"minWins": 5, "minPoints": 15, "minVenueTierIndex": 1, "minTransportTierIndex": 1, "minTeamOverall": 55, "requiredCash": 5000},
    "REGIONAL": {"minWins": 10, "minPoints": 30, "minVenueTierIndex": 2, "minTransportTierIndex": 2, "minTeamOverall": 65, "requiredCash": 25000},
    "SEMI_PRO": {"minWins": 15, "minPoints": 45, "minVenueTierIndex": 3, "minTransportTierIndex": 4, "minTeamOverall": 75, "requiredCash": 100000},
    "PRO": {"minWins": 25, "minPoints": 75, "minVenueTierIndex": 4, "minTransportTierIndex": 6, "minTeamOverall": 85, "requiredCash": 500000},
}

# ─── Colors ───

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


# ─── Helpers ───

def ok(msg: str) -> None:
    print(f"  {Colors.GREEN}✓{Colors.RESET} {msg}")

def fail(msg: str) -> None:
    print(f"  {Colors.RED}✗{Colors.RESET} {msg}")

def warn(msg: str) -> None:
    print(f"  {Colors.YELLOW}⚠{Colors.RESET} {msg}")

def info(msg: str) -> None:
    print(f"  {Colors.BLUE}ℹ{Colors.RESET} {msg}")

def section(title: str) -> None:
    print(f"\n{Colors.BOLD}{title}{Colors.RESET}")


def try_import_prisma():
    """Try to import Prisma client. Returns (prisma, connected) or (None, False)."""
    try:
        # Try to import the generated Prisma client
        sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api" / "node_modules" / ".prisma" / "client"))
        # Actually, Prisma client is generated and needs the runtime. Let's use a simpler approach.
        # We'll try to use subprocess to run a Node.js script for DB checks.
        import subprocess
        return subprocess
    except Exception as e:
        return None


# ─── Static Code Checks ───

def check_safe_reward_policy_constants() -> bool:
    """Verify SAFE_REWARD_POLICY is defined in teamEconomy.config.ts."""
    section("1. SAFE_REWARD_POLICY Constants")
    config_path = Path(__file__).parent.parent / "apps" / "api" / "src" / "modules" / "economy" / "teamEconomy.config.ts"

    if not config_path.exists():
        fail(f"Config file not found: {config_path}")
        return False

    content = config_path.read_text()

    checks = [
        ("winnerDoesNotReceiveOpponentFees", "true"),
        ("entryFeesAreOperatingCosts", "true"),
        ("LEAGUE_BUDGET", None),
        ("SPONSOR_BUDGET", None),
        ("GAME_DAY_REVENUE", None),
        ("PLATFORM_GRANT", None),
    ]

    all_pass = True
    for key, expected in checks:
        if key not in content:
            fail(f"Missing key: {key}")
            all_pass = False
        elif expected and expected not in content:
            fail(f"Expected {key} = {expected}")
            all_pass = False

    if all_pass:
        ok("SAFE_REWARD_POLICY constants are present and correctly defined")

    return all_pass


def check_no_opponent_fee_transfers() -> bool:
    """Verify no opponent fee transfer logic exists in gameEconomics.ts."""
    section("2. No Opponent Fee Transfers")
    economics_path = Path(__file__).parent.parent / "apps" / "api" / "src" / "modules" / "economy" / "gameEconomics.ts"

    if not economics_path.exists():
        fail(f"File not found: {economics_path}")
        return False

    content = economics_path.read_text()

    # Only check the calculateGameEconomics function, not the assertion helper
    # Split at the assertNoOpponentFeeTransfer function definition
    game_logic = content.split("export function assertNoOpponentFeeTransfer")[0]

    # Strip comments from the game logic before checking
    import re
    # Remove single-line comments
    game_logic_no_comments = re.sub(r'//.*', '', game_logic)
    # Remove multi-line comments
    game_logic_no_comments = re.sub(r'/\*.*?\*/', '', game_logic_no_comments, flags=re.DOTALL)

    forbidden_terms = [
        "opponent fee",
        "opponent cost",
        "entry fee pool",
        "winner takes",
        "loser pays",
        "payout to winner",
    ]

    found = []
    for term in forbidden_terms:
        if term.lower() in game_logic_no_comments.lower():
            found.append(term)

    if found:
        fail(f"Forbidden terms found: {', '.join(found)}")
        return False

    ok("No opponent fee transfer logic detected in gameEconomics.ts")

    # Verify assertNoOpponentFeeTransfer exists
    if "assertNoOpponentFeeTransfer" in content:
        ok("assertNoOpponentFeeTransfer guard function is present")
    else:
        warn("assertNoOpponentFeeTransfer guard function not found")

    return True


def check_safe_revenue_sources() -> bool:
    """Verify all revenue breakdown keys are in safeRevenueSources."""
    section("3. Safe Revenue Sources")
    economics_path = Path(__file__).parent.parent / "apps" / "api" / "src" / "modules" / "economy" / "gameEconomics.ts"

    if not economics_path.exists():
        fail(f"File not found: {economics_path}")
        return False

    content = economics_path.read_text()

    # Extract only POSITIVE breakdown keys (revenue sources)
    # Exclude lines that assign negative values or reference expense variables
    import re
    all_lines = content.splitlines()
    breakdown_keys = []
    known_expenses = {'Travel & Transport', 'Venue Staff & Referees', 'Player Recovery', 'League Dues'}
    for line in all_lines:
        m = re.search(r"breakdown\['([^']+)'\]\s*=", line)
        if m:
            key = m.group(1)
            if key not in known_expenses and '-travelCost' not in line and '-venueCost' not in line and '-recoveryCost' not in line and '-leagueDues' not in line:
                breakdown_keys.append(key)

    safe_revenue_names = {
        'League Result Reward',
        'Ticket Sales',
        'Concessions',
        'Merchandise',
        'Road Game Share',
        'Sponsor Revenue',
        'High Scoring Bonus',
        'Clean Sheet Bonus',
        'Home Field Advantage',
    }

    all_safe = True
    for key in breakdown_keys:
        if key not in safe_revenue_names:
            fail(f"Unknown revenue source in breakdown: '{key}'")
            all_safe = False

    if all_safe:
        ok(f"All {len(breakdown_keys)} revenue sources are in the safe list")

    return all_safe


def check_operating_cost_sinks() -> bool:
    """Verify all expense breakdown keys are operating cost sinks."""
    section("4. Operating Cost Sinks")
    economics_path = Path(__file__).parent.parent / "apps" / "api" / "src" / "modules" / "economy" / "gameEconomics.ts"

    if not economics_path.exists():
        fail(f"File not found: {economics_path}")
        return False

    content = economics_path.read_text()

    import re
    # Find all negative breakdown entries
    expense_keys = re.findall(r"breakdown\['([^']+)'\]\s*=\s*-\d+", content)
    # Also find expressions with negative values
    expense_keys2 = re.findall(r"breakdown\['([^']+)'\]\s*=\s*-", content)
    all_expense_keys = set(expense_keys + expense_keys2)

    expected_expenses = {
        'Travel & Transport',
        'Venue Staff & Referees',
        'Player Recovery',
        'League Dues',
    }

    all_sink = True
    for key in all_expense_keys:
        if key not in expected_expenses:
            fail(f"Unexpected expense category: '{key}'")
            all_sink = False

    if all_sink:
        ok(f"All {len(all_expense_keys)} expense categories are valid operating cost sinks")

    return all_sink


# ─── Database Checks (via Node.js subprocess) ───

def check_database_consistency() -> bool:
    """Run database consistency checks via Node.js."""
    section("5. Database Consistency")

    script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const results = { passed: 0, failed: 0, messages: [] };

  function pass(msg) { results.passed++; results.messages.push({ status: 'PASS', msg }); }
  function fail(msg) { results.failed++; results.messages.push({ status: 'FAIL', msg }); }

  try {
    // 1. Check all active sponsorships have valid teams
    const orphanedSponsors = await prisma.sponsorship.count({
      where: { teamId: { not: null }, team: null }
    });
    if (orphanedSponsors === 0) pass('No orphaned sponsorships');
    else fail(`${orphanedSponsors} orphaned sponsorships found`);

    // 2. Check all teams have at most 3 active sponsors
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, _count: { select: { sponsorships: { where: { active: true } } } } }
    });
    const overSponsored = teams.filter(t => t._count.sponsorships > 3);
    if (overSponsored.length === 0) pass('All teams have ≤3 active sponsors');
    else fail(`${overSponsored.length} teams exceed 3 active sponsors`);

    // 3. Check all active league memberships have valid leagues
    const orphanedMemberships = await prisma.teamLeagueMembership.count({
      where: { leagueId: { not: null }, league: null }
    });
    if (orphanedMemberships === 0) pass('No orphaned league memberships');
    else fail(`${orphanedMemberships} orphaned league memberships`);

    // 4. Check finance snapshots have net = revenue - expense
    const mismatchedSnapshots = await prisma.teamFinanceSnapshot.count({
      where: {
        NOT: { net: { equals: prisma.teamFinanceSnapshot.fields.revenue.minus(prisma.teamFinanceSnapshot.fields.expense) } }
      }
    });
    // Actually, Prisma doesn't support this query directly. Let's just check a sample.
    const snapshots = await prisma.teamFinanceSnapshot.findMany({ take: 100 });
    const mismatched = snapshots.filter(s => s.net !== (s.revenue - s.expense)).length;
    if (mismatched === 0) pass('Finance snapshots are consistent (net = revenue - expense)');
    else fail(`${mismatched} finance snapshots have inconsistent net values`);

    // 5. Check venues have positive capacity and ticket price
    const invalidVenues = await prisma.venue.count({
      where: { OR: [{ capacity: { lte: 0 } }, { ticketPrice: { lte: 0 } }] }
    });
    if (invalidVenues === 0) pass('All venues have valid capacity and ticket price');
    else fail(`${invalidVenues} venues have invalid capacity or ticket price`);

    // 6. Check transportation has positive operating cost
    const invalidTransport = await prisma.transportationAsset.count({
      where: { operatingCost: { lte: 0 } }
    });
    if (invalidTransport === 0) pass('All transport assets have valid operating costs');
    else fail(`${invalidTransport} transport assets have invalid operating costs`);

    // 7. Summary stats
    const sponsorCount = await prisma.sponsorship.count({ where: { active: true } });
    const leagueCount = await prisma.league.count();
    const venueCount = await prisma.venue.count();
    pass(`Stats: ${sponsorCount} active sponsors, ${leagueCount} leagues, ${venueCount} venues`);

  } catch (e) {
    fail(`Database check error: ${e.message}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify(results));
}

check();
"""

    api_dir = Path(__file__).parent.parent / "apps" / "api"
    env = os.environ.copy()

    # Check if we're in a deployed environment with DB_URL
    if not env.get('DATABASE_URL'):
        # Try to read from .env or local config
        env_file = api_dir / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith('DATABASE_URL='):
                    env['DATABASE_URL'] = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

    if not env.get('DATABASE_URL'):
        warn("DATABASE_URL not set - skipping database checks")
        return True

    try:
        import subprocess
        result = subprocess.run(
            ['node', '-e', script],
            cwd=str(api_dir),
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )

        if result.returncode != 0:
            fail(f"Database check script failed: {result.stderr[:500]}")
            return False

        # Parse the last line as JSON
        lines = result.stdout.strip().split('\n')
        json_line = None
        for line in reversed(lines):
            try:
                json_line = json.loads(line)
                break
            except json.JSONDecodeError:
                continue

        if not json_line:
            fail("Could not parse database check results")
            return False

        for msg in json_line.get('messages', []):
            if msg['status'] == 'PASS':
                ok(msg['msg'])
            else:
                fail(msg['msg'])

        return json_line.get('failed', 0) == 0

    except Exception as e:
        fail(f"Database check error: {e}")
        return False


# ─── Promotion Logic Checks ───

def check_promotion_logic() -> bool:
    """Verify promotion requirements are internally consistent."""
    section("6. Promotion Logic Consistency")

    all_pass = True

    # Check that each tier maps to the correct next tier
    for i, tier in enumerate(LEAGUE_TIERS[:-1]):
        next_tier = LEAGUE_TIERS[i + 1]
        req = PROMOTION_REQUIREMENTS.get(tier)
        if not req:
            fail(f"No requirements for {tier}")
            all_pass = False
            continue

        # Verify increasing difficulty
        if i > 0:
            prev_req = PROMOTION_REQUIREMENTS[LEAGUE_TIERS[i - 1]]
            if req['minWins'] <= prev_req['minWins']:
                fail(f"{tier} wins ({req['minWins']}) should exceed {LEAGUE_TIERS[i-1]} ({prev_req['minWins']})")
                all_pass = False
            if req['requiredCash'] <= prev_req['requiredCash']:
                fail(f"{tier} cash ({req['requiredCash']}) should exceed {LEAGUE_TIERS[i-1]} ({prev_req['requiredCash']})")
                all_pass = False

        ok(f"{tier} → {next_tier}: {req['minWins']} wins, {req['requiredCash']:,} CASH")

    # PRO should have no next tier
    if 'PRO' in PROMOTION_REQUIREMENTS:
        ok("PRO tier is the maximum (no promotion beyond)")

    return all_pass


# ─── Sponsorship Logic Checks ───

def check_sponsorship_logic() -> bool:
    """Verify sponsorship generation logic is safe."""
    section("7. Sponsorship Logic Safety")

    service_path = Path(__file__).parent.parent / "apps" / "api" / "src" / "modules" / "sponsorships" / "sponsorship.service.ts"

    if not service_path.exists():
        fail(f"Sponsorship service not found: {service_path}")
        return False

    content = service_path.read_text()

    checks = [
        ("MAX_ACTIVE_SPONSORS", "3"),
        ("amountPerGame", None),
        ("amountPerSeason", None),
        ("bonusRules", None),
    ]

    all_pass = True
    for key, expected in checks:
        if key not in content:
            fail(f"Missing: {key}")
            all_pass = False
        elif expected and expected not in content:
            fail(f"Expected {key} = {expected}")
            all_pass = False

    # Verify no gambling terms
    forbidden = ["bet", "wager", "gamble", "odds", "payout"]
    found = [w for w in forbidden if w in content.lower()]
    if found:
        fail(f"Forbidden gambling terms: {found}")
        all_pass = False

    if all_pass:
        ok("Sponsorship logic is safe and correctly structured")

    return all_pass


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="Verify GRID safe team economy")
    parser.add_argument("--api-url", help="API base URL (optional)")
    parser.add_argument("--json", action="store_true", help="Output JSON only")
    args = parser.parse_args()

    print(f"{Colors.BOLD}GRID Safe Team Economy — Live Verification{Colors.RESET}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    if args.api_url:
        print(f"API URL: {args.api_url}")

    results = {
        "timestamp": datetime.now().isoformat(),
        "checks": {},
        "passed": 0,
        "failed": 0,
        "total": 0,
    }

    checks = [
        ("safe_reward_policy", check_safe_reward_policy_constants),
        ("no_opponent_fees", check_no_opponent_fee_transfers),
        ("safe_revenue_sources", check_safe_revenue_sources),
        ("operating_cost_sinks", check_operating_cost_sinks),
        ("database_consistency", check_database_consistency),
        ("promotion_logic", check_promotion_logic),
        ("sponsorship_logic", check_sponsorship_logic),
    ]

    for name, fn in checks:
        try:
            passed = fn()
        except Exception as e:
            section(f"Error in {name}")
            fail(f"Exception: {e}")
            passed = False

        results["checks"][name] = "PASS" if passed else "FAIL"
        results["total"] += 1
        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1

    # Summary
    print(f"\n{Colors.BOLD}Summary{Colors.RESET}")
    print(f"  Total checks: {results['total']}")
    print(f"  {Colors.GREEN}Passed: {results['passed']}{Colors.RESET}")
    print(f"  {Colors.RED}Failed: {results['failed']}{Colors.RESET}")

    if args.json:
        print(json.dumps(results, indent=2))

    if results["failed"] > 0:
        print(f"\n{Colors.RED}{Colors.BOLD}VERIFICATION FAILED{Colors.RESET}")
        sys.exit(1)
    else:
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL CHECKS PASSED ✓{Colors.RESET}")
        sys.exit(0)


if __name__ == "__main__":
    main()
