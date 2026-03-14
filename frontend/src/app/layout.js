import './globals.css';
import Providers from './Providers';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';

export const metadata = {
  title: 'Мессенджер',
  description: 'Учебный мессенджер на Next.js + Express + Postgres',
  manifest: '/manifest.webmanifest',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <RegisterServiceWorker />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
