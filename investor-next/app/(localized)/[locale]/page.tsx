import type {Metadata} from 'next';
import SendaExperience from '../../senda-experience';
import type {Locale} from '../../copy';
export function generateStaticParams(){return [{locale:'es'},{locale:'nl'}];}
export const dynamicParams=false;
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale}=await params;
 const lang=(locale==='nl'?'nl':'es') as Locale;
 const title=lang==='es'?'SENDA — Cuando la red se apaga | Emergencias sin cobertura, incendios y vías de tren':'SENDA — Als het netwerk uitvalt | Noodberichten zonder dekking, natuurbranden en spoor';
 const description=lang==='es'?'SENDA mueve mensajes de emergencia por cualquier canal que quede y calcula dónde hay personas, cuándo llega el fuego a cada pueblo y qué vía revisar. Demos en vivo con el código probado.':'SENDA verstuurt noodberichten via elk resterend kanaal en berekent waar mensen zijn, wanneer het vuur elk dorp bereikt en welk spoor te inspecteren. Live demo’s met geteste code.';
 return {title,description,openGraph:{title,description,locale:lang==='es'?'es_ES':'nl_NL',type:'website'},twitter:{card:'summary_large_image',title,description},alternates:{canonical:'/'+lang+'/',languages:{en:'/',es:'/es/',nl:'/nl/'}}};
}
export default async function LocalizedPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;
 return <SendaExperience locale={locale==='nl'?'nl':'es'}/>;
}
