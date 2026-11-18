import type { Metadata, Viewport } from 'next';
import { Cinzel, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

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
    <html
      lang="en"
      className={`${cinzel.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
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
