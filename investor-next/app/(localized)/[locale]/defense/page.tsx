import type { Metadata } from 'next';
import SurfaceView from '../../../surface-view';

export function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'nl' }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang = locale === 'nl' ? 'nl' : 'es';
  return {
    title: lang === 'es' ? 'Bóveda de Defensa · Doble Uso | Civic Relay · OEP' : 'Defensiekluis · Dubbel Gebruik | Civic Relay · OEP',
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${lang}/defense/`,
      languages: { en: '/defense/', es: '/es/defense/', nl: '/nl/defense/' }
    }
  };
}

export default async function LocalizedDefensePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SurfaceView locale={locale === 'nl' ? 'nl' : 'es'} surface="DEFENSE" />;
}
