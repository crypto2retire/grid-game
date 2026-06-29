import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { RegisterInput, LoginInput } from './auth.schema';
import { generatePlayerData } from '../players/player.generator';
import { giveStarterEquipment } from '../market/seed';

export const SALT_ROUNDS = 12;

const footballPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const generateToken = (user: { id: string; email: string; username: string; role: string }): string => {
  const secret = env.JWT_SECRET || 'fallback-secret-for-dev-only';
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    secret,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );
};

export const register = async (input: RegisterInput): Promise<{ user: object; token: string }> => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
    },
  });

  if (existingUser) {
    throw new AppError(409, 'Email or username already exists');
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const STARTING_CASH = 1000;

  const result = await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        username: input.username,
        password: hashedPassword,
        displayName: input.displayName || input.username,
        wallet: {
          create: {
            cash: STARTING_CASH,
            gridTokens: 0,
          },
        },
        currencyLedger: {
          create: {
            currency: 'CASH',
            amount: STARTING_CASH,
            balanceAfter: STARTING_CASH,
            reason: 'STARTING_BALANCE',
            sourceType: 'AUTH_REGISTER',
            metadata: { note: 'Initial wallet balance for new player' },
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });

    // ─── Auto-create free State College team ───
    const teamName = `${input.username}'s State College`;
    const team = await tx.team.create({
      data: {
        name: teamName,
        sportId: 'american-football',
        ownerId: user.id,
        tier: 'STATE_COLLEGE',
        isFree: true,
        purchasePrice: 0,
        purchaseCurrency: 'FREE',
        formation: '4-3-3',
        tactics: { formation: '4-3-3', sportId: 'american-football' },
      },
    });

    // Create free venue
    await tx.venue.create({
      data: {
        teamId: team.id,
        ownerId: user.id, // Player owns their stadium from day one
        sportId: 'american-football',
        name: `${teamName} Field`,
        tier: 'PARK_FIELD',
        capacity: 5000,
        ticketPrice: 8,
        condition: 70,
        prestige: 10,
      },
    });

    // Create starter transportation
    await tx.transportationAsset.create({
      data: {
        teamId: team.id,
        ownerId: user.id, // Player owns their transport from day one
        tier: 'CARPOOL',
        name: 'Carpool / Rental Vans',
        operatingCost: 100,
        fatigueReduction: 0,
        prestige: 0,
      },
    });

    // Join local rec league
    await tx.teamLeagueMembership.create({
      data: {
        teamId: team.id,
        leagueId: 'local-rec-football',
        season: 'beta',
        status: 'ACTIVE',
      },
    });

    // Generate 18 players for the free team (65-72 OVR range, age 18-20)
    const players = [];
    for (let i = 0; i < 18; i++) {
      const pos = footballPositions[i % footballPositions.length];
      const data = generatePlayerData({ sportId: 'american-football', position: pos });
      // Force stats into 65-72 range for free team, age 18-20
      const targetOverall = randomInt(65, 72);
      const spread = targetOverall - 50;
      const adjusted = {
        ...data,
        age: randomInt(18, 20),
        health: 100,
        injuryStatus: 'HEALTHY' as any,
        injuryWeeks: 0,
        pace: Math.min(99, Math.max(50, 50 + spread + randomInt(-3, 3))),
        shooting: Math.min(99, Math.max(50, 50 + spread + randomInt(-3, 3))),
        passing: Math.min(99, Math.max(50, 50 + spread + randomInt(-3, 3))),
        dribbling: Math.min(99, Math.max(50, 50 + spread + randomInt(-3, 3))),
        defending: Math.min(99, Math.max(50, 50 + spread + randomInt(-3, 3))),
        physical: Math.min(99, Math.max(50, 50 + spread + randomInt(-3, 3))),
      };
      adjusted.overall = Math.round((adjusted.pace + adjusted.shooting + adjusted.passing + adjusted.dribbling + adjusted.defending + adjusted.physical) / 6);
      adjusted.basePrice = adjusted.overall * 100;

      const player = await tx.player.create({
        data: {
          ...adjusted,
          attributes: {
            ...adjusted.attributes,
            legacy: { pace: adjusted.pace, shooting: adjusted.shooting, passing: adjusted.passing, dribbling: adjusted.dribbling, defending: adjusted.defending, physical: adjusted.physical, goalkeeping: 0 },
          },
        } as any,
      });
      players.push(player);

      // Mark first 11 as starters
      await tx.teamPlayer.create({
        data: {
          teamId: team.id,
          playerId: player.id,
          isStarter: i < 11,
        },
      });
    }

    return { user, team };
  });

  // Give starter equipment to all players on the new team
  await giveStarterEquipment(prisma, result.team.id);

  const token = generateToken(result.user);

  return { user: result.user, token };
};

export const login = async (input: LoginInput): Promise<{ user: object; token: string }> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password);

  if (!isValidPassword) {
    throw new AppError(401, 'Invalid email or password');
  }

  const userResponse = {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };

  const token = generateToken(userResponse);

  return { user: userResponse, token };
};

export const getMe = async (userId: string): Promise<object> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatar: true,
      role: true,
      createdAt: true,
      wallet: {
        select: {
          cash: true,
          gridTokens: true,
        },
      },
      teams: {
        select: {
          id: true,
          name: true,
          wins: true,
          draws: true,
          losses: true,
          points: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
};
