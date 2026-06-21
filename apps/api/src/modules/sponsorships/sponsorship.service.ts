import { prisma } from '../../config/database';
import {
  type LeagueTier,
} from '../economy/teamEconomy.config';

// ─── Sponsorship Tier Definitions ───

export const SPONSOR_TIERS = [
  'LOCAL_BUSINESS',
  'REGIONAL_BRAND',
  'NATIONAL_BRAND',
  'GLOBAL_CORP',
] as const;

export type SponsorTier = (typeof SPONSOR_TIERS)[number];

const SPONSOR_NAMES: Record<SponsorTier, string[]> = {
  LOCAL_BUSINESS: [
    "Joe's Diner",
    'Main Street Auto',
    'Community Hardware',
    'Hometown Bakery',
    'Corner Coffee',
    'Family Pizza',
    'Local Gym',
    'Barber Shop',
  ],
  REGIONAL_BRAND: [
    'Statewide Fitness',
    'Regional Bank',
    'Midwest Motors',
    'County Wide Realty',
    'Tri-State Insurance',
  ],
  NATIONAL_BRAND: [
    'SportGear Pro',
    'EnergyMax Drinks',
    'Titan Footwear',
    'Velocity Apparel',
    'Champion Nutrition',
  ],
  GLOBAL_CORP: [
    'Nike',
    'Adidas',
    'Under Armour',
    'Puma',
    'Reebok',
    'New Balance',
  ],
};

const SPONSOR_AMOUNT_PER_GAME: Record<SponsorTier, { min: number; max: number }> = {
  LOCAL_BUSINESS: { min: 50, max: 200 },
  REGIONAL_BRAND: { min: 200, max: 800 },
  NATIONAL_BRAND: { min: 800, max: 3000 },
  GLOBAL_CORP: { min: 3000, max: 10000 },
};

const SPONSOR_AMOUNT_PER_SEASON: Record<SponsorTier, { min: number; max: number }> = {
  LOCAL_BUSINESS: { min: 500, max: 2000 },
  REGIONAL_BRAND: { min: 2000, max: 10000 },
  NATIONAL_BRAND: { min: 10000, max: 50000 },
  GLOBAL_CORP: { min: 50000, max: 200000 },
};

const MAX_ACTIVE_SPONSORS = 3;
const OFFER_EXPIRY_DAYS = 7;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickSponsorTier(leagueTier: LeagueTier): SponsorTier {
  const rand = Math.random();
  switch (leagueTier) {
    case 'LOCAL_REC':
      return rand < 0.7 ? 'LOCAL_BUSINESS' : 'REGIONAL_BRAND';
    case 'REGIONAL':
      return rand < 0.5 ? 'LOCAL_BUSINESS' : rand < 0.85 ? 'REGIONAL_BRAND' : 'NATIONAL_BRAND';
    case 'SEMI_PRO':
      return rand < 0.3 ? 'REGIONAL_BRAND' : rand < 0.75 ? 'NATIONAL_BRAND' : 'GLOBAL_CORP';
    case 'PRO':
      return rand < 0.4 ? 'NATIONAL_BRAND' : 'GLOBAL_CORP';
    default:
      return 'LOCAL_BUSINESS';
  }
}

function generateOfferForTeam(_team: any, leagueTier: LeagueTier) {
  const tier = pickSponsorTier(leagueTier);
  const names = SPONSOR_NAMES[tier];
  const name = names[randomInt(0, names.length - 1)];
  const gameRange = SPONSOR_AMOUNT_PER_GAME[tier];
  const seasonRange = SPONSOR_AMOUNT_PER_SEASON[tier];

  const amountPerGame = randomInt(gameRange.min, gameRange.max);
  const amountPerSeason = randomInt(seasonRange.min, seasonRange.max);

  // Bonus rules based on team performance
  const bonusRules: Record<string, any> = {
    winBonus: Math.round(amountPerGame * 0.2),
    playoffBonus: Math.round(amountPerSeason * 0.3),
    championshipBonus: Math.round(amountPerSeason * 0.5),
  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + OFFER_EXPIRY_DAYS);

  return {
    sponsorName: name,
    tier,
    amountPerGame,
    amountPerSeason,
    bonusRules,
    expiresAt,
  };
}

/**
 * Generate up to 3 sponsorship offers for a team.
 * Considers current league tier, team wins, and venue prestige.
 */
export async function generateSponsorshipOffers(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      venue: true,
      leagueMemberships: { include: { league: true } },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const activeMembership = team.leagueMemberships.find((m: any) => m.status === 'ACTIVE');
  const leagueTier: LeagueTier = (activeMembership?.league?.tier as LeagueTier) || 'LOCAL_REC';

  // Count current active sponsors
  const activeSponsors = await prisma.sponsorship.count({
    where: { teamId, active: true },
  });

  const slotsAvailable = MAX_ACTIVE_SPONSORS - activeSponsors;
  if (slotsAvailable <= 0) {
    return { generated: 0, offers: [], reason: 'Max sponsors reached' };
  }

  // Generate 1-3 offers depending on performance
  const numOffers = Math.min(slotsAvailable, randomInt(1, 3));
  const offers = [];

  for (let i = 0; i < numOffers; i++) {
    const offer = generateOfferForTeam(team, leagueTier);
    offers.push(offer);
  }

  return { generated: offers.length, offers, leagueTier };
}

/**
 * Accept a sponsorship offer and create the Sponsorship record.
 */
export async function acceptSponsorshipOffer(
  teamId: string,
  offer: {
    sponsorName: string;
    tier: string;
    amountPerGame: number;
    amountPerSeason: number;
    bonusRules: Record<string, any>;
  }
) {
  const activeSponsors = await prisma.sponsorship.count({
    where: { teamId, active: true },
  });

  if (activeSponsors >= MAX_ACTIVE_SPONSORS) {
    throw new Error('Maximum active sponsors reached');
  }

  return prisma.sponsorship.create({
    data: {
      teamId,
      sponsorName: offer.sponsorName,
      amountPerGame: offer.amountPerGame,
      amountPerSeason: offer.amountPerSeason,
      bonusRules: offer.bonusRules,
      active: true,
    },
  });
}

/**
 * Cancel / deactivate a sponsorship.
 */
export async function cancelSponsorship(teamId: string, sponsorshipId: string) {
  const sponsorship = await prisma.sponsorship.findFirst({
    where: { id: sponsorshipId, teamId },
  });

  if (!sponsorship) {
    throw new Error('Sponsorship not found');
  }

  return prisma.sponsorship.update({
    where: { id: sponsorshipId },
    data: { active: false },
  });
}

/**
 * Get all sponsorships for a team.
 */
export async function getTeamSponsorships(teamId: string) {
  return prisma.sponsorship.findMany({
    where: { teamId },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  });
}
