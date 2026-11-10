import type { Metadata } from 'next';
import SurfaceView from '../../surface-view';

// Bóveda de defensa y doble uso: separada del producto civil y fuera de buscadores.
export const metadata: Metadata = {
  title: 'Defence Vault · Dual Use | Civic Relay · OEP',
  description: 'Dual-use and counter-UAS research modules, kept apart from the civil SENDA product.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/defense/',
    languages: { en: '/defense/', es: '/es/defense/', nl: '/nl/defense/' }
  }
};

export default function DefenseRoutePage() {
  return <SurfaceView locale="en" surface="DEFENSE" />;
}
