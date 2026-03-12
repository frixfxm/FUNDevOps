'use client';

import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext({
  addToast: () => {}
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const api = useMemo(
    () => ({
      addToast({ title, description, onClick }) {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setToasts((prev) => [...prev, { id, title, description, onClick }]);

        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, 4000);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            insetInlineEnd: 16,
            insetBlockStart: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 50
          }}
        >
          {toasts.map((toast) => (
            <button
              key={toast.id}
              type="button"
              onClick={() => {
                setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                if (toast.onClick) {
                  toast.onClick();
                }
              }}
              style={{
                minWidth: 260,
                maxWidth: 360,
                textAlign: 'left',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#e2e8f0',
                cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(15,23,42,0.7)'
              }}
            >
              {toast.title ? (
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{toast.title}</div>
              ) : null}
              {toast.description ? (
                <div style={{ fontSize: 14, color: '#cbd5f5' }}>{toast.description}</div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

