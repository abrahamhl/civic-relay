'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Cpu,
  Orbit,
  Radio,
  ShieldCheck
} from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import Reveal from '../components/Reveal';
import MediaVideo from '../components/MediaVideo';
import AudienceLens, { type AudienceMode } from '../components/AudienceLens';
import LazySection from '../components/LazySection';
import LivingScrollDock from '../components/LivingScrollDock';
import { HOME_COPY } from '../data/home-product';
import { localeHref, type Locale } from '../data/types';

// Lazy-loaded heavyweight interactive engines: 0 bytes in initial Home JS, instant mount on scroll
const ScrollBlueprintStage = dynamic(() => import('../components/ScrollBlueprintStage'), { ssr: false });
const LivePacketRaceSim = dynamic(() => import('../components/LivePacketRaceSim'), { ssr: false });
const InnovationShowcase = dynamic(() => import('../components/InnovationShowcase'), { ssr: false });
const LiveSimulatorsBay = dynamic(() => import('../components/LiveSimulatorsBay'), { ssr: false });
const MissionControlDeck = dynamic(() => import('../components/MissionControlDeck'), { ssr: false });
const OsintIntelligenceDeck = dynamic(() => import('../components/OsintIntelligenceDeck'), { ssr: false });
const OrbitalOjoDeck = dynamic(() => import('../components/OrbitalOjoDeck'), { ssr: false });
const SensorShowcase = dynamic(() => import('../components/SensorShowcase'), { ssr: false });
const CrisisAtlas = dynamic(() => import('../components/CrisisAtlas'), { ssr: false });
const InteractiveLabsHub = dynamic(() => import('../components/InteractiveLabsHub'), { ssr: false });
const FullCapabilityMatrix = dynamic(() => import('../components/FullCapabilityMatrix'), { ssr: false });
const ActionMissionDock = dynamic(() => import('../components/ActionMissionDock'), { ssr: false });

export default function HomePage({ locale }: { locale: Locale }) {
  const c = HOME_COPY[locale];
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
      en: '3D WebGL Mission Control, OSINT CCTV 1/4/9 matrix + FOV cones, live Iridium/Galileo/QO-100 constellations, 24-byte 3GPP NTN bursts, 64-subcarrier OFDM CSI wall radar, Contact Graph Routing (94.2% / -84% mJ) & 38 working offline modules.',
      es: 'Mission Control 3D WebGL, matriz OSINT CCTV 1/4/9 + conos FOV, constelaciones Iridium/Galileo/QO-100 en vivo, ráfagas 3GPP NTN de 24 B, radar Wi-Fi CSI OFDM de 64 subportadoras, CGR (94,2 % / -84 % mJ) y 38 módulos activos.',
      nl: '3D WebGL Mission Control, OSINT CCTV-matrix + FOV-kegels, live Iridium/Galileo/QO-100 satellieten, 24-byte 3GPP NTN bursts, 64-subcarrier OFDM CSI en 38 werkende modules.'
    }
  };

  const heroStatus = {
    es: '506/506 PRUEBAS CORE · 38 MÓDULOS · OSINT + SATÉLITES + MALLA SIN RED',
    en: '506/506 CORE TESTS · 38 LIVE MODULES · OSINT + SATELLITES + OFFLINE MESH',
    nl: '506/506 KERNTESTS · 38 LIVE MODULES · OSINT + SATELLIETEN + OFFLINE MESH'
  }[locale];

  const quickCtas = {
    es: {
      sim3d: 'Mission Control 3D',
      fieldApp: 'Abrir SENDA Campo',
      easyMode: 'Modo fácil (3 botones)'
    },
    en: {
      sim3d: '3D Mission Control',
      fieldApp: 'Open SENDA Field',
      easyMode: 'Easy mode (3 buttons)'
    },
    nl: {
      sim3d: '3D Mission Control',
      fieldApp: 'Open SENDA Veld',
      easyMode: '3-knoppen modus'
    }
  }[locale];

  return (
    <PageShell locale={locale} active="home">
      {/* 1. Aerospace Command Hero — Deep Obsidian + Instant Cinema Film + Audience Clarity Lens */}
      <section className="s-hero s-hero-command" id="hero-cinema">
        <div className="s-hero-grid-bg" aria-hidden="true" />
        <div className="s-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="s-hero-status">
            <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" compact />
            <span className="s-mono" style={{ fontSize: 11.5 }}>{heroStatus}</span>
          </div>

          <h1 className="s-display s-center" style={{ maxWidth: '18ch', marginTop: 10 }}>
            {c.headline}
          </h1>
          <p className="s-small s-center" style={{ marginTop: 8, color: 'var(--s-accent)', fontWeight: 600 }}>
            {c.tagline}
          </p>
          <p className="s-lead" style={{ marginTop: 10 }}>
            {heroAudienceLead[audience][locale]}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <AudienceLens locale={locale} value={audience} onChange={setAudience} />
          </div>

          <div className="s-hero-cta" style={{ marginTop: 16 }}>
            <a href="#simulador-vivo" className="s-btn s-btn-coral" data-testid="hero-cta-platform">
              <Orbit size={17} aria-hidden="true" />
              <span>{quickCtas.sim3d}</span>
            </a>
            <a href="/senda/" className="s-btn s-btn-primary" data-testid="hero-cta-product">
              <Radio size={16} aria-hidden="true" />
              <span>{quickCtas.fieldApp}</span>
            </a>
            <a href={localeHref(locale, 'platform')} className="s-btn s-btn-secondary">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{c.ctaPrimary}</span>
            </a>
          </div>

          {/* Crisp outcome explainer right below primary CTAs */}
          <div className="s-hero-cta-hints">
            <span>
              {locale === 'es'
                ? '1. Simulador SOS en vivo + Globo 3D: prueba en 15 s cómo llega un aviso sin cobertura.'
                : locale === 'nl'
                ? '1. Live SOS-simulator + 3D Globe: zie in 15 s hoe een noodbericht zonder bereik aankomt.'
                : '1. Live SOS Simulator + 3D Globe: test in 15 s how an alert routes with zero signal.'}
            </span>
            <span>
              {locale === 'es'
                ? '2. SENDA Campo (PWA): abre la app real offline en modo avión sin registro ni rastreo.'
                : locale === 'nl'
                ? '2. SENDA Veld (PWA): open de echte offline app in vliegtuigmodus zonder account.'
                : '2. SENDA Field (PWA): launch the real offline airplane-mode app with zero login.'}
            </span>
            <span>
              {locale === 'es'
                ? '3. Centro de Control: tour guiado de 6 pasos con 16.699 fuentes OSINT y cámaras FOV.'
                : locale === 'nl'
                ? '3. Controlecentrum: rondleiding in 6 stappen met 16.699 OSINT-bronnen en FOV-camera’s.'
                : '3. Control Center: 6-step guided tour with 16,699 OSINT feeds & FOV cameras.'}
            </span>
          </div>

          {/* Integrated Cinema Presentation Film right above the fold (Auto-detect browser lang + ES/EN/NL subtitles) */}
          <div style={{ marginTop: 28, textAlign: 'left' }}>
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
                  ? 'Película oficial SENDA 2026 · Origen, accidentes en España, satélites, OSINT y simulaciones en vivo'
                  : locale === 'nl'
                  ? 'Officiële SENDA-film 2026 · Oorsprong, satellieten, OSINT en live simulaties'
                  : 'Official SENDA Master Film 2026 · Origin, satellites, OSINT & live core simulations'
              }
              caption={
                locale === 'es'
                  ? 'Audio automático según tu navegador (ES / EN) con subtítulos en Español, Inglés y Neerlandés.'
                  : locale === 'nl'
                  ? 'Automatische browsertaaldetectie met Spaanse, Engelse en Nederlandse ondertitels.'
                  : 'Automatically matches your browser language with one-tap Spanish, English, and Dutch subtitles.'
              }
              evidenceId="EV-CONSOLE-16K"
            />
          </div>
        </div>
      </section>

      {/* 2. SCROLL-BUILT KINETIC ARCHITECTURE STAGE (Sticky Live Blueprint constructs layer-by-layer on scroll) */}
      <LazySection id="construccion-viva" placeholderHeight={720} rootMargin="140px 0px">
        <ScrollBlueprintStage locale={locale} />
      </LazySection>

      {/* 3. HANDS-ON LIVE SOS PACKET RACE SIMULATOR (Pick crisis + cut towers + compare Traditional vs SENDA) */}
      <LazySection id="simulador-vivo" placeholderHeight={680} rootMargin="220px 0px">
        <LivePacketRaceSim locale={locale} />
      </LazySection>

      {/* 4. INNOVATION ARCHITECTURE: WHAT WE SOLVE, HOW WE DO IT, BREAKTHROUGHS & ALL REAL DEMO VIDEOS */}
      <LazySection id="innovacion" placeholderHeight={740} rootMargin="240px 0px">
        <InnovationShowcase locale={locale} audience={audience} />
      </LazySection>

      {/* 5. LIVE 3D/4D SIMULATORS BAY (6 Real Embedded SENDA Apps + 7 Interactive Vector Engineering Renders) */}
      <LazySection id="simuladores-3d" placeholderHeight={700} rootMargin="240px 0px">
        <LiveSimulatorsBay locale={locale} />
      </LazySection>

      {/* 3. LIVE 3D RAYCAST MISSION CONTROL (Earth · Moon · Mars + Satellites + Sectors + Timeline) */}
      <LazySection id="mission-3d" placeholderHeight={680} rootMargin="240px 0px">
        <MissionControlDeck locale={locale} audience={audience} />
      </LazySection>

      {/* 3. REAL OSINT & SECTOR INTELLIGENCE CCTV CONSOLE (1/4/9 Matrix + FOV Cones + 8-Stage OSINT Pipeline) */}
      <LazySection id="osint-cctv" placeholderHeight={720} rootMargin="240px 0px">
        <OsintIntelligenceDeck locale={locale} audience={audience} />
      </LazySection>

      {/* 4. LIVE OJO DE SENDA (Iridium · Galileo · QO-100) + HYPERFRAMES 5-ACT CINEMA + 7-SCENE ANIMATED STORY */}
      <LazySection id="ojo-satelites" placeholderHeight={660} rootMargin="240px 0px">
        <OrbitalOjoDeck locale={locale} audience={audience} />
      </LazySection>

      {/* 5. SCROLL-BUILT SMARTPHONE HARDWARE & SENSOR MOCKUP (All 6 Phone Sensors Animated) */}
      <LazySection id="sensors" placeholderHeight={700} rootMargin="240px 0px">
        <SensorShowcase locale={locale} audience={audience} />
      </LazySection>

      {/* 6. REAL-WORLD INSPIRATION & MULTI-CRISIS ATLAS (Spain Rail, Valencia DANA, Indonesia/Nepal, Venezuela, Traffic, Fire, NL) */}
      <LazySection id="crises" placeholderHeight={620} rootMargin="240px 0px">
        <CrisisAtlas locale={locale} audience={audience} />
      </LazySection>

      {/* 7. PALANTIR 7-SIMULATOR ENGINEERING WORKBENCH (NTN/CSI, CommandSurface 90KB, Rail, Doppler, 3D Building, 5 Theorems, WebCrypto/L2.5) */}
      <LazySection id="labs" placeholderHeight={720} rootMargin="240px 0px">
        <InteractiveLabsHub locale={locale} defaultLab="telecom" id="labs-panel" />
      </LazySection>

      {/* 8. COMPLETE 38-CAPABILITY SENDA MATRIX + 9:16 VERTICAL MOBILE REELS & FULL FILM LIBRARY */}
      <LazySection id="all-capabilities" placeholderHeight={680} rootMargin="240px 0px">
        <FullCapabilityMatrix locale={locale} />
      </LazySection>

      {/* 9. Verified Metrics + Human-Led AI Orchestration & Vibe Coding Craftsmanship */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
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

          <div className="s-read" style={{ marginTop: 24 }}>
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

      {/* 10. High-Clarity Role-Based Mission Entry CTAs ("Know exactly what opens before clicking") */}
      <div style={{ paddingBottom: 88 }}>
        <LazySection id="entrar-en-senda" placeholderHeight={520} rootMargin="240px 0px">
          <ActionMissionDock locale={locale} />
        </LazySection>
      </div>

      {/* Floating Glass Living Command Dock (scroll % + 1-tap simulator jump bar) */}
      <LivingScrollDock locale={locale} />
    </PageShell>
  );
}
