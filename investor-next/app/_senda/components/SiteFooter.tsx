'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, REPO_URL, type Locale } from '../data/types';

interface Provenance {
  sourceSha?: string;
  nextVersion?: string;
  workingTree?: string;
}

export default function SiteFooter({ locale }: { locale: Locale }) {
  const ui = SITE_STRINGS[locale];
  const f = ui.footer;
  const [prov, setProv] = useState<Provenance | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/release-provenance.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setProv(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const shaShort = prov?.sourceSha ? prov.sourceSha.slice(0, 8) : 'local';

  return (
    <footer className="s-footer">
      <div className="s-container">
        <div className="s-footer-grid">
          <div className="s-stack">
            <div className="s-row" style={{ gap: 8 }}>
              <strong style={{ color: 'var(--s-text)', fontSize: 16 }}>SENDA</strong>
              <span className="s-pill">v0.1.0 · MIT</span>
            </div>
            <p className="s-small" style={{ margin: 0 }}>
              {f.summary}
            </p>
            <p className="s-micro s-faint" style={{ margin: 0 }}>
              {f.aiNotice}
            </p>
          </div>

          <div>
            <h4>{f.colProduct}</h4>
            <ul>
              {ui.nav.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <a href={localeHref(locale, item.slug)}>{item.label}</a>
                </li>
              ))}
              <li>
                <a href={localeHref(locale, 'mando')}>{f.links.legacyMando}</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>{f.colEvidence}</h4>
            <ul>
              <li>
                <a href={localeHref(locale, 'evidence')}>{f.links.evidenceRegister}</a>
              </li>
              <li>
                <a href={localeHref(locale, 'science')}>{ui.nav[3].label}</a>
              </li>
              <li>
                <a
                  href={`${REPO_URL}/blob/master/docs/audits/LATEST_ENGINEERING_STATUS.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {f.links.engStatus}
                </a>
              </li>
              <li>
                <a href="/design/">{f.links.designSystem}</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>{f.colDocs}</h4>
            <ul>
              <li>
                <a href="/vision-master.md" download>
                  {f.links.visionMaster}
                </a>
              </li>
              <li>
                <a href="/senda/paper.html">{f.links.fuegoPaper}</a>
              </li>
              <li>
                <a
                  href={`${REPO_URL}/blob/master/docs/financiacion/RONDA_FINANCIACION_2026-11-05.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {f.links.fundingDoc}
                </a>
              </li>
              <li>
                <a href={`${localeHref(locale, 'investors')}#press`}>{f.links.pressKit}</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>{f.colLegal}</h4>
            <ul>
              <li>
                <a href={localeHref(locale, 'security')}>{f.links.securityPolicy}</a>
              </li>
              <li>
                <a href="/.well-known/security.txt">{f.links.securityTxt}</a>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  {f.links.sourceCode}
                </a>
              </li>
              <li>
                <a href={`${localeHref(locale, 'investors')}#dossier`}>{f.links.contact}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="s-footer-base">
          <span className="s-row" style={{ gap: 8 }}>
            <ShieldAlert size={14} aria-hidden="true" />
            <span>{f.legalNotice}</span>
          </span>
          <span className="s-mono s-num">
            {f.buildLabel}: v0.1.0 · SHA {shaShort}
            {prov?.nextVersion ? ` · Next ${prov.nextVersion}` : ''}
          </span>
        </div>
      </div>
    </footer>
  );
}
