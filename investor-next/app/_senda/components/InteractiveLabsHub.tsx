'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Building2, Car, FlaskConical, Gauge, Radio, Satellite, TrainFront } from 'lucide-react';
import type { Locale } from '../data/types';

const TelecomAndRfRadarSuite = dynamic(() => import('../../telecom-rf-radar-suite'), { ssr: false });
const CommandSurface = dynamic(() => import('../../command-surface'), { ssr: false });
const RailSafetyLab = dynamic(() => import('../../rail-safety-lab'), { ssr: false });
const VehicularDopplerLab = dynamic(() => import('../../vehicular-doppler-lab'), { ssr: false });
const CoordinationLab = dynamic(() => import('../../coordination-lab'), { ssr: false });
const ScientificTheoremsLab = dynamic(() => import('../../scientific-theorems-lab'), { ssr: false });
const CalibrationPanel = dynamic(() => import('../../calibration-panel'), { ssr: false });
const LiveHardwareAndDealRoomConsole = dynamic(() => import('../../live-hardware-console'), { ssr: false });

export type LabId = 'telecom' | 'mando' | 'rail' | 'doppler' | 'building' | 'theorems' | 'calibration';

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
      en: 'Satellites 3GPP NTN & Wi-Fi CSI',
      es: 'Satélites 3GPP NTN y Radar Wi-Fi CSI',
      nl: '3GPP NTN Satellieten & Wi-Fi CSI'
    },
    summary: {
      en: 'Adjust LEO/MEO/GEO orbits, elevation angle, 24-byte binary burst frames, 9-sector mesh recovery, and ITU-R P.2040 through-wall 64-subcarrier OFDM tomography live.',
      es: 'Ajusta órbitas LEO/MEO/GEO, ángulo de elevación, trama binaria de 24 bytes, recuperación en 9 sectores y radar Wi-Fi CSI OFDM de 64 subportadoras a través de muros.',
      nl: 'Pas LEO/MEO/GEO-banen, elevatiehoek, 24-byte frames, 9-sector herstel en ITU-R P.2040 64-subcarrier OFDM muurtomografie live aan.'
    },
    tryHint: {
      en: 'Slide orbit elevation or wall material below to recalculate link budgets and OFDM spectra live.',
      es: 'Mueve los deslizadores de órbita, elevación o tipo de muro para recalcular el balance satelital y el espectro OFDM en vivo.',
      nl: 'Verschuif elevatiehoek of muurmateriaal om linkbudgetten en OFDM-spectra live te herberekenen.'
    }
  },
  {
    id: 'mando',
    icon: Radio,
    title: {
      en: 'Multichannel Command & Corridor A12',
      es: 'Mando Multicanal, RF y Corredor A12',
      nl: 'Multikanaal Commando & A12 Corridor'
    },
    summary: {
      en: 'Full multichannel activation panel: blackout presets, weighted RF trilateration, propagation margins, hop-by-hop mesh routing, and 9-layer A12 Arnhem–Ede Corridor Intelligence.',
      es: 'Panel completo de activaciones multicanal: escenarios de apagón, trilateración RF ponderada, márgenes de propagación, rutas multisalto y 9 capas del Corredor A12 Arnhem–Ede.',
      nl: 'Multikanaal activatiepaneel: uitvalscenario’s, gewogen RF-trilateratie, mesh-routes en 9-laags A12 Arnhem–Ede Corridor Intelligence.'
    },
    tryHint: {
      en: 'Switch between activation scenarios, RF link budget, trilateration, and Corridor Intelligence layers.',
      es: 'Explora activaciones, balance RF, trilateración y las 9 capas de Corridor Intelligence directamente aquí.',
      nl: 'Wissel tussen activaties, RF-linkbudget, trilateratie en de 9 Corridor Intelligence-lagen.'
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
    id: 'building',
    icon: Building2,
    title: {
      en: '3D Building Collapse & Routing Lab',
      es: 'Edificio 3D y Laboratorio de Enrutamiento',
      nl: '3D Gebouw & Routeringslab'
    },
    summary: {
      en: 'Simulate an earthquake damaging a 5-storey building with 20–100 devices, opt-in permissions, SAFE / SOS / UNKNOWN states, battery limits, and adaptive gateway routing.',
      es: 'Simula un terremoto en un edificio de 5 plantas con 20–100 dispositivos, permisos opt-in, estados SAFE / SOS / UNKNOWN, cuotas de batería y enrutamiento adaptativo.',
      nl: 'Simuleer een aardbeving in een gebouw met 5 verdiepingen, 20–100 toestellen, opt-in rechten, SAFE/SOS/UNKNOWN en adaptieve routering.'
    },
    tryHint: {
      en: 'Adjust infrastructure damage %, battery level, and active radios to compare cellular vs SENDA.',
      es: 'Ajusta % de daño, batería y radios activas para comparar red celular frente a SENDA adaptativo.',
      nl: 'Pas schadepercentage, accu en actieve radio’s aan om mobiel versus SENDA te vergelijken.'
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
      en: 'WebCrypto ECDSA, L2.5 & Hardware',
      es: 'WebCrypto ECDSA, Calibración y Móvil',
      nl: 'WebCrypto ECDSA, L2.5 & Hardware'
    },
    summary: {
      en: 'Generate real ECDSA P-256 keys and signed OEP packets in your browser, test local device sensors, and inspect the 5-bin L2.5 reliability calibration diagram.',
      es: 'Genera claves ECDSA P-256 reales y paquetes OEP firmados en tu navegador, prueba los sensores reales de tu móvil y explora el diagrama de calibración L2.5.',
      nl: 'Genereer echte ECDSA P-256-sleutels en ondertekende pakketten in uw browser, test sensoren en bekijk L2.5-kalibratie.'
    },
    tryHint: {
      en: 'Sign a live cryptographic packet and run an optional sensor diagnostic on your phone or laptop.',
      es: 'Firma un paquete criptográfico real y ejecuta un diagnóstico opcional de sensores en tu dispositivo.',
      nl: 'Onderteken een echt cryptografisch pakket en start een optionele sensortest.'
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
      eyebrow: '7 LIVE PALANTIR-GRADE SIMULATORS · REAL CODE EXECUTING IN YOUR BROWSER',
      title: 'Test every satellite, RF, rail, Doppler, 3D building, theorem & crypto engine live.',
      lead: 'All seven advanced engineering consoles unified into one clean, mobile-ready workbench — one active lab at a time so every slider works cleanly.'
    },
    es: {
      eyebrow: '7 SIMULADORES AVANZADOS EN VIVO · CÓDIGO REAL EJECUTÁNDOSE EN TU NAVEGADOR',
      title: 'Prueba en vivo satélites, mando RF, trenes, Doppler, edificio 3D, teoremas y WebCrypto.',
      lead: 'Las 7 consolas de ingeniería más avanzadas del proyecto unificadas en un banco de trabajo limpio y adaptado a móvil — un simulador activo cada vez para máxima claridad.'
    },
    nl: {
      eyebrow: '7 LIVE ENGINEERING-SIMULATOREN · ECHTE CODE IN UW BROWSER',
      title: 'Test satellieten, RF-commando, spoor, Doppler, 3D-gebouw, stellingen & WebCrypto live.',
      lead: 'Alle zeven geavanceerde simulatoren verenigd in één overzichtelijke, mobielvriendelijke werkruimte.'
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

        <div className="s-card s-lab-intro">
          <div className="s-stack" style={{ gap: 6 }}>
            <h3 className="s-h3">{current.title[locale]}</h3>
            <p style={{ margin: 0 }}>{current.summary[locale]}</p>
            <p className="s-micro" style={{ color: 'var(--s-accent)', fontWeight: 600, margin: 0 }}>
              {current.tryHint[locale]}
            </p>
          </div>
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`lab-tab-${current.id}`}
          className="s-lab-shell s-sim-frame"
        >
          {activeLab === 'telecom' && <TelecomAndRfRadarSuite locale={locale} />}
          {activeLab === 'mando' && <CommandSurface locale={locale} />}
          {activeLab === 'rail' && <RailSafetyLab locale={locale} />}
          {activeLab === 'doppler' && <VehicularDopplerLab locale={locale} />}
          {activeLab === 'building' && <CoordinationLab locale={locale} />}
          {activeLab === 'theorems' && <ScientificTheoremsLab locale={locale} />}
          {activeLab === 'calibration' && (
            <div className="s-stack-lg" style={{ padding: 'clamp(14px, 2.5vw, 24px)' }}>
              <LiveHardwareAndDealRoomConsole locale={locale} />
              <CalibrationPanel locale={locale} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
