const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function getPresenceWsUrl() {
  let base = API_URL.replace(/^https?/, 'ws').replace(/\/api\/?$/, '');
  if (typeof window !== 'undefined' && window.location) {
    if (base === '' || base.startsWith('/')) {
      base = window.location.origin.replace(/^http/, 'ws');
    } else if (base.includes('localhost')) {
      base = base.replace('localhost', window.location.hostname);
    }
  }
  base = base.replace(/\/+$/, '');
  return `${base}/ws/presence`;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export { API_URL };
