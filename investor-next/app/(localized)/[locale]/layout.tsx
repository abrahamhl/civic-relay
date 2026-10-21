import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import '../../globals.css';

const inter=Inter({subsets:['latin'],display:'swap',variable:'--font-inter'});
export const metadata: Metadata={
  metadataBase:new URL('https://civic-relay-investor.vercel.app'),
  robots:{index:true,follow:true}
};
export default async function LocalizedRootLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
  const {locale}=await params;
  if(locale!=='es' && locale!=='nl') throw new Error('Unsupported static locale');
  return <html lang={locale}><body className={inter.variable}>{children}</body></html>;
}
