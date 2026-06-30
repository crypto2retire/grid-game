import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordCurrencyLedger } from '../economy/ledger';

const DAILY_QUESTS = [
  {
    code: 'COMPLETE_3_TEAM_DRILLS',
    title: 'Complete 3 team drills',
    description: 'Run server-scored drills from the hotbar to sharpen your roster.',
    category: 'TEAM_DRILL',
    target: 3,
    rewardCash: 750,
    rewardDyn: 0,
    rewardXp: 750,
    sortOrder: 10,
    metadata: { theme: 'training', icon: '💪' },
  },
  {
    code: 'PLAY_1_STADIUM_SCRIMMAGE',
    title: 'Play 1 stadium scrimmage',
    description: 'Run a live server-resolved scrimmage at the stadium district.',
    category: 'STADIUM_MATCH',
    target: 1,
    rewardCash: 1500,
    rewardDyn: 0,
    rewardXp: 1200,
    sortOrder: 20,
    metadata: { theme: 'matchday', icon: '🏟️' },
  },
  {
    code: 'SCOUT_2_ATHLETES',
    title: 'Scout 2 athletes',
    description: 'Run scouting combines to uncover player-value signals.',
    category: 'SCOUTING',
    target: 2,
    rewardCash: 500,
    rewardDyn: 0,
    rewardXp: 500,
    sortOrder: 30,
    metadata: { theme: 'scouting', icon: '🔭', rewardItem: 'Draft Ticket' },
  },
];

export interface QuestProgressResult {
  questId: string;
  code: string;
  title: string;
  category: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function buildRewardLabel(quest: { rewardCash: number; rewardDyn: number; rewardXp: number; metadata?: unknown }): string {
  const parts: string[] = [];
  if (quest.rewardCash > 0) parts.push(`+${quest.rewardCash.toLocaleString()} CASH`);
  if (quest.rewardDyn > 0) parts.push(`+${quest.rewardDyn.toLocaleString()} DYN`);
  if (quest.rewardXp > 0) parts.push(`+${quest.rewardXp.toLocaleString()} Team XP`);
  const metadata = quest.metadata && typeof quest.metadata === 'object' ? quest.metadata as Record<string, unknown> : {};
  if (typeof metadata.rewardItem === 'string') parts.push(`+1 ${metadata.rewardItem}`);
  return parts.join(' • ') || 'Progress reward';
}

export async function ensureDefaultDailyQuests(): Promise<void> {
  await Promise.all(
    DAILY_QUESTS.map((quest) =>
      prisma.dailyQuest.upsert({
        where: { code: quest.code },
        update: {
          title: quest.title,
          description: quest.description,
          category: quest.category,
          target: quest.target,
          rewardCash: quest.rewardCash,
          rewardDyn: quest.rewardDyn,
          rewardXp: quest.rewardXp,
          sortOrder: quest.sortOrder,
          active: true,
          metadata: quest.metadata,
        },
        create: quest,
      })
    )
  );
}

export async function getDailyQuestsForUser(userId: string) {
  await ensureDefaultDailyQuests();
  const dateKey = todayKey();
  const quests = await prisma.dailyQuest.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  await Promise.all(
    quests.map((quest) =>
      prisma.dailyQuestProgress.upsert({
        where: { userId_questId_dateKey: { userId, questId: quest.id, dateKey } },
        update: {},
        create: { userId, questId: quest.id, dateKey },
      })
    )
  );

  const progressRows = await prisma.dailyQuestProgress.findMany({
    where: { userId, dateKey, questId: { in: quests.map((quest) => quest.id) } },
  });
  const progressByQuest = new Map(progressRows.map((row) => [row.questId, row]));

  return quests.map((quest) => {
    const progress = progressByQuest.get(quest.id);
    const current = Math.min(progress?.progress ?? 0, quest.target);
    return {
      id: quest.id,
      code: quest.code,
      label: quest.title,
      title: quest.title,
      description: quest.description,
      category: quest.category,
      progress: current,
      total: quest.target,
      target: quest.target,
      completed: progress?.completed ?? false,
      claimed: progress?.claimed ?? false,
      rewardCash: quest.rewardCash,
      rewardDyn: quest.rewardDyn,
      rewardXp: quest.rewardXp,
      rewardLabel: buildRewardLabel(quest),
      metadata: quest.metadata,
      dateKey,
    };
  });
}

export async function recordDailyQuestProgress(
  tx: any,
  userId: string,
  category: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<QuestProgressResult[]> {
  const dateKey = todayKey();
  const quests = await tx.dailyQuest.findMany({
    where: { active: true, category },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const results: QuestProgressResult[] = [];
  for (const quest of quests) {
    const existing = await tx.dailyQuestProgress.findUnique({
      where: { userId_questId_dateKey: { userId, questId: quest.id, dateKey } },
    });

    if (existing?.claimed || existing?.completed) {
      results.push({
        questId: quest.id,
        code: quest.code,
        title: quest.title,
        category: quest.category,
        progress: Math.min(existing.progress, quest.target),
        target: quest.target,
        completed: existing.completed,
        claimed: existing.claimed,
      });
      continue;
    }

    const nextProgress = Math.min(quest.target, (existing?.progress ?? 0) + amount);
    const completed = nextProgress >= quest.target;
    const data = {
      progress: nextProgress,
      completed,
      completedAt: completed ? new Date() : null,
      metadata: { lastEvent: metadata, updatedAt: new Date().toISOString() },
    };

    const saved = existing
      ? await tx.dailyQuestProgress.update({
          where: { id: existing.id },
          data,
        })
      : await tx.dailyQuestProgress.create({
          data: { userId, questId: quest.id, dateKey, ...data },
        });

    results.push({
      questId: quest.id,
      code: quest.code,
      title: quest.title,
      category: quest.category,
      progress: Math.min(saved.progress, quest.target),
      target: quest.target,
      completed: saved.completed,
      claimed: saved.claimed,
    });
  }

  return results;
}

export async function claimDailyQuest(userId: string, questId: string) {
  await ensureDefaultDailyQuests();
  const dateKey = todayKey();
  const progress = await prisma.dailyQuestProgress.findUnique({
    where: { userId_questId_dateKey: { userId, questId, dateKey } },
    include: { quest: true },
  });

  if (!progress) throw new AppError(404, 'Daily quest progress not found');
  if (!progress.completed) throw new AppError(400, 'Daily quest is not complete yet');
  if (progress.claimed) throw new AppError(400, 'Daily quest reward already claimed');

  return prisma.$transaction(async (tx: any) => {
    const claimed = await tx.dailyQuestProgress.update({
      where: { id: progress.id },
      data: { claimed: true, rewardGranted: true, claimedAt: new Date() },
      include: { quest: true },
    });

    let wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.wallet.create({ data: { userId } });
    }

    if (progress.quest.rewardCash > 0) {
      wallet = await tx.wallet.update({
        where: { userId },
        data: { cash: { increment: progress.quest.rewardCash } },
      });
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'CASH',
        amount: progress.quest.rewardCash,
        balanceAfter: wallet.cash,
        reason: 'DAILY_QUEST_REWARD',
        sourceType: 'DAILY_QUEST',
        sourceId: progress.quest.id,
        metadata: { code: progress.quest.code, dateKey },
      });
    }

    if (progress.quest.rewardDyn > 0) {
      wallet = await tx.wallet.update({
        where: { userId },
        data: { dynTokens: { increment: progress.quest.rewardDyn } },
      });
      await recordCurrencyLedger(tx, {
        userId,
        currency: 'DYN',
        amount: progress.quest.rewardDyn,
        balanceAfter: wallet.dynTokens,
        reason: 'DAILY_QUEST_REWARD',
        sourceType: 'DAILY_QUEST',
        sourceId: progress.quest.id,
        metadata: { code: progress.quest.code, dateKey },
      });
    }

    return {
      quest: {
        id: claimed.quest.id,
        code: claimed.quest.code,
        label: claimed.quest.title,
        progress: Math.min(claimed.progress, claimed.quest.target),
        total: claimed.quest.target,
        completed: claimed.completed,
        claimed: claimed.claimed,
        rewardLabel: buildRewardLabel(claimed.quest),
      },
      wallet,
    };
  });
}
