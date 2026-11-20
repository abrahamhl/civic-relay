'use client';

import dynamic from 'next/dynamic';
import { ExternalLink, Globe2, Orbit } from 'lucide-react';
import type { AudienceMode } from './AudienceLens';
import { localeHref, type Locale } from '../data/types';

const MissionControl = dynamic(() => import('../../mission-control'), { ssr: false });

export default function MissionControlDeck({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const copy = {
    es: {
      eyebrow: 'SIMULADOR 3D RAYCAST · TIERRA · LUNA · MARTE · SATÉLITES Y SECTORES',
      title: 'Mission Control 3D: gira el planeta, pulsa satélites y simula el rescate.',
      lead: {
        citizen: 'Toca o gira el globo 3D para volar sobre España y Países Bajos, ver los satélites moviéndose encima de nosotros y comprobar paso a paso cómo sale un aviso cuando cae la red.',
        investor: 'Consola espacial y terrestre interactiva con 6 capas conmutables, vuelo automático a sectores piloto (El Tiemblo, Valencia, Arnhem) y línea de tiempo reproducible T+00m..T+10m.',
        engineer: 'WebGL Three.js con raycasting de objetos 3D, efemérides orbitales calculadas en vivo (lib/live-protocol-node.mjs), motor de enrutamiento determinista (lib/emergency-routing.mjs) y exportación JSON semilla.'
      }[audience],
      fullscreen: 'Abrir Mission Control a pantalla completa'
    },
    en: {
      eyebrow: 'LIVE 3D RAYCAST SIMULATOR · EARTH · MOON · MARS · SATELLITES & SECTORS',
      title: '3D Mission Control: spin the globe, tap satellites, and run the timeline.',
      lead: {
        citizen: 'Drag or tap the 3D globe to fly across Spain and the Netherlands, watch overhead satellites move, and play step-by-step how an alert escapes when mobile networks fail.',
        investor: 'Interactive orbital and ground command deck with 6 toggleable OSINT/tactical layers, instant sector fly-to (El Tiemblo, Valencia, Arnhem), and reproducible T+00m..T+10m playback.',
        engineer: 'Three.js WebGL with 3D object raycasting, live orbital ephemeris (lib/live-protocol-node.mjs), deterministic routing solver (lib/emergency-routing.mjs), and reproducible seed export.'
      }[audience],
      fullscreen: 'Open Mission Control fullscreen'
    },
    nl: {
      eyebrow: 'LIVE 3D RAYCAST SIMULATOR · AARDE · MAAN · MARS · SATELLIETEN',
      title: '3D Mission Control: draai de wereldbol, klik satellieten en speel de tijdlijn af.',
      lead: {
        citizen: 'Draai de 3D-wereldbol naar Spanje of Nederland, zie satellieten overvliegen en volg stap voor stap hoe een noodmelding ontsnapt bij netwerkuitval.',
        investor: 'Interactief commandoplatform met 6 schakelbare OSINT-lagen, sectorkeuze (El Tiemblo, Valencia, Arnhem) en T+00m..T+10m tijdlijnsimulatie.',
        engineer: 'Three.js WebGL raycasting, live baanberekening (lib/live-protocol-node.mjs), deterministische routering (lib/emergency-routing.mjs) en JSON-export.'
      }[audience],
      fullscreen: 'Open Mission Control op volledig scherm'
    }
  }[locale];

  return (
    <section className="s-section s-deck-band" data-testid="mission-control-deck">
      <div className="s-container s-stack-lg">
        <div className="s-between" style={{ alignItems: 'flex-end', gap: 16 }}>
          <div className="s-read">
            <p className="s-eyebrow">
              <Orbit size={15} aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </p>
            <h2 className="s-h2">{copy.title}</h2>
            <p className="s-lead">{copy.lead}</p>
          </div>
          <a href={localeHref(locale, 'mission-control')} className="s-btn s-btn-secondary s-btn-sm">
            <Globe2 size={15} aria-hidden="true" />
            <span>{copy.fullscreen}</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>

        <div className="s-lab-shell s-sim-frame">
          <MissionControl locale={locale} />
        </div>
      </div>
    </section>
  );
}
