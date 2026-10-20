import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter=Inter({subsets:['latin'],display:'swap',variable:'--font-inter'});
export const metadata: Metadata={
  title:'Civic Relay — Communication Beyond Blackout',
  description:'Civic Relay develops offline-first crisis messaging research. Explore an interactive simulated mission model, open-source code and the European field-validation roadmap. Not an emergency service.',
  openGraph:{title:'Civic Relay | Resilience by design',description:'When networks go dark, communication must endure. Open-source research prototype; transport links shown are simulated.',type:'website'},
  robots:{index:true,follow:true}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="en"><body className={inter.variable}>{children}</body></html>;
}
