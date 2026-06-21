-- Training, Equipment, Treasury, and Solana Purchase System

-- Add solBalance to Wallet
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "solBalance" DOUBLE PRECISION DEFAULT 0;

-- TrainingPackage
CREATE TABLE IF NOT EXISTS "TrainingPackage" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    "focusType" TEXT NOT NULL DEFAULT 'ALL',
    "targetPosition" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 7,
    "costGrid" INTEGER NOT NULL DEFAULT 0,
    "costCash" INTEGER NOT NULL DEFAULT 0,
    "statBoosts" JSONB NOT NULL DEFAULT '{}',
    "maxUsesPerPlayer" INTEGER NOT NULL DEFAULT 3,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    active BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TrainingPackage_focusType_idx" ON "TrainingPackage"("focusType");
CREATE INDEX IF NOT EXISTS "TrainingPackage_active_idx" ON "TrainingPackage"(active);

-- PlayerTraining
CREATE TABLE IF NOT EXISTS "PlayerTraining" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "trainingPackageId" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "statImprovements" JSONB NOT NULL DEFAULT '{}',
    "costGrid" INTEGER NOT NULL DEFAULT 0,
    "costCash" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerTraining_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerTraining_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerTraining_trainingPackageId_fkey" FOREIGN KEY ("trainingPackageId") REFERENCES "TrainingPackage"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlayerTraining_playerId_idx" ON "PlayerTraining"("playerId");
CREATE INDEX IF NOT EXISTS "PlayerTraining_teamId_idx" ON "PlayerTraining"("teamId");
CREATE INDEX IF NOT EXISTS "PlayerTraining_status_idx" ON "PlayerTraining"(status);
CREATE INDEX IF NOT EXISTS "PlayerTraining_startedAt_idx" ON "PlayerTraining"("startedAt");

-- EquipmentType
CREATE TABLE IF NOT EXISTS "EquipmentType" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'TRAINING',
    tier INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL DEFAULT '',
    "baseCostGrid" INTEGER NOT NULL DEFAULT 0,
    "baseCostCash" INTEGER NOT NULL DEFAULT 0,
    effects JSONB NOT NULL DEFAULT '{}',
    "upgradeFromId" TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EquipmentType_category_idx" ON "EquipmentType"(category);
CREATE INDEX IF NOT EXISTS "EquipmentType_tier_idx" ON "EquipmentType"(tier);
CREATE INDEX IF NOT EXISTS "EquipmentType_active_idx" ON "EquipmentType"(active);

-- TeamEquipment
CREATE TABLE IF NOT EXISTS "TeamEquipment" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "teamId" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeEffects" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "TeamEquipment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEquipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TeamEquipment_teamId_idx" ON "TeamEquipment"("teamId");
CREATE INDEX IF NOT EXISTS "TeamEquipment_equipmentTypeId_idx" ON "TeamEquipment"("equipmentTypeId");

-- GameTreasury
CREATE TABLE IF NOT EXISTS "GameTreasury" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    currency TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    "totalInflows" INTEGER NOT NULL DEFAULT 0,
    "totalOutflows" INTEGER NOT NULL DEFAULT 0,
    "totalBurned" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GameTreasury_currency_idx" ON "GameTreasury"(currency);

-- TreasuryTransaction
CREATE TABLE IF NOT EXISTS "TreasuryTransaction" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "treasuryId" TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    reason TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryTransaction_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "GameTreasury"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TreasuryTransaction_treasuryId_idx" ON "TreasuryTransaction"("treasuryId");
CREATE INDEX IF NOT EXISTS "TreasuryTransaction_type_idx" ON "TreasuryTransaction"(type);
CREATE INDEX IF NOT EXISTS "TreasuryTransaction_createdAt_idx" ON "TreasuryTransaction"("createdAt");

-- SolanaPurchase
CREATE TABLE IF NOT EXISTS "SolanaPurchase" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    type TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "purchasePriceSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isInitialSale" BOOLEAN NOT NULL DEFAULT true,
    "resaleTaxPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolanaPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SolanaPurchase_userId_idx" ON "SolanaPurchase"("userId");
CREATE INDEX IF NOT EXISTS "SolanaPurchase_type_idx" ON "SolanaPurchase"(type);
CREATE INDEX IF NOT EXISTS "SolanaPurchase_isInitialSale_idx" ON "SolanaPurchase"("isInitialSale");

-- Seed default training packages
INSERT INTO "TrainingPackage" (id, name, description, "focusType", "targetPosition", "durationDays", "costGrid", "costCash", "statBoosts", "maxUsesPerPlayer", "cooldownHours", active) VALUES
('tp-basic-strength', 'Basic Strength & Conditioning', 'All players receive a small physical boost', 'ALL', NULL, 7, 0, 300, '{"physical": 1, "pace": 1}', 5, 24, true),
('tp-qb-camp', 'QB Passing Camp', 'Intensive passing drills for quarterbacks', 'POSITION_GROUP', 'QB', 7, 500, 0, '{"passing": 3, "pace": 2}', 3, 48, true),
('tp-rb-camp', 'RB Power Camp', 'Focus on running power and agility', 'POSITION_GROUP', 'RB', 7, 500, 0, '{"physical": 2, "pace": 2, "dribbling": 1}', 3, 48, true),
('tp-wr-camp', 'WR Route Camp', 'Precision route running and catching', 'POSITION_GROUP', 'WR', 7, 500, 0, '{"shooting": 3, "pace": 2}', 3, 48, true),
('tp-ol-camp', 'OL Line Camp', 'Blocking technique and strength', 'POSITION_GROUP', 'OL', 7, 500, 0, '{"physical": 3, "defending": 2}', 3, 48, true),
('tp-dl-camp', 'DL Rush Camp', 'Pass rushing and run stopping', 'POSITION_GROUP', 'DL', 7, 500, 0, '{"defending": 3, "physical": 2}', 3, 48, true),
('tp-lb-camp', 'LB Coverage Camp', 'Coverage skills and tackling', 'POSITION_GROUP', 'LB', 7, 500, 0, '{"defending": 3, "pace": 1}', 3, 48, true),
('tp-db-camp', 'DB Coverage Camp', 'Man and zone coverage technique', 'POSITION_GROUP', 'CB', 7, 500, 0, '{"defending": 3, "pace": 2}', 3, 48, true),
('tp-offense-blitz', 'Offense Blitz', 'All offensive players get a boost', 'OFFENSE', NULL, 7, 1000, 0, '{"passing": 1, "shooting": 1, "pace": 1}', 2, 72, true),
('tp-defense-blitz', 'Defense Blitz', 'All defensive players get a boost', 'DEFENSE', NULL, 7, 1000, 0, '{"defending": 1, "physical": 1, "pace": 1}', 2, 72, true),
('tp-elite-individual', 'Elite Individual Training', 'Double focus on one specific player', 'INDIVIDUAL', NULL, 14, 2000, 0, '{"pace": 2, "shooting": 2, "passing": 2, "dribbling": 2, "defending": 2, "physical": 2}', 2, 72, true),
('tp-speed-school', 'Speed School', 'All players get a pace boost', 'ALL', NULL, 7, 800, 0, '{"pace": 2}', 3, 48, true)
ON CONFLICT (id) DO NOTHING;

-- Seed default equipment types
INSERT INTO "EquipmentType" (id, name, category, tier, description, "baseCostGrid", "baseCostCash", effects, active) VALUES
('eq-basic-weights', 'Basic Weight Room', 'TRAINING', 1, 'Standard free weights and benches', 0, 1000, '{"trainingBoost": 0.05}', true),
('eq-power-rack', 'Power Rack Setup', 'TRAINING', 2, 'Advanced squat racks and Olympic platforms', 0, 5000, '{"trainingBoost": 0.10}', true),
('eq-full-gym', 'Full Performance Gym', 'TRAINING', 3, 'Complete gym with recovery stations', 15000, 0, '{"trainingBoost": 0.15, "fatigueReduction": 5}', true),
('eq-video-analysis', 'Video Analysis Suite', 'ANALYSIS', 1, 'Film breakdown and opponent scouting', 0, 3000, '{"trainingBoost": 0.03, "matchPrepBonus": 2}', true),
('eq-recovery-room', 'Recovery Room', 'MEDICAL', 1, 'Ice baths and compression therapy', 0, 4000, '{"fatigueReduction": 10, "injuryPrevention": 5}', true),
('eq-sports-med', 'Sports Medicine Center', 'MEDICAL', 2, 'Full medical staff and rehab facilities', 20000, 0, '{"fatigueReduction": 15, "injuryPrevention": 10, "trainingBoost": 0.05}', true),
('eq-practice-field', 'Practice Field Upgrades', 'FACILITY', 1, 'Better turf and lighting', 0, 8000, '{"trainingBoost": 0.05, "matchPrepBonus": 3}', true),
('eq-indoor-facility', 'Indoor Training Facility', 'FACILITY', 2, 'Climate-controlled practice facility', 25000, 0, '{"trainingBoost": 0.10, "fatigueReduction": 5, "matchPrepBonus": 5}', true)
ON CONFLICT (id) DO NOTHING;

-- Seed initial treasury balances
INSERT INTO "GameTreasury" (id, currency, balance, "totalInflows", "totalOutflows", "totalBurned") VALUES
('treasury-grid', 'GRID', 0, 0, 0, 0),
('treasury-cash', 'CASH', 0, 0, 0, 0),
('treasury-sol', 'SOL', 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;
