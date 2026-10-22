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
    title: lang === 'es' ? 'Mission Control 3D y Sector Intelligence | Civic Relay · OEP' : 'Mission Control 3D & Sector Intelligence | Civic Relay · OEP',
    alternates: {
      canonical: `/${lang}/mission-control/`,
      languages: { en: '/mission-control/', es: '/es/mission-control/', nl: '/nl/mission-control/' }
    }
  };
}

export default async function LocalizedMissionControlPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SurfaceView locale={locale === 'nl' ? 'nl' : 'es'} surface="MISSION_CONTROL" />;
}
