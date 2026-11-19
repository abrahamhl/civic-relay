import type { Metadata } from 'next';
import SciencePage from '../../_senda/pages/SciencePage';
import { buildPageMetadata } from '../../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'science');

export default function ScienceRoute() {
  return <SciencePage locale="en" />;
}
