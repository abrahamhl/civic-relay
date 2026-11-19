import type { Metadata } from 'next';
import ProductPage from '../../_senda/pages/ProductPage';
import { buildPageMetadata } from '../../_senda/data/metadata';

export const metadata: Metadata = buildPageMetadata('en', 'product');

export default function ProductRoute() {
  return <ProductPage locale="en" />;
}
