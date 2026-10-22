import type { Metadata } from 'next';
import SurfaceView from '../../surface-view';

export const metadata: Metadata = {
  title: 'Science & Protocol Laboratory | Civic Relay · OEP',
  description: 'Reproducible Store-and-Forward laboratory, real WebCrypto ECDSA P-256 packet verification, and scientific truth matrix.',
  alternates: {
    canonical: '/science/',
    languages: { en: '/science/', es: '/es/science/', nl: '/nl/science/' }
  }
};

export default function ScienceRoutePage() {
  return <SurfaceView locale="en" surface="SCIENCE" />;
}
