import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const JOURNEY_STAGES = ['PREPARE', 'DEVELOP', 'COMPETE', 'GROW'] as const;
export type JourneyStage = typeof JOURNEY_STAGES[number];

export const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
export const isJourneyComplete = (stages: Record<string, boolean>) => JOURNEY_STAGES.every((stage) => stages[stage] === true);
export function computeDailyChestReward(streak: number) {
  const value = Math.max(1, Math.floor(streak));
  return { cash: Math.min(2500, 1500 + (value - 1) * 100), dyn: value % 7 === 0 ? 10 : 0 };
}
function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return utcDateKey(date);
}
async function ensureState(userId: string, dateKey: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "RetentionProfile" ("userId", "updatedAt") VALUES (${userId}, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "DailyJourney" ("userId", "dateKey") VALUES (${userId}, ${dateKey})
      ON CONFLICT ("userId", "dateKey") DO NOTHING
    `);
  });
}
export async function getRetentionState(userId: string, now = new Date()) {
  const dateKey = utcDateKey(now);
  await ensureState(userId, dateKey);
  const [profile] = await prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT "currentStreak", "bestStreak", "seasonXp" FROM "RetentionProfile" WHERE "userId"=${userId}`);
  const [journey] = await prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT "stages", "completedAt", "chestEligibleAt", "chestClaimedAt" FROM "DailyJourney" WHERE "userId"=${userId} AND "dateKey"=${dateKey}`);
  const [season] = await prisma.$queryRaw<Array<any>>(Prisma.sql`
    SELECT s."id",s."code",s."name",s."startsAt",s."endsAt",COALESCE(p."xp",0)::int AS "xp"
    FROM "RetentionSeason" s LEFT JOIN "SeasonProgress" p ON p."seasonId"=s."id" AND p."userId"=${userId}
    WHERE s."status"='ACTIVE' AND ${now} BETWEEN s."startsAt" AND s."endsAt" ORDER BY s."startsAt" DESC LIMIT 1
  `);
  return { dateKey, streak: profile || { currentStreak: 0, bestStreak: 0, seasonXp: 0 }, journey, season: season || null };
}
export async function completeJourneyStage(userId: string, stage: JourneyStage, now = new Date()) {
  if (!JOURNEY_STAGES.includes(stage)) throw new Error('Invalid journey stage');
  const dateKey = utcDateKey(now);
  await ensureState(userId, dateKey);
  return prisma.$transaction(async (tx) => {
    const [journey] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "id","stages","completedAt" FROM "DailyJourney" WHERE "userId"=${userId} AND "dateKey"=${dateKey} FOR UPDATE`);
    const stages = { ...journey.stages, [stage]: true };
    const newlyCompleted = !journey.completedAt && isJourneyComplete(stages);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "DailyJourney" SET "stages"=${JSON.stringify(stages)}::jsonb,
      "completedAt"=CASE WHEN ${newlyCompleted} THEN ${now} ELSE "completedAt" END,
      "chestEligibleAt"=CASE WHEN ${newlyCompleted} THEN ${now} ELSE "chestEligibleAt" END,
      "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${journey.id}
    `);
    if (newlyCompleted) {
      const [profile] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "currentStreak","bestStreak","lastActiveDate" FROM "RetentionProfile" WHERE "userId"=${userId} FOR UPDATE`);
      const nextStreak = profile.lastActiveDate === previousDateKey(dateKey) ? profile.currentStreak + 1 : 1;
      await tx.$executeRaw(Prisma.sql`
        UPDATE "RetentionProfile" SET "currentStreak"=${nextStreak},"bestStreak"=GREATEST("bestStreak",${nextStreak}),
        "lastActiveDate"=${dateKey},"seasonXp"="seasonXp"+100,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId}
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "SeasonProgress" ("userId","seasonId","xp") SELECT ${userId},s."id",100 FROM "RetentionSeason" s
        WHERE s."status"='ACTIVE' AND ${now} BETWEEN s."startsAt" AND s."endsAt"
        ON CONFLICT ("userId","seasonId") DO UPDATE SET "xp"="SeasonProgress"."xp"+100,"updatedAt"=CURRENT_TIMESTAMP
      `);
    }
    return { dateKey, stages, newlyCompleted };
  });
}
async function grantWalletReward(tx: Prisma.TransactionClient, userId: string, cash: number, dyn: number, sourceType: string, sourceId: string, metadata: object) {
  const [wallet] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "id","cash","dynTokens" FROM "Wallet" WHERE "userId"=${userId} FOR UPDATE`);
  if (!wallet) throw new Error('Wallet not found');
  const nextCash = wallet.cash + cash;
  const nextDyn = wallet.dynTokens + dyn;
  await tx.$executeRaw(Prisma.sql`UPDATE "Wallet" SET "cash"=${nextCash},"dynTokens"=${nextDyn},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${wallet.id}`);
  if (cash) await tx.$executeRaw(Prisma.sql`INSERT INTO "CurrencyLedger" ("id","userId","currency","amount","balanceAfter","reason","sourceType","sourceId","metadata") VALUES (${randomUUID()},${userId},'CASH',${cash},${nextCash},'RETENTION_REWARD',${sourceType},${sourceId},${JSON.stringify(metadata)}::jsonb)`);
  if (dyn) await tx.$executeRaw(Prisma.sql`INSERT INTO "CurrencyLedger" ("id","userId","currency","amount","balanceAfter","reason","sourceType","sourceId","metadata") VALUES (${randomUUID()},${userId},'DYN',${dyn},${nextDyn},'RETENTION_REWARD',${sourceType},${sourceId},${JSON.stringify(metadata)}::jsonb)`);
  return { cash: nextCash, dynTokens: nextDyn };
}
export async function claimDailyChest(userId: string, key: string, now = new Date()) {
  if (!key || key.length < 8) throw new Error('A valid idempotency key is required');
  const dateKey = utcDateKey(now);
  return prisma.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "rewardCash","rewardDyn","metadata" FROM "RewardClaim" WHERE "userId"=${userId} AND "idempotencyKey"=${key}`);
    if (existing) return { replayed: true, ...existing };
    const [journey] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "id","chestEligibleAt","chestClaimedAt" FROM "DailyJourney" WHERE "userId"=${userId} AND "dateKey"=${dateKey} FOR UPDATE`);
    if (!journey?.chestEligibleAt) throw new Error('Daily journey is not complete');
    if (journey.chestClaimedAt) throw new Error('Daily chest already claimed');
    const [profile] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "currentStreak" FROM "RetentionProfile" WHERE "userId"=${userId} FOR UPDATE`);
    const reward = computeDailyChestReward(profile.currentStreak);
    const claimId = randomUUID();
    const metadata = { dateKey, streak: profile.currentStreak };
    await tx.$executeRaw(Prisma.sql`INSERT INTO "RewardClaim" ("id","userId","claimType","claimKey","idempotencyKey","rewardCash","rewardDyn","metadata") VALUES (${claimId},${userId},'DAILY_CHEST',${dateKey},${key},${reward.cash},${reward.dyn},${JSON.stringify(metadata)}::jsonb)`);
    const wallet = await grantWalletReward(tx,userId,reward.cash,reward.dyn,'DAILY_CHEST',claimId,metadata);
    await tx.$executeRaw(Prisma.sql`UPDATE "DailyJourney" SET "chestClaimedAt"=${now},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${journey.id}`);
    return { replayed: false, rewardCash: reward.cash, rewardDyn: reward.dyn, wallet, metadata };
  });
}
export async function getSeasonState(userId: string, now = new Date()) {
  const [season] = await prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT s."id",s."code",s."name",s."startsAt",s."endsAt",COALESCE(p."xp",0)::int AS "xp" FROM "RetentionSeason" s LEFT JOIN "SeasonProgress" p ON p."seasonId"=s."id" AND p."userId"=${userId} WHERE s."status"='ACTIVE' AND ${now} BETWEEN s."startsAt" AND s."endsAt" LIMIT 1`);
  if (!season) return null;
  const milestones = await prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT m.*,EXISTS(SELECT 1 FROM "RewardClaim" c WHERE c."userId"=${userId} AND c."claimType"='SEASON_MILESTONE' AND c."claimKey"=m."id") AS "claimed" FROM "SeasonMilestone" m WHERE m."seasonId"=${season.id} ORDER BY m."tier"`);
  return { ...season, milestones };
}
export async function claimSeasonMilestone(userId: string, milestoneId: string, key: string, now = new Date()) {
  if (!key || key.length < 8) throw new Error('A valid idempotency key is required');
  return prisma.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT "rewardCash","rewardDyn","metadata" FROM "RewardClaim" WHERE "userId"=${userId} AND "idempotencyKey"=${key}`);
    if (existing) return { replayed: true, ...existing };
    const [m] = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT m.*,p."xp" FROM "SeasonMilestone" m JOIN "RetentionSeason" s ON s."id"=m."seasonId" JOIN "SeasonProgress" p ON p."seasonId"=s."id" AND p."userId"=${userId} WHERE m."id"=${milestoneId} AND s."status"='ACTIVE' AND ${now} BETWEEN s."startsAt" AND s."endsAt" FOR UPDATE OF p`);
    if (!m) throw new Error('Season milestone not found');
    if (m.xp < m.xpRequired) throw new Error('Season milestone is locked');
    const claimId=randomUUID(); const metadata={milestoneId,tier:m.tier,seasonId:m.seasonId};
    await tx.$executeRaw(Prisma.sql`INSERT INTO "RewardClaim" ("id","userId","claimType","claimKey","idempotencyKey","rewardCash","rewardDyn","metadata") VALUES (${claimId},${userId},'SEASON_MILESTONE',${milestoneId},${key},${m.rewardCash},${m.rewardDyn},${JSON.stringify(metadata)}::jsonb)`);
    const wallet=await grantWalletReward(tx,userId,m.rewardCash,m.rewardDyn,'SEASON_MILESTONE',claimId,metadata);
    return { replayed:false,rewardCash:m.rewardCash,rewardDyn:m.rewardDyn,wallet,metadata };
  });
}
export async function getFacilityModifiers(now = new Date()) {
  return prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT "id","code","facilityId","name","description","startsAt","endsAt","effects",CASE WHEN ${now} BETWEEN "startsAt" AND "endsAt" THEN 'ACTIVE' ELSE "status" END AS "status" FROM "FacilityModifier" WHERE "status" IN ('SCHEDULED','ACTIVE') AND "endsAt">${now} ORDER BY "startsAt"`);
}
