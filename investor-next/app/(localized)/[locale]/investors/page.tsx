import type { Metadata } from 'next';
import InvestorsPage from '../../../_senda/pages/InvestorsPage';
import { buildPageMetadata } from '../../../_senda/data/metadata';
import type { Locale } from '../../../_senda/data/types';

export function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'nl' }];
}
export const dynamicParams = false;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang: Locale = locale === 'nl' ? 'nl' : 'es';
  return buildPageMetadata(lang, 'investors');
}

export default async function LocalizedInvestors({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <InvestorsPage locale={locale === 'nl' ? 'nl' : 'es'} />;
}
