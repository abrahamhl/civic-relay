import type { Metadata } from 'next';
import SecurityPage from '../../_senda/pages/SecurityPage';
import { buildPageMetadata } from '../../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'security');

export default function SecurityRoute() {
  return <SecurityPage locale="en" />;
}
