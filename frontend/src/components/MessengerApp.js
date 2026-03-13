'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getPresenceWsUrl } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

function formatTime(dateString) {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const MOBILE_BREAKPOINT = 768;

export default function MessengerApp() {
  const router = useRouter();
  const { addToast } = useToast();
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [typingUserId, setTypingUserId] = useState(null);
  const wsRef = useRef(null);
  const [wsReconnectKey, setWsReconnectKey] = useState(0);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSendTimeoutRef = useRef(null);
  const lastSeenRef = useRef({});
  const prevUnreadRef = useRef({});
  const newMessageAudioRef = useRef(null);
  const prevMessagesRef = useRef([]);

  const [showMicBanner, setShowMicBanner] = useState(false);
  const [micPermissionRequested, setMicPermissionRequested] = useState(false);
  const [incomingCallFrom, setIncomingCallFrom] = useState(null);
  const [incomingOfferSdp, setIncomingOfferSdp] = useState(null);
  const [callingUserId, setCallingUserId] = useState(null);
  const [inCallWithUserId, setInCallWithUserId] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const ringtoneRef = useRef(null);
  const ringbackRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const callTargetUserIdRef = useRef(null);
  const inCallPeerRef = useRef(null);
  const pendingIceRef = useRef([]);
  const conversationsRef = useRef([]);
  const searchResultsRef = useRef([]);
  const callingUserIdRef = useRef(null);
  const inCallWithUserIdRef = useRef(null);
  const incomingCallFromRef = useRef(null);

  useEffect(() => {
    conversationsRef.current = conversations;
    searchResultsRef.current = searchResults;
  }, [conversations, searchResults]);

  useEffect(() => {
    return () => cleanupCall();
  }, []);

  useEffect(() => {
    callingUserIdRef.current = callingUserId;
    inCallWithUserIdRef.current = inCallWithUserId;
    incomingCallFromRef.current = incomingCallFrom;
  }, [callingUserId, inCallWithUserId, incomingCallFrom]);

  const isUserOnline = useCallback((userId) => onlineUserIds.has(userId), [onlineUserIds]);

  const [selectedUserFromSearch, setSelectedUserFromSearch] = useState(null);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedUserId, mobileShowChat]);

  useEffect(() => {
    setTypingUserId(null);
  }, [selectedUserId]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    const fromConv = conversations.find((u) => u.id === selectedUserId);
    if (fromConv) return fromConv;
    const fromSearch = searchResults.find((u) => u.id === selectedUserId);
    if (fromSearch) return fromSearch;
    return selectedUserFromSearch?.id === selectedUserId ? selectedUserFromSearch : null;
  }, [conversations, searchResults, selectedUserId, selectedUserFromSearch]);

  const sidebarList = useMemo(() => {
    if (searchQuery.trim()) return searchResults;
    if (!selectedUserId) return conversations;
    const inConv = conversations.some((c) => c.id === selectedUserId);
    if (inConv) return conversations;
    if (selectedUserFromSearch?.id === selectedUserId) {
      return [...conversations, selectedUserFromSearch];
    }
    return conversations;
  }, [searchQuery, searchResults, conversations, selectedUserId, selectedUserFromSearch]);

  useEffect(() => {
    const savedToken = localStorage.getItem('messenger_token');
    const savedUser = localStorage.getItem('messenger_user');

    if (!savedToken || !savedUser) {
      router.replace('/login');
      return;
    }

    setToken(savedToken);
    setCurrentUser(JSON.parse(savedUser));
  }, [router]);

  useEffect(() => {
    newMessageAudioRef.current = new Audio('/sounds/new-message-for-you-man.mp3');
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const asked = sessionStorage.getItem('messenger_mic_permission_asked');
    if (!asked) {
      setShowMicBanner(true);
    }
  }, [currentUser]);

  async function requestMicPermission() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      sessionStorage.setItem('messenger_mic_permission_asked', '1');
      setShowMicBanner(false);
      setMicPermissionRequested(true);
    } catch {
      setShowMicBanner(false);
      sessionStorage.setItem('messenger_mic_permission_asked', '1');
    }
  }

  function attachRemoteStream(stream) {
    const el = remoteAudioRef.current;
    if (!el || !stream || stream.getAudioTracks().length === 0) return;
    remoteStreamRef.current = stream;
    el.srcObject = stream;
    el.muted = false;
    el.volume = 1;
    el.play().catch(() => {});
  }

  function stopCallSounds() {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (ringbackRef.current) {
      ringbackRef.current.pause();
      ringbackRef.current.currentTime = 0;
    }
  }

  function cleanupCall() {
    stopCallSounds();
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    pendingIceRef.current = [];
    callTargetUserIdRef.current = null;
    inCallPeerRef.current = null;
    remoteStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setCallingUserId(null);
    setInCallWithUserId(null);
    setIncomingCallFrom(null);
    setIncomingOfferSdp(null);
  }

  async function startCall() {
    if (!selectedUser || !wsRef.current || wsRef.current.readyState !== 1) return;
    if (callingUserId || inCallWithUserId) return;
    if (!isUserOnline(selectedUser.id)) {
      addToast({ title: 'Пользователь не в сети' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (e) => {
        if (e.track) e.track.enabled = true;
        const remoteStream = e.streams?.[0] || (e.track ? new MediaStream([e.track]) : null);
        if (remoteStream) attachRemoteStream(remoteStream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected' && remoteStreamRef.current) {
          attachRemoteStream(remoteStreamRef.current);
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: 'call_ice', toUserId: selectedUser.id, candidate: e.candidate }));
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current.send(JSON.stringify({ type: 'call_offer', toUserId: selectedUser.id, sdp: offer }));
      callTargetUserIdRef.current = selectedUser.id;
      inCallPeerRef.current = { id: selectedUser.id, fullName: selectedUser.fullName };
      setCallingUserId(selectedUser.id);
      const ringback = new Audio('/sounds/gudki.mp3');
      ringback.loop = true;
      ringback.play().catch(() => {});
      ringbackRef.current = ringback;
      callTimeoutRef.current = setTimeout(() => {
        callTimeoutRef.current = null;
        if (callingUserIdRef.current === callTargetUserIdRef.current) {
          cleanupCall();
          addToast({ title: 'Нет ответа' });
        }
      }, 60000);
    } catch (err) {
      addToast({ title: 'Не удалось начать звонок', description: err.message });
      cleanupCall();
    }
  }

  function cancelCall() {
    if (!callingUserId || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'call_end', toUserId: callingUserId }));
    cleanupCall();
  }

  async function acceptCall() {
    if (!incomingCallFrom || !incomingOfferSdp || !wsRef.current || wsRef.current.readyState !== 1) return;
    const fromId = incomingCallFrom.id;
    stopCallSounds();
    setIncomingCallFrom(null);
    setIncomingOfferSdp(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (e) => {
        if (e.track) e.track.enabled = true;
        const remoteStream = e.streams?.[0] || (e.track ? new MediaStream([e.track]) : null);
        if (remoteStream) attachRemoteStream(remoteStream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected' && remoteStreamRef.current) {
          attachRemoteStream(remoteStreamRef.current);
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: 'call_ice', toUserId: fromId, candidate: e.candidate }));
        }
      };
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferSdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current.send(JSON.stringify({ type: 'call_answer', toUserId: fromId, sdp: answer }));
      pendingIceRef.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingIceRef.current = [];
      inCallPeerRef.current = { id: fromId, fullName: incomingCallFrom.fullName };
      setInCallWithUserId(fromId);
    } catch (err) {
      addToast({ title: 'Не удалось принять звонок', description: err.message });
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'call_reject', toUserId: fromId }));
      }
    }
  }

  function rejectCall() {
    if (!incomingCallFrom || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'call_reject', toUserId: incomingCallFrom.id }));
    stopCallSounds();
    setIncomingCallFrom(null);
    setIncomingOfferSdp(null);
  }

  function endCall() {
    if (!inCallWithUserId || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'call_end', toUserId: inCallWithUserId }));
    cleanupCall();
  }

  function playNewMessageSound() {
    const audio = newMessageAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // игнорируем ошибки воспроизведения
    }
  }

  useEffect(() => {
    if (!token) return;

    async function loadConversations() {
      try {
        const data = await apiRequest('/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConversations(data);
      } catch (err) {
        setError(err.message);
      }
    }

    loadConversations();
  }, [token]);

  const searchDebounceRef = useRef(null);
  useEffect(() => {
    if (!token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await apiRequest(`/chat/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
      searchDebounceRef.current = null;
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [token, searchQuery]);

  const wsClosedByUsRef = useRef(false);
  const wsReconnectAttemptsRef = useRef(0);
  const wsTryAuthByMessageRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    if (wsReconnectKey === 0) {
      wsReconnectAttemptsRef.current = 0;
      wsTryAuthByMessageRef.current = false;
    } else {
      wsReconnectAttemptsRef.current += 1;
    }
    if (wsReconnectAttemptsRef.current > 15) return;

    wsClosedByUsRef.current = false;
    const baseWsUrl = getPresenceWsUrl();
    const wsUrl = wsTryAuthByMessageRef.current
      ? baseWsUrl
      : `${baseWsUrl}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    function scheduleReconnect() {
      if (reconnectTimeoutRef.current) return;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        setWsReconnectKey((k) => k + 1);
      }, 2000);
    }

    ws.onopen = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsTryAuthByMessageRef.current) {
        ws.send(JSON.stringify({ type: 'auth', token }));
        wsTryAuthByMessageRef.current = false;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'online_list' && Array.isArray(data.userIds)) {
          wsReconnectAttemptsRef.current = 0;
          setOnlineUserIds(new Set(data.userIds));
          return;
        }
        if (data.type === 'presence' && typeof data.userId === 'number') {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            if (data.online) next.add(data.userId);
            else next.delete(data.userId);
            return next;
          });
          return;
        }
        if (data.type === 'typing' && typeof data.userId === 'number') {
          setTypingUserId(data.userId);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUserId(null);
            typingTimeoutRef.current = null;
          }, 3000);
        }
        if (data.type === 'call_offer' && typeof data.fromUserId === 'number' && data.sdp) {
          if (inCallWithUserIdRef.current || callingUserIdRef.current) return;
          const conv = conversationsRef.current || [];
          const search = searchResultsRef.current || [];
          const caller = conv.find((c) => c.id === data.fromUserId) || search.find((r) => r.id === data.fromUserId) || { id: data.fromUserId, fullName: 'Пользователь', avatarUrl: '' };
          setIncomingCallFrom(caller);
          setIncomingOfferSdp(data.sdp);
          const ring = new Audio('/sounds/zvonok.mp3');
          ring.loop = true;
          ring.play().catch(() => {});
          ringtoneRef.current = ring;
        }
        if (data.type === 'call_answer' && typeof data.fromUserId === 'number' && data.sdp) {
          const pc = peerConnectionRef.current;
          if (pc && callingUserIdRef.current === data.fromUserId) {
            if (callTimeoutRef.current) {
              clearTimeout(callTimeoutRef.current);
              callTimeoutRef.current = null;
            }
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
              pendingIceRef.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
              pendingIceRef.current = [];
            }).catch(() => {});
            if (ringbackRef.current) {
              ringbackRef.current.pause();
              ringbackRef.current.currentTime = 0;
            }
            setCallingUserId(null);
            setInCallWithUserId(data.fromUserId);
          }
        }
        if (data.type === 'call_reject' && typeof data.fromUserId === 'number') {
          if (ringbackRef.current) {
            ringbackRef.current.pause();
            ringbackRef.current.currentTime = 0;
          }
          setCallingUserId(null);
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
          }
          addToast({ title: 'Собеседник отклонил звонок' });
        }
        if (data.type === 'call_end' && typeof data.fromUserId === 'number') {
          if (inCallWithUserIdRef.current === data.fromUserId) {
            cleanupCall();
          } else {
            const from = incomingCallFromRef.current;
            if (from && from.id === data.fromUserId) {
              stopCallSounds();
              setIncomingCallFrom(null);
              setIncomingOfferSdp(null);
            }
          }
        }
        if (data.type === 'call_ice' && typeof data.fromUserId === 'number' && data.candidate != null) {
          const pc = peerConnectionRef.current;
          if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
          } else {
            pendingIceRef.current.push(data.candidate);
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      scheduleReconnect();
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      if (!wsClosedByUsRef.current) {
        if (event.code === 4001 || event.code === 4002) {
          wsTryAuthByMessageRef.current = true;
        }
        scheduleReconnect();
      }
    };

    return () => {
      wsClosedByUsRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      wsRef.current = null;
      ws.close();
    };
  }, [token, wsReconnectKey]);

  useEffect(() => {
    if (!selectedUserId || !message.trim()) return;
    if (typingSendTimeoutRef.current) clearTimeout(typingSendTimeoutRef.current);
    typingSendTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'typing', peerId: selectedUserId }));
      }
      typingSendTimeoutRef.current = null;
    }, 300);
    return () => {
      if (typingSendTimeoutRef.current) clearTimeout(typingSendTimeoutRef.current);
    };
  }, [message, selectedUserId]);

  useEffect(() => {
    if (!token || !selectedUserId) return;

    let active = true;
    let isFirstLoad = true;

    async function loadMessages() {
      try {
        const data = await apiRequest(`/chat/messages/${selectedUserId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (active) {
          // при первом открытии диалога не считаем существующие сообщения "новыми"
          if (isFirstLoad) {
            prevMessagesRef.current = data;
            setMessages(data);
            isFirstLoad = false;
            return;
          }

          if (currentUser) {
            const prevMessages = prevMessagesRef.current || [];
            const prevLastIncoming = [...prevMessages]
              .reverse()
              .find((item) => item.senderId === selectedUserId);
            const prevLastIncomingId = prevLastIncoming ? prevLastIncoming.id : null;

            const newLastIncoming = [...data]
              .reverse()
              .find((item) => item.senderId === selectedUserId);
            const newLastIncomingId = newLastIncoming ? newLastIncoming.id : null;

            if (
              newLastIncomingId != null &&
              (prevLastIncomingId == null || newLastIncomingId > prevLastIncomingId)
            ) {
              playNewMessageSound();
            }
          }

          prevMessagesRef.current = data;
          setMessages(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      }
    }

    loadMessages();
    const timer = setInterval(loadMessages, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId || messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (!last) return;

    lastSeenRef.current[selectedUserId] = last.id;
    prevUnreadRef.current[selectedUserId] = 0;
    setUnreadCounts((prev) => ({
      ...prev,
      [selectedUserId]: 0
    }));
  }, [selectedUserId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!token || conversations.length === 0) return;

    let cancelled = false;

    async function pollAllChats() {
      for (const user of conversations) {
        if (cancelled) return;

        const peerId = user.id;

        try {
          const data = await apiRequest(`/chat/messages/${peerId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (cancelled || data.length === 0) {
            continue;
          }

          const last = data[data.length - 1];

          if (lastSeenRef.current[peerId] == null) {
            lastSeenRef.current[peerId] = last.id;
            prevUnreadRef.current[peerId] = 0;
            setUnreadCounts((prev) => ({
              ...prev,
              [peerId]: 0
            }));
            continue;
          }

          const lastSeen = lastSeenRef.current[peerId];

          let unread = 0;
          if (last.id > lastSeen) {
            unread = data.filter(
              (item) => item.id > lastSeen && item.senderId === peerId
            ).length;
          }

          if (peerId === selectedUserId) {
            lastSeenRef.current[peerId] = last.id;
            prevUnreadRef.current[peerId] = 0;
            setUnreadCounts((prev) => ({
              ...prev,
              [peerId]: 0
            }));
            continue;
          }

          const previousUnread = prevUnreadRef.current[peerId] ?? 0;

          if (unread > previousUnread) {
            const lastIncoming = [...data]
              .reverse()
              .find((item) => item.senderId === peerId && item.id > lastSeen);

            if (lastIncoming) {
              playNewMessageSound();
              addToast({
                title: user.fullName,
                description: lastIncoming.body,
                onClick: () => {
                  setSelectedUserId(peerId);
                  if (isMobile) {
                    setMobileShowChat(true);
                  }
                  lastSeenRef.current[peerId] = last.id;
                  prevUnreadRef.current[peerId] = 0;
                  setUnreadCounts((prev) => ({
                    ...prev,
                    [peerId]: 0
                  }));
                }
              });
            }
          }

          prevUnreadRef.current[peerId] = unread;

          setUnreadCounts((prev) => ({
            ...prev,
            [peerId]: unread
          }));
        } catch {
          // ошибки опроса не должны ломать основной интерфейс
        }
      }
    }

    pollAllChats();
    const timer = setInterval(pollAllChats, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, conversations, selectedUserId, isMobile, addToast]);

  async function sendMessage(event) {
    event.preventDefault();

    if (!message.trim() || !selectedUserId) return;

    try {
      const created = await apiRequest('/chat/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: selectedUserId, body: message })
      });

      setMessages((prev) => [...prev, { ...created, senderName: currentUser?.fullName }]);
      setMessage('');

      const peerInConversations = conversations.some((c) => c.id === selectedUserId);
      if (!peerInConversations) {
        const list = await apiRequest('/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConversations(list);
        setSelectedUserFromSearch(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem('messenger_token');
    localStorage.removeItem('messenger_user');
    router.push('/login');
  }

  if (!currentUser) {
    return null;
  }

  const gridClass = isMobile
    ? mobileShowChat
      ? 'messenger-grid mobile-show-chat'
      : 'messenger-grid mobile-show-list'
    : 'messenger-grid';

  const inCallPeerName = (inCallWithUserId && inCallPeerRef.current?.fullName) ? inCallPeerRef.current.fullName : (inCallWithUserId ? 'собеседником' : '');

  return (
    <div className="messenger-page">
      {showMicBanner && (
        <div className="mic-banner" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, padding: '12px 20px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ fontSize: 14, color: '#e2e8f0' }}>Для звонков нужен доступ к микрофону</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={requestMicPermission} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 14 }}>Разрешить</button>
            <button type="button" onClick={() => { setShowMicBanner(false); sessionStorage.setItem('messenger_mic_permission_asked', '1'); }} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Позже</button>
          </div>
        </div>
      )}

      {incomingCallFrom && (
        <div className="incoming-call-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={(e) => e.target === e.currentTarget && rejectCall()}>
          <div className="incoming-call-modal" style={{ background: '#111827', borderRadius: 20, padding: 32, border: '1px solid #334155', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <img src={incomingCallFrom.avatarUrl || ''} alt="" width="80" height="80" style={{ borderRadius: '50%', objectFit: 'cover', background: '#334155' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Вам звонит {incomingCallFrom.fullName}</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button type="button" onClick={acceptCall} className="call-modal-btn call-modal-accept" style={{ padding: '14px 28px', borderRadius: 14, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600 }}>Взять</button>
              <button type="button" onClick={rejectCall} className="call-modal-btn call-modal-reject" style={{ padding: '14px 28px', borderRadius: 14, border: '1px solid #475569', background: '#334155', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600 }}>Сбросить</button>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        aria-hidden
      />

      <div className={gridClass} style={{ marginTop: showMicBanner ? 52 : 0 }}>
        <aside className="messenger-sidebar">
          <div style={{ padding: 20, borderBottom: '1px solid #1e293b' }}>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>Вы вошли как</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{currentUser.fullName}</div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 6 }}>@{currentUser.username}</div>
            <button
              type="button"
              onClick={logout}
              style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#0f172a', color: '#fff', cursor: 'pointer' }}
            >
              Выйти
            </button>
          </div>

          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e293b' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени или логину..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#fff',
                fontSize: 14
              }}
            />
          </div>
          <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {sidebarList.length === 0 && !searchQuery.trim() ? (
              <div style={{ padding: 16, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                Нет диалогов. Введите имя или логин в поиске.
              </div>
            ) : sidebarList.length === 0 && searchQuery.trim() ? (
              <div style={{ padding: 16, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                Никого не найдено
              </div>
            ) : (
              sidebarList.map((user) => {
                const active = selectedUserId === user.id;
                const unread = unreadCounts[user.id] ?? 0;
                const online = isUserOnline(user.id);
                const fromSearch = searchQuery.trim() && searchResults.some((r) => r.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      if (fromSearch) setSelectedUserFromSearch(user);
                      else setSelectedUserFromSearch(null);
                      if (isMobile) setMobileShowChat(true);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 10,
                      borderRadius: 16,
                      border: active ? '1px solid #3b82f6' : '1px solid #1e293b',
                      background: active ? '#0f172a' : 'transparent',
                      color: '#fff',
                      padding: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={user.avatarUrl} alt={user.fullName} width="48" height="48" style={{ borderRadius: '999px', objectFit: 'cover', background: '#334155' }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700 }}>{user.fullName}</span>
                          {online ? (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: '#22c55e'
                              }}
                            />
                          ) : null}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 14 }}>
                          @{user.username}
                          {online ? ' · в сети' : ''}
                        </div>
                      </div>
                    </div>
                    {unread > 0 ? (
                      <div
                        style={{
                          minWidth: 24,
                          height: 24,
                          borderRadius: 999,
                          background: '#ef4444',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {unread > 9 ? '9+' : unread}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="messenger-chat">
          <header className="messenger-chat-header" style={{ padding: 20, borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileShowChat(false)}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', cursor: 'pointer' }}
              >
                ← Назад
              </button>
            )}
            {selectedUser ? (
              <>
                <img src={selectedUser.avatarUrl} alt={selectedUser.fullName} width="52" height="52" style={{ borderRadius: '999px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>{selectedUser.fullName}</span>
                    {isUserOnline(selectedUser.id) ? (
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: '#22c55e'
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    {typingUserId === selectedUser.id
                      ? 'печатает...'
                      : isUserOnline(selectedUser.id)
                        ? 'в сети'
                        : 'оффлайн'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {inCallWithUserId ? (
                    <>
                      <span className="in-call-label" style={{ fontSize: 14, color: '#94a3b8' }}>
                        Разговор с {inCallPeerName || 'собеседником'}
                      </span>
                      <button
                        type="button"
                        onClick={endCall}
                        className="call-btn call-btn-end"
                        title="Завершить"
                        style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      </button>
                    </>
                  ) : callingUserId ? (
                    <>
                      <span style={{ fontSize: 14, color: '#94a3b8' }}>Звонок...</span>
                      <button
                        type="button"
                        onClick={cancelCall}
                        className="call-btn call-btn-cancel"
                        title="Отменить"
                        style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#64748b', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startCall}
                      className="call-btn call-btn-start"
                      title="Позвонить"
                      style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #334155', background: '#0f172a', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div>Выберите пользователя</div>
            )}
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: '#0b1120' }}>
            {error ? <div style={{ color: '#fca5a5' }}>{error}</div> : null}
            {messages.map((item) => {
              const isMine = item.senderId === currentUser.id;
              return (
                <div
                  key={item.id}
                  style={{
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    background: isMine ? '#2563eb' : '#1e293b',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.body}</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{formatTime(item.createdAt)}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} style={{ height: 0 }} aria-hidden />
          </div>

          <form onSubmit={sendMessage} style={{ padding: 20, borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onFocus={() => {
                if (selectedUserId && message.trim() && wsRef.current?.readyState === 1) {
                  wsRef.current.send(JSON.stringify({ type: 'typing', peerId: selectedUserId }));
                }
              }}
              placeholder="Введите сообщение"
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                border: '1px solid #334155',
                background: '#020617',
                color: '#fff'
              }}
            />
            <button
              type="submit"
              style={{ padding: '0 22px', borderRadius: 14, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer' }}
            >
              Отправить
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
