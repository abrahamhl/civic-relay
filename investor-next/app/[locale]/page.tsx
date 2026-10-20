import type {Metadata} from 'next';
import InvestorPage from '../investor-page';
import {getCopy,type Locale} from '../copy';
export function generateStaticParams(){return [{locale:'es'},{locale:'nl'}];}
export const dynamicParams=false;
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale}=await params;
 const lang=(locale==='es'||locale==='nl'?locale:'en') as Locale;
 const t=getCopy(lang);
 return {title:t.solution.title+' | Proyecto de comunicaciones por satélite para emergencias offline',description:t.solution.lead+' '+t.solution.why,openGraph:{title:t.solution.title+' | Proyecto de comunicaciones por satélite para emergencias offline',description:t.solution.lead,locale:lang==='es'?'es_ES':'nl_NL',type:'website'},twitter:{card:'summary_large_image',title:t.solution.title+' | Proyecto de comunicaciones por satélite para emergencias offline',description:t.solution.lead},alternates:{canonical:'/'+lang+'/',languages:{en:'/',es:'/es/',nl:'/nl/'}}};
}
export default async function LocalizedPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;
 return <InvestorPage locale={locale==='nl'?'nl':'es'}/>;
}
