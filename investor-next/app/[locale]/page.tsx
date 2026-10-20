import type {Metadata} from 'next';
import InvestorPage from '../investor-page';
import {getCopy,type Locale} from '../copy';
export function generateStaticParams(){return [{locale:'es'},{locale:'nl'}];}
export const dynamicParams=false;
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale}=await params;
 const lang=(locale==='es'||locale==='nl'?locale:'en') as Locale;
 const t=getCopy(lang);
 return {title:t.solution.title+' | CIVIC RELAY',description:t.solution.lead+' '+t.solution.why,alternates:{canonical:'/'+lang+'/',languages:{en:'/',es:'/es/',nl:'/nl/'}}};
}
export default async function LocalizedPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;
 return <InvestorPage locale={locale==='nl'?'nl':'es'}/>;
}
