import './globals.css';

export const metadata = {
  title: 'Messenger',
  description: 'Учебный мессенджер на Next.js + Express + Postgres'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
