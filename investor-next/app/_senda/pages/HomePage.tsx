'use client';

import {
  ArrowRight,
  Radio,
  Network,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Compass,
  Users,
  FileSearch,
  Building2
} from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import Reveal from '../components/Reveal';
import MediaVideo from '../components/MediaVideo';
import { HOME_COPY } from '../data/home-product';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, type Locale } from '../data/types';

const PILLAR_ICONS = [Radio, Network, ShieldCheck];
const AUDIENCE_ICONS = [Users, Building2, FileSearch, Compass];

export default function HomePage({ locale }: { locale: Locale }) {
  const c = HOME_COPY[locale];
  const ui = SITE_STRINGS[locale];

  return (
    <PageShell locale={locale} active="home">
      {/* 1. Hero — Clear in < 60 seconds */}
      <section className="s-hero">
        <div className="s-container">
          <div className="s-hero-status">
            <EvidenceBadge locale={locale} evidenceId="EV-09-PHY" compact />
            <span>{ui.researchPill}</span>
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
              href={localeHref(locale, 'evidence')}
              className="s-btn s-btn-ghost"
            >
              {ui.ctaEvidence}
            </a>
          </div>

          {/* Product as protagonist: lightweight crisp Control Center visual preview */}
          <div className="s-frame">
            <div className="s-frame-bar">
              <span className="s-frame-dot" />
              <span className="s-frame-dot" />
              <span className="s-frame-dot" />
              <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--s-text-2)' }}>
                {c.previewLabel}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <EvidenceBadge locale={locale} evidenceId="EV-S01-ROUTE" compact />
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
                {/* Subtle coordinate grid */}
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

                {/* Left sidebar mock: Queue */}
                <rect x="20" y="20" width="210" height="340" rx="14" fill="var(--s-bg-elev)" stroke="var(--s-line)" />
                <text x="36" y="48" fill="var(--s-text-3)" fontSize="11" fontWeight="600">
                  EVENT QUEUE · 8 SCENARIOS
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
                <circle cx="48" cy="267" r="4" fill="var(--s-sim)" />
                <text x="60" y="271" fill="var(--s-text)" fontSize="12" fontWeight="500">S05 · Rubble Bridge</text>
                <text x="48" y="288" fill="var(--s-text-3)" fontSize="11">BLE Surface Relay</text>

                {/* Center Map Routing Fabric */}
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

                {/* Outage radius */}
                <circle cx="285" cy="260" r="46" fill="var(--s-crit)" fillOpacity="0.08" stroke="var(--s-crit)" strokeOpacity="0.35" strokeDasharray="4 4" />
                <circle cx="285" cy="260" r="7" fill="var(--s-crit)" />
                <text x="255" y="324" fill="var(--s-text)" fontSize="12" fontWeight="600">San Martín (No Cell)</text>

                {/* Relay hops */}
                <circle cx="430" cy="186" r="6" fill="var(--s-accent)" />
                <circle cx="430" cy="186" r="14" fill="var(--s-accent)" fillOpacity="0.16" className="s-pulse" />
                <text x="395" y="166" fill="var(--s-text-2)" fontSize="11">BLE Neighbor</text>

                <circle cx="555" cy="142" r="6" fill="var(--s-ok)" />
                <text x="515" y="122" fill="var(--s-text-2)" fontSize="11">Satellite Gateway</text>

                <circle cx="510" cy="70" r="5" fill="var(--s-warn)" />
                <text x="468" y="54" fill="var(--s-text-2)" fontSize="11">LEO D2D Pass (91m)</text>

                {/* Destination */}
                <circle cx="735" cy="120" r="7" fill="var(--s-ok)" />
                <text x="692" y="100" fill="var(--s-text)" fontSize="12" fontWeight="600">Arnhem · ACK</text>

                {/* Right inspector mock */}
                <rect x="800" y="20" width="220" height="340" rx="14" fill="var(--s-bg-elev)" stroke="var(--s-line)" />
                <text x="816" y="48" fill="var(--s-text-3)" fontSize="11" fontWeight="600">
                  OBJECT INSPECTOR
                </text>
                <text x="816" y="76" fill="var(--s-text)" fontSize="14" fontWeight="600">
                  Route #S01-BLE-SAT
                </text>
                <rect x="816" y="88" width="90" height="22" rx="11" fill="var(--s-sim-soft)" />
                <text x="828" y="103" fill="var(--s-sim)" fontSize="11" fontWeight="600">SIMULATED</text>

                <text x="816" y="138" fill="var(--s-text-3)" fontSize="11">SENDA Multipath ETA</text>
                <text x="816" y="160" fill="var(--s-text)" fontSize="22" fontWeight="600">~4 min</text>

                <text x="816" y="192" fill="var(--s-text-3)" fontSize="11">Cellular Baseline</text>
                <text x="816" y="212" fill="var(--s-text-2)" fontSize="16" fontWeight="500">480 min</text>

                <text x="816" y="246" fill="var(--s-text-3)" fontSize="11">Envelope Crypto</text>
                <text x="816" y="264" fill="var(--s-text-2)" fontSize="12">ECDH P-256 · AES-GCM</text>

                <rect x="816" y="292" width="188" height="34" rx="17" fill="var(--s-accent)" />
                <text x="854" y="313" fill="var(--s-accent-ink)" fontSize="12" fontWeight="600">Launch Simulation</text>
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

      {/* 2. Three Pillars */}
      <section className="s-section s-sunk">
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

      {/* 3. Verifiable Metrics — Every number badged */}
      <section className="s-section">
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

      {/* 4. Proven vs Pending — Radical honesty */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <Reveal>
            <div className="s-read">
              <h2 className="s-h2">{c.truthTitle}</h2>
              <p className="s-lead">{c.truthLead}</p>
            </div>
          </Reveal>

          <div className="s-grid s-grid-2">
            <div className="s-card s-stack">
              <div className="s-row">
                <CheckCircle2 size={20} style={{ color: 'var(--s-ok)' }} aria-hidden="true" />
                <h3 className="s-h3">{c.provenTitle}</h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {c.provenItems.map((item) => (
                  <li key={item.text} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--s-line)' }}>
                    <span className="s-small" style={{ color: 'var(--s-text)' }}>{item.text}</span>
                    <div>
                      <EvidenceBadge locale={locale} evidenceId={item.evidenceId} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="s-card s-stack">
              <div className="s-row">
                <Clock size={20} style={{ color: 'var(--s-warn)' }} aria-hidden="true" />
                <h3 className="s-h3">{c.pendingTitle}</h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {c.pendingItems.map((item) => (
                  <li key={item.text} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--s-line)' }}>
                    <span className="s-small" style={{ color: 'var(--s-text)' }}>{item.text}</span>
                    <div>
                      <EvidenceBadge locale={locale} evidenceId={item.evidenceId} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Real App Captures */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <Reveal>
            <div className="s-read">
              <h2 className="s-h2">{c.videoTitle}</h2>
              <p className="s-lead">{c.videoLead}</p>
            </div>
          </Reveal>

          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-consola-promo.mp4"
              poster="/media/senda-film-poster-es.jpg"
              caption={
                locale === 'es'
                  ? 'Consola de situación real: 16.699 elementos públicos fechados (89 s)'
                  : locale === 'nl'
                  ? 'Echte situatieconsole: 16.699 gedateerde openbare items (89 s)'
                  : 'Real situation console capture: 16,699 dated public elements (89 s)'
              }
              evidenceId="EV-CONSOLE-16K"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-demo-real-mensaje-sin-red.mp4"
              poster="/media/senda-ruta-poster-es.jpg"
              caption={
                locale === 'es'
                  ? 'Envío cifrado y cola local en la PWA con la red cortada'
                  : locale === 'nl'
                  ? 'Versleuteld bericht en lokale wachtrij in de offline PWA'
                  : 'Encrypted message queuing inside the offline PWA with network disabled'
              }
              evidenceId="EV-OFFLINE-49"
            />
          </div>
        </div>
      </section>

      {/* 6. Audience Shortcuts */}
      <section className="s-section s-sunk">
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
