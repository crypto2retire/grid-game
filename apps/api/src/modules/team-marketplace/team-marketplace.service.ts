import { prisma } from '../../config/database';
import { creditCurrency, debitCurrency } from '../economy/currency.service';
import { processTreasuryInflow, processBurn } from '../treasury/treasury.service';

const BURN_PCT = 0.05; // 5% burned (static)
const COOLDOWN_DAYS = 90; // 90-day price floor after initial purchase

/**
 * Calculate foundation tax rate based on days held.
 * Decreasing tax rewards long-term holders, punishes flippers.
 * 0-30 days: 15% | 31-60 days: 12% | 61-90 days: 8% | 90+ days: 5%
 */
export function getFoundationTaxRate(daysHeld: number): number {
  if (daysHeld <= 30) return 0.15;
  if (daysHeld <= 60) return 0.12;
  if (daysHeld <= 90) return 0.08;
  return 0.05;
}

/**
 * Get a human-readable tax tier label.
 */
export function getTaxTierLabel(daysHeld: number): string {
  if (daysHeld <= 30) return 'Short-term Flip';
  if (daysHeld <= 60) return 'Early Seller';
  if (daysHeld <= 90) return 'Hodler';
  return 'Diamond Hands';
}

/**
 * List a team for sale on the marketplace.
 * Tax is calculated dynamically based on how long the seller has held the team.
 */
export async function listTeamForSale(
  sellerId: string,
  teamId: string,
  price: number,
  currency: 'DYN' | 'SOL'
) {
  if (price <= 0) {
    throw new Error('Price must be greater than 0');
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: sellerId },
  });

  if (!team) {
    throw new Error('Team not found or you do not own it');
  }

  if (team.isForSale) {
    throw new Error('Team is already listed for sale');
  }

  // Calculate how long the seller has held this team
  const daysHeld = Math.floor(
    (new Date().getTime() - new Date(team.purchasedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check 90-day price floor (only for initial sale from game)
  const daysSincePurchase = daysHeld;
  if (daysSincePurchase < COOLDOWN_DAYS && team.purchasePrice > 0) {
    const minPrice = Math.floor(team.purchasePrice * 0.75);
    if (price < minPrice) {
      throw new Error(
        `Price floor active. Minimum sale price: ${minPrice.toLocaleString()} ${currency}. ${Math.ceil(COOLDOWN_DAYS - daysSincePurchase)} days remaining.`
      );
    }
  }

  // Dynamic tax calculation based on hold time
  const taxRate = getFoundationTaxRate(daysHeld);
  const foundationTax = Math.floor(price * taxRate);
  const burnAmount = Math.floor(price * BURN_PCT);
  const sellerReceives = price - foundationTax - burnAmount;

  return prisma.$transaction(async (tx: any) => {
    // Mark team as for sale
    await tx.team.update({
      where: { id: teamId },
      data: {
        isForSale: true,
        salePrice: price,
        saleCurrency: currency,
        saleListedAt: new Date(),
      },
    });

    const listing = await tx.teamMarketplaceListing.create({
      data: {
        sellerId,
        teamId,
        price,
        currency,
        foundationTaxPaid: foundationTax,
        burnAmount,
        sellerReceives,
        daysHeld,
        status: 'ACTIVE',
      },
    });

    return {
      listing,
      daysHeld,
      taxRate: parseFloat((taxRate * 100).toFixed(1)),
      taxTier: getTaxTierLabel(daysHeld),
      foundationTax,
      burnAmount,
      sellerReceives,
    };
  });
}

/**
 * Buy a team from the marketplace (player-to-player).
 */
export async function buyTeamFromMarketplace(buyerId: string, listingId: string) {
  const listing = await prisma.teamMarketplaceListing.findFirst({
    where: { id: listingId, status: 'ACTIVE' },
    include: { team: true, seller: { include: { wallet: true } } },
  });

  if (!listing) {
    throw new Error('Listing not found or no longer active');
  }

  if (listing.sellerId === buyerId) {
    throw new Error('Cannot buy your own team');
  }

  const buyerWallet = await prisma.wallet.findUnique({ where: { userId: buyerId } });
  if (!buyerWallet) {
    throw new Error('Buyer wallet not found');
  }

  const price = listing.price;
  const currency = listing.currency as 'DYN' | 'SOL';

  if (currency === 'DYN' && buyerWallet.dynTokens < price) {
    throw new Error(`Insufficient DYN. Need ${price.toLocaleString()} DYN`);
  }
  if (currency === 'SOL' && buyerWallet.solBalance < price) {
    throw new Error(`Insufficient SOL. Need ${price.toLocaleString()} SOL`);
  }

  return prisma.$transaction(async (tx: any) => {
    // Deduct from buyer. Marketplace transfers are token movements, not
    // lifetime earned/spent for the luck system.
    await debitCurrency(tx, {
      userId: buyerId,
      currency,
      amount: price,
      reason: 'MARKETPLACE_TEAM_PURCHASE',
      sourceType: 'MARKETPLACE_TRANSFER',
      sourceId: listingId,
      metadata: { teamId: listing.teamId, sellerId: listing.sellerId, price, currency },
    });

    // Pay seller (net of tax/burn) — AI sales credit the game owner wallet, player resales credit the seller
    if (listing.sellerReceives > 0) {
      await creditCurrency(tx, {
        userId: listing.sellerId,
        currency,
        amount: listing.sellerReceives,
        reason: listing.team.isAI ? 'AI_TEAM_PRIMARY_SALE' : 'MARKETPLACE_TEAM_SALE',
        sourceType: 'MARKETPLACE_TRANSFER',
        sourceId: listingId,
        metadata: { teamId: listing.teamId, buyerId, price: listing.sellerReceives, currency, isAI: listing.team.isAI },
      });
    }

    // Foundation tax (15%) → rewards pool if DYN, operations if SOL
    if (listing.foundationTaxPaid > 0) {
      if (currency === 'DYN') {
        await processTreasuryInflow(tx, 'DYN', Math.round(listing.foundationTaxPaid * 0.5), 'TEAM_MARKETPLACE_TAX', listingId);
        await processBurn(tx, 'DYN', Math.round(listing.foundationTaxPaid * 0.5), 'TEAM_MARKETPLACE_TAX', listingId);
      }
      // SOL tax goes to game operations
    }

    // Burn (5%)
    if (listing.burnAmount > 0 && currency === 'DYN') {
      await processBurn(tx, 'DYN', listing.burnAmount, 'TEAM_MARKETPLACE_BURN', listingId);
    }

    // Transfer team ownership
    await tx.team.update({
      where: { id: listing.teamId },
      data: {
        ownerId: buyerId,
        isForSale: false,
        salePrice: 0,
        purchasePrice: price,
        purchaseCurrency: currency,
        purchasedAt: new Date(),
      },
    });

    // Update listing
    const updatedListing = await tx.teamMarketplaceListing.update({
      where: { id: listingId },
      data: { status: 'SOLD', soldAt: new Date() },
    });

    // Mark buyer as paid if not already
    await tx.user.update({
      where: { id: buyerId },
      data: { hasPaidPurchase: true },
    });

    return { listing: updatedListing, teamId: listing.teamId, price, currency };
  });
}

/**
 * Cancel a team listing.
 */
export async function cancelTeamListing(sellerId: string, listingId: string) {
  const listing = await prisma.teamMarketplaceListing.findFirst({
    where: { id: listingId, sellerId, status: 'ACTIVE' },
  });

  if (!listing) {
    throw new Error('Listing not found or not active');
  }

  return prisma.$transaction(async (tx: any) => {
    await tx.team.update({
      where: { id: listing.teamId },
      data: { isForSale: false, salePrice: 0 },
    });

    return tx.teamMarketplaceListing.update({
      where: { id: listingId },
      data: { status: 'CANCELLED' },
    });
  });
}

/**
 * Get all active team marketplace listings.
 */
export async function getTeamMarketplaceListings(filters?: { tier?: string; sportId?: string }) {
  const where: any = { status: 'ACTIVE' };
  if (filters?.sportId) where.sportId = filters.sportId;

  const listings = await prisma.teamMarketplaceListing.findMany({
    where,
    include: {
      seller: { select: { id: true, username: true, displayName: true } },
      team: {
        select: {
          id: true,
          name: true,
          tier: true,
          sportId: true,
          wins: true,
          losses: true,
          points: true,
          teamPlayers: { include: { player: { select: { id: true, name: true, position: true, overall: true } } } },
          venue: { select: { name: true, capacity: true, tier: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter by tier if specified (need to do in JS since team.tier is a relation field)
  if (filters?.tier) {
    return listings.filter((l: any) => l.team?.tier === filters.tier);
  }

  return listings;
}

/**
 * Get a single marketplace listing with full details.
 */
export async function getTeamMarketplaceListing(listingId: string) {
  return prisma.teamMarketplaceListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: { id: true, username: true, displayName: true } },
      team: {
        include: {
          teamPlayers: { include: { player: true } },
          venue: true,
          transportationAssets: true,
          leagueMemberships: { include: { league: true } },
        },
      },
    },
  });
}

/**
 * Get teams listed for sale by a specific user.
 */
export async function getUserTeamListings(userId: string) {
  return prisma.teamMarketplaceListing.findMany({
    where: { sellerId: userId, status: 'ACTIVE' },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          tier: true,
          teamPlayers: { include: { player: { select: { name: true, overall: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
