import type { ReactNode } from 'react';
import '../senda.css';
import LanguageDocument from '../../language-document';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import CookieBanner from './CookieBanner';
import { REPO_URL, SITE_URL, type Locale, type NavSection } from '../data/types';

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('color-scheme');var m=document.querySelector('meta[name="color-scheme"]');if(!m){m=document.createElement('meta');m.name='color-scheme';document.head.appendChild(m);}if(s==='light'||s==='dark'){m.content=s;document.documentElement.setAttribute('data-theme',s);}else{m.content='light dark';document.documentElement.removeAttribute('data-theme');}}catch(e){}})();`;

export default function PageShell({
  locale,
  active,
  children,
  hideFooter = false
}: {
  locale: Locale;
  active: NavSection;
  children: ReactNode;
  hideFooter?: boolean;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'SENDA (Civic Relay / OEP)',
        url: SITE_URL,
        sameAs: [REPO_URL],
        description:
          'Open-source research platform for alternative-channel emergency message routing and situational correlation.'
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'SENDA — Alternative-Channel Emergency Routing',
        inLanguage: [locale],
        publisher: { '@id': `${SITE_URL}/#organization` }
      },
      {
        '@type': 'SoftwareApplication',
        name: 'SENDA Research Platform',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web, Android (Experimental Lab)',
        license: 'https://opensource.org/licenses/MIT',
        softwareVersion: '0.1.0',
        isAccessibleForFree: true,
        url: SITE_URL
      }
    ]
  };

  return (
    <div className="s-shell" data-locale={locale} data-section={active}>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LanguageDocument locale={locale} />
      <SiteHeader locale={locale} active={active} />
      <main id="main-content" className="s-main">
        {children}
      </main>
      {!hideFooter && <SiteFooter locale={locale} />}
      <CookieBanner locale={locale} />
    </div>
  );
}
