'use client';

import dynamic from 'next/dynamic';
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
  Cpu
} from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import Reveal from '../components/Reveal';
import MediaVideo from '../components/MediaVideo';
import AudienceLens, { type AudienceMode } from '../components/AudienceLens';
import LazySection from '../components/LazySection';
import { HOME_COPY } from '../data/home-product';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, type Locale } from '../data/types';

// Lazy-loaded interactive flagship engines: 0 bytes in initial Home JS, instant mount on scroll
const ScrollGlobeStage = dynamic(() => import('../components/ScrollGlobeStage'), { ssr: false });
const SensorShowcase = dynamic(() => import('../components/SensorShowcase'), { ssr: false });
const CrisisAtlas = dynamic(() => import('../components/CrisisAtlas'), { ssr: false });
const InteractiveLabsHub = dynamic(() => import('../components/InteractiveLabsHub'), { ssr: false });
const ServiceCatalogSection = dynamic(() => import('../components/ServiceCatalogSection'), { ssr: false });

const PILLAR_ICONS = [Radio, Network, ShieldCheck];
const AUDIENCE_ICONS = [Users, Building2, FileSearch, Compass];

export default function HomePage({ locale }: { locale: Locale }) {
  const c = HOME_COPY[locale];
  const ui = SITE_STRINGS[locale];
  const [audience, setAudience] = useState<AudienceMode>('citizen');

  const heroAudienceLead: Record<AudienceMode, Record<Locale, string>> = {
    citizen: {
      en: 'If an earthquake, flood, or train or road accident knocks out cell towers, your phone quietly passes your "I am safe" or "Need help" message across nearby phones and satellites until it reaches your family.',
      es: 'Si un terremoto, una riada o un accidente de tren o carretera corta la cobertura, tu móvil saca tu aviso de "Estoy bien" o "Necesito ayuda" saltando por teléfonos cercanos y satélites hasta llegar a tu familia.',
      nl: 'Als een aardbeving, overstroming of ongeval het mobiele netwerk uitschakelt, stuurt uw telefoon uw noodbericht automatisch via nabije toestellen en satellieten naar uw familie.'
    },
    investor: {
      en: c.lead,
      es: c.lead,
      nl: c.lead
    },
    engineer: {
      en: 'Deterministic E2EE store-and-forward (ECDH P-256 + AES-GCM + ECDSA), Contact Graph Routing (ARR_REPLAN_V2, 94.2% delivery / -84% mJ), 24-byte 3GPP NTN satellite bursts, 64-subcarrier OFDM CSI radar, and 16,699-source fusion.',
      es: 'Almacenar-y-reenviar determinista E2EE (ECDH P-256 + AES-GCM + ECDSA), Contact Graph Routing (ARR_REPLAN_V2, 94,2 % entrega / -84 % mJ), ráfagas 3GPP NTN de 24 bytes, radar CSI OFDM de 64 subportadoras y fusión de 16.699 fuentes.',
      nl: 'Deterministische E2EE store-and-forward (ECDH P-256 + AES-GCM), Contact Graph Routing (ARR_REPLAN_V2, 94,2% / -84% mJ), 24-byte 3GPP NTN bursts en 64-subcarrier OFDM CSI.'
    }
  };

  return (
    <PageShell locale={locale} active="home">
      {/* 1. Hero Keynote — Apple Editorial + Live Presentation Video + Audience Clarity Lens */}
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
          <p className="s-lead">{heroAudienceLead[audience][locale]}</p>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <AudienceLens locale={locale} value={audience} onChange={setAudience} />
          </div>

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
              href="#labs"
              className="s-btn s-btn-secondary"
              data-testid="hero-cta-product"
            >
              {locale === 'es' ? 'Probar simuladores en vivo' : locale === 'nl' ? 'Start live simulatoren' : 'Try live simulators'}
            </a>
            <a
              href="#sensors"
              className="s-btn s-btn-ghost"
            >
              {locale === 'es' ? 'Sensores del móvil' : locale === 'nl' ? 'Telefoonsensoren' : 'Phone sensors'}
            </a>
          </div>

          {/* Integrated Cinema Presentation Film right in Hero (Auto-detect browser lang + ES/EN/NL subtitles) */}
          <div style={{ marginTop: 40, textAlign: 'left' }}>
            <MediaVideo
              locale={locale}
              variant="cinema"
              ambientAutoplay
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
                  ? 'Presentación oficial SENDA · De un corte total al rescate coordinado por satélite y malla'
                  : locale === 'nl'
                  ? 'Officiële SENDA-presentatie · Van totale uitval naar satelliet- en mesh-redding'
                  : 'Official SENDA Presentation · From total blackout to satellite & mesh rescue'
              }
              caption={
                locale === 'es'
                  ? 'Detecta automáticamente el idioma de tu navegador (ES / EN) con subtítulos en Español, Inglés y Neerlandés.'
                  : locale === 'nl'
                  ? 'Automatische browsertaaldetectie met Spaanse, Engelse en Nederlandse ondertitels.'
                  : 'Automatically matches your browser language with one-tap Spanish, English, and Dutch subtitles.'
              }
              evidenceId="EV-CONSOLE-16K"
            />
          </div>
        </div>
      </section>

      {/* 2. Live 3D Orbital Satellite & Multipath Scroll Cinema (Three.js — lazy on scroll) */}
      <LazySection id="orbital-story-wrap" placeholderHeight={640} rootMargin="420px 0px">
        <ScrollGlobeStage locale={locale} audience={audience} />
      </LazySection>

      {/* 3. Scroll-Built Smartphone Hardware & Sensor Mockup (Apple Hardware Reveal) */}
      <LazySection id="sensors" placeholderHeight={720} rootMargin="520px 0px">
        <SensorShowcase locale={locale} audience={audience} />
      </LazySection>

      {/* 4. Real-World Inspiration & Multi-Crisis Atlas (Spain Rail, Valencia DANA, Indonesia/Nepal, Venezuela, Traffic, Fire, NL) */}
      <LazySection id="crises" placeholderHeight={620} rootMargin="520px 0px">
        <CrisisAtlas locale={locale} audience={audience} />
      </LazySection>

      {/* 5. Palantir-Grade Interactive Engineering Labs Hub (All 5 Real Working Simulators!) */}
      <LazySection id="labs" placeholderHeight={680} rootMargin="450px 0px">
        <InteractiveLabsHub locale={locale} defaultLab="telecom" id="labs-panel" />
      </LazySection>

      {/* 6. Three Core Engines + Verifiable Metrics */}
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

          <div className="s-grid s-grid-4" style={{ marginTop: 12 }}>
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

      {/* 7. Complete Suite of 12 Live Services & Interactive Modules */}
      <LazySection id="services" placeholderHeight={520} rootMargin="500px 0px">
        <ServiceCatalogSection locale={locale} title={c.servicesTitle} lead={c.servicesLead} />
      </LazySection>

      {/* 8. Technical & Broadcast Films (Mobile-Optimized with Auto Browser Language & ES/EN/NL Subtitles) */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <Reveal>
            <div className="s-read">
              <h2 className="s-h2">{c.flagshipFilmTitle}</h2>
              <p className="s-lead">{c.flagshipFilmLead}</p>
            </div>
          </Reveal>

          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              ambientAutoplay
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
              ambientAutoplay
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

      {/* 9. Human-Led AI Orchestration & Vibe Coding Craftsmanship */}
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

      {/* 10. Audience Shortcuts */}
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
