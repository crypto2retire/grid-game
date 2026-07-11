-- Follow-up accounting fixes for Economy Balance V2.

CREATE OR REPLACE FUNCTION economy_record_seller_sale() RETURNS TRIGGER AS $$
DECLARE
  sale_volume DOUBLE PRECISION;
  week_key TEXT;
  xp_gain INTEGER;
  season_gain INTEGER;
  dyn_balance INTEGER;
  benefit_tier INTEGER;
  rebate_rate DOUBLE PRECISION;
  rebate_amount DOUBLE PRECISION;
  balance_after DOUBLE PRECISION;
BEGIN
  IF NEW."amount" <= 0 OR NEW."reason" NOT LIKE '%\_SALE' ESCAPE '\' OR NEW."reason" = 'SELLER_FEE_REBATE' THEN RETURN NEW; END IF;
  IF COALESCE(NEW."sourceType", '') NOT ILIKE '%MARKET%' THEN RETURN NEW; END IF;

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
  UPDATE "SellerProfile" SET "reputationLevel" = economy_reputation_level("reputationXp") WHERE "userId" = NEW."userId";

  INSERT INTO "SellerWeeklyObjective" ("userId", "weekKey", "salesProgress", "volumeProgress", "updatedAt")
  VALUES (NEW."userId", week_key, 1, sale_volume, CURRENT_TIMESTAMP)
  ON CONFLICT ("userId", "weekKey") DO UPDATE SET
    "salesProgress" = "SellerWeeklyObjective"."salesProgress" + 1,
    "volumeProgress" = "SellerWeeklyObjective"."volumeProgress" + EXCLUDED."volumeProgress",
    "updatedAt" = CURRENT_TIMESTAMP;
  UPDATE "SellerWeeklyObjective" SET "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP)
  WHERE "userId" = NEW."userId" AND "weekKey" = week_key
    AND "salesProgress" >= "salesTarget" AND "volumeProgress" >= "volumeTarget";

  UPDATE "RetentionProfile" SET "seasonXp" = "seasonXp" + season_gain, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId";

  SELECT COALESCE("dynTokens", 0) INTO dyn_balance FROM "Wallet" WHERE "userId" = NEW."userId";
  benefit_tier := economy_dyn_benefit_tier(COALESCE(dyn_balance, 0));
  rebate_rate := CASE benefit_tier WHEN 3 THEN 0.025 WHEN 2 THEN 0.015 WHEN 1 THEN 0.0075 ELSE 0 END;
  rebate_amount := CASE WHEN NEW."currency" = 'SOL' THEN ROUND((sale_volume * rebate_rate)::numeric, 9)::double precision ELSE FLOOR(sale_volume * rebate_rate) END;

  IF rebate_amount > 0 THEN
    IF NEW."currency" = 'DYN' THEN
      UPDATE "Wallet" SET "dynTokens" = "dynTokens" + rebate_amount::int, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId" RETURNING "dynTokens" INTO balance_after;
    ELSIF NEW."currency" = 'SOL' THEN
      UPDATE "Wallet" SET "solBalance" = "solBalance" + rebate_amount, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId" RETURNING "solBalance" INTO balance_after;
    ELSE
      UPDATE "Wallet" SET "cash" = "cash" + rebate_amount::int, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId" RETURNING "cash" INTO balance_after;
    END IF;
    INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
    VALUES (gen_random_uuid()::text, NEW."userId", NEW."currency", rebate_amount, balance_after, 'SELLER_FEE_REBATE', 'SELLER_PROGRESSION', NEW."sourceId",
      jsonb_build_object('benefitTier', benefit_tier, 'sourceSaleLedgerId', NEW."id"), CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION economy_match_completion_costs() RETURNS TRIGGER AS $$
DECLARE
  team_row RECORD;
  week_key TEXT;
  weekly_games INTEGER;
  avg_ovr DOUBLE PRECISION;
  travel_cost INTEGER;
  recovery_cost INTEGER;
  preparation_cost INTEGER;
  specialization_cash INTEGER;
  specialization_dyn INTEGER;
  requested_cash INTEGER;
  actual_cash INTEGER;
  actual_dyn INTEGER;
  cash_before INTEGER;
  cash_after INTEGER;
  dyn_before INTEGER;
  dyn_after INTEGER;
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

    SELECT COALESCE(CEIL(SUM("maintenanceCash") / 8.0), 0)::int, COALESCE(CEIL(SUM("maintenanceDyn") / 8.0), 0)::int
      INTO specialization_cash, specialization_dyn FROM "FacilitySpecialization" WHERE "teamId" = team_row.team_id;

    avg_ovr := team_row.roster_ovr;
    travel_cost := GREATEST(75, team_row.transport_cost);
    recovery_cost := FLOOR(GREATEST(0, avg_ovr - 45) * 5 + GREATEST(0, weekly_games - 8) * 45)::int;
    preparation_cost := FLOOR(100 + GREATEST(0, avg_ovr - 50) * 4 + GREATEST(0, weekly_games - 12) * 80)::int;
    requested_cash := travel_cost + recovery_cost + preparation_cost + specialization_cash;

    SELECT "cash", "dynTokens" INTO cash_before, dyn_before FROM "Wallet" WHERE "userId" = team_row.user_id FOR UPDATE;
    actual_cash := LEAST(GREATEST(0, COALESCE(cash_before, 0)), requested_cash);
    actual_dyn := LEAST(GREATEST(0, COALESCE(dyn_before, 0)), specialization_dyn);
    UPDATE "Wallet" SET "cash" = "cash" - actual_cash, "dynTokens" = "dynTokens" - actual_dyn, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = team_row.user_id RETURNING "cash", "dynTokens" INTO cash_after, dyn_after;

    IF actual_cash > 0 THEN
      INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
      VALUES (gen_random_uuid()::text, team_row.user_id, 'CASH', -actual_cash, cash_after, 'MATCH_OPERATING_COST', 'MATCH', NEW."id",
        jsonb_build_object('weeklyGames', weekly_games, 'rosterOverall', ROUND(avg_ovr), 'travel', travel_cost, 'recovery', recovery_cost, 'preparation', preparation_cost, 'specializationUpkeep', specialization_cash, 'requested', requested_cash), CURRENT_TIMESTAMP);
    END IF;
    IF actual_dyn > 0 THEN
      INSERT INTO "CurrencyLedger" ("id", "userId", "currency", "amount", "balanceAfter", "reason", "sourceType", "sourceId", "metadata", "createdAt")
      VALUES (gen_random_uuid()::text, team_row.user_id, 'DYN', -actual_dyn, dyn_after, 'FACILITY_SPECIALIZATION_UPKEEP', 'MATCH', NEW."id",
        jsonb_build_object('weeklyGames', weekly_games, 'requested', specialization_dyn), CURRENT_TIMESTAMP);
    END IF;

    INSERT INTO "TeamFinanceSnapshot" ("id", "teamId", "matchId", "category", "expense", "net", "metadata", "createdAt")
    VALUES (gen_random_uuid()::text, team_row.team_id, NEW."id", 'MATCH_OPERATIONS', actual_cash, -actual_cash,
      jsonb_build_object('weeklyGames', weekly_games, 'travel', travel_cost, 'recovery', recovery_cost, 'preparation', preparation_cost, 'specializationUpkeepCash', specialization_cash, 'specializationUpkeepDyn', actual_dyn), CURRENT_TIMESTAMP);

    INSERT INTO "CompetitiveEconomyWeek" ("userId", "weekKey", "matchesPlayed", "difficultyPoints", "maintenanceCharged", "updatedAt")
    VALUES (team_row.user_id, week_key, 1,
      CASE team_row."tier" WHEN 'PRO_ELITE' THEN 5 WHEN 'PRO_ENTRY' THEN 4 WHEN 'REGIONAL_PRO' THEN 3 WHEN 'TOP_COLLEGE' THEN 2 ELSE 1 END,
      actual_cash, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "weekKey") DO UPDATE SET
      "matchesPlayed" = "CompetitiveEconomyWeek"."matchesPlayed" + 1,
      "difficultyPoints" = "CompetitiveEconomyWeek"."difficultyPoints" + EXCLUDED."difficultyPoints",
      "maintenanceCharged" = "CompetitiveEconomyWeek"."maintenanceCharged" + EXCLUDED."maintenanceCharged",
      "updatedAt" = CURRENT_TIMESTAMP;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
