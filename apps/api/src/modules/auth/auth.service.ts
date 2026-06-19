import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { RegisterInput, LoginInput } from './auth.schema';

export const SALT_ROUNDS = 12;

export const generateToken = (user: { id: string; email: string; username: string; role: string }): string => {
  const secret = env.JWT_SECRET || 'fallback-secret-for-dev-only';
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    secret,
    { expiresIn: env.JWT_EXPIRES_IN }
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

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      password: hashedPassword,
      displayName: input.displayName || input.username,
      wallet: {
        create: {
          cash: 50000,
          gridTokens: 0,
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

  const token = generateToken(user);

  return { user, token };
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
