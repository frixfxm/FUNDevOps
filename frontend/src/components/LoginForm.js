'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

const demoUsers = [
  { fullName: 'Люба', login: 'luba', password: 'May122004!' },
  { fullName: 'Петр Петрович', login: 'peta', password: 'petaOWN' },
  { fullName: 'Толя', login: 'tolya', password: 'Tolik0508' },
  { fullName: 'Хомяк', login: 'dima', password: 'DIMASIK1213' },
  { fullName: 'Влад', login: 'vlad', password: 'vladLadaSedan' }
];

export default function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState('luba');
  const [password, setPassword] = useState('May122004!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password })
      });

      localStorage.setItem('messenger_token', result.token);
      localStorage.setItem('messenger_user', JSON.stringify(result.user));
      router.push('/messenger');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        <section style={{ background: '#111827', borderRadius: 20, padding: 32, border: '1px solid #334155' }}>
          <h1 style={{ marginTop: 0, fontSize: 34 }}>Учебный мессенджер</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Вход только по готовым пользователям. Регистрации нет — проект подготовлен для практики с Docker,
            Express, Next.js и Postgres.
          </p>
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18 }}>Готовые пользователи</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {demoUsers.map((user) => (
                <button
                  key={user.login}
                  type="button"
                  onClick={() => {
                    setLogin(user.login);
                    setPassword(user.password);
                  }}
                  style={{
                    textAlign: 'left',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: 14,
                    padding: 14,
                    cursor: 'pointer'
                  }}
                >
                  <strong>{user.fullName}</strong>
                  <div style={{ color: '#94a3b8', marginTop: 6, fontSize: 14 }}>
                    {user.login} / {user.password}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <form onSubmit={onSubmit} style={{ background: '#111827', borderRadius: 20, padding: 32, border: '1px solid #334155' }}>
          <h2 style={{ marginTop: 0 }}>Вход</h2>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ marginBottom: 8 }}>Логин</div>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Введите логин"
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#fff' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ marginBottom: 8 }}>Пароль</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#fff' }}
            />
          </label>
          {error ? <p style={{ color: '#fca5a5' }}>{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
