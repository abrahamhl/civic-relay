import type { Metadata } from 'next';
import SurfaceView from '../../surface-view';

export const metadata: Metadata = {
  title: 'SENDA Command · Multichannel Emergency Panel | Civic Relay · OEP',
  description:
    'Synthetic multichannel command surface: activations, taxonomy, surface tracking, mesh routes and RF link budgets. Deterministic research model, not a live emergency service.',
  alternates: {
    canonical: '/mando/',
    languages: { en: '/mando/', es: '/es/mando/', nl: '/nl/mando/' }
  }
};

export default function CommandRoutePage() {
  return <SurfaceView locale="en" surface="MANDO" />;
}
