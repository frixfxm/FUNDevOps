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
    <div
      className="login-page"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'radial-gradient(900px circle at 20% 10%, rgba(34,197,94,0.12), transparent 55%), radial-gradient(700px circle at 80% 30%, rgba(37,99,235,0.16), transparent 55%), #020617'
      }}
    >
      <form
        onSubmit={onSubmit}
        className="login-form"
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 20,
          border: '1px solid #1e293b',
          background: 'rgba(15,23,42,0.8)',
          backdropFilter: 'blur(10px)',
          padding: 28,
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)'
        }}
      >
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10, marginBottom: 18 }}>
          <img
            src="/icon/mainico.svg"
            alt="Логотип"
            width="56"
            height="56"
            style={{ display: 'block', filter: 'brightness(0) invert(1)' }}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>Мессенджер</div>
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 14 }}>Войдите, чтобы продолжить</div>
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ marginBottom: 8, color: '#cbd5e1', fontSize: 13 }}>Логин</div>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Введите логин"
            autoComplete="username"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #334155',
              background: '#020617',
              color: '#fff',
              outline: 'none'
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ marginBottom: 8, color: '#cbd5e1', fontSize: 13 }}>Пароль</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #334155',
              background: '#020617',
              color: '#fff',
              outline: 'none'
            }}
          />
        </label>

        {error ? <p style={{ color: '#fca5a5', marginTop: 0, marginBottom: 14 }}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 14,
            border: '1px solid #1d4ed8',
            background: loading ? '#1e3a8a' : '#2563eb',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700
          }}
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

