'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

function formatTime(dateString) {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function MessengerApp() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  return (
    <div style={{ minHeight: '100vh', padding: 20, background: '#020617' }}>
      <div style={{ height: 'calc(100vh - 40px)', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <aside style={{ background: '#111827', borderRadius: 20, border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
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
                  <img src={user.avatarUrl} alt={user.fullName} width="48" height="48" style={{ borderRadius: '999px', objectFit: 'cover', background: '#334155' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>@{user.username}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ background: '#111827', borderRadius: 20, border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <header style={{ padding: 20, borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
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
