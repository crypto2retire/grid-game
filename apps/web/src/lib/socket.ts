import { io } from 'socket.io-client';

function normalizeSocketOrigin(rawBase?: string): string {
  const trimmed = (rawBase || '').trim();
  if (!trimmed || trimmed.startsWith('/')) return window.location.origin;
  return trimmed.replace(/\/api\/?$/, '').replace(/\/+$/, '');
}

const SOCKET_ORIGIN = normalizeSocketOrigin(import.meta.env.VITE_API_URL);

export const socket = io(SOCKET_ORIGIN, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export function connectSocket(token: string) {
  if (socket.connected) return;
  socket.auth = { token };
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}

export function subscribeToMatch(matchId: string) {
  socket.emit('match:subscribe', { matchId });
}

export function unsubscribeFromMatch(matchId: string) {
  socket.emit('match:unsubscribe', { matchId });
}

export function sendAvatarMove(x: number, y: number, targetX = x, targetY = y) {
  socket.emit('world:avatar:move', { x, y, targetX, targetY });
}
