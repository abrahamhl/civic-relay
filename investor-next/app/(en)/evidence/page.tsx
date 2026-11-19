import type { Metadata } from 'next';
import EvidencePage from '../../_senda/pages/EvidencePage';
import { buildPageMetadata } from '../../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'evidence');

export default function EvidenceRoute() {
  return <EvidencePage locale="en" />;
}
