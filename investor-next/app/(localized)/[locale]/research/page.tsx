import type { Metadata } from 'next';
import ResearchPage from '../../../research-page';
import type { Locale } from '../../../copy';

export function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'nl' }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale === 'nl' ? 'nl' : 'es') as Locale;
  const title = lang === 'es'
    ? 'Biblioteca de investigación | SENDA · Informes técnicos'
    : 'Onderzoeksbibliotheek | SENDA · Technische rapporten';
  const description = lang === 'es'
    ? 'Tres informes técnicos sobre inferencia con prueba, colas de borrado y determinismo de visualización entre runtimes. Incluyen fuente, BibTeX, datos y manifiesto SHA-256; sin revisión por pares.'
    : 'Drie technische rapporten over proof-carrying inference, erasure-staarten en cross-runtime weergavedeterminisme. Met bron, BibTeX, data en SHA-256-manifest; niet peer-reviewed.';
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/research/`,
      languages: { en: '/research/', es: '/es/research/', nl: '/nl/research/' }
    },
    openGraph: {
      title,
      description,
      locale: lang === 'es' ? 'es_ES' : 'nl_NL',
      type: 'website'
    }
  };
}

export default async function LocalizedResearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ResearchPage locale={locale === 'nl' ? 'nl' : 'es'} />;
}
