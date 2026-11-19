import type { Metadata } from 'next';
import DesignSystemPage from '../../_senda/pages/DesignSystemPage';

export const metadata: Metadata = {
  title: 'Design System | SENDA',
  description: 'Internal design tokens, typography scale, EvidenceBadge, and base UI components for SENDA.',
  robots: { index: false, follow: false }
};

export default function DesignRoute() {
  return <DesignSystemPage locale="es" />;
}
