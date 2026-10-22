import type { Metadata } from 'next';
import SurfaceView from '../../surface-view';

export const metadata: Metadata = {
  title: 'Mission Control 3D & Sector Intelligence | Civic Relay · OEP',
  description: 'Interactive 3D Globe, raycast selection, authorized public road camera catalog, and deterministic emergency routing simulator.',
  alternates: {
    canonical: '/mission-control/',
    languages: { en: '/mission-control/', es: '/es/mission-control/', nl: '/nl/mission-control/' }
  }
};

export default function MissionControlRoutePage() {
  return <SurfaceView locale="en" surface="MISSION_CONTROL" />;
}
