import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter=Inter({subsets:['latin'],display:'swap',variable:'--font-inter'});
export const metadata: Metadata={
  metadataBase:new URL('https://civic-relay-investor.vercel.app'),
  title:'OEP — Offline Emergency Protocol | Distributed Emergency Coordination & Adaptive Multi-Network Routing',
  description:'OEP researches the opt-in flow consent → SAFE/SOS → bounded local queue → adaptive multi-network routing → receiver ACK. Reproducible 3D simulation, Next.js architecture and experimental Android lab. Not a live emergency service.',
  openGraph:{title:'OEP — Offline Emergency Protocol | Distributed Emergency Coordination & Adaptive Routing',description:'See how OEP models opt-in safety check-ins, offline message queuing, adaptive paths and receiver receipts. Open-source research MVP; no real disaster routing claimed.',locale:'en_US',type:'website'},
  twitter:{card:'summary_large_image',title:'OEP — Offline Emergency Protocol | Distributed Emergency Coordination & Adaptive Routing',description:'Open-source emergency coordination research: opt-in status, store-and-forward queue, adaptive routing and explicit ACK boundaries.'},
  alternates:{canonical:'/',languages:{en:'/',es:'/es/',nl:'/nl/'}},
  robots:{index:true,follow:true}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="en"><body className={inter.variable}>{children}</body></html>;
}
