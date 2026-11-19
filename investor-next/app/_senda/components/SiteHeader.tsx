'use client';

import { useEffect, useState } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, type Locale, type NavSection } from '../data/types';
import ThemeToggle from './ThemeToggle';

const LOCALES: Locale[] = ['es', 'en', 'nl'];

export default function SiteHeader({
  locale,
  active
}: {
  locale: Locale;
  active: NavSection;
}) {
  const ui = SITE_STRINGS[locale];
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const currentSlug = active === 'home' ? '' : active;

  return (
    <>
      <a href="#main-content" className="s-skip">
        {ui.skipToContent}
      </a>
      <header className="s-header">
        <div className="s-container s-header-in">
          <a
            href={localeHref(locale)}
            className="s-brand"
            aria-label="SENDA"
          >
            <svg
              className="s-brand-mark"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="5" cy="18" r="2.2" fill="currentColor" />
              <circle cx="19" cy="6" r="2.2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M6.8 16.5L10.4 13.4M13.6 10.6L17.2 7.5M5.5 15.8C6.5 9.5 10.5 6.5 16.8 6.2M7.2 18.2C13.5 17.8 17.6 14.2 18.7 8.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>{ui.brandTag}</span>
          </a>

          <nav aria-label="Primary" className="s-nav">
            {ui.nav.map((item) => (
              <a
                key={item.id}
                href={localeHref(locale, item.slug)}
                aria-current={active === item.id ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="s-header-tools">
            <div className="s-lang" role="group" aria-label={ui.langLabel}>
              {LOCALES.map((l) => (
                <a
                  key={l}
                  href={localeHref(l, active === 'design' ? '' : currentSlug)}
                  hrefLang={l}
                  lang={l}
                  aria-current={locale === l ? 'true' : undefined}
                >
                  {l.toUpperCase()}
                </a>
              ))}
            </div>

            <ThemeToggle locale={locale} />

            <a
              href={`${localeHref(locale, 'investors')}#dossier`}
              className="s-btn s-btn-primary s-btn-sm s-hide-m"
              data-testid="cta-dossier-header"
            >
              {ui.ctaDossier}
            </a>

            <button
              type="button"
              className="s-icon-btn s-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="s-mobile-nav"
              aria-label={menuOpen ? ui.menuClose : ui.menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div
        id="s-mobile-nav"
        className="s-mobile-nav"
        data-open={menuOpen ? 'true' : 'false'}
        hidden={!menuOpen}
      >
        <nav aria-label="Mobile navigation">
          <ul>
            {ui.nav.map((item) => (
              <li key={item.id}>
                <a
                  href={localeHref(locale, item.slug)}
                  aria-current={active === item.id ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <span>{item.label}</span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 24 }}>
            <a
              href={`${localeHref(locale, 'investors')}#dossier`}
              className="s-btn s-btn-primary"
              style={{ width: '100%' }}
              onClick={() => setMenuOpen(false)}
            >
              {ui.ctaDossier}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
