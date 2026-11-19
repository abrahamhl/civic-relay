'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldAlert, CheckCircle2, Radio, Lock, AlertTriangle } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import { PIPELINE_STAGES, PRODUCT_SCENES } from '../data/home-product';
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
          <rect x="44" y="122" width="110" height="48" rx="10" fill="var(--s-bg-elev)" stroke="var(--s-line-strong)" />
          <text x="64" y="150" fill="var(--s-text)" fontSize="13" fontWeight="600">Family SOS</text>
          <line x1="154" y1="146" x2="212" y2="146" stroke="var(--s-crit)" strokeWidth="2" strokeDasharray="4 4" />
          <rect x="406" y="122" width="110" height="48" rx="10" fill="var(--s-bg-elev)" stroke="var(--s-line-strong)" />
          <text x="424" y="150" fill="var(--s-text-2)" fontSize="13" fontWeight="600">No Delivery</text>
          <text x="150" y="256" fill="var(--s-text-2)" fontSize="13">Cellular-only baseline: 480 min until tower recovery</text>
        </svg>
      </div>
    );
  }

  if (sceneIndex === 1) {
    return (
      <div className="s-stack" style={{ width: '100%' }}>
        <div className="s-between">
          <span className="s-micro s-faint s-mono">SCENE 02 · MULTIPATH RACE</span>
          <EvidenceBadge locale={locale} evidenceId="EV-S01-ROUTE" compact />
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
          <text x="205" y="254" fill="var(--s-text-2)" fontSize="12">SMS / Gateway / Acoustic</text>
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
        icon: ShieldAlert,
        title: locale === 'es' ? 'Autorización verificada' : locale === 'nl' ? 'Geverifieerde autorisatie' : 'Verified trigger',
        text:
          locale === 'es'
            ? 'Solo zona CAP oficial o sismo corroborado por múltiples fuentes.'
            : locale === 'nl'
            ? 'Alleen officiële CAP-zone of meervoudig bevestigde beving.'
            : 'Requires verified CAP emergency zone or multi-source corroborated quake.'
      },
      {
        icon: Lock,
        title: locale === 'es' ? 'Relés ciegos E2E' : locale === 'nl' ? 'Blinde E2E-relays' : 'Blind E2EE relays',
        text:
          locale === 'es'
            ? 'ECDH P-256 + AES-GCM: ningún teléfono intermedio lee el contenido.'
            : locale === 'nl'
            ? 'ECDH P-256 + AES-GCM: geen enkel tussenstation leest de inhoud.'
            : 'ECDH P-256 + AES-GCM: intermediate handsets never see message plaintext.'
      },
      {
        icon: Radio,
        title: locale === 'es' ? 'Límites de SO y batería' : locale === 'nl' ? 'OS- en accugrenzen' : 'OS & battery caps',
        text:
          locale === 'es'
            ? 'Consentimiento al instalar + toque explícito si la radio está apagada.'
            : locale === 'nl'
            ? 'Toestemming bij installatie + expliciete tik bij uitgeschakelde radio.'
            : 'Install-time opt-in + user tap if radio is off (Android 13+ / iOS).'
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
        <span className="s-micro s-faint s-mono">SCENE 05 · EVIDENCE BOUNDARY</span>
        <EvidenceBadge locale={locale} evidenceId="EV-09-PHY" compact />
      </div>
      <div className="s-card" style={{ padding: 18 }}>
        <div className="s-row" style={{ marginBottom: 10 }}>
          <CheckCircle2 size={18} style={{ color: 'var(--s-ok)' }} aria-hidden="true" />
          <strong>
            {locale === 'es' ? 'Verificado en software' : locale === 'nl' ? 'Geverifieerd in software' : 'Verified in software'}
          </strong>
        </div>
        <p className="s-small s-muted" style={{ margin: 0 }}>
          {locale === 'es'
            ? '506/506 tests de núcleo, 49/49 E2E offline en Chromium, APK Android compilada y 16.699 elementos reales en consola.'
            : locale === 'nl'
            ? '506/506 kerntests, 49/49 offline Chromium E2E, gecompileerde Android-APK en 16.699 echte console-items.'
            : '506/506 core unit tests, 49/49 offline Chromium E2E, compiled Android lab APK, and 16,699 real console snapshots.'}
        </p>
      </div>
      <div className="s-card" style={{ padding: 18 }}>
        <div className="s-row" style={{ marginBottom: 10 }}>
          <AlertTriangle size={18} style={{ color: 'var(--s-warn)' }} aria-hidden="true" />
          <strong>
            {locale === 'es' ? 'No probado físicamente todavía' : locale === 'nl' ? 'Nog niet fysiek getest' : 'Not physically proven yet'}
          </strong>
        </div>
        <p className="s-small s-muted" style={{ margin: 0 }}>
          {locale === 'es'
            ? '0/30 pruebas físicas Android↔Android, sin integración 112, sin enlace satelital operativo ni radar trans-pared validado.'
            : locale === 'nl'
            ? '0/30 fysieke Android↔Android-proeven, geen 112-koppeling, geen operationele satelliet en geen door-muur veldvalidatie.'
            : '0/30 physical Android-to-Android trials, no live 112 integration, no licensed satellite link, and no field through-wall validation.'}
        </p>
      </div>
      <a href={localeHref(locale, 'evidence')} className="s-btn s-btn-secondary">
        <span>{SITE_STRINGS[locale].ctaEvidence}</span>
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
      eyebrow: 'PRODUCT ARCHITECTURE',
      title: 'Five scenes from blackout to verifiable receipt.',
      lead: 'How SENDA routes emergency messages across surviving channels without overclaiming operational readiness.',
      pipeTitle: 'End-to-end deterministic message lifecycle',
      videoTitle: 'Offline messaging & guided flow captures'
    },
    es: {
      eyebrow: 'ARQUITECTURA DE PRODUCTO',
      title: 'Cinco escenas del apagón al recibo verificable.',
      lead: 'Cómo SENDA enruta mensajes de emergencia por canales alternativos separando el diseño verificado de lo pendiente de campo.',
      pipeTitle: 'Ciclo determinista completo del mensaje',
      videoTitle: 'Capturas reales de mensajería sin red y flujo guiado'
    },
    nl: {
      eyebrow: 'PRODUCTARCHITECTUUR',
      title: 'Vijf scènes van netwerkuitval tot ontvangstbewijs.',
      lead: 'Hoe SENDA noodberichten routeert via overlevende kanalen met een heldere scheiding tussen bewezen software en veldvalidatie.',
      pipeTitle: 'Deterministische levenscyclus van elk bericht',
      videoTitle: 'Echte opnames van offline berichten en begeleide flow'
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

          {/* Persistent CTA Bar */}
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

      {/* Real videos */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">{heading.videoTitle}</h2>
          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-demo-guiada.mp4"
              poster="/media/senda-capacidades-poster-es.jpg"
              caption={
                locale === 'es'
                  ? 'Demo guiada de capacidades en la aplicación web sin red'
                  : locale === 'nl'
                  ? 'Begeleide demo van offline functies in de webapp'
                  : 'Guided walkthrough of capabilities inside the offline web app'
              }
              evidenceId="EV-OFFLINE-49"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-60s-en.mp4"
              vttSrc={`/media/m95/senda-m95-60s-${locale}.vtt`}
              poster="/media/m95/senda-m95-film-poster.jpg"
              caption={
                locale === 'es'
                  ? 'Resumen de 60 s con subtítulos en español'
                  : locale === 'nl'
                  ? '60 s overzicht met Nederlandse ondertiteling'
                  : '60-second overview with captions'
              }
              evidenceId="EV-S01-ROUTE"
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
