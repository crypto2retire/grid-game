import { prisma } from '../../config/database';
import { recordCurrencyLedger } from '../economy/ledger';
import { processTreasuryInflow, processBurn } from '../treasury/treasury.service';

// ─── Training Package Catalog ───

const OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL'];
const DEFENSIVE_POSITIONS = ['DL', 'LB', 'CB', 'S', 'K'];

interface TrainingInput {
  teamId: string;
  userId: string;
  packageId: string;
  playerId?: string; // For INDIVIDUAL focus
}

interface StatBoosts {
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
}

/**
 * Get all available training packages.
 */
export async function getTrainingPackages() {
  return prisma.trainingPackage.findMany({
    where: { active: true },
    orderBy: [{ costGrid: 'asc' }, { costCash: 'asc' }],
  });
}

/**
 * Get active trainings for a team.
 */
export async function getTeamTrainings(teamId: string) {
  return prisma.playerTraining.findMany({
    where: { teamId },
    include: {
      player: { select: { id: true, name: true, position: true, overall: true } },
      trainingPackage: true,
    },
    orderBy: { startedAt: 'desc' },
  });
}

/**
 * Get active trainings for a specific player.
 */
export async function getPlayerTrainings(playerId: string) {
  return prisma.playerTraining.findMany({
    where: { playerId },
    include: { trainingPackage: true },
    orderBy: { startedAt: 'desc' },
  });
}

/**
 * Calculate training effectiveness with equipment bonuses.
 */
async function getTrainingEffectiveness(teamId: string): Promise<number> {
  const equipment = await prisma.teamEquipment.findMany({
    where: { teamId },
    include: { equipmentType: true },
  });

  let boost = 1.0; // Base effectiveness

  for (const eq of equipment) {
    const effects = eq.equipmentType.effects as Record<string, any>;
    if (effects?.trainingBoost) {
      boost += effects.trainingBoost;
    }
  }

  return boost;
}

/**
 * Apply diminishing returns: higher stats get smaller improvements.
 */
function applyDiminishingReturns(baseStat: number, rawBoost: number): number {
  // Stat 50: 100% of boost
  // Stat 70: 75% of boost
  // Stat 85: 50% of boost
  // Stat 95: 25% of boost
  const factor = Math.max(0.25, 1.0 - (baseStat - 50) / 100);
  return Math.round(rawBoost * factor);
}

/**
 * Start a training program for a team.
 * For POSITION_GROUP: all players in that position get trained.
 * For OFFENSE/DEFENSE: all players in that group get trained.
 * For INDIVIDUAL: one player gets double boost.
 * For ALL: all players get small boost.
 */
export async function startTraining(input: TrainingInput) {
  const { teamId, userId, packageId, playerId } = input;

  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    include: { teamPlayers: { include: { player: true } } },
  });

  if (!team) {
    throw new Error('Team not found or you do not own it');
  }

  const package_ = await prisma.trainingPackage.findUnique({
    where: { id: packageId, active: true },
  });

  if (!package_) {
    throw new Error('Training package not found');
  }

  // Check wallet
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  if (wallet.dynTokens < package_.costGrid) {
    throw new Error(`Insufficient DYN tokens. Need ${package_.costGrid.toLocaleString()} DYN`);
  }
  if (wallet.cash < package_.costCash) {
    throw new Error(`Insufficient CASH. Need ${package_.costCash.toLocaleString()} CASH`);
  }

  // Determine target players
  let targetPlayers: any[] = [];
  switch (package_.focusType) {
    case 'POSITION_GROUP':
      if (!package_.targetPosition) {
        throw new Error('Position group training requires a target position');
      }
      targetPlayers = team.teamPlayers
        .filter((tp: any) => tp.player.position === package_.targetPosition)
        .map((tp: any) => tp.player);
      break;
    case 'OFFENSE':
      targetPlayers = team.teamPlayers
        .filter((tp: any) => OFFENSIVE_POSITIONS.includes(tp.player.position))
        .map((tp: any) => tp.player);
      break;
    case 'DEFENSE':
      targetPlayers = team.teamPlayers
        .filter((tp: any) => DEFENSIVE_POSITIONS.includes(tp.player.position))
        .map((tp: any) => tp.player);
      break;
    case 'INDIVIDUAL':
      if (!playerId) {
        throw new Error('Individual training requires a player ID');
      }
      const targetPlayer = team.teamPlayers.find((tp: any) => tp.player.id === playerId);
      if (!targetPlayer) {
        throw new Error('Player not found on this team');
      }
      targetPlayers = [targetPlayer.player];
      break;
    case 'ALL':
    default:
      targetPlayers = team.teamPlayers.map((tp: any) => tp.player);
      break;
  }

  if (targetPlayers.length === 0) {
    throw new Error('No players available for this training focus');
  }

  // Check max uses per player
  for (const player of targetPlayers) {
    const useCount = await prisma.playerTraining.count({
      where: { playerId: player.id, trainingPackageId: packageId, status: 'COMPLETED' },
    });
    if (useCount >= package_.maxUsesPerPlayer) {
      throw new Error(`Player ${player.name} has already completed this training ${useCount} times (max: ${package_.maxUsesPerPlayer})`);
    }
  }

  const effectiveness = await getTrainingEffectiveness(teamId);
  const statBoosts = package_.statBoosts as StatBoosts;

  // Calculate actual improvements with diminishing returns
  const improvements = targetPlayers.map((player: any) => {
    const individualBoosts: any = {};
    const multiplier = package_.focusType === 'INDIVIDUAL' ? 2.0 : 1.0;

    for (const [stat, rawBoost] of Object.entries(statBoosts)) {
      if (rawBoost && typeof rawBoost === 'number') {
        const baseStat = player[stat] || 50;
        const adjustedBoost = applyDiminishingReturns(baseStat, rawBoost * multiplier * effectiveness);
        individualBoosts[stat] = adjustedBoost;
      }
    }

    return { playerId: player.id, improvements: individualBoosts };
  });

  return prisma.$transaction(async (tx: any) => {
    // Deduct payment
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: {
        dynTokens: { decrement: package_.costGrid },
        cash: { decrement: package_.costCash },
      },
    });

    // Record ledger
    if (package_.costGrid > 0) {
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'DYN',
        amount: -package_.costGrid,
        balanceAfter: updatedWallet.dynTokens,
        reason: 'TRAINING_PACKAGE',
        sourceType: 'TRAINING',
        sourceId: packageId,
        metadata: { teamId, focusType: package_.focusType },
      });
      // 90% to treasury, 10% burned
      await processTreasuryInflow(tx, 'DYN', Math.round(package_.costGrid * 0.9), 'TRAINING_PURCHASE', packageId);
      await processBurn(tx, 'DYN', Math.round(package_.costGrid * 0.1), 'TRAINING_PURCHASE', packageId);
    }

    if (package_.costCash > 0) {
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: -package_.costCash,
        balanceAfter: updatedWallet.cash,
        reason: 'TRAINING_PACKAGE',
        sourceType: 'TRAINING',
        sourceId: packageId,
        metadata: { teamId, focusType: package_.focusType },
      });
      // Cash also goes to treasury (no burn for cash)
      await processTreasuryInflow(tx, 'CASH', package_.costCash, 'TRAINING_PURCHASE', packageId);
    }

    // Apply stat improvements immediately
    const trainingRecords = [];
    for (const imp of improvements) {
      const updateData: any = {};
      for (const [stat, boost] of Object.entries(imp.improvements)) {
        if (boost && typeof boost === 'number') {
          updateData[stat] = { increment: boost };
        }
      }

      // Apply stat boosts to player
      await tx.player.update({
        where: { id: imp.playerId },
        data: updateData,
      });

      // Recalculate overall
      const updatedPlayer = await tx.player.findUnique({ where: { id: imp.playerId } });
      if (updatedPlayer) {
        const newOverall = Math.round(
          (updatedPlayer.pace + updatedPlayer.shooting + updatedPlayer.passing +
           updatedPlayer.dribbling + updatedPlayer.defending + updatedPlayer.physical) / 6
        );
        await tx.player.update({
          where: { id: imp.playerId },
          data: { overall: newOverall },
        });
      }

      // Record training
      const trainingRecord = await tx.playerTraining.create({
        data: {
          playerId: imp.playerId,
          teamId,
          trainingPackageId: packageId,
          status: 'COMPLETED',
          completedAt: new Date(),
          statImprovements: imp.improvements,
          costGrid: Math.round(package_.costGrid / targetPlayers.length),
          costCash: Math.round(package_.costCash / targetPlayers.length),
        },
      });
      trainingRecords.push(trainingRecord);
    }

    return { trainingRecords, improvements, wallet: updatedWallet };
  });
}

/**
 * Get training history for a user across all teams.
 */
export async function getUserTrainingHistory(userId: string) {
  const teams = await prisma.team.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) return [];

  return prisma.playerTraining.findMany({
    where: { teamId: { in: teamIds } },
    include: {
      player: { select: { id: true, name: true, position: true } },
      trainingPackage: { select: { id: true, name: true, focusType: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
}
