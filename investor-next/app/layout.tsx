import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter=Inter({subsets:['latin'],display:'swap',variable:'--font-inter'});
export const metadata: Metadata={
  title:'OEP — Offline Emergency Protocol | Coordinación offline, rutas y ACK',
  description:'OEP investiga el flujo consentimiento → SAFE/SOS → cola local → enrutamiento adaptativo → ACK. Simulación 3D reproducible, arquitectura Next.js y laboratorio Android experimental. Sin enlaces de emergencias operativos.',
  openGraph:{title:'OEP — Offline Emergency Protocol | Resiliencia civil europea',description:'See exactly how OEP models opt-in safety check-ins, offline message queuing, adaptive paths and receiver receipts. Open-source prototype; no real disaster routing claimed.',type:'website'},
  robots:{index:true,follow:true}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="en"><body className={inter.variable}>{children}</body></html>;
}
