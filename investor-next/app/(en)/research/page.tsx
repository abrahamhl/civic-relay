import type { Metadata } from 'next';
import ResearchPage from '../../research-page';

export const metadata: Metadata = {
  title: 'Research Library | SENDA · Technical Reports',
  description: 'Three technical reports on proof-carrying inference, erasure tails and cross-runtime display determinism. Source, BibTeX, data and SHA-256 manifest included; not peer reviewed.',
  alternates: {
    canonical: '/research/',
    languages: { en: '/research/', es: '/es/research/', nl: '/nl/research/' }
  },
  openGraph: {
    title: 'Research Library | SENDA · Technical Reports',
    description: 'Checkable technical reports with source, data, citations and artifact hashes. Technical reports, not peer reviewed.',
    locale: 'en_US',
    type: 'website'
  }
};

export default function ResearchRoutePage() {
  return <ResearchPage locale="en" />;
}
