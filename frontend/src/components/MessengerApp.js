'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
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
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const lastSeenRef = useRef({});
  const prevUnreadRef = useRef({});

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );

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
    if (!token) return;

    async function loadUsers() {
      try {
        const data = await apiRequest('/chat/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(data);
        if (data.length > 0) {
          setSelectedUserId((prev) => prev ?? data[0].id);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadUsers();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedUserId) return;

    let active = true;

    async function loadMessages() {
      try {
        const data = await apiRequest(`/chat/messages/${selectedUserId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (active) {
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
    if (!token || users.length === 0) return;

    let cancelled = false;

    async function pollAllChats() {
      for (const user of users) {
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
  }, [token, users, selectedUserId, isMobile, addToast]);

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

  return (
    <div className="messenger-page">
      <div className={gridClass}>
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

          <div style={{ padding: '16px 20px 8px', fontSize: 14, color: '#94a3b8' }}>Пользователи</div>
          <div style={{ overflowY: 'auto', padding: '0 12px 12px' }}>
            {users.map((user) => {
              const active = selectedUserId === user.id;
              const unread = unreadCounts[user.id] ?? 0;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(user.id);
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
                      <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                      <div style={{ color: '#94a3b8', fontSize: 14 }}>@{user.username}</div>
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
            })}
          </div>
        </aside>

        <section className="messenger-chat">
          <header style={{ padding: 20, borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
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
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedUser.fullName}</div>
                  <div style={{ color: '#94a3b8' }}>Личный чат</div>
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
          </div>

          <form onSubmit={sendMessage} style={{ padding: 20, borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
