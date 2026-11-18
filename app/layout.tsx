import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aethergate: Shards of Solis',
  description:
    'Cross-platform isometric multiplayer third-person MMORPG with diegetic UI, mobile touch controls, and Turso libSQL world persistence.',
  openGraph: {
    title: 'Aethergate: Shards of Solis',
    description:
      'Cross-platform isometric multiplayer third-person MMORPG with diegetic UI, mobile touch controls, and Turso libSQL world persistence.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aethergate: Shards of Solis',
    description:
      'Cross-platform isometric multiplayer third-person MMORPG with diegetic UI, mobile touch controls, and Turso libSQL world persistence.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        data-state="title"
        className="overflow-hidden bg-[#0c1018] text-[#f8f5ee] antialiased select-none"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
