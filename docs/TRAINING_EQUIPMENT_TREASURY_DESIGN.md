# Training, Equipment & Treasury System Design

## Overview

This document designs the player improvement, equipment, and treasury system for GRID.

## Core Principles

1. **All in-game currency stays in the game or is burned** — no external selling
2. **Game profits come from SOLANA** — new item sales, trading fees
3. **Training packages use GRID tokens** — 90% to treasury, 10% burned
4. **Whale purchases use SOLANA** — pro teams, stadiums, large items
5. **Treasury funds league expenses** — distributed back to teams as revenue
6. **Initial purchases = game profit** — resales have 5% tax

## Currency Flow

```
User buys Training Package (GRID)
  ├── 90% → Game Treasury
  └── 10% → Burned

Treasury distributes funds
  └── League Rewards → Teams

User buys Pro Team/Stadium (SOLANA)
  └── 100% → Game Profit (SOL wallet)

User resells whale item (SOLANA)
  ├── 95% → Seller
  └── 5% Tax
       ├── 90% of tax → Game Treasury (SOL)
       └── 10% of tax → Burned

Trading fees (SOLANA)
  └── 100% → Game Profit
```

## Database Schema Additions

### TrainingPackage
- `id`, `name`, `description`, `focusType` (POSITION_GROUP | INDIVIDUAL | OFFENSE | DEFENSE)
- `targetPosition` (optional, for POSITION_GROUP)
- `durationDays`, `costGrid`, `costCash`
- `statBoosts`: { pace: +2, shooting: +1, ... }
- `maxUsesPerPlayer`, `cooldownHours`

### PlayerTraining
- `id`, `playerId`, `teamId`, `trainingPackageId`
- `startedAt`, `completedAt`, `status` (ACTIVE | COMPLETED | CANCELLED)
- `statImprovements`: JSON of actual improvements applied

### EquipmentType (Catalog)
- `id`, `name`, `category` (TRAINING | FACILITY | MEDICAL | ANALYSIS)
- `tier`, `baseCostGrid`, `baseCostCash`, `description`
- `effects`: { trainingBoost: 0.15, fatigueReduction: 5, ... }
- `upgradeFromId` (optional, for upgrade paths)

### TeamEquipment
- `id`, `teamId`, `equipmentTypeId`, `level`, `purchasedAt`
- `activeEffects`: JSON of current effects at this level

### GameTreasury
- `id`, `currency` (GRID | CASH | SOL)
- `balance`, `totalInflows`, `totalOutflows`, `totalBurned`
- `lastUpdatedAt`

### TreasuryTransaction
- `id`, `treasuryId`, `type` (INFLOW | OUTFLOW | BURN)
- `amount`, `currency`, `reason`, `sourceType`, `sourceId`
- `metadata`, `createdAt`

### SolanaPurchase
- `id`, `userId`, `type` (TEAM | STADIUM | FACILITY | EQUIPMENT)
- `itemId`, `purchasePriceSol`, `isInitialSale` (true = game profit)
- `resaleTaxPaid`, `createdAt`

## Training Mechanics

### Focus Types
1. **Position Group**: QB, RB, WR, TE, OL, DL, LB, CB, S, K
2. **Individual**: Single player, double effect
3. **Offense**: QB, RB, WR, TE, OL — all get partial boost
4. **Defense**: DL, LB, CB, S — all get partial boost

### Stat Improvements
- Training improves base stats (pace, shooting, passing, etc.)
- Each point of improvement costs more as the player gets better
- Diminishing returns: +10 to a 50-stat is cheap, +10 to a 90-stat is expensive
- Equipment can boost training effectiveness

### Example Packages
| Package | Focus | Duration | Cost (GRID) | Effect |
|---------|-------|----------|-------------|--------|
| QB Camp | Position: QB | 7 days | 500 | +3 passing, +2 pace |
| Offense Blitz | Offense | 7 days | 1,000 | All offense +1 to main stat |
| Elite Individual | Individual | 14 days | 2,000 | +5 to chosen stat |
| Strength & Conditioning | All | 7 days | 300 | +1 physical all players |

## Equipment System

### Categories
1. **Training**: Weights, sleds, agility ladders — boost training effectiveness
2. **Facility**: Video analysis, recovery rooms — reduce fatigue, improve form
3. **Medical**: Training staff, sports medicine — reduce injury risk, faster recovery
4. **Analysis**: Scouting software, analytics — improve player evaluation

### Upgrade Path Example
| Tier | Name | Cost | Effect |
|------|------|------|--------|
| 1 | Basic Weights | 1,000 CASH | +5% training effectiveness |
| 2 | Power Rack | 5,000 CASH | +10% training effectiveness |
| 3 | Full Gym | 15,000 GRID | +15% training effectiveness, +5% injury prevention |

## Treasury Mechanics

### Inflows
- Training package purchases (90% of GRID cost)
- Resale taxes (90% of 5% SOL tax)
- Trading fees (SOL)
- New item sales (SOL)

### Outflows
- League result rewards (distributed to teams)
- Standing bonuses
- Playoff bonuses
- Tournament prizes

### Burn Mechanism
- 10% of all training package purchases burned
- 10% of all resale taxes burned
- Burned tokens are removed from total supply

## SOLANA Whale Purchase System

### Items Purchasable with SOLANA
- Pro Teams (rare franchises)
- Stadiums (tiers 4-5)
- Charter flights / Team aircraft
- Premium equipment (tiers 4-5)
- Exclusive player skins / cosmetics

### Initial Sale vs Resale
- **Initial Sale**: 100% to game (profit). No tax.
- **Resale**: 5% tax on transaction
  - 90% of tax → Game treasury (SOL)
  - 10% of tax → Burned

### Example
- Pro Team Stadium: 50 SOL initial sale → Game receives 50 SOL
- User resells for 60 SOL → 3 SOL tax (5%)
  - 2.7 SOL to game treasury
  - 0.3 SOL burned
  - Seller receives 57 SOL
