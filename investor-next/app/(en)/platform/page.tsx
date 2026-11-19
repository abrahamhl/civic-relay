import type { Metadata } from 'next';
import ControlCenter from '../../_senda/platform/ControlCenter';
import { buildPageMetadata } from '../../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'platform');

export default function PlatformRoute() {
  return <ControlCenter locale="en" />;
}
