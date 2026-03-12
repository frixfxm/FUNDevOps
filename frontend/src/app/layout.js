import './globals.css';
import Providers from './Providers';

export const metadata = {
  title: 'Messenger',
  description: 'Учебный мессенджер на Next.js + Express + Postgres'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
