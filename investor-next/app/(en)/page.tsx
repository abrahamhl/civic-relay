import type { Metadata } from 'next';
import HomePage from '../_senda/pages/HomePage';
import { buildPageMetadata } from '../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'home');

export default function Home() {
  return <HomePage locale="en" />;
}
