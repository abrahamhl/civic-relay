'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2, Radio, Lock, Layers, ExternalLink } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import { SERVICE_CATALOG } from '../data/home-product';
import { PIPELINE_STAGES, PRODUCT_SCENES } from '../data/product';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, type Locale } from '../data/types';

function SceneVisual({ sceneIndex, locale }: { sceneIndex: number; locale: Locale }) {
  if (sceneIndex === 0) {
    return (
      <div className="s-stack" style={{ width: '100%' }}>
        <div className="s-between">
          <span className="s-micro s-faint s-mono">SCENE 01 · SINGLE POINT OF FAILURE</span>
          <EvidenceBadge locale={locale} evidenceId="EV-S01-ROUTE" compact />
        </div>
        <svg viewBox="0 0 560 300" role="img" aria-label="Cellular tower outage diagram" style={{ width: '100%', height: 'auto' }}>
          <rect x="16" y="16" width="528" height="268" rx="16" fill="var(--s-bg-sunk)" stroke="var(--s-line)" />
          <circle cx="280" cy="146" r="68" fill="var(--s-crit)" fillOpacity="0.08" stroke="var(--s-crit)" strokeDasharray="5 5" />
          <line x1="280" y1="96" x2="280" y2="196" stroke="var(--s-crit)" strokeWidth="3" />
          <line x1="256" y1="120" x2="304" y2="168" stroke="var(--s-crit)" strokeWidth="2.5" />
          <line x1="304" y1="120" x2="256" y2="168" stroke="var(--s-crit)" strokeWidth="2.5" />
          <rect x="44" y="122" width="116" height="48" rx="10" fill="var(--s-bg-elev)" stroke="var(--s-line-strong)" />
          <text x="64" y="150" fill="var(--s-text)" fontSize="13" fontWeight="600">Family SOS</text>
          <line x1="160" y1="146" x2="212" y2="146" stroke="var(--s-crit)" strokeWidth="2" strokeDasharray="4 4" />
          <rect x="400" y="122" width="116" height="48" rx="10" fill="var(--s-bg-elev)" stroke="var(--s-line-strong)" />
          <text x="418" y="150" fill="var(--s-text-2)" fontSize="13" fontWeight="600">480 min wait</text>
          <text x="150" y="256" fill="var(--s-text-2)" fontSize="13">Cellular-only baseline waits 8 hours until tower restoration</text>
        </svg>
      </div>
    );
  }

  if (sceneIndex === 1) {
    return (
      <div className="s-stack" style={{ width: '100%' }}>
        <div className="s-between">
          <span className="s-micro s-faint s-mono">SCENE 02 · MULTIPATH RACE</span>
          <EvidenceBadge locale={locale} evidenceId="EV-ARR-V2" compact />
        </div>
        <svg viewBox="0 0 560 300" role="img" aria-label="Multipath routing animation" style={{ width: '100%', height: 'auto' }}>
          <rect x="16" y="16" width="528" height="268" rx="16" fill="var(--s-bg-sunk)" stroke="var(--s-line)" />
          <path d="M90 150 C190 60, 370 60, 470 150" fill="none" stroke="var(--s-warn)" strokeWidth="2" className="s-route-anim" />
          <path d="M90 150 C210 150, 350 150, 470 150" fill="none" stroke="var(--s-accent)" strokeWidth="3" className="s-route-anim" />
          <path d="M90 150 C190 240, 370 240, 470 150" fill="none" stroke="var(--s-ok)" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx="90" cy="150" r="16" fill="var(--s-bg-elev)" stroke="var(--s-accent)" strokeWidth="2" />
          <text x="72" y="192" fill="var(--s-text)" fontSize="12" fontWeight="600">Sender</text>
          <circle cx="280" cy="76" r="7" fill="var(--s-warn)" />
          <text x="218" y="56" fill="var(--s-text-2)" fontSize="12">LEO D2D Pass (~91 m)</text>
          <circle cx="230" cy="150" r="7" fill="var(--s-accent)" />
          <circle cx="330" cy="150" r="7" fill="var(--s-accent)" />
          <text x="195" y="134" fill="var(--s-text)" fontSize="12" fontWeight="600">BLE -&gt; Neighbor Sat (~4 m)</text>
          <circle cx="280" cy="224" r="7" fill="var(--s-ok)" />
          <text x="200" y="254" fill="var(--s-text-2)" fontSize="12">SMS / LoRa / Acoustic MFSK-16</text>
          <circle cx="470" cy="150" r="16" fill="var(--s-ok-soft)" stroke="var(--s-ok)" strokeWidth="2" />
          <text x="454" y="192" fill="var(--s-ok)" fontSize="12" fontWeight="600">ACK</text>
        </svg>
      </div>
    );
  }

  if (sceneIndex === 2) {
    return (
      <div className="s-stack" style={{ width: '100%' }}>
        <div className="s-between">
          <span className="s-micro s-faint s-mono">SCENE 03 · 6-STAGE PIPELINE</span>
          <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" compact />
        </div>
        <div className="s-grid s-grid-2" style={{ gap: 10 }}>
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.code} className="s-pipe">
              <div className="s-pipe-num">0{i + 1}</div>
              <b>{stage.code}</b>
              <span>{stage.desc[locale]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sceneIndex === 3) {
    const rules = [
      {
        icon: ShieldCheck,
        title: locale === 'es' ? 'Activación por zona verificada' : locale === 'nl' ? 'Geverifieerde zone-activering' : 'Verified zone activation',
        text:
          locale === 'es'
            ? 'Activación mediante alerta oficial CAP o evento sísmico corroborado por múltiples fuentes.'
            : locale === 'nl'
            ? 'Activering via officiële CAP-melding of meervoudig bevestigde aardbeving.'
            : 'Triggered by official CAP emergency zone or multi-source corroborated seismic detection.'
      },
      {
        icon: Lock,
        title: locale === 'es' ? 'Relés ciegos E2E' : locale === 'nl' ? 'Blinde E2E-relays' : 'Blind E2EE relays',
        text:
          locale === 'es'
            ? 'ECDH P-256 + AES-GCM: cada teléfono intermedio transporta sobres cifrados con total privacidad.'
            : locale === 'nl'
            ? 'ECDH P-256 + AES-GCM: tussenstations dragen versleutelde pakketten met volledige privacy.'
            : 'ECDH P-256 + AES-GCM: intermediate handsets carry encrypted envelopes with full privacy.'
      },
      {
        icon: Radio,
        title: locale === 'es' ? 'Cuotas de SO y batería' : locale === 'nl' ? 'OS- en accuquotums' : 'OS & battery budgets',
        text:
          locale === 'es'
            ? 'Consentimiento al instalar + protección automática de batería y permisos nativos de Android/iOS.'
            : locale === 'nl'
            ? 'Toestemming bij installatie + automatische accubescherming en Android/iOS-machtigingen.'
            : 'Install-time opt-in + automatic battery conservation respecting Android/iOS radio permissions.'
      }
    ];
    return (
      <div className="s-stack" style={{ width: '100%' }}>
        <div className="s-between">
          <span className="s-micro s-faint s-mono">SCENE 04 · PRE-AUTHORIZED RELAY</span>
          <EvidenceBadge locale={locale} evidenceId="EV-02-SWEEP" compact />
        </div>
        {rules.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="s-card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="s-card-icon" style={{ marginBottom: 0, width: 36, height: 36 }}>
                <Icon size={18} aria-hidden="true" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{r.title}</div>
                <div className="s-small s-muted">{r.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="s-stack" style={{ width: '100%' }}>
      <div className="s-between">
        <span className="s-micro s-faint s-mono">SCENE 05 · FULL SENDA ECOSYSTEM</span>
        <EvidenceBadge locale={locale} evidenceId="EV-CONSOLE-16K" compact />
      </div>
      <div className="s-card" style={{ padding: 18 }}>
        <div className="s-row" style={{ marginBottom: 8 }}>
          <CheckCircle2 size={18} style={{ color: 'var(--s-ok)' }} aria-hidden="true" />
          <strong>
            {locale === 'es' ? 'Núcleo, PWA sin red y consola operativa' : locale === 'nl' ? 'Kern, offline PWA & situatieconsole' : 'Core protocol, offline PWA & live console'}
          </strong>
        </div>
        <p className="s-small s-muted" style={{ margin: 0 }}>
          {locale === 'es'
            ? '506/506 tests de núcleo, 49/49 E2E offline en Chromium, APK Android Nearby, firmware ESP32 y 16.699 fuentes fusionadas.'
            : locale === 'nl'
            ? '506/506 kerntests, 49/49 offline Chromium E2E, Android Nearby-APK, ESP32-firmware en 16.699 gefuseerde bronnen.'
            : '506/506 core tests, 49/49 offline Chromium E2E, Android Nearby APK, ESP32 survey firmware, and 16,699 fused sources.'}
        </p>
      </div>
      <div className="s-card" style={{ padding: 18 }}>
        <div className="s-row" style={{ marginBottom: 8 }}>
          <Layers size={18} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
          <strong>
            {locale === 'es' ? 'Motores científicos y visores 3D/4D' : locale === 'nl' ? 'Wetenschappelijke engines & 3D/4D-viewers' : 'Scientific engines & 3D/4D viewers'}
          </strong>
        </div>
        <p className="s-small s-muted" style={{ margin: 0 }}>
          {locale === 'es'
            ? 'Incendios 3D (SENDA-3D), aislamiento vial EMSR773, agua en Países Bajos (RWS), ferrocarril multi-tren, edificios 3D y 5 papers.'
            : locale === 'nl'
            ? '3D-natuurbranden, EMSR773-isolatie, RWS-watergolven NL, spoorfusie, 3D-gebouwen en 5 papers.'
            : 'SENDA-3D wildfire wind, EMSR773 flood isolation, Dutch RWS hydrology, multi-train rail fusion, 3D buildings, and 5 papers.'}
        </p>
      </div>
      <a href={localeHref(locale, 'platform')} className="s-btn s-btn-primary">
        <span>{SITE_STRINGS[locale].ctaPlatform}</span>
        <ArrowRight aria-hidden="true" />
      </a>
    </div>
  );
}

export default function ProductPage({ locale }: { locale: Locale }) {
  const ui = SITE_STRINGS[locale];
  const [activeScene, setActiveScene] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.sceneIndex);
            if (!Number.isNaN(idx)) setActiveScene(idx);
          }
        }
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: 0.05 }
    );
    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const heading = {
    en: {
      eyebrow: 'PRODUCT ARCHITECTURE & CAPABILITIES',
      title: 'Five scenes from cellular blackout to verifiable coordination.',
      lead: 'How SENDA routes critical messages across every surviving channel and unifies citizens, responders, and environmental telemetry.',
      pipeTitle: 'End-to-end deterministic message lifecycle',
      videoTitle: 'Multilingual product & capability showcase',
      videoLead: 'Automatically adapts to your browser language with switchable ES / EN / NL subtitles.',
      modulesTitle: 'Explore every functional module'
    },
    es: {
      eyebrow: 'ARQUITECTURA DE PRODUCTO Y CAPACIDADES',
      title: 'Cinco escenas del apagón a la coordinación verificable.',
      lead: 'Cómo SENDA enruta mensajes críticos por cada canal disponible y coordina a ciudadanía, equipos de emergencia y telemetría ambiental.',
      pipeTitle: 'Ciclo determinista completo del mensaje',
      videoTitle: 'Vídeos completos de producto y capacidades',
      videoLead: 'Detección automática del idioma de tu navegador con subtítulos activables en Español, Inglés y Neerlandés.',
      modulesTitle: 'Explora todos los módulos operativos'
    },
    nl: {
      eyebrow: 'PRODUCTARCHITECTUUR & FUNCTIES',
      title: 'Vijf scènes van netwerkuitval tot gecoördineerde hulp.',
      lead: 'Hoe SENDA kritieke berichten over elk overlevend kanaal routeert en burgers, hulpdiensten en omgevingstelemetrie verbindt.',
      pipeTitle: 'Deterministische levenscyclus van elk bericht',
      videoTitle: 'Meertalige product- en functievideo’s',
      videoLead: 'Past zich automatisch aan uw browsertaal aan met schakelbare ES / EN / NL ondertiteling.',
      modulesTitle: 'Verken alle interactieve modules'
    }
  }[locale];

  return (
    <PageShell locale={locale} active="product">
      <section className="s-section-tight">
        <div className="s-container">
          <div className="s-read">
            <p className="s-eyebrow">{heading.eyebrow}</p>
            <h1 className="s-h1">{heading.title}</h1>
            <p className="s-lead">{heading.lead}</p>
          </div>
        </div>
      </section>

      {/* Sticky 5-Scene Story */}
      <section className="s-section-tight s-sunk">
        <div className="s-container">
          <div className="s-story">
            <div className="s-story-steps">
              {PRODUCT_SCENES.map((scene, idx) => (
                <article
                  key={scene.num}
                  ref={(el) => {
                    stepRefs.current[idx] = el;
                  }}
                  data-scene-index={idx}
                  className={`s-story-step ${activeScene === idx ? 'is-active' : ''}`}
                >
                  <p className="s-eyebrow">{scene.eyebrow[locale]}</p>
                  <h2 className="s-h2" style={{ fontSize: 'clamp(28px, 3vw, 40px)' }}>
                    {scene.title[locale]}
                  </h2>
                  <p>{scene.body[locale]}</p>
                  <p className="s-small s-faint" style={{ marginTop: 14 }}>
                    {scene.detail[locale]}
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <EvidenceBadge locale={locale} evidenceId={scene.evidenceId} />
                  </div>
                  <div className="s-story-inline">
                    <SceneVisual sceneIndex={idx} locale={locale} />
                  </div>
                </article>
              ))}
            </div>

            <div className="s-story-visual" aria-live="polite">
              {PRODUCT_SCENES.map((scene, idx) => (
                <div
                  key={scene.num}
                  className={`s-story-pane ${activeScene === idx ? 'is-active' : ''}`}
                >
                  <SceneVisual sceneIndex={idx} locale={locale} />
                </div>
              ))}
            </div>
          </div>

          <div className="s-sticky-cta" role="region" aria-label="Product actions">
            <span className="s-small s-muted" style={{ paddingLeft: 8 }}>
              {ui.tagline}
            </span>
            <div className="s-row">
              <a href={localeHref(locale, 'platform')} className="s-btn s-btn-primary s-btn-sm">
                <span>{ui.ctaPlatform}</span>
                <ArrowRight aria-hidden="true" />
              </a>
              <a href={`${localeHref(locale, 'investors')}#dossier`} className="s-btn s-btn-secondary s-btn-sm">
                {ui.ctaDossier}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Clean 6-stage pipeline */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <h2 className="s-h2">{heading.pipeTitle}</h2>
            <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" />
          </div>
          <div className="s-pipeline">
            {PIPELINE_STAGES.map((st, idx) => (
              <div key={st.code} className="s-pipe">
                <div className="s-pipe-num">0{idx + 1}</div>
                <b>{st.code}</b>
                <span>{st.desc[locale]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multilingual Videos Showcase */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <div className="s-read">
            <h2 className="s-h2">{heading.videoTitle}</h2>
            <p className="s-lead">{heading.videoLead}</p>
          </div>
          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/senda-ruta-es.mp4"
              sources={{
                es: '/media/senda-ruta-es.mp4',
                en: '/media/senda-ruta-en.mp4'
              }}
              posters={{
                es: '/media/senda-ruta-poster-es.jpg',
                en: '/media/senda-ruta-poster-en.jpg'
              }}
              subtitles={{
                es: '/media/senda-ruta-es.vtt',
                en: '/media/senda-ruta-en.vtt',
                nl: '/media/senda-ruta-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Enrutamiento multicanal y carrera de caminos'
                  : locale === 'nl'
                  ? 'Multikanaal-routering en padkeuze'
                  : 'Multi-channel routing & path racing'
              }
              caption={
                locale === 'es'
                  ? 'Cómo SENDA selecciona en paralelo Bluetooth, satélite vecino, SMS y pasarelas.'
                  : locale === 'nl'
                  ? 'Hoe SENDA Bluetooth, buursatelliet, sms en gateways parallel combineert.'
                  : 'How SENDA races Bluetooth, neighbor satellite, SMS, and gateways in parallel.'
              }
              evidenceId="EV-S01-ROUTE"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-reel-blacksky-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-reel-blacksky-es.mp4',
                en: '/media/m95/senda-m95-reel-blacksky-en.mp4'
              }}
              poster="/media/m95/senda-m95-reel-blacksky-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-reel-blacksky-es.vtt',
                en: '/media/m95/senda-m95-reel-blacksky-en.vtt',
                nl: '/media/m95/senda-m95-reel-blacksky-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Escenario Black-Sky · Continuidad en apagón total'
                  : locale === 'nl'
                  ? 'Black-Sky Scenario · Continuïteit bij stroomuitval'
                  : 'Black-Sky Scenario · Continuity under full outage'
              }
              caption={
                locale === 'es'
                  ? 'Respuesta de la malla preautorizada cuando cae la infraestructura terrestre.'
                  : locale === 'nl'
                  ? 'Reactie van het vooraf geautoriseerde mesh-netwerk bij volledige uitval.'
                  : 'Pre-authorized mesh behavior during wide-area terrestrial blackouts.'
              }
              evidenceId="EV-ARR-V2"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-role-citizen-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-role-citizen-es.mp4',
                en: '/media/m95/senda-m95-role-citizen-en.mp4'
              }}
              poster="/media/m95/senda-m95-role-citizen-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-role-citizen-es.vtt',
                en: '/media/m95/senda-m95-role-citizen-en.vtt',
                nl: '/media/m95/senda-m95-role-citizen-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Experiencia ciudadana · Aviso SAFE / SOS en un toque'
                  : locale === 'nl'
                  ? 'Burgerervaring · SAFE / SOS-melding in één tik'
                  : 'Citizen experience · One-tap SAFE / SOS continuity'
              }
              caption={
                locale === 'es'
                  ? 'Flujo simple y accesible para familias durante una emergencia.'
                  : locale === 'nl'
                  ? 'Eenvoudige en toegankelijke flow voor families tijdens noodsituaties.'
                  : 'Simple, accessible check-in flow for families during outages.'
              }
              evidenceId="EV-OFFLINE-49"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-role-developer-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-role-developer-es.mp4',
                en: '/media/m95/senda-m95-role-developer-en.mp4'
              }}
              poster="/media/m95/senda-m95-role-developer-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-role-developer-es.vtt',
                en: '/media/m95/senda-m95-role-developer-en.vtt',
                nl: '/media/m95/senda-m95-role-developer-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Arquitectura abierta para desarrolladores e integradores'
                  : locale === 'nl'
                  ? 'Open architectuur voor ontwikkelaars & integratoren'
                  : 'Open architecture for developers & integrators'
              }
              caption={
                locale === 'es'
                  ? 'Protocolo MIT, paquetes modulares, SDK Android y adaptadores abiertos.'
                  : locale === 'nl'
                  ? 'MIT-protocol, modulaire pakketten, Android-SDK en open adapters.'
                  : 'MIT protocol core, modular packages, Android lab, and open adapters.'
              }
              evidenceId="EV-CORE-506"
            />
          </div>
        </div>
      </section>

      {/* Complete Modules Directory */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">{heading.modulesTitle}</h2>
          <div className="s-grid s-grid-3">
            {SERVICE_CATALOG.map((svc) => (
              <a
                key={svc.id}
                href={svc.href}
                className="s-card s-card-lift"
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div className="s-between">
                  <strong style={{ fontSize: 15.5 }}>{svc.title[locale]}</strong>
                  <ExternalLink size={14} style={{ color: 'var(--s-accent)' }} aria-hidden="true" />
                </div>
                <p style={{ flex: 1 }}>{svc.desc[locale]}</p>
                <code className="s-mono s-faint">{svc.href}</code>
              </a>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
