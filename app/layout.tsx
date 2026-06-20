import type { Metadata } from 'next';
import './globals.css';

const serverName = process.env.PLEX_SERVER_NAME ?? 'Plex Server';

export const metadata: Metadata = {
  title: `${serverName} Status`,
  description: `${serverName} infrastructure status`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
