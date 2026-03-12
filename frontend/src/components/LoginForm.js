'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="login-page">
      <div className="login-grid">
        <section className="login-intro">
          <h1 style={{ marginTop: 0, fontSize: 34 }}>Учебный мессенджер</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Вы попали в новый телеграмм
          </p>
        </section>

        <form onSubmit={onSubmit} className="login-form">
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

