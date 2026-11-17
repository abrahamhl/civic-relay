import type { Metadata } from 'next';
import SurfaceView from '../../../surface-view';
import type { Locale } from '../../../copy';

export function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'nl' }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale === 'nl' ? 'nl' : 'es') as Locale;
  return {
    title:
      lang === 'es'
        ? 'SENDA Mando · Panel multicanal de emergencias | Civic Relay · OEP'
        : 'SENDA Commando · Multikanaal noodpaneel | Civic Relay · OEP',
    description:
      lang === 'es'
        ? 'Superficie de mando sintética: activaciones, taxonomía, seguimiento, rutas mesh y presupuestos de enlace RF. Modelo determinista de investigación, no un servicio de emergencia real.'
        : 'Synthetisch commando-oppervlak: activaties, taxonomie, tracking, mesh-routes en RF-linkbudgetten. Deterministisch onderzoeksmodel, geen echte hulpdienst.',
    alternates: {
      canonical: `/${lang}/mando/`,
      languages: { en: '/mando/', es: '/es/mando/', nl: '/nl/mando/' }
    }
  };
}

export default async function LocalizedCommandPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SurfaceView locale={locale === 'nl' ? 'nl' : 'es'} surface="MANDO" />;
}
