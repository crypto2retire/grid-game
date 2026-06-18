import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export function connectSocket(token: string) {
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
