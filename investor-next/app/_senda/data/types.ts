export type Locale = 'en' | 'es' | 'nl';

export type EvidenceStatus =
  | 'confirmed'
  | 'observed'
  | 'predicted'
  | 'simulated'
  | 'untested';

export type NavSection =
  | 'home'
  | 'product'
  | 'platform'
  | 'evidence'
  | 'science'
  | 'investors'
  | 'security'
  | 'design';

export interface LocalizedText {
  en: string;
  es: string;
  nl: string;
}

export interface EvidenceRecord {
  id: string;
  scenario: LocalizedText;
  hypothesis: LocalizedText;
  result: LocalizedText;
  status: EvidenceStatus;
  date: string;
  sha: string;
  method: LocalizedText;
  sourcePath: string;
  sourceUrl: string;
  limits: LocalizedText;
  category: 'protocol' | 'routing' | 'hardware' | 'fire' | 'hazard' | 'web';
}

export const SITE_URL = 'https://civic-relay-investor.vercel.app';
export const REPO_URL = 'https://github.com/abrahamhl/civic-relay';

export function localeHref(locale: Locale, slug = ''): string {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  if (locale === 'en') return clean ? `/${clean}/` : '/';
  return clean ? `/${locale}/${clean}/` : `/${locale}/`;
}
