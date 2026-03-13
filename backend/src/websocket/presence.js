import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const onlineUsers = new Map();

function broadcastPresence(userId, online) {
  const payload = JSON.stringify({ type: 'presence', userId, online });
  for (const set of onlineUsers.values()) {
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

export function setupPresenceWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/presence' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    let userId = null;

    try {
      if (!token) {
        ws.close(4001, 'token required');
        return;
      }
      const payload = jwt.verify(token, env.jwtSecret);
      userId = Number(payload.sub);
    } catch {
      ws.close(4002, 'invalid token');
      return;
    }

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(ws);
    ws.userId = userId;
    broadcastPresence(userId, true);

    const currentOnlineIds = Array.from(onlineUsers.keys());
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'online_list', userIds: currentOnlineIds }));
    }

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'typing' && typeof data.peerId === 'number') {
          const peerId = data.peerId;
          const senderId = ws.userId;
          if (senderId === peerId) return;
          const peerSet = onlineUsers.get(peerId);
          if (peerSet) {
            const payload = JSON.stringify({ type: 'typing', userId: senderId });
            for (const peerWs of peerSet) {
              if (peerWs.readyState === 1) peerWs.send(payload);
            }
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          onlineUsers.delete(userId);
          broadcastPresence(userId, false);
        }
      }
    });
  });
}
