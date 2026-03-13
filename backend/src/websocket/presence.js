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

    function sendToUser(targetUserId, payload) {
      if (targetUserId === userId) return;
      const peerSet = onlineUsers.get(targetUserId);
      if (peerSet) {
        const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
        for (const peerWs of peerSet) {
          if (peerWs.readyState === 1) peerWs.send(str);
        }
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
            sendToUser(peerId, { type: 'typing', userId: senderId });
          } else if (data.type === 'call_offer' && typeof data.toUserId === 'number' && data.sdp) {
            sendToUser(data.toUserId, {
              type: 'call_offer',
              fromUserId: userId,
              sdp: data.sdp
            });
          } else if (data.type === 'call_answer' && typeof data.toUserId === 'number' && data.sdp) {
            sendToUser(data.toUserId, {
              type: 'call_answer',
              fromUserId: userId,
              sdp: data.sdp
            });
          } else if (data.type === 'call_reject' && typeof data.toUserId === 'number') {
            sendToUser(data.toUserId, { type: 'call_reject', fromUserId: userId });
          } else if (data.type === 'call_end' && typeof data.toUserId === 'number') {
            sendToUser(data.toUserId, { type: 'call_end', fromUserId: userId });
          } else if (data.type === 'call_ice' && typeof data.toUserId === 'number' && data.candidate != null) {
            sendToUser(data.toUserId, {
              type: 'call_ice',
              fromUserId: userId,
              candidate: data.candidate
            });
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
