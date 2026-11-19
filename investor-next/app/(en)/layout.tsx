import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { buildPageMetadata } from '../_senda/data/metadata';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter'
});

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1
};

export const metadata: Metadata = {
  ...buildPageMetadata('en', 'home'),
  metadataBase: new URL(process.env.SITE_URL || 'https://civic-relay-investor.vercel.app')
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
