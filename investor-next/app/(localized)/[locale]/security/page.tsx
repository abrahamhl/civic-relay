import type { Metadata } from 'next';
import SecurityPage from '../../../_senda/pages/SecurityPage';
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
  return buildPageMetadata(lang, 'security');
}

export default async function LocalizedSecurity({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SecurityPage locale={locale === 'nl' ? 'nl' : 'es'} />;
}
