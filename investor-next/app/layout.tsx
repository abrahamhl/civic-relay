import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://github.com/abrahamhl/civic-relay'),
  title: 'Civic Relay | Resilient Crisis Messaging Research',
  description: 'Evidence-led EU civil security technology prototype. Simulated store-and-forward, multipath acknowledgements and local-first messaging research. Not an emergency service.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
