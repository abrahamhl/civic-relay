'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ExternalLink, Film, Flame, Globe2, Satellite } from 'lucide-react';
import type { AudienceMode } from './AudienceLens';
import type { Locale } from '../data/types';

const HyperFramesCinemaDeck = dynamic(
  () => import('../../hyperframes-cinema-deck').then((m) => m.HyperFramesCinemaDeck),
  { ssr: false }
);
const CrisisStory = dynamic(() => import('../../crisis-story'), { ssr: false });
const ScrollGlobeStage = dynamic(() => import('./ScrollGlobeStage'), { ssr: false });

type OrbitalTab = 'ojo' | 'hyperframes' | 'crisis-anim' | 'orbital-3d';

export default function OrbitalOjoDeck({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const [tab, setTab] = useState<OrbitalTab>('ojo');

  const copy = {
    es: {
      eyebrow: 'CONSTELACIONES REALES EN VIVO Y ANIMACIONES CINEMATOGRÁFICAS',
      title: 'Ojo de SENDA (Iridium · Galileo · QO-100), HyperFrames y Escenas Animadas.',
      lead: 'Observa satélites reales orbitando ahora mismo sobre España y Europa, controla los 5 actos animados en tiempo real o recorre la historia animada de un apagón paso a paso.',
      tabs: [
        { id: 'ojo' as OrbitalTab, icon: Satellite, label: 'Ojo de SENDA (Satélites en vivo)' },
        { id: 'hyperframes' as OrbitalTab, icon: Film, label: 'HyperFrames 5 Actos (Animado)' },
        { id: 'crisis-anim' as OrbitalTab, icon: Flame, label: 'Historia Animada (7 Escenas)' },
        { id: 'orbital-3d' as OrbitalTab, icon: Globe2, label: 'Globo 3D Multipath' }
      ],
      constellations: [
        { name: 'Iridium · LEO (780 km)', desc: '66 satélites en órbita baja con cobertura global 100 % para sobres cifrados de hasta 340 B.' },
        { name: 'Galileo · MEO (23.222 km)', desc: '24 satélites europeos de posicionamiento preciso y búsqueda y salvamento (SAR) con enlace de retorno.' },
        { name: 'QO-100 · GEO (25,9° E)', desc: 'Satélite geoestacionario siempre visible desde España y Europa para estados públicos firmados.' }
      ],
      openOjo: 'Abrir Ojo de SENDA a pantalla completa'
    },
    en: {
      eyebrow: 'LIVE SATELLITE CONSTELLATIONS & INTERACTIVE CINEMA ANIMATIONS',
      title: 'SENDA Eye (Iridium · Galileo · QO-100), HyperFrames & Animated Crisis Story.',
      lead: 'Track real orbital constellations flying overhead right now, scrub the interactive 5-act HyperFrames cinema deck, or explore the 7-scene animated blackout story.',
      tabs: [
        { id: 'ojo' as OrbitalTab, icon: Satellite, label: 'SENDA Eye (Live Satellites)' },
        { id: 'hyperframes' as OrbitalTab, icon: Film, label: 'HyperFrames 5-Act Cinema' },
        { id: 'crisis-anim' as OrbitalTab, icon: Flame, label: '7-Scene Animated Story' },
        { id: 'orbital-3d' as OrbitalTab, icon: Globe2, label: '3D Multipath Globe' }
      ],
      constellations: [
        { name: 'Iridium · LEO (780 km)', desc: '66 low-earth-orbit satellites offering pole-to-pole reach for encrypted envelopes up to 340 B.' },
        { name: 'Galileo · MEO (23,222 km)', desc: '24 European navigation satellites with Search & Rescue (SAR) return-link acknowledgment.' },
        { name: 'QO-100 · GEO (25.9° E)', desc: 'Geostationary relay always visible over Europe & Africa for signed public emergency bulletins.' }
      ],
      openOjo: 'Open SENDA Eye fullscreen'
    },
    nl: {
      eyebrow: 'LIVE SATELLIETCONSTELLATIES & INTERACTIEVE ANIMATIES',
      title: 'Oog van SENDA (Iridium · Galileo · QO-100), HyperFrames & Geanimeerd Verhaal.',
      lead: 'Volg live satellieten boven Europa, bedien het interactieve 5-akten HyperFrames cinema-deck of beleef het 7-scènes noodverhaal.',
      tabs: [
        { id: 'ojo' as OrbitalTab, icon: Satellite, label: 'Oog van SENDA (Live Satellieten)' },
        { id: 'hyperframes' as OrbitalTab, icon: Film, label: 'HyperFrames 5 Akten' },
        { id: 'crisis-anim' as OrbitalTab, icon: Flame, label: '7-Scènes Animatie' },
        { id: 'orbital-3d' as OrbitalTab, icon: Globe2, label: '3D Multipath Globe' }
      ],
      constellations: [
        { name: 'Iridium · LEO (780 km)', desc: '66 satellieten met wereldwijde dekking voor versleutelde noodpakketten tot 340 B.' },
        { name: 'Galileo · MEO (23.222 km)', desc: '24 Europese satellieten voor nauwkeurige positie en Search & Rescue (SAR) retourkanaal.' },
        { name: 'QO-100 · GEO (25,9° O)', desc: 'Geostationaire relay altijd zichtbaar boven Europa voor ondertekende noodberichten.' }
      ],
      openOjo: 'Open Oog van SENDA op volledig scherm'
    }
  }[locale];

  return (
    <section className="s-section" data-testid="orbital-ojo-deck">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Satellite size={15} aria-hidden="true" />
            <span>{copy.eyebrow}</span>
          </p>
          <h2 className="s-h2">{copy.title}</h2>
          <p className="s-lead">{copy.lead}</p>
        </div>

        <div className="s-tabs-scroller" role="tablist" aria-label={copy.title}>
          {copy.tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className="s-tab-btn"
                onClick={() => setTab(item.id)}
                data-testid={`orbital-tab-${item.id}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {tab === 'ojo' && (
          <div className="s-stack-lg">
            <div className="s-grid s-grid-3">
              {copy.constellations.map((cst) => (
                <div key={cst.name} className="s-card s-stack" style={{ gap: 6, padding: 18 }}>
                  <strong className="s-mono" style={{ color: 'var(--s-accent)', fontSize: 13 }}>{cst.name}</strong>
                  <p style={{ margin: 0, fontSize: 14 }}>{cst.desc}</p>
                </div>
              ))}
            </div>
            <div className="s-lab-shell">
              <iframe
                src={`/senda/ojo.html?embed=1${locale === 'es' ? '' : '&lang=en'}`}
                title={copy.tabs[0].label}
                className="s-ojo-iframe"
                loading="lazy"
              />
            </div>
            <div className="s-row">
              <a
                href={`/senda/ojo.html${locale === 'es' ? '' : '?lang=en'}`}
                className="s-btn s-btn-secondary s-btn-sm"
              >
                <span>{copy.openOjo}</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        )}

        {tab === 'hyperframes' && (
          <div className="s-lab-shell s-sim-frame">
            <HyperFramesCinemaDeck locale={locale} />
          </div>
        )}

        {tab === 'crisis-anim' && (
          <div className="s-lab-shell s-sim-frame">
            <CrisisStory locale={locale} />
          </div>
        )}

        {tab === 'orbital-3d' && <ScrollGlobeStage locale={locale} audience={audience} />}
      </div>
    </section>
  );
}
