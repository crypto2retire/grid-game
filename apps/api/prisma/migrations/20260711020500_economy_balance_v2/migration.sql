-- Economy balance V2: seller retention, DYN utility, staking concentration controls,
-- grinder cost scaling, and long-lived facility specialization cycles.

CREATE TABLE IF NOT EXISTS "SellerProfile" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "reputationXp" INTEGER NOT NULL DEFAULT 0,
  "reputationLevel" INTEGER NOT NULL DEFAULT 1,
  "completedSales" INTEGER NOT NULL DEFAULT 0,
  "lifetimeVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "seasonXpEarned" INTEGER NOT NULL DEFAULT 0,
  "milestonesClaimed" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SellerWeeklyObjective" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "weekKey" TEXT NOT NULL,
  "salesTarget" INTEGER NOT NULL DEFAULT 3,
  "volumeTarget" DOUBLE PRECISION NOT NULL DEFAULT 2500,
  "salesProgress" INTEGER NOT NULL DEFAULT 0,
  "volumeProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "rewardSellerXp" INTEGER NOT NULL DEFAULT 125,
  "rewardSeasonXp" INTEGER NOT NULL DEFAULT 75,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerWeeklyObjective_user_week_key" UNIQUE ("userId", "weekKey")
);
CREATE INDEX IF NOT EXISTS "SellerWeeklyObjective_user_idx" ON "SellerWeeklyObjective"("userId", "weekKey");

CREATE TABLE IF NOT EXISTS "FacilitySpecialization" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "facilityType" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "effects" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "maintenanceCash" INTEGER NOT NULL DEFAULT 0,
  "maintenanceDyn" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacilitySpecialization_team_facility_key" UNIQUE ("teamId", "facilityType")
);
CREATE INDEX IF NOT EXISTS "FacilitySpecialization_team_idx" ON "FacilitySpecialization"("teamId");

CREATE TABLE IF NOT EXISTS "FacilitySeasonCycle" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "seasonKey" TEXT NOT NULL,
  "cycleType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "costCash" INTEGER NOT NULL DEFAULT 0,
  "costDyn" INTEGER NOT NULL DEFAULT 0,
  "effects" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacilitySeasonCycle_team_season_type_key" UNIQUE ("teamId", "seasonKey", "cycleType")
);
CREATE INDEX IF NOT EXISTS "FacilitySeasonCycle_team_idx" ON "FacilitySeasonCycle"("teamId", "seasonKey");

CREATE TABLE IF NOT EXISTS "CompetitiveEconomyWeek" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "weekKey" TEXT NOT NULL,
  "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
  "difficultyPoints" INTEGER NOT NULL DEFAULT 0,
  "cashRewardGross" INTEGER NOT NULL DEFAULT 0,
  "cashRewardClawedBack" INTEGER NOT NULL DEFAULT 0,
  "maintenanceCharged" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitiveEconomyWeek_user_week_key" UNIQUE ("userId", "weekKey")
);

CREATE OR REPLACE FUNCTION economy_week_key(ts TIMESTAMP WITH TIME ZONE DEFAULT now()) RETURNS TEXT AS $$
BEGIN
  RETURN to_char((ts AT TIME ZONE 'UTC')::date - (EXTRACT(ISODOW FROM ts AT TIME ZONE 'UTC')::int - 1), 'YYYY-MM-DD');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION economy_reputation_level(xp INTEGER) RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, LEAST(20, 1 + FLOOR(SQRT(GREATEST(0, xp)::numeric / 100.0))::int));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION economy_dyn_benefit_tier(dyn_balance INTEGER) RETURNS INTEGER AS $$
BEGIN
  IF dyn_balance >= 2500 THEN RETURN 3; END IF;
  IF dyn_balance >= 500 THEN RETURN 2; END IF;
  IF dyn_balance >= 100 THEN RETURN 1; END IF;
  RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION economy_record_seller_sale() RETURNS TRIGGER AS $$
DECLARE
  sale_volume DOUBLE PRECISION;
  week_key TEXT;
  xp_gain INTEGER;
  season_gain INTEGER;
  dyn_balance INTEGER;
  benefit_tier INTEGER;
  rebate_rate DOUBLE PRECISION;
  rebate_amount INTEGER;
  next_level INTEGER;
BEGIN
  IF NEW."amount" <= 0 OR NEW."reason" NOT LIKE '%\_SALE' ESCAPE '\' OR NEW."reason" = 'SELLER_FEE_REBATE' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW."sourceType", '') NOT ILIKE '%MARKET%' THEN
    RETURN NEW;
  END IF;

  sale_volume := NEW."amount";
  week_key := economy_week_key(NEW."createdAt");
  xp_gain := LEAST(150, 20 + FLOOR(SQRT(GREATEST(1, sale_volume)))::int);
  season_gain := LEAST(50, 10 + FLOOR(LN(GREATEST(2, sale_volume)))::int * 3);

  INSERT INTO "SellerProfile" ("userId", "reputationXp", "completedSales", "lifetimeVolume", "seasonXpEarned", "updatedAt")
  VALUES (NEW."userId", xp_gain, 1, sale_volume, season_gain, CURRENT_TIMESTAMP)
  ON CONFLICT ("userId") DO UPDATE SET
    "reputationXp" = "SellerProfile"."reputationXp" + EXCLUDED."reputationXp",
    "completedSales" = "SellerProfile"."completedSales" + 1,
    "lifetimeVolume" = "SellerProfile"."lifetimeVolume" + EXCLUDED."lifetimeVolume",
    "seasonXpEarned" = "SellerProfile"."seasonXpEarned" + EXCLUDED."seasonXpEarned",
    "updatedAt" = CURRENT_TIMESTAMP;

  UPDATE "SellerProfile"
  SET "reputationLevel" = economy_reputation_level("reputationXp")
  WHERE "userId" = NEW."userId";

  INSERT INTO "SellerWeeklyObjective" ("userId", "weekKey", "salesProgress", "volumeProgress", "updatedAt")
  VALUES (NEW."userId", week_key, 1, sale_volume, CURRENT_TIMESTAMP)
  ON CONFLICT ("userId", "weekKey") DO UPDATE SET
    "salesProgress" = "SellerWeeklyObjective"."salesProgress" + 1,
    "volumeProgress" = "SellerWeeklyObjective"."volumeProgress" + EXCLUDED."volumeProgress",
    "updatedAt" = CURRENT_TIMESTAMP;

  UPDATE "SellerWeeklyObjective"
  SET "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP)
  WHERE "userId" = NEW."userId" AND "weekKey" = week_key
    AND "salesProgress" >= "salesTarget" AND "volumeProgress" >= "volumeTarget";

  -- Marketplace activity contributes to active season progression without minting liquid DYN.
  UPDATE "RetentionProfile"
  SET "seasonXp" = "seasonXp" + season_gain, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "userId" = NEW."userId";

  SELECT COALESCE("dynTokens", 0) INTO dyn_balance FROM "Wallet" WHERE "userId" = NEW."userId";
  benefit_tier := economy_dyn_benefit_tier(COALESCE(dyn_balance, 0));
  rebate_rate := CASE benefit_tier WHEN 3 THEN 0.025 WHEN 2 THEN 0.015 WHEN 1 THEN 0.0075 ELSE 0 END;
  rebate_amount := FLOOR(sale_volume * rebate_rate)::int;

  IF rebate_amount > 0 THEN
    UPDATE "Wallet" SET "cash" = "cash" + rebate_amount, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId";
    INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
    SELECT gen_random_uuid()::text, NEW."userId", 'CASH', rebate_amount, "cash", 'SELLER_FEE_REBATE', 'SELLER_PROGRESSION', NEW."sourceId",
      jsonb_build_object('benefitTier', benefit_tier, 'sourceSaleLedgerId', NEW."id"), CURRENT_TIMESTAMP
    FROM "Wallet" WHERE "userId" = NEW."userId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_economy_record_seller_sale ON "CurrencyLedger";
CREATE TRIGGER trg_economy_record_seller_sale
AFTER INSERT ON "CurrencyLedger"
FOR EACH ROW EXECUTE FUNCTION economy_record_seller_sale();

CREATE OR REPLACE FUNCTION economy_enforce_listing_slots() RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
  rep_level INTEGER;
  dyn_balance INTEGER;
  listing_limit INTEGER;
  table_name TEXT;
BEGIN
  table_name := TG_TABLE_NAME;
  SELECT COALESCE("reputationLevel", 1) INTO rep_level FROM "SellerProfile" WHERE "userId" = NEW."sellerId";
  SELECT COALESCE("dynTokens", 0) INTO dyn_balance FROM "Wallet" WHERE "userId" = NEW."sellerId";
  listing_limit := 3 + LEAST(4, GREATEST(0, COALESCE(rep_level, 1) - 1) / 3) + economy_dyn_benefit_tier(COALESCE(dyn_balance, 0));

  IF table_name = 'MarketplaceListing' THEN
    SELECT COUNT(*) INTO active_count FROM "MarketplaceListing" WHERE "sellerId" = NEW."sellerId" AND "status" = 'ACTIVE';
  ELSIF table_name = 'MarketplaceItemListing' THEN
    SELECT COUNT(*) INTO active_count FROM "MarketplaceItemListing" WHERE "sellerId" = NEW."sellerId" AND "status" = 'ACTIVE';
  ELSE
    SELECT COUNT(*) INTO active_count FROM "TeamMarketplaceListing" WHERE "sellerId" = NEW."sellerId" AND "status" = 'ACTIVE';
  END IF;

  IF active_count >= listing_limit THEN
    RAISE EXCEPTION 'Active listing limit reached (%). Hold DYN or build seller reputation for more slots.', listing_limit USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_listing_slots ON "MarketplaceListing";
CREATE TRIGGER trg_marketplace_listing_slots BEFORE INSERT ON "MarketplaceListing" FOR EACH ROW EXECUTE FUNCTION economy_enforce_listing_slots();
DROP TRIGGER IF EXISTS trg_item_listing_slots ON "MarketplaceItemListing";
CREATE TRIGGER trg_item_listing_slots BEFORE INSERT ON "MarketplaceItemListing" FOR EACH ROW EXECUTE FUNCTION economy_enforce_listing_slots();
DROP TRIGGER IF EXISTS trg_team_listing_slots ON "TeamMarketplaceListing";
CREATE TRIGGER trg_team_listing_slots BEFORE INSERT ON "TeamMarketplaceListing" FOR EACH ROW EXECUTE FUNCTION economy_enforce_listing_slots();

CREATE OR REPLACE FUNCTION economy_staking_multiplier(stake_amount INTEGER) RETURNS DOUBLE PRECISION AS $$
BEGIN
  IF stake_amount <= 5000 THEN RETURN 1.0; END IF;
  IF stake_amount <= 25000 THEN RETURN 0.75; END IF;
  IF stake_amount <= 100000 THEN RETURN 0.50; END IF;
  RETURN 0.30;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION economy_apply_staking_diminishing_return() RETURNS TRIGGER AS $$
DECLARE
  stake_amount INTEGER;
  reward_component INTEGER;
  multiplier DOUBLE PRECISION;
  excess INTEGER;
BEGIN
  IF NEW."currency" <> 'DYN' OR NEW."amount" <= 0 OR NEW."reason" NOT IN ('STAKE_REWARD', 'STAKE_WITHDRAWAL') THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM("amount"), 0)::int INTO stake_amount FROM "UserStake" WHERE "userId" = NEW."userId" AND "status" IN ('ACTIVE', 'UNSTAKING');
  multiplier := economy_staking_multiplier(stake_amount);
  reward_component := CASE WHEN NEW."reason" = 'STAKE_WITHDRAWAL' THEN COALESCE((NEW."metadata"->>'rewards')::int, 0) ELSE NEW."amount"::int END;
  excess := FLOOR(reward_component * (1 - multiplier))::int;
  IF excess <= 0 THEN RETURN NEW; END IF;

  UPDATE "Wallet" SET "dynTokens" = GREATEST(0, "dynTokens" - excess), "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId";
  UPDATE "RewardsPool" SET "totalRewardsFunded" = "totalRewardsFunded" + excess,
    "totalRewardsDistributed" = GREATEST(0, "totalRewardsDistributed" - excess), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'main';
  INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
  SELECT gen_random_uuid()::text, NEW."userId", 'DYN', -excess, "dynTokens", 'STAKE_REWARD_DIMINISHING_RETURN', 'STAKING', NEW."sourceId",
    jsonb_build_object('stakeAmount', stake_amount, 'multiplier', multiplier, 'originalLedgerId', NEW."id"), CURRENT_TIMESTAMP
  FROM "Wallet" WHERE "userId" = NEW."userId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staking_diminishing_return ON "CurrencyLedger";
CREATE TRIGGER trg_staking_diminishing_return AFTER INSERT ON "CurrencyLedger" FOR EACH ROW EXECUTE FUNCTION economy_apply_staking_diminishing_return();

CREATE OR REPLACE FUNCTION economy_progressive_upgrade_surcharge() RETURNS TRIGGER AS $$
DECLARE
  owner_id TEXT;
  upgrade_count INTEGER;
  surcharge INTEGER;
  balance_after INTEGER;
BEGIN
  SELECT v."ownerId", COUNT(su."id")::int INTO owner_id, upgrade_count
  FROM "Venue" v LEFT JOIN "StadiumUpgrade" su ON su."venueId" = v."id"
  WHERE v."id" = NEW."venueId" GROUP BY v."ownerId";
  IF owner_id IS NULL OR upgrade_count <= 3 THEN RETURN NEW; END IF;
  surcharge := LEAST(1200, 40 * (2 ^ LEAST(5, upgrade_count - 3))::int);
  UPDATE "Wallet" SET "dynTokens" = "dynTokens" - surcharge, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = owner_id AND "dynTokens" >= surcharge RETURNING "dynTokens" INTO balance_after;
  IF balance_after IS NULL THEN
    RAISE EXCEPTION 'High-tier upgrade requires an additional % DYN specialization surcharge.', surcharge USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
  VALUES (gen_random_uuid()::text, owner_id, 'DYN', -surcharge, balance_after, 'PROGRESSIVE_FACILITY_UPGRADE', 'STADIUM_UPGRADE', NEW."id",
    jsonb_build_object('upgradeCount', upgrade_count, 'upgradeType', NEW."type"), CURRENT_TIMESTAMP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_progressive_upgrade_surcharge ON "StadiumUpgrade";
CREATE TRIGGER trg_progressive_upgrade_surcharge AFTER INSERT ON "StadiumUpgrade" FOR EACH ROW EXECUTE FUNCTION economy_progressive_upgrade_surcharge();

CREATE OR REPLACE FUNCTION economy_match_completion_costs() RETURNS TRIGGER AS $$
DECLARE
  team_row RECORD;
  week_key TEXT;
  weekly_games INTEGER;
  avg_ovr DOUBLE PRECISION;
  travel_cost INTEGER;
  recovery_cost INTEGER;
  preparation_cost INTEGER;
  total_cost INTEGER;
  actual_cost INTEGER;
  wallet_balance INTEGER;
BEGIN
  IF NOT (OLD."status" IS DISTINCT FROM NEW."status" AND NEW."status" = 'COMPLETED') THEN RETURN NEW; END IF;
  week_key := economy_week_key(COALESCE(NEW."completedAt", CURRENT_TIMESTAMP));

  FOR team_row IN
    SELECT t."id" AS team_id, t."ownerId" AS user_id, t."tier",
      COALESCE((SELECT AVG(p."overall") FROM "TeamPlayer" tp JOIN "Player" p ON p."id" = tp."playerId" WHERE tp."teamId" = t."id"), 50) AS roster_ovr,
      COALESCE((SELECT MAX(ta."operatingCost") FROM "TransportationAsset" ta WHERE ta."teamId" = t."id"), 100) AS transport_cost
    FROM "Team" t WHERE t."id" IN (NEW."homeTeamId", NEW."awayTeamId") AND t."isAI" = false
  LOOP
    SELECT COUNT(*)::int INTO weekly_games FROM "Match" m
      WHERE m."status" = 'COMPLETED' AND m."completedAt" >= COALESCE(NEW."completedAt", CURRENT_TIMESTAMP) - INTERVAL '7 days'
        AND (m."homeTeamId" = team_row.team_id OR m."awayTeamId" = team_row.team_id);
    avg_ovr := team_row.roster_ovr;
    travel_cost := GREATEST(75, team_row.transport_cost);
    recovery_cost := FLOOR(GREATEST(0, avg_ovr - 45) * 5 + GREATEST(0, weekly_games - 8) * 45)::int;
    preparation_cost := FLOOR(100 + GREATEST(0, avg_ovr - 50) * 4 + GREATEST(0, weekly_games - 12) * 80)::int;
    total_cost := travel_cost + recovery_cost + preparation_cost;

    UPDATE "Wallet" SET "cash" = GREATEST(0, "cash" - total_cost), "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = team_row.user_id RETURNING "cash" INTO wallet_balance;
    actual_cost := total_cost;
    INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
      VALUES (gen_random_uuid()::text, team_row.user_id, 'CASH', -actual_cost, wallet_balance, 'MATCH_OPERATING_COST', 'MATCH', NEW."id",
        jsonb_build_object('weeklyGames', weekly_games, 'rosterOverall', ROUND(avg_ovr), 'travel', travel_cost, 'recovery', recovery_cost, 'preparation', preparation_cost), CURRENT_TIMESTAMP);
    INSERT INTO "TeamFinanceSnapshot" ("id", "teamId", "matchId", "category", "expense", "net", "metadata", "createdAt")
      VALUES (gen_random_uuid()::text, team_row.team_id, NEW."id", 'MATCH_OPERATIONS', actual_cost, -actual_cost,
        jsonb_build_object('weeklyGames', weekly_games, 'travel', travel_cost, 'recovery', recovery_cost, 'preparation', preparation_cost), CURRENT_TIMESTAMP);
    INSERT INTO "CompetitiveEconomyWeek" ("userId", "weekKey", "matchesPlayed", "difficultyPoints", "maintenanceCharged", "updatedAt")
      VALUES (team_row.user_id, week_key, 1,
        CASE team_row."tier" WHEN 'PRO_ELITE' THEN 5 WHEN 'PRO_ENTRY' THEN 4 WHEN 'REGIONAL_PRO' THEN 3 WHEN 'TOP_COLLEGE' THEN 2 ELSE 1 END,
        actual_cost, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "weekKey") DO UPDATE SET
        "matchesPlayed" = "CompetitiveEconomyWeek"."matchesPlayed" + 1,
        "difficultyPoints" = "CompetitiveEconomyWeek"."difficultyPoints" + EXCLUDED."difficultyPoints",
        "maintenanceCharged" = "CompetitiveEconomyWeek"."maintenanceCharged" + EXCLUDED."maintenanceCharged",
        "updatedAt" = CURRENT_TIMESTAMP;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_match_completion_costs ON "Match";
CREATE TRIGGER trg_match_completion_costs AFTER UPDATE ON "Match" FOR EACH ROW EXECUTE FUNCTION economy_match_completion_costs();

CREATE OR REPLACE FUNCTION economy_match_reward_soft_cap() RETURNS TRIGGER AS $$
DECLARE
  week_key TEXT;
  matches_played INTEGER;
  multiplier DOUBLE PRECISION;
  clawback INTEGER;
  balance_after INTEGER;
BEGIN
  IF NEW."currency" <> 'CASH' OR NEW."amount" <= 0 THEN RETURN NEW; END IF;
  IF NOT (NEW."reason" ILIKE '%MATCH%REWARD%' OR NEW."reason" ILIKE '%GAME%REWARD%') THEN RETURN NEW; END IF;
  IF NEW."reason" = 'MATCH_REWARD_SOFT_CAP' THEN RETURN NEW; END IF;
  week_key := economy_week_key(NEW."createdAt");
  SELECT COALESCE("matchesPlayed", 0) INTO matches_played FROM "CompetitiveEconomyWeek" WHERE "userId" = NEW."userId" AND "weekKey" = week_key;
  multiplier := CASE WHEN matches_played <= 12 THEN 1.0 WHEN matches_played <= 20 THEN 0.75 WHEN matches_played <= 30 THEN 0.50 ELSE 0.25 END;
  clawback := FLOOR(NEW."amount" * (1 - multiplier))::int;
  IF clawback <= 0 THEN RETURN NEW; END IF;
  UPDATE "Wallet" SET "cash" = GREATEST(0, "cash" - clawback), "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId" RETURNING "cash" INTO balance_after;
  INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
    VALUES (gen_random_uuid()::text, NEW."userId", 'CASH', -clawback, balance_after, 'MATCH_REWARD_SOFT_CAP', 'MATCH', NEW."sourceId",
      jsonb_build_object('weeklyMatches', matches_played, 'multiplier', multiplier, 'originalLedgerId', NEW."id"), CURRENT_TIMESTAMP);
  UPDATE "CompetitiveEconomyWeek" SET "cashRewardGross" = "cashRewardGross" + NEW."amount"::int,
    "cashRewardClawedBack" = "cashRewardClawedBack" + clawback, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = NEW."userId" AND "weekKey" = week_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_match_reward_soft_cap ON "CurrencyLedger";
CREATE TRIGGER trg_match_reward_soft_cap AFTER INSERT ON "CurrencyLedger" FOR EACH ROW EXECUTE FUNCTION economy_match_reward_soft_cap();
