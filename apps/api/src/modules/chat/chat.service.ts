import { prisma } from '../../config/database';

export interface ChatMessagePayload {
  id: string;
  channel: string;
  worldId: string;
  userId: string;
  user: string;
  username: string;
  msg: string;
  message: string;
  createdAt: string;
}

const ALLOWED_CHANNELS = new Set(['Realm', 'Global', 'Trade', 'Club']);

function normalizeChannel(channel?: string): string {
  if (!channel) return 'Realm';
  const normalized = channel.trim();
  return ALLOWED_CHANNELS.has(normalized) ? normalized : 'Realm';
}

function cleanMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function formatChatMessage(message: any): ChatMessagePayload {
  return {
    id: message.id,
    channel: message.channel,
    worldId: message.worldId,
    userId: message.userId,
    user: message.usernameSnapshot,
    username: message.usernameSnapshot,
    msg: message.message,
    message: message.message,
    createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
  };
}

export async function getRecentChatMessages(channel = 'Realm', limit = 50, worldId = 'grid-city') {
  const messages = await prisma.chatMessage.findMany({
    where: { channel: normalizeChannel(channel), worldId },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 100)),
  });
  return messages.reverse().map(formatChatMessage);
}

export async function createChatMessage(input: {
  userId: string;
  username: string;
  channel?: string;
  message: string;
  worldId?: string;
}) {
  const message = cleanMessage(input.message);
  if (!message) {
    throw new Error('Message cannot be empty');
  }

  const saved = await prisma.chatMessage.create({
    data: {
      channel: normalizeChannel(input.channel),
      worldId: input.worldId ?? 'grid-city',
      userId: input.userId,
      usernameSnapshot: input.username,
      message,
    },
  });

  return formatChatMessage(saved);
}
