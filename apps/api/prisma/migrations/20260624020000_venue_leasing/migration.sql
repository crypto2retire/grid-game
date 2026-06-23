-- Add leaseRate to Venue for revenue sharing model
ALTER TABLE "Venue" ADD COLUMN "leaseRate" DOUBLE PRECISION DEFAULT 0.10;

-- Set ownerId on all AI team venues to the AI system owner (treasury)
UPDATE "Venue" SET "ownerId" = 'ai-system-owner-001'
WHERE "teamId" IN (SELECT id FROM "Team" WHERE "isAI" = true);

-- Set ownerId on all user team venues to the AI system owner (treasury owns until purchased)
UPDATE "Venue" SET "ownerId" = 'ai-system-owner-001'
WHERE "ownerId" IS NULL;
