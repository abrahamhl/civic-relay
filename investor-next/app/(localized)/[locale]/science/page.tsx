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
    title: lang === 'es' ? 'Laboratorio Científico y Evidencia | Civic Relay · OEP' : 'Wetenschappelijk Lab & Bewijs | Civic Relay · OEP',
    alternates: {
      canonical: `/${lang}/science/`,
      languages: { en: '/science/', es: '/es/science/', nl: '/nl/science/' }
    }
  };
}

export default async function LocalizedSciencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SurfaceView locale={locale === 'nl' ? 'nl' : 'es'} surface="SCIENCE" />;
}
