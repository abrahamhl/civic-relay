'use client';

import dynamic from 'next/dynamic';
import { Eye, ExternalLink } from 'lucide-react';
import type { AudienceMode } from './AudienceLens';
import { localeHref, type Locale } from '../data/types';

const SectorIntelligenceConsole = dynamic(() => import('../../sector-intelligence-console'), { ssr: false });

export default function OsintIntelligenceDeck({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const copy = {
    es: {
      eyebrow: 'INTELIGENCIA OSINT · MATRIZ CCTV 1/4/9 · CONOS FOV Y PIPELINE DE 8 ETAPAS',
      title: 'OSINT en vivo: cámaras públicas viales, conos FOV y arquitectura Observar → Decidir → Coordinar.',
      lead: {
        citizen: 'SENDA cruza únicamente cámaras públicas de carreteras (como DGT o Rijkswaterstaat) con avisos voluntarios de personas para saber dónde hay humo, agua o atasco — sin grabar nunca caras ni matrículas.',
        investor: 'Consola OSINT completa con matriz de cámaras 1/4/9, conos proyectivos FOV sobre sectores piloto, control de frescura de señal (STALE / NO_SIGNAL) y trazabilidad en 8 etapas auditables.',
        engineer: 'Motor OSINT en lib/sector-camera-engine.mjs con validación anti-SSRF de URLs, geometría proyectiva haversiana, separación estricta entre capa observacional y mensajería consentida, y enlace directo al código fuente de cada etapa.'
      }[audience],
      openPlatform: 'Abrir Centro de Control Completo'
    },
    en: {
      eyebrow: 'OSINT INTELLIGENCE · 1/4/9 CCTV MATRIX · FOV CONES & 8-STAGE PIPELINE',
      title: 'Live OSINT: public road cameras, FOV cones, and the Observe → Decide → Coordinate pipeline.',
      lead: {
        citizen: 'SENDA combines public highway cameras (DGT / Rijkswaterstaat) with voluntary check-ins to spot smoke, floods, or roadblocks early — never storing faces or license plates.',
        investor: 'Full OSINT console featuring 1/4/9 camera layouts, projective FOV cones across pilot sectors, signal-freshness tracking, and an 8-stage auditable operational pipeline.',
        engineer: 'OSINT engine in lib/sector-camera-engine.mjs with anti-SSRF upstream URL validation, Haversine FOV projection, strict separation of observational feeds vs consented envelopes, and per-stage GitHub source links.'
      }[audience],
      openPlatform: 'Open Full Control Center'
    },
    nl: {
      eyebrow: 'OSINT INTELLIGENTIE · 1/4/9 CCTV-MATRIX · FOV-KEGELS & 8-STAPS PIPELINE',
      title: 'Live OSINT: openbare wegcamera’s, FOV-kegels en de Observeren → Beslissen → Coördineren pipeline.',
      lead: {
        citizen: 'SENDA combineert openbare wegcamera’s (Rijkswaterstaat / DGT) met vrijwillige meldingen om rook, water of files te zien — zonder gezichten of kentekens op te slaan.',
        investor: 'Volledige OSINT-console met 1/4/9 cameramatrix, FOV-kegels over pilotsectoren, signaalbewaking en een 8-staps verifieerbare beslissingsketen.',
        engineer: 'OSINT-engine in lib/sector-camera-engine.mjs met anti-SSRF URL-validatie, haversine FOV-projectie en directe broncodelinks per fase.'
      }[audience],
      openPlatform: 'Open Volledig Controlecentrum'
    }
  }[locale];

  return (
    <section className="s-section s-sunk" data-testid="osint-intelligence-deck">
      <div className="s-container s-stack-lg">
        <div className="s-between" style={{ alignItems: 'flex-end', gap: 16 }}>
          <div className="s-read">
            <p className="s-eyebrow">
              <Eye size={15} aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </p>
            <h2 className="s-h2">{copy.title}</h2>
            <p className="s-lead">{copy.lead}</p>
          </div>
          <a href={localeHref(locale, 'platform')} className="s-btn s-btn-secondary s-btn-sm">
            <span>{copy.openPlatform}</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>

        <div className="s-lab-shell s-sim-frame">
          <SectorIntelligenceConsole locale={locale} />
        </div>
      </div>
    </section>
  );
}
