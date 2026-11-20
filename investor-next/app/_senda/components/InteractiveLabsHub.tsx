'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Car, FlaskConical, Gauge, Satellite, TrainFront } from 'lucide-react';
import type { Locale } from '../data/types';

const TelecomAndRfRadarSuite = dynamic(() => import('../../telecom-rf-radar-suite'), { ssr: false });
const RailSafetyLab = dynamic(() => import('../../rail-safety-lab'), { ssr: false });
const VehicularDopplerLab = dynamic(() => import('../../vehicular-doppler-lab'), { ssr: false });
const ScientificTheoremsLab = dynamic(() => import('../../scientific-theorems-lab'), { ssr: false });
const CalibrationPanel = dynamic(() => import('../../calibration-panel'), { ssr: false });
const DeviceFieldDiagnostics = dynamic(() => import('../../device-field-diagnostics'), { ssr: false });

export type LabId = 'telecom' | 'rail' | 'doppler' | 'theorems' | 'calibration';

interface LabTabDef {
  id: LabId;
  icon: typeof Satellite;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  tryHint: Record<Locale, string>;
}

const LABS: LabTabDef[] = [
  {
    id: 'telecom',
    icon: Satellite,
    title: {
      en: 'Satellites 3GPP NTN & Wi-Fi CSI Radar',
      es: 'Satélites 3GPP NTN y Radar Wi-Fi CSI',
      nl: '3GPP NTN Satellieten & Wi-Fi CSI Radar'
    },
    summary: {
      en: 'Adjust LEO/MEO/GEO orbits, elevation angle, 24-byte binary burst frames, 9-sector mesh recovery, and ITU-R P.2040 through-wall 64-subcarrier OFDM tomography live.',
      es: 'Ajusta órbitas LEO/MEO/GEO, ángulo de elevación, trama binaria de 24 bytes, recuperación en 9 sectores y radar Wi-Fi CSI OFDM de 64 subportadoras a través de muros.',
      nl: 'Pas LEO/MEO/GEO-banen, elevatiehoek, 24-byte frames, 9-sector herstel en ITU-R P.2040 64-subcarrier OFDM muurtomografie live aan.'
    },
    tryHint: {
      en: 'Slide orbit elevation or wall material below to watch link budgets and OFDM spectra recalculate live.',
      es: 'Mueve los deslizadores de órbita, elevación o tipo de muro para recalcular el balance satelital y el espectro OFDM en vivo.',
      nl: 'Verschuif elevatiehoek of muurmateriaal om linkbudgetten en OFDM-spectra live te herberekenen.'
    }
  },
  {
    id: 'rail',
    icon: TrainFront,
    title: {
      en: 'Spain Rail Safety Physics',
      es: 'Seguridad Ferroviaria (España)',
      nl: 'Spoorveiligheid & Fysica'
    },
    summary: {
      en: 'Five live railway disaster prevention simulators: single-track conflicts, Kerr thermal buckling, 5,100 m/s ultrasonic guided waves (Adamuz pattern), T2V crossings, and tunnel beacons.',
      es: 'Cinco simuladores físicos ferroviarios: conflictos de vía única, pandeo térmico Kerr, ondas ultrasónicas a 5.100 m/s (patrón Adamuz), paso a nivel T2V y baliza multimodal en túnel.',
      nl: 'Vijf spoorveiligheidssimulatoren: enkelspoorconflicten, thermische spoorvervorming, 5.100 m/s ultrasone golven, T2V-overwegen en tunnelbakens.'
    },
    tryHint: {
      en: 'Switch modules 1–5 inside the console and drag train speed, rail temperature, or break severity.',
      es: 'Cambia entre los módulos 1–5 dentro de la consola y modifica velocidad, temperatura del carril o rotura.',
      nl: 'Wissel tussen modules 1–5 en pas snelheid, railtemperatuur of breukernst aan.'
    }
  },
  {
    id: 'doppler',
    icon: Car,
    title: {
      en: 'Traffic, Doppler 24/77 GHz & V2I',
      es: 'Tráfico, Doppler y Pasarela V2I',
      nl: 'Verkeer, Doppler & V2I Gateway'
    },
    summary: {
      en: 'Interactive YOLOX + ByteTrack vehicle tracking, animated 24/77 GHz electromagnetic Doppler wave compression, 0-RTT DGT gantry gateways, and Train-Car-112 rescue relay.',
      es: 'Tracking multi-vehicular YOLOX + ByteTrack, animación en tiempo real de compresión de ondas Doppler 24/77 GHz, pasarelas V2I 0-RTT en pórticos DGT y puente Tren-Coche-112.',
      nl: 'YOLOX + ByteTrack verkeersvolging, 24/77 GHz Doppler-golfanimatie, 0-RTT portaal-gateways en Trein-Auto-112 relay.'
    },
    tryHint: {
      en: 'Change vehicle speed (km/h), radar band (24/77 GHz), or traffic density to see live wave physics.',
      es: 'Ajusta velocidad (km/h), banda radar (24/77 GHz) o densidad de tráfico para observar la física ondulatoria en directo.',
      nl: 'Pas snelheid (km/u), radarband (24/77 GHz) of verkeersdichtheid aan voor live golffysica.'
    }
  },
  {
    id: 'theorems',
    icon: FlaskConical,
    title: {
      en: '5 Live Mathematical Theorems',
      es: '5 Teoremas Matemáticos en Vivo',
      nl: '5 Live Wiskundige Stellingen'
    },
    summary: {
      en: 'Direct browser execution of our tested physics core: A2G drone elevation, Fiedler Graph Laplacian connectivity, Deygout diffraction, Passive Radar CRLB, and Near-Ultrasound audio budget.',
      es: 'Ejecución directa del núcleo físico verificado: elevación óptima de dron A2G, conectividad Laplaciana de Fiedler, difracción Deygout, radar pasivo CRLB y presupuesto acústico.',
      nl: 'Directe uitvoering van de fysicakern: A2G-dronehoogte, Fiedler-connectiviteit, Deygout-diffractie, passieve radar CRLB en akoestisch budget.'
    },
    tryHint: {
      en: 'Explore all 5 proven theorem calculators powered by the exact offline core module.',
      es: 'Explora los 5 teoremas calculados directamente por el mismo módulo del núcleo que corre sin conexión.',
      nl: 'Verken alle 5 stellingen rechtstreeks berekend door de offline kernmodule.'
    }
  },
  {
    id: 'calibration',
    icon: Gauge,
    title: {
      en: 'L2.5 Calibration & Device Sensors',
      es: 'Calibración L2.5 y Sensores del Móvil',
      nl: 'L2.5 Kalibratie & Toestelsensoren'
    },
    summary: {
      en: '5-bin reliability calibration diagram (Brier score, ECE, Murphy decomposition) paired with live user-initiated browser sensor & hardware capability diagnostics.',
      es: 'Diagrama de fiabilidad en 5 intervalos (Brier score, ECE, descomposición de Murphy) junto al diagnóstico interactivo de sensores reales de tu propio móvil o navegador.',
      nl: 'Betrouwbaarheidsdiagram (Brier-score, ECE, Murphy-decompositie) samen met live sensordiagnostiek op uw eigen toestel.'
    },
    tryHint: {
      en: 'Inspect reliability curves and run an optional local sensor check on the device you are holding right now.',
      es: 'Inspecciona las curvas de calibración y lanza el diagnóstico opcional de sensores en tu propio dispositivo.',
      nl: 'Bekijk kalibratiecurves en start optioneel de sensordiagnostiek op uw huidige toestel.'
    }
  }
];

export default function InteractiveLabsHub({
  locale,
  defaultLab = 'telecom',
  id = 'labs'
}: {
  locale: Locale;
  defaultLab?: LabId;
  id?: string;
}) {
  const [activeLab, setActiveLab] = useState<LabId>(defaultLab);
  const current = LABS.find((l) => l.id === activeLab) ?? LABS[0];

  const copy = {
    en: {
      eyebrow: 'INTERACTIVE ENGINEERING SIMULATORS · LIVE EXECUTION IN BROWSER',
      title: 'Test every physics, satellite, rail, Doppler, and sensor engine live.',
      lead: 'Select one lab at a time so every control stays crystal clear, fast, and touch-friendly on both mobile and desktop.'
    },
    es: {
      eyebrow: 'SIMULADORES INTERACTIVOS DE INGENIERÍA · EJECUCIÓN REAL EN TU NAVEGADOR',
      title: 'Prueba en vivo cada motor de satélites, radar Wi-Fi, trenes, Doppler y teoremas.',
      lead: 'Elige un laboratorio a la vez para explorar cada simulación con controles claros, rápidos y cómodos tanto en móvil como en ordenador.'
    },
    nl: {
      eyebrow: 'INTERACTIEVE ENGINEERING-SIMULATOREN · LIVE IN UW BROWSER',
      title: 'Test elke satelliet-, radar-, spoor-, Doppler- en sensorengine live.',
      lead: 'Kies één laboratorium tegelijk zodat elke regelaar overzichtelijk, snel en mobielvriendelijk blijft.'
    }
  }[locale];

  return (
    <section className="s-section s-sunk" id={id} data-testid="interactive-labs-hub">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">{copy.eyebrow}</p>
          <h2 className="s-h2">{copy.title}</h2>
          <p className="s-lead">{copy.lead}</p>
        </div>

        {/* Single-row scrollable accessible tablist per modern-web-guidance (tabs) */}
        <div className="s-tabs-scroller" role="tablist" aria-label={copy.title}>
          {LABS.map((lab) => {
            const Icon = lab.icon;
            const selected = lab.id === activeLab;
            return (
              <button
                key={lab.id}
                type="button"
                role="tab"
                id={`lab-tab-${lab.id}`}
                aria-selected={selected}
                className="s-tab-btn"
                onClick={() => setActiveLab(lab.id)}
                data-testid={`lab-tab-${lab.id}`}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{lab.title[locale]}</span>
              </button>
            );
          })}
        </div>

        {/* Plain-language orientation card before the heavy live console */}
        <div className="s-card s-lab-intro">
          <div className="s-stack" style={{ gap: 6 }}>
            <h3 className="s-h3">{current.title[locale]}</h3>
            <p style={{ margin: 0 }}>{current.summary[locale]}</p>
            <p className="s-micro" style={{ color: 'var(--s-accent)', fontWeight: 600, margin: 0 }}>
              {current.tryHint[locale]}
            </p>
          </div>
        </div>

        {/* Contained Palantir Dark-Glass Interactive Simulator Shell */}
        <div
          role="tabpanel"
          aria-labelledby={`lab-tab-${current.id}`}
          className="s-lab-shell"
        >
          {activeLab === 'telecom' && <TelecomAndRfRadarSuite locale={locale} />}
          {activeLab === 'rail' && <RailSafetyLab locale={locale} />}
          {activeLab === 'doppler' && <VehicularDopplerLab locale={locale} />}
          {activeLab === 'theorems' && <ScientificTheoremsLab locale={locale} />}
          {activeLab === 'calibration' && (
            <div className="s-stack-lg" style={{ padding: 24 }}>
              <CalibrationPanel locale={locale} />
              <DeviceFieldDiagnostics locale={locale} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
