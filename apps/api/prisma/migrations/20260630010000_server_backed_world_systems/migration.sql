-- Server-backed MMO world systems: live chat, avatar presence, daily quests, and sports mini-games.

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "channel" TEXT NOT NULL DEFAULT 'Realm',
    "worldId" TEXT NOT NULL DEFAULT 'grid-city',
    "userId" TEXT NOT NULL,
    "usernameSnapshot" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorldAvatarPresence" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL DEFAULT 'grid-city',
    "usernameSnapshot" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 95,
    "targetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetY" DOUBLE PRECISION NOT NULL DEFAULT 95,
    "facing" TEXT NOT NULL DEFAULT 'down',
    "avatarColor" TEXT NOT NULL DEFAULT '#2563eb',
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldAvatarPresence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DailyQuest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "rewardCash" INTEGER NOT NULL DEFAULT 0,
    "rewardDyn" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyQuest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DailyQuestProgress" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyQuestProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MiniGameAttempt" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "miniGameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "rewardCash" INTEGER NOT NULL DEFAULT 0,
    "rewardDyn" INTEGER NOT NULL DEFAULT 0,
    "questProgress" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiniGameAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatMessage_worldId_channel_createdAt_idx" ON "ChatMessage"("worldId", "channel", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WorldAvatarPresence_userId_key" ON "WorldAvatarPresence"("userId");
CREATE INDEX IF NOT EXISTS "WorldAvatarPresence_worldId_status_lastSeen_idx" ON "WorldAvatarPresence"("worldId", "status", "lastSeen");
CREATE UNIQUE INDEX IF NOT EXISTS "DailyQuest_code_key" ON "DailyQuest"("code");
CREATE INDEX IF NOT EXISTS "DailyQuest_active_sortOrder_idx" ON "DailyQuest"("active", "sortOrder");
CREATE INDEX IF NOT EXISTS "DailyQuest_category_idx" ON "DailyQuest"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "DailyQuestProgress_userId_questId_dateKey_key" ON "DailyQuestProgress"("userId", "questId", "dateKey");
CREATE INDEX IF NOT EXISTS "DailyQuestProgress_userId_dateKey_idx" ON "DailyQuestProgress"("userId", "dateKey");
CREATE INDEX IF NOT EXISTS "DailyQuestProgress_questId_dateKey_idx" ON "DailyQuestProgress"("questId", "dateKey");
CREATE INDEX IF NOT EXISTS "MiniGameAttempt_userId_createdAt_idx" ON "MiniGameAttempt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MiniGameAttempt_miniGameType_createdAt_idx" ON "MiniGameAttempt"("miniGameType", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ChatMessage_userId_fkey' AND table_name = 'ChatMessage') THEN
    ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'WorldAvatarPresence_userId_fkey' AND table_name = 'WorldAvatarPresence') THEN
    ALTER TABLE "WorldAvatarPresence" ADD CONSTRAINT "WorldAvatarPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DailyQuestProgress_userId_fkey' AND table_name = 'DailyQuestProgress') THEN
    ALTER TABLE "DailyQuestProgress" ADD CONSTRAINT "DailyQuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DailyQuestProgress_questId_fkey' AND table_name = 'DailyQuestProgress') THEN
    ALTER TABLE "DailyQuestProgress" ADD CONSTRAINT "DailyQuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "DailyQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MiniGameAttempt_userId_fkey' AND table_name = 'MiniGameAttempt') THEN
    ALTER TABLE "MiniGameAttempt" ADD CONSTRAINT "MiniGameAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
