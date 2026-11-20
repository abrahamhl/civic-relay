'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Radio,
  Network,
  ShieldCheck,
  Compass,
  Users,
  FileSearch,
  Building2,
  Cpu,
  Layers,
  ExternalLink
} from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import Reveal from '../components/Reveal';
import MediaVideo from '../components/MediaVideo';
import { HOME_COPY, SERVICE_CATALOG } from '../data/home-product';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, type Locale } from '../data/types';

const PILLAR_ICONS = [Radio, Network, ShieldCheck];
const AUDIENCE_ICONS = [Users, Building2, FileSearch, Compass];

type ServiceFilter = 'all' | 'comms' | 'command' | 'hazard' | 'rescue';

export default function HomePage({ locale }: { locale: Locale }) {
  const c = HOME_COPY[locale];
  const ui = SITE_STRINGS[locale];
  const [svcFilter, setSvcFilter] = useState<ServiceFilter>('all');

  const filterLabels: Record<ServiceFilter, string> = {
    en: { all: 'All (12)', comms: 'Offline Comms', command: 'Control & 4D', hazard: 'Fire, Flood & Sat', rescue: 'Rail, Road & Rescue' },
    es: { all: 'Todos (12)', comms: 'Comunicaciones sin red', command: 'Mando y Visor 4D', hazard: 'Fuego, Riada y Satélite', rescue: 'Ferrocarril y Rescate' },
    nl: { all: 'Alle (12)', comms: 'Offline comms', command: 'Commando & 4D', hazard: 'Brand, Water & Sat', rescue: 'Spoor & Redding' }
  }[locale];

  const visibleServices =
    svcFilter === 'all'
      ? SERVICE_CATALOG
      : SERVICE_CATALOG.filter((s) => s.category === svcFilter);

  return (
    <PageShell locale={locale} active="home">
      {/* 1. Hero — Clear, confident, solution-first */}
      <section className="s-hero">
        <div className="s-container">
          <div className="s-hero-status">
            <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" compact />
            <span>{ui.heroPill}</span>
          </div>

          <p className="s-eyebrow" style={{ display: 'block' }}>
            {c.eyebrow}
          </p>
          <h1 className="s-display s-center" style={{ maxWidth: '18ch' }}>
            {c.headline}
          </h1>
          <p
            className="s-h3 s-center"
            style={{ marginTop: 18, color: 'var(--s-accent)', fontWeight: 500 }}
          >
            {c.tagline}
          </p>
          <p className="s-lead">{c.lead}</p>

          <div className="s-hero-cta">
            <a
              href={localeHref(locale, 'platform')}
              className="s-btn s-btn-primary"
              data-testid="hero-cta-platform"
            >
              <span>{c.ctaPrimary}</span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a
              href={localeHref(locale, 'product')}
              className="s-btn s-btn-secondary"
              data-testid="hero-cta-product"
            >
              {c.ctaSecondary}
            </a>
            <a
              href={localeHref(locale, 'science')}
              className="s-btn s-btn-ghost"
            >
              {ui.nav[3].label}
            </a>
          </div>

          {/* Product Preview Frame */}
          <div className="s-frame">
            <div className="s-frame-bar">
              <span className="s-frame-dot" />
              <span className="s-frame-dot" />
              <span className="s-frame-dot" />
              <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--s-text-2)' }}>
                {c.previewLabel}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <EvidenceBadge locale={locale} evidenceId="EV-CONSOLE-16K" compact />
              </span>
            </div>

            <div style={{ padding: 'clamp(16px, 2.5vw, 28px)' }}>
              <svg
                viewBox="0 0 1040 380"
                role="img"
                aria-label={c.previewLabel}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 16,
                  background: 'var(--s-bg-sunk)',
                  border: '1px solid var(--s-line)'
                }}
              >
                <defs>
                  <pattern id="senda-hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.06"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="1040" height="380" fill="url(#senda-hero-grid)" />

                <rect x="20" y="20" width="210" height="340" rx="14" fill="var(--s-bg-elev)" stroke="var(--s-line)" />
                <text x="36" y="48" fill="var(--s-text-3)" fontSize="11" fontWeight="600">
                  OPERATIONAL SCENARIOS
                </text>
                <rect x="34" y="64" width="182" height="54" rx="10" fill="var(--s-accent-soft)" stroke="var(--s-accent)" strokeOpacity="0.4" />
                <circle cx="48" cy="83" r="4" fill="var(--s-crit)" />
                <text x="60" y="87" fill="var(--s-text)" fontSize="12" fontWeight="600">S01 · Arnhem -&gt; SMV</text>
                <text x="48" y="106" fill="var(--s-text-2)" fontSize="11">Blackout 8h · Multi-path 4m</text>

                <rect x="34" y="128" width="182" height="50" rx="10" fill="var(--s-bg-sunk)" />
                <circle cx="48" cy="147" r="4" fill="var(--s-warn)" />
                <text x="60" y="151" fill="var(--s-text)" fontSize="12" fontWeight="500">S02 · Wildfire 3D</text>
                <text x="48" y="168" fill="var(--s-text-3)" fontSize="11">GOES-R + Sentinel-2</text>

                <rect x="34" y="188" width="182" height="50" rx="10" fill="var(--s-bg-sunk)" />
                <circle cx="48" cy="207" r="4" fill="var(--s-obs)" />
                <text x="60" y="211" fill="var(--s-text)" fontSize="12" fontWeight="500">S03 · Flood EMSR773</text>
                <text x="48" y="228" fill="var(--s-text-3)" fontSize="11">l&apos;Horta Sud + RWS NL</text>

                <rect x="34" y="248" width="182" height="50" rx="10" fill="var(--s-bg-sunk)" />
                <circle cx="48" cy="267" r="4" fill="var(--s-accent)" />
                <text x="60" y="271" fill="var(--s-text)" fontSize="12" fontWeight="500">S05 · Rubble Bridge</text>
                <text x="48" y="288" fill="var(--s-text-3)" fontSize="11">BLE Surface Relay</text>

                <path
                  d="M285 260 C380 230, 445 145, 530 140 C600 136, 650 165, 735 120"
                  fill="none"
                  stroke="var(--s-accent)"
                  strokeWidth="2.5"
                  className="s-route-anim"
                />
                <path
                  d="M285 260 C410 300, 560 280, 735 120"
                  fill="none"
                  stroke="var(--s-ok)"
                  strokeWidth="2"
                  strokeDasharray="4 6"
                  strokeOpacity="0.85"
                />
                <path
                  d="M285 260 Q510 55 735 120"
                  fill="none"
                  stroke="var(--s-warn)"
                  strokeWidth="1.6"
                  strokeDasharray="3 5"
                  strokeOpacity="0.75"
                />

                <circle cx="285" cy="260" r="46" fill="var(--s-crit)" fillOpacity="0.08" stroke="var(--s-crit)" strokeOpacity="0.35" strokeDasharray="4 4" />
                <circle cx="285" cy="260" r="7" fill="var(--s-crit)" />
                <text x="242" y="324" fill="var(--s-text)" fontSize="12" fontWeight="600">San Martín (Outage Zone)</text>

                <circle cx="430" cy="186" r="6" fill="var(--s-accent)" />
                <circle cx="430" cy="186" r="14" fill="var(--s-accent)" fillOpacity="0.16" className="s-pulse" />
                <text x="392" y="166" fill="var(--s-text-2)" fontSize="11">BLE Neighbor</text>

                <circle cx="555" cy="142" r="6" fill="var(--s-ok)" />
                <text x="515" y="122" fill="var(--s-text-2)" fontSize="11">Satellite Gateway</text>

                <circle cx="510" cy="70" r="5" fill="var(--s-warn)" />
                <text x="468" y="54" fill="var(--s-text-2)" fontSize="11">LEO D2D Pass (91m)</text>

                <circle cx="735" cy="120" r="7" fill="var(--s-ok)" />
                <text x="692" y="100" fill="var(--s-text)" fontSize="12" fontWeight="600">Arnhem · ACK</text>

                <rect x="800" y="20" width="220" height="340" rx="14" fill="var(--s-bg-elev)" stroke="var(--s-line)" />
                <text x="816" y="48" fill="var(--s-text-3)" fontSize="11" fontWeight="600">
                  OBJECT INSPECTOR
                </text>
                <text x="816" y="76" fill="var(--s-text)" fontSize="14" fontWeight="600">
                  Route #S01-BLE-SAT
                </text>
                <rect x="816" y="88" width="96" height="22" rx="11" fill="var(--s-ok-soft)" />
                <text x="828" y="103" fill="var(--s-ok)" fontSize="11" fontWeight="600">ACTIVE PATH</text>

                <text x="816" y="138" fill="var(--s-text-3)" fontSize="11">SENDA Multipath ETA</text>
                <text x="816" y="160" fill="var(--s-text)" fontSize="22" fontWeight="600">~4 min</text>

                <text x="816" y="192" fill="var(--s-text-3)" fontSize="11">Cellular Baseline</text>
                <text x="816" y="212" fill="var(--s-text-2)" fontSize="16" fontWeight="500">480 min</text>

                <text x="816" y="246" fill="var(--s-text-3)" fontSize="11">Envelope Crypto</text>
                <text x="816" y="264" fill="var(--s-text-2)" fontSize="12">ECDH P-256 · AES-GCM</text>

                <rect x="816" y="292" width="188" height="34" rx="17" fill="var(--s-accent)" />
                <text x="848" y="313" fill="var(--s-accent-ink)" fontSize="12" fontWeight="600">Open Control Center</text>
              </svg>

              <div className="s-between" style={{ marginTop: 16 }}>
                <p className="s-small s-muted" style={{ margin: 0, maxWidth: 740 }}>
                  {c.previewCaption}
                </p>
                <a href={localeHref(locale, 'platform')} className="s-btn s-btn-secondary s-btn-sm">
                  <span>{c.ctaPrimary}</span>
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Flagship Multilingual Videos (auto-detects browser language + ES/EN/NL subtitles) */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <Reveal>
            <div className="s-read">
              <h2 className="s-h2">{c.flagshipFilmTitle}</h2>
              <p className="s-lead">{c.flagshipFilmLead}</p>
            </div>
          </Reveal>

          {/* Master Flagship Film (M96 Promo — full-length ES/EN audio + ES/EN/NL VTT) */}
          <MediaVideo
            locale={locale}
            src="/media/m96/senda-m96-promo-es.mp4"
            sources={{
              es: '/media/m96/senda-m96-promo-es.mp4',
              en: '/media/m96/senda-m96-promo-en.mp4'
            }}
            poster="/media/m96/senda-m96-promo-poster.jpg"
            subtitles={{
              es: '/media/m96/senda-m96-promo-es.vtt',
              en: '/media/m96/senda-m96-promo-en.vtt',
              nl: '/media/m96/senda-m96-promo-nl.vtt'
            }}
            title={
              locale === 'es'
                ? 'Película oficial SENDA · Visión completa, arquitectura y plataforma'
                : locale === 'nl'
                ? 'Officiële SENDA-film · Volledige visie, architectuur en platform'
                : 'Official SENDA Master Film · Complete vision, architecture & platform'
            }
            caption={
              locale === 'es'
                ? 'Audio automático según tu navegador (ES / EN) con subtítulos activables en Español, Inglés y Neerlandés.'
                : locale === 'nl'
                ? 'Automatische taalkeuze op basis van uw browser met Nederlandse, Engelse en Spaanse ondertitels.'
                : 'Auto-matched to your browser language with switchable Spanish, English, and Dutch subtitles.'
            }
            evidenceId="EV-CONSOLE-16K"
          />

          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/senda-film-es.mp4"
              sources={{
                es: '/media/senda-film-es.mp4',
                en: '/media/senda-film-en.mp4'
              }}
              posters={{
                es: '/media/senda-film-poster-es.jpg',
                en: '/media/senda-film-poster-en.jpg'
              }}
              subtitles={{
                es: '/media/senda-film-es.vtt',
                en: '/media/senda-film-en.vtt',
                nl: '/media/senda-film-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Documental técnico SENDA · Del corte de red al rescate coordinado'
                  : locale === 'nl'
                  ? 'Technische film SENDA · Van netwerkuitval tot gecoördineerde hulp'
                  : 'SENDA Technical Film · From cellular blackout to coordinated rescue'
              }
              caption={
                locale === 'es'
                  ? 'Recorrido integral por mensajería sin red, incendios 3D y fusión de sensores.'
                  : locale === 'nl'
                  ? 'Volledige rondleiding door offline berichten, 3D-branden en sensorfusie.'
                  : 'End-to-end walkthrough of offline routing, 3D wildfire physics, and sensor fusion.'
              }
              evidenceId="EV-OFFLINE-49"
            />

            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-broadcast-special-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-broadcast-special-es.mp4',
                en: '/media/m95/senda-m95-broadcast-special-en.mp4'
              }}
              poster="/media/m95/senda-m95-broadcast-special-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-broadcast-special-es.vtt',
                en: '/media/m95/senda-m95-broadcast-special-en.vtt',
                nl: '/media/m95/senda-m95-broadcast-special-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Especial Broadcast · Consola de situación y respuesta multicanal'
                  : locale === 'nl'
                  ? 'Broadcast Special · Situatieconsole en multikanaal-respons'
                  : 'Broadcast Special · Situation Console & multi-channel response'
              }
              caption={
                locale === 'es'
                  ? 'Presentación ejecutiva bilingüe con subtítulos en ES, EN y NL.'
                  : locale === 'nl'
                  ? 'Tweetalige presentatie met ES-, EN- en NL-ondertiteling.'
                  : 'Bilingual executive briefing with ES, EN, and NL subtitles.'
              }
              evidenceId="EV-S01-ROUTE"
            />
          </div>
        </div>
      </section>

      {/* 3. Three Core Pillars */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <Reveal>
            <div className="s-read">
              <h2 className="s-h2">{c.pillarsTitle}</h2>
              <p className="s-lead">{c.pillarsLead}</p>
            </div>
          </Reveal>

          <div className="s-grid s-grid-3">
            {c.pillars.map((pillar, i) => {
              const Icon = PILLAR_ICONS[i] ?? Radio;
              return (
                <Reveal key={pillar.title}>
                  <article className="s-card s-card-lift" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="s-between">
                      <div className="s-card-icon" style={{ marginBottom: 0 }}>
                        <Icon aria-hidden="true" />
                      </div>
                      <EvidenceBadge locale={locale} evidenceId={pillar.evidenceId} />
                    </div>
                    <h3 className="s-h3">{pillar.title}</h3>
                    <p>{pillar.body}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Verifiable Metrics */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <Reveal>
            <div className="s-read">
              <h2 className="s-h2">{c.metricsTitle}</h2>
              <p className="s-lead">{c.metricsLead}</p>
            </div>
          </Reveal>

          <div className="s-grid s-grid-4">
            {c.metrics.map((m) => (
              <Reveal key={m.label}>
                <div className="s-card s-kpi" style={{ height: '100%' }}>
                  <div>
                    <EvidenceBadge locale={locale} evidenceId={m.evidenceId} />
                  </div>
                  <div className="s-kpi-value s-num" style={{ marginTop: 8 }}>
                    {m.value}
                  </div>
                  <div className="s-kpi-label">{m.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Complete Suite of Live Services & Interactive Modules */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <div className="s-read">
              <p className="s-eyebrow">
                <Layers size={15} aria-hidden="true" />
                <span>SENDA ECOSYSTEM</span>
              </p>
              <h2 className="s-h2">{c.servicesTitle}</h2>
              <p className="s-lead">{c.servicesLead}</p>
            </div>
          </div>

          <div className="s-chipbar" role="group" aria-label="Service categories">
            {(['all', 'comms', 'command', 'hazard', 'rescue'] as ServiceFilter[]).map((cat) => (
              <button
                key={cat}
                type="button"
                className="s-chip"
                aria-pressed={svcFilter === cat}
                onClick={() => setSvcFilter(cat)}
              >
                {filterLabels[cat]}
              </button>
            ))}
          </div>

          <div className="s-grid s-grid-3">
            {visibleServices.map((svc) => (
              <a
                key={svc.id}
                href={svc.href}
                className="s-card s-card-lift"
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div className="s-between">
                  <strong style={{ fontSize: 16, color: 'var(--s-text)' }}>{svc.title[locale]}</strong>
                  <ExternalLink size={15} style={{ color: 'var(--s-accent)', flex: 'none' }} aria-hidden="true" />
                </div>
                <p style={{ flex: 1 }}>{svc.desc[locale]}</p>
                <div className="s-between" style={{ paddingTop: 10, borderTop: '1px solid var(--s-line)' }}>
                  <code className="s-mono s-faint">{svc.href}</code>
                  <span className="s-micro" style={{ color: 'var(--s-accent)', fontWeight: 600 }}>
                    {locale === 'es' ? 'Abrir módulo' : locale === 'nl' ? 'Open module' : 'Launch module'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Human-Led AI Orchestration & Vibe Coding Craftsmanship */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <div className="s-read">
            <p className="s-eyebrow">
              <Cpu size={15} aria-hidden="true" />
              <span>{c.vibeCoding.eyebrow}</span>
            </p>
            <h2 className="s-h2">{c.vibeCoding.title}</h2>
            <p className="s-lead">{c.vibeCoding.lead}</p>
          </div>

          <div className="s-grid s-grid-3">
            {c.vibeCoding.pillars.map((p) => (
              <article key={p.title} className="s-card s-stack">
                <h3 className="s-h3">{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Audience Shortcuts */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">{c.audiencesTitle}</h2>
          <div className="s-grid s-grid-4">
            {c.audiences.map((aud, idx) => {
              const Icon = AUDIENCE_ICONS[idx] ?? Compass;
              return (
                <a
                  key={aud.role}
                  href={localeHref(locale, aud.hrefSlug)}
                  className="s-card s-card-lift"
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div className="s-card-icon" style={{ marginBottom: 4 }}>
                    <Icon aria-hidden="true" />
                  </div>
                  <h3 className="s-h3">{aud.role}</h3>
                  <p style={{ flex: 1 }}>{aud.desc}</p>
                  <span className="s-row s-small" style={{ color: 'var(--s-accent)', fontWeight: 600, marginTop: 8 }}>
                    <span>{aud.cta}</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
