import type { Metadata } from 'next';
import InvestorsPage from '../../_senda/pages/InvestorsPage';
import { buildPageMetadata } from '../../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'investors');

export default function InvestorsRoute() {
  return <InvestorsPage locale="en" />;
}
