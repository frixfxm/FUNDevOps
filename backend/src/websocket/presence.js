import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const onlineUsers = new Map();

const groupCallRooms = new Map();

function generateRoomId() {
  return 'room_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function removeUserFromAllRooms(userId) {
  for (const [roomId, room] of groupCallRooms.entries()) {
    if (room.joined.has(userId)) {
      room.joined.delete(userId);
      for (const uid of room.joined) {
        if (uid !== userId) {
          const peerSet = onlineUsers.get(uid);
          if (peerSet) {
            const payload = JSON.stringify({ type: 'group_call_participant_left', roomId, userId });
            for (const peerWs of peerSet) {
              if (peerWs.readyState === 1) peerWs.send(payload);
            }
          }
        }
      }
      if (room.joined.size === 0) groupCallRooms.delete(roomId);
    }
  }
}

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
              sdp: data.sdp,
              isVideo: data.isVideo === true
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
          } else if (data.type === 'group_call_create' && Array.isArray(data.participantIds)) {
            const participantIds = data.participantIds.filter((id) => typeof id === 'number' && id !== userId);
            const roomId = generateRoomId();
            const joined = new Set([userId]);
            groupCallRooms.set(roomId, {
              creatorId: userId,
              participantIds: [...new Set(participantIds)],
              joined
            });
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'group_call_created', roomId, participantIds }));
            }
            const invitePayload = { type: 'group_call_invite', roomId, fromUserId: userId, isVideo: data.isVideo === true };
            participantIds.forEach((pid, index) => {
              const delay = index * 80;
              if (delay === 0) {
                sendToUser(pid, invitePayload);
              } else {
                setTimeout(() => sendToUser(pid, invitePayload), delay);
              }
            });
          } else if (data.type === 'group_call_join' && typeof data.roomId === 'string') {
            const room = groupCallRooms.get(data.roomId);
            if (room && !room.joined.has(userId)) {
              room.joined.add(userId);
              const participants = Array.from(room.joined).filter((id) => id !== userId);
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'group_call_room_state', roomId: data.roomId, participants }));
              }
              const joinedPayload = { type: 'group_call_participant_joined', roomId: data.roomId, userId };
              const toNotify = Array.from(room.joined).filter((uid) => uid !== userId);
              toNotify.forEach((uid, index) => {
                if (index === 0) {
                  sendToUser(uid, joinedPayload);
                } else {
                  setTimeout(() => sendToUser(uid, joinedPayload), index * 50);
                }
              });
            }
          } else if (data.type === 'group_call_reject' && typeof data.roomId === 'string') {
            const room = groupCallRooms.get(data.roomId);
            if (room && room.creatorId) {
              sendToUser(room.creatorId, { type: 'group_call_participant_declined', roomId: data.roomId, userId });
            }
          } else if (data.type === 'group_call_leave' && typeof data.roomId === 'string') {
            const room = groupCallRooms.get(data.roomId);
            if (room && room.joined.has(userId)) {
              room.joined.delete(userId);
              for (const uid of room.joined) {
                sendToUser(uid, { type: 'group_call_participant_left', roomId: data.roomId, userId });
              }
              if (room.joined.size === 0) groupCallRooms.delete(data.roomId);
            }
          } else if (data.type === 'group_call_offer' && typeof data.roomId === 'string' && typeof data.toUserId === 'number' && data.sdp) {
            const room = groupCallRooms.get(data.roomId);
            if (room && room.joined.has(userId) && room.joined.has(data.toUserId)) {
              sendToUser(data.toUserId, { type: 'group_call_offer', roomId: data.roomId, fromUserId: userId, sdp: data.sdp, isVideo: data.isVideo === true });
            }
          } else if (data.type === 'group_call_answer' && typeof data.roomId === 'string' && typeof data.toUserId === 'number' && data.sdp) {
            const room = groupCallRooms.get(data.roomId);
            if (room && room.joined.has(userId) && room.joined.has(data.toUserId)) {
              sendToUser(data.toUserId, { type: 'group_call_answer', roomId: data.roomId, fromUserId: userId, sdp: data.sdp });
            }
          } else if (data.type === 'group_call_ice' && typeof data.roomId === 'string' && typeof data.toUserId === 'number' && data.candidate != null) {
            const room = groupCallRooms.get(data.roomId);
            if (room && room.joined.has(userId) && room.joined.has(data.toUserId)) {
              sendToUser(data.toUserId, { type: 'group_call_ice', roomId: data.roomId, fromUserId: userId, candidate: data.candidate });
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
      removeUserFromAllRooms(userId);
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
