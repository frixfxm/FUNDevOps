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
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    let token = url.searchParams.get('token');
    let userId = null;

    function attachUser(uid) {
      userId = uid;
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
    }

    function handleMessage(raw) {
      try {
        const data = JSON.parse(raw.toString());
        if (userId != null) {
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
          return;
        }
        if (data.type === 'auth' && typeof data.token === 'string') {
          authTimeoutRef && clearTimeout(authTimeoutRef);
          const payload = jwt.verify(data.token, env.jwtSecret);
          attachUser(Number(payload.sub));
        }
      } catch {}
    }

    let authTimeoutRef = null;
    function handleClose() {
      if (authTimeoutRef) clearTimeout(authTimeoutRef);
      if (userId == null) return;
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          onlineUsers.delete(userId);
          broadcastPresence(userId, false);
        }
      }
    }

    if (token) {
      try {
        const payload = jwt.verify(token, env.jwtSecret);
        attachUser(Number(payload.sub));
      } catch {
        ws.close(4002, 'invalid token');
        return;
      }
    } else {
      authTimeoutRef = setTimeout(() => {
        authTimeoutRef = null;
        if (userId == null) ws.close(4001, 'auth required');
      }, 8000);
    }

    ws.on('message', handleMessage);
    ws.on('close', handleClose);
  });
}
