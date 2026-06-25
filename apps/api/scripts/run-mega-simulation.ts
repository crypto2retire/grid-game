import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import {
  initializeMegaSimulation,
  runMegaSimulationSeason,
  buildMegaSimulationResults,
} from '../src/modules/testing/mega-simulation.service';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const userCount = parseInt(args[0] || '250', 10);
  const seasonCount = parseInt(args[1] || '5', 10);
  const throttleMs = parseInt(args[2] || '0', 10);

  console.log(`\n🎮 GRID Mega Simulation V2 — CLI Runner`);
  console.log(`   Users: ${userCount} | Seasons: ${seasonCount} | Throttle: ${throttleMs}ms\n`);

  const startTime = Date.now();

  try {
    console.log('⏳  Initializing simulation state...');
    const state = await initializeMegaSimulation(userCount, seasonCount);
    console.log(`✅  Initialized: ${state.users.length} users, ${state.allTeams.length} teams\n`);

    // Run each season with progress logging
    for (let season = 1; season <= seasonCount; season++) {
      const seasonStart = Date.now();
      process.stdout.write(`   Season ${season}/${seasonCount} ... `);

      await runMegaSimulationSeason(state, season, throttleMs);

      const seasonDuration = Date.now() - seasonStart;
      const lastMetrics = state.seasons[state.seasons.length - 1];
      process.stdout.write(
        `done in ${(seasonDuration / 1000).toFixed(1)}s | ` +
        `${lastMetrics.matchesPlayed} matches | ` +
        `${lastMetrics.activeUsers} active users | ` +
        `GRID spent: ${Math.round(lastMetrics.totalGridSpent).toLocaleString()}\n`
      );
    }

    const result = buildMegaSimulationResults(state);

    console.log(`\n✅  Simulation complete in ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   Users: ${result.usersCreated} | Teams: ${result.teamsCreated} (AI: ${result.aiTeamsCreated}) | Players: ${result.totalPlayers}`);
    console.log(`   Matches: ${result.seasons.reduce((s, m) => s + m.matchesPlayed, 0)} | Injuries: ${result.seasons.reduce((s, m) => s + m.injuries, 0)} | Retirements: ${result.seasons.reduce((s, m) => s + m.retirements, 0)}`);
    console.log(`   Total GRID spent: ${Math.round(result.marketplaceSummary.totalGridSpent).toLocaleString()}`);
    console.log(`   Total CASH spent: ${Math.round(result.marketplaceSummary.totalCashSpent).toLocaleString()}`);
    console.log(`   Total SOL spent: ${result.marketplaceSummary.totalSolSpent.toFixed(2)}`);
    console.log(`   Pump.fun final price: $${result.pumpfunSummary.finalPrice.toFixed(4)} | Market cap: $${(result.pumpfunSummary.finalMarketCap / 1e6).toFixed(2)}M`);
    console.log(`   Treasury inflow: ${Math.round(result.economicSummary.totalTreasuryInflow).toLocaleString()}`);
    console.log(`   Total burned: ${Math.round(result.economicSummary.totalBurned).toLocaleString()}`);

    // Write full results to JSON file
    const fs = await import('fs');
    const outputPath = `mega-sim-results-${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n📁  Full results written to: ${outputPath}\n`);

  } catch (error: any) {
    console.error('\n❌  Fatal error:', error?.message || 'unknown');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
