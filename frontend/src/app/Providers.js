'use client';

import { ToastProvider } from '@/components/ToastProvider';

export default function Providers({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

