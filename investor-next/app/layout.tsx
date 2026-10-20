import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter=Inter({subsets:['latin'],display:'swap',variable:'--font-inter'});
export const metadata: Metadata={
  title:'OEP — Offline Emergency Protocol — Simulador 3D y propuesta europea',
  description:'OEP — Offline Emergency Protocol: investigación y simulación 3D de mensajería resiliente. Explore an interactive simulated mission model, open-source code and the European field-validation roadmap. Not an emergency service.',
  openGraph:{title:'OEP — Offline Emergency Protocol | Resiliencia civil europea',description:'When networks go dark, communication must endure. Open-source research prototype; transport links shown are simulated.',type:'website'},
  robots:{index:true,follow:true}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="en"><body className={inter.variable}>{children}</body></html>;
}
