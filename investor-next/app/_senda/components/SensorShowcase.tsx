'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bluetooth,
  Camera,
  ExternalLink,
  Radar,
  Satellite,
  Volume2
} from 'lucide-react';
import type { AudienceMode } from './AudienceLens';
import EvidenceBadge from './EvidenceBadge';
import type { Locale } from '../data/types';

type SensorId = 'seismic' | 'mesh' | 'radar' | 'satellite' | 'acoustic' | 'vision';

interface SensorSpec {
  id: SensorId;
  code: string;
  chip: string;
  badge: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  copy: Record<AudienceMode, Record<Locale, string>>;
  metricLabel: Record<Locale, string>;
  metricValue: string;
  href: string;
  evidenceId: string;
}

const SENSORS: SensorSpec[] = [
  {
    id: 'seismic',
    code: 'SENSOR 01',
    chip: 'IMU 3-AXIS · 100 HZ',
    badge: 'P-WAVE + G-FORCE',
    title: {
      en: 'Accelerometer & Gyroscope',
      es: 'Acelerómetro y Giroscopio',
      nl: 'Versnellingsmeter & Gyroscoop'
    },
    subtitle: {
      en: 'Seismic P-wave early warning & train/vehicle crash corroboration',
      es: 'Prevención sísmica temprana (Onda P) y detección de choques en trenes y coches',
      nl: 'Vroege P-golf aardbevingsdetectie & botsingsfusie bij trein en auto'
    },
    copy: {
      citizen: {
        en: 'Your phone feels the first harmless seismic ripple (P-wave) seconds before the destructive shaking arrives — or detects the sudden impact of a train or car crash and alerts rescuers automatically.',
        es: 'Tu móvil detecta la primera vibración sísmica (onda P) segundos antes de la sacudida destructiva, o reconoce el golpe brusco de un accidente de tren o coche para pedir ayuda de inmediato.',
        nl: 'Uw telefoon voelt de eerste seismische P-golf seconden vóór de zware schok, of herkent een trein- of auto-ongeluk om direct hulp in te schakelen.'
      },
      investor: {
        en: 'Turns existing consumer smartphones into a zero-CAPEX distributed seismograph and multi-convoy crash sensor network corroborated across nearby devices before triggering alerts.',
        es: 'Convierte los smartphones que la población ya lleva en el bolsillo en una red sísmica y de detección multi-tren de CAPEX cero, corroborada entre varios dispositivos para evitar falsas alarmas.',
        nl: 'Verandert bestaande smartphones zonder hardware-investering in een gedistribueerd seismisch en botsingsdetectienetwerk met meervoudige verificatie.'
      },
      engineer: {
        en: 'STA/LTA P-wave trigger + multi-device spatiotemporal clustering (Venezuela seismic scenarios) and high-G deceleration fusion separating multi-train impacts (Adamuz rail engine).',
        es: 'Disparo STA/LTA de onda P + agrupación espacio-temporal multi-dispositivo (escenarios sísmicos Venezuela) y fusión de deceleración G para aislar múltiples trenes (motor ferroviario Adamuz).',
        nl: 'STA/LTA P-golf trigger + spatiotemporele clustering (Venezuela-scenario) en G-krachtfusie voor meer-trein-ongevallen.'
      }
    },
    metricLabel: { en: 'Warning lead / Impact fusion', es: 'Ventaja de aviso / Fusión', nl: 'Waarschuwingstijd / Fusie' },
    metricValue: 'P-wave + Multi-G',
    href: '/senda/incidente.html',
    evidenceId: 'EV-RAIL-ADAMUZ'
  },
  {
    id: 'mesh',
    code: 'SENSOR 02',
    chip: 'BLE 5 + WI-FI DIRECT',
    badge: 'OFFLINE MESH',
    title: {
      en: 'Bluetooth LE & Wi-Fi Direct',
      es: 'Bluetooth LE y Wi-Fi Direct',
      nl: 'Bluetooth LE & Wi-Fi Direct'
    },
    subtitle: {
      en: 'Zero-Internet neighborhood relay & rubble surface bridge',
      es: 'Malla ciudadana sin Internet y puente de rescate bajo escombros',
      nl: 'Offline buurt-mesh & puinbrug bij ingestorte gebouwen'
    },
    copy: {
      citizen: {
        en: 'When cell towers drown or lose power, your phone whispers your sealed message to nearby phones via Bluetooth and Wi-Fi Direct until it reaches someone who has signal.',
        es: 'Cuando las antenas se inundan o se quedan sin luz, tu teléfono pasa tu mensaje cifrado por Bluetooth y Wi-Fi Direct a móviles cercanos hasta llegar a alguien con salida.',
        nl: 'Wanneer zendmasten uitvallen, geeft uw telefoon het versleutelde bericht via Bluetooth en Wi-Fi Direct door tot iemand wel bereik heeft.'
      },
      investor: {
        en: 'Pre-authorized relay mode activates under official CAP/EU-Alert zones with strict battery quotas, cutting energy consumption by 84% via ARR_REPLAN_V2 Contact Graph Routing.',
        es: 'El modo relé preautorizado se activa bajo alertas oficiales respetando cuotas estrictas de batería y reduciendo un 84 % el consumo frente a inundación epidémica.',
        nl: 'Vooraf geautoriseerde relay schakelt in bij officiële noodzones met strikte acculimieten en 84% lager energieverbruik.'
      },
      engineer: {
        en: 'E2EE envelopes (ECDH P-256 + AES-GCM + ECDSA) relayed blindly over Android Nearby / BLE GATT beacons with deterministic deduplication and signed ACK queue purge.',
        es: 'Sobres E2EE (ECDH P-256 + AES-GCM + ECDSA) reenviados a ciegas sobre Android Nearby / balizas BLE con deduplicación determinista y purga por ACK firmado.',
        nl: 'E2EE-enveloppen (ECDH P-256 + AES-GCM + ECDSA) blind doorgestuurd via Android Nearby / BLE met deterministische ontdubbeling.'
      }
    },
    metricLabel: { en: 'Delivery vs flooding energy', es: 'Entrega y ahorro energético', nl: 'Bezorging & energiebesparing' },
    metricValue: '94.2% · -84% mJ',
    href: '/senda/red.html',
    evidenceId: 'EV-ARR-V2'
  },
  {
    id: 'radar',
    code: 'SENSOR 03',
    chip: '64-SUBCARRIER OFDM CSI',
    badge: 'THROUGH-WALL RF',
    title: {
      en: 'Wi-Fi CSI & RF Spectral Sensing',
      es: 'Wi-Fi CSI y Radar Espectral RF',
      nl: 'Wi-Fi CSI & RF-spectrale Radar'
    },
    subtitle: {
      en: 'Through-wall attenuation modeling & rubble signal tomography',
      es: 'Modelado de atenuación en muros y tomografía RF bajo escombros',
      nl: 'Muurdemping-modellering & RF-tomografie door puin'
    },
    copy: {
      citizen: {
        en: 'Wi-Fi radio waves bounce differently when they pass through walls or rubble. SENDA analyzes those subtle ripples to help rescue teams locate where signals come from inside collapsed structures.',
        es: 'Las ondas Wi-Fi cambian al atravesar paredes o escombros. SENDA analiza esas variaciones sutiles para ayudar a los equipos de rescate a localizar señales dentro de edificios colapsados.',
        nl: 'Wi-Fi-golven veranderen bij muren en puin. SENDA analyseert deze patronen om reddingsteams te helpen signalen in ingestorte gebouwen te lokaliseren.'
      },
      investor: {
        en: 'Software-defined sensing built over commodity Wi-Fi chipsets: adds through-wall awareness and ITU-R P.2040 structural loss modeling without specialized military radar hardware.',
        es: 'Sensado definido por software sobre chips Wi-Fi estándar: añade localización a través de muros con física ITU-R P.2040 sin requerir radares militares dedicados.',
        nl: 'Software-gedefinieerde detectie op standaard Wi-Fi-chips met ITU-R P.2040-demping zonder kostbare speciale radarhardware.'
      },
      engineer: {
        en: 'Computes ITU-R P.2040 wall attenuation across brick/concrete/rubble and 64-subcarrier OFDM channel state information (CSI) tomography in lib/telecom-suite.mjs.',
        es: 'Calcula atenuación ITU-R P.2040 en ladrillo/hormigón/escombro y tomografía CSI OFDM de 64 subportadoras en tiempo real dentro de lib/telecom-suite.mjs.',
        nl: 'Berekent ITU-R P.2040 muurdemping en 64-subcarrier OFDM CSI-tomografie in lib/telecom-suite.mjs.'
      }
    },
    metricLabel: { en: 'OFDM Spectral Resolution', es: 'Resolución espectral OFDM', nl: 'OFDM-spectrale resolutie' },
    metricValue: '64 subcarriers · P.2040',
    href: '/senda/edificios.html',
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'satellite',
    code: 'SENSOR 04',
    chip: '3GPP NTN · LEO 550 KM',
    badge: '24-BYTE BURST',
    title: {
      en: 'Direct-to-Cell Satellite Modem (NTN)',
      es: 'Enlace Satelital Direct-to-Cell (3GPP NTN)',
      nl: 'Direct-to-Cell Satellietmodem (3GPP NTN)'
    },
    subtitle: {
      en: 'Orbital pass prediction, Doppler compensation & 24-byte SOS burst',
      es: 'Predicción de paso orbital, compensación Doppler y ráfaga SOS de 24 bytes',
      nl: 'Baanvoorspelling, Dopplercompensatie & 24-byte noodpuls'
    },
    copy: {
      citizen: {
        en: 'When there is no mobile tower for miles, SENDA tells you which direction the next satellite is passing and shrinks your message so it fits in a tiny instant radio flash.',
        es: 'Si no hay ninguna antena en kilómetros, SENDA calcula cuándo pasa el próximo satélite por encima y reduce tu aviso a un destello de radio ultracorto.',
        nl: 'Als er kilometers ver geen zendmast werkt, berekent SENDA wanneer de volgende satelliet passeert en verzendt een ultrakorte noodpuls.'
      },
      investor: {
        en: 'Native readiness for the emerging 3GPP Rel-17/18 Direct-to-Cell satellite wave: compresses full authenticated distress telemetry into 24 bytes with deterministic integrity checks.',
        es: 'Preparado para el despliegue global 3GPP Rel-17/18 Direct-to-Cell: comprime telemetría autenticada de emergencia en solo 24 bytes con verificación íntegra.',
        nl: 'Klaar voor 3GPP Rel-17/18 Direct-to-Cell: comprimeert geauthenticeerde noodtelemetrie in slechts 24 bytes.'
      },
      engineer: {
        en: '24-byte OEP-NTN binary frame with magic header + CRC-16-CCITT, paired with slant range, FSPL, Doppler shift, and viable burst bitrate solver in lib/telecom-suite.mjs.',
        es: 'Trama binaria OEP-NTN de 24 bytes con cabecera mágica y CRC-16-CCITT junto al cálculo real de slant range, FSPL, Doppler y bitrate útil en lib/telecom-suite.mjs.',
        nl: '24-byte OEP-NTN binair frame met CRC-16-CCITT plus slant range, FSPL, Doppler- en bitratesolver.'
      }
    },
    metricLabel: { en: 'Compact Binary Payload', es: 'Carga binaria compacta', nl: 'Compact binair frame' },
    metricValue: '24 B · CRC-16-CCITT',
    href: '/es/product/#labs',
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    id: 'acoustic',
    code: 'SENSOR 05',
    chip: 'MFSK-16 · AUDIO FALLBACK',
    badge: 'SOUND DATA',
    title: {
      en: 'Speaker & Microphone (MFSK-16 Modem)',
      es: 'Altavoz y Micrófono (Módem Acústico)',
      nl: 'Luidspreker & Microfoon (MFSK-16 Modem)'
    },
    subtitle: {
      en: 'Transfers encrypted ~300 B envelopes by sound when all radios fail',
      es: 'Transfiere sobres cifrados de ~300 B por sonido si falla cualquier radio',
      nl: 'Verstuurt ~300 B versleutelde enveloppen via geluid als alle radio uitvalt'
    },
    copy: {
      citizen: {
        en: 'Even if Bluetooth, Wi-Fi, and SIM cards are blocked or broken, two phones can literally "sing" a short sequence of tones to pass an encrypted emergency message across a room or tunnel.',
        es: 'Incluso si Bluetooth, Wi-Fi y la SIM fallan por completo, dos móviles pueden transmitirse un mensaje cifrado de emergencia mediante tonos acústicos cortos en un túnel o refugio.',
        nl: 'Zelfs als Bluetooth, Wi-Fi en simkaarten volledig uitvallen, geven twee telefoons via korte geluidstonen een versleuteld noodbericht door.'
      },
      investor: {
        en: 'Universal zero-permission fallback channel working across any browser, Android, or iOS device—guaranteeing interoperability even across completely locked-down OS sandboxes.',
        es: 'Canal universal de respaldo sin barreras entre iOS, Android y navegador web: asegura interoperabilidad física incluso cuando el sistema operativo restringe las radios.',
        nl: 'Universeel noodkanaal tussen iOS, Android en browser zonder afhankelijkheid van besturingssysteem-radiorechten.'
      },
      engineer: {
        en: '16-tone MFSK modulation in Web Audio API carrying ~300 B E2EE payloads protected by Hamming(7,4) forward error correction and CRC-32 checksum verification.',
        es: 'Modulación MFSK de 16 tonos sobre Web Audio API con sobres E2EE de ~300 B protegidos por corrección de errores Hamming(7,4) y verificación CRC-32.',
        nl: '16-toons MFSK-modulatie via Web Audio API met ~300 B E2EE-payload, Hamming(7,4) FEC en CRC-32.'
      }
    },
    metricLabel: { en: 'Error-Corrected Sound Frame', es: 'Trama acústica protegida', nl: 'Foutgecorrigeerd geluidsframe' },
    metricValue: 'MFSK-16 · Hamming(7,4)',
    href: '/senda/llamada.html',
    evidenceId: 'EV-ACOUSTIC'
  },
  {
    id: 'vision',
    code: 'SENSOR 06',
    chip: 'BAROMETER + GPS + YOLOX-S',
    badge: '3D FLOOR & VISION',
    title: {
      en: 'Barometer, GPS & On-Device Camera',
      es: 'Barómetro, GPS y Cámara Local (YOLOX)',
      nl: 'Barometer, GPS & Lokale Camera (YOLOX)'
    },
    subtitle: {
      en: 'Floor-by-floor building rescue, wildfire weather & plate-free traffic counts',
      es: 'Altura planta por planta en edificios, clima de incendios y tráfico sin matrículas',
      nl: 'Verdiepingstriage, brandweerdata & kentekenvrije verkeerstelling'
    },
    copy: {
      citizen: {
        en: 'The barometer estimates which floor you are on inside a building, helps forecast wildfire wind shifts, and the camera can count blocked road traffic locally without ever recording faces or license plates.',
        es: 'El barómetro estima en qué planta estás dentro de un edificio, ayuda a medir cambios de viento en incendios y la cámara cuenta vehículos bloqueados en local sin guardar matrículas ni caras.',
        nl: 'De barometer schat op welke verdieping u bent, helpt brandwind te meten en de camera telt lokaal geblokkeerd verkeer zonder gezichten of kentekens op te slaan.'
      },
      investor: {
        en: 'Multi-modal civic intelligence: pairs EMS-98 3D building digital twins, fleet atmospheric pressure sensing for wildfires, and privacy-by-design YOLOX-s + ByteTrack edge vision.',
        es: 'Inteligencia cívica multimodal: une gemelos digitales 3D EMS-98 de edificios, meteorología colaborativa de flotas contra incendios y visión edge YOLOX-s + ByteTrack con privacidad por diseño.',
        nl: 'Multimodale burgerintelligentie: combineert 3D EMS-98 gebouwtwins, brandweer-sensoren en privacyvriendelijke YOLOX-s edge-visie.'
      },
      engineer: {
        en: 'Hypsometric barometric floor estimator + Copernicus DEM GLO-30 wildfire mass-consistent wind solver + local ONNX/Python YOLOX-s + ByteTrack flow counters (zero raw video export).',
        es: 'Estimación barométrica hipsométrica por planta + viento 3D con conservación de masa sobre Copernicus DEM GLO-30 + contadores locales YOLOX-s + ByteTrack (cero exportación de vídeo crudo).',
        nl: 'Barometrische hoogteschatting + Copernicus DEM GLO-30 windmodel + lokale YOLOX-s + ByteTrack verkeerstelling zonder video-export.'
      }
    },
    metricLabel: { en: 'Privacy & Edge Processing', es: 'Privacidad y cómputo local', nl: 'Privacy & edge-verwerking' },
    metricValue: '100% On-Device · EMS-98',
    href: '/senda/edificios.html',
    evidenceId: 'EV-FIRE-SMV'
  }
];

function PhoneScreenVisual({ sensor }: { sensor: SensorId }) {
  return (
    <svg
      viewBox="0 0 320 560"
      className="s-phone-svg"
      role="img"
      aria-label={`Interactive SENDA smartphone sensor animation: ${sensor}`}
    >
      <defs>
        <linearGradient id="phoneBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#071324" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>
      </defs>

      {/* Titanium Phone Chassis */}
      <rect x="24" y="14" width="272" height="532" rx="44" fill="url(#phoneBody)" stroke="#475569" strokeWidth="2.5" />
      <rect x="36" y="26" width="248" height="508" rx="34" fill="url(#screenGlow)" stroke="#1e293b" strokeWidth="1.5" />
      {/* Dynamic Island */}
      <rect x="118" y="38" width="84" height="20" rx="10" fill="#020617" />
      <circle cx="182" cy="48" r="3.5" fill="#0ea5e9" opacity="0.85" />

      {/* Top Status HUD */}
      <text x="54" y="53" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="700">SENDA OS</text>
      <text x="218" y="53" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="700">E2EE ON</text>

      {/* Live Animated Sensor Visualization inside Phone Screen */}
      {sensor === 'seismic' && (
        <g>
          <text x="54" y="92" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="700">IMU 3-AXIS · P-WAVE DETECT</text>
          <rect x="50" y="106" width="220" height="170" rx="16" fill="#0b192c" stroke="#1d4ed8" strokeOpacity="0.45" />
          {/* Animated Seismograph P-wave -> S-wave */}
          <path
            className="s-anim-wave"
            d="M 62 192 L 90 192 L 102 178 L 114 205 L 126 184 L 138 196 L 154 192 L 166 138 L 178 244 L 190 144 L 204 236 L 218 166 L 232 212 L 246 192 L 258 192"
            fill="none"
            stroke="#fb7185"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="102" y1="120" x2="102" y2="262" stroke="#38bdf8" strokeDasharray="4 4" strokeOpacity="0.7" />
          <text x="108" y="134" fill="#7dd3fc" fontSize="9.5" fontFamily="monospace">P-WAVE (+9s LEAD)</text>
          <circle cx="160" cy="356" r="24" fill="#fb7185" fillOpacity="0.18" className="s-anim-pulse" />
          <circle cx="160" cy="356" r="46" fill="none" stroke="#fb7185" strokeWidth="1.5" strokeDasharray="5 5" className="s-anim-spin" style={{ transformOrigin: '160px 356px' }} />
          <circle cx="160" cy="356" r="10" fill="#fb7185" />
          <text x="86" y="432" fill="#f8fafc" fontSize="12" fontWeight="600">14 nearby phones corroborated</text>
          <rect x="56" y="454" width="208" height="44" rx="12" fill="#0f2942" stroke="#38bdf8" strokeOpacity="0.4" />
          <text x="72" y="480" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="700">PRE-AUTH RELAY: TRIGGERED</text>
        </g>
      )}

      {sensor === 'mesh' && (
        <g>
          <text x="54" y="92" fill="#34d399" fontSize="11" fontFamily="monospace" fontWeight="700">BLE 5 + WI-FI DIRECT MESH</text>
          <circle cx="160" cy="240" r="95" fill="none" stroke="#34d399" strokeOpacity="0.18" strokeDasharray="4 6" className="s-anim-spin" style={{ transformOrigin: '160px 240px' }} />
          <circle cx="160" cy="240" r="56" fill="#34d399" fillOpacity="0.08" stroke="#34d399" strokeOpacity="0.4" className="s-anim-pulse" />
          {/* Multi-hop path */}
          <path d="M 88 308 L 160 240 L 228 192 L 194 128" fill="none" stroke="#38bdf8" strokeWidth="2.8" className="s-anim-dash" />
          {[
            [88, 308, 'SOS', '#fb7185'],
            [160, 240, 'HOP 1', '#34d399'],
            [228, 192, 'HOP 2', '#38bdf8'],
            [194, 128, 'EXIT', '#30d158']
          ].map(([cx, cy, lbl, col]) => (
            <g key={String(lbl)}>
              <circle cx={Number(cx)} cy={Number(cy)} r="13" fill="#081422" stroke={String(col)} strokeWidth="2.5" />
              <text x={Number(cx) - 16} y={Number(cy) + 27} fill="#e2e8f0" fontSize="9.5" fontFamily="monospace">{lbl}</text>
            </g>
          ))}
          <rect x="52" y="396" width="216" height="104" rx="16" fill="#0b192c" stroke="#1e3a5f" />
          <text x="68" y="422" fill="#94a3b8" fontSize="10" fontFamily="monospace">CELLULAR: 0 BARS (OFFLINE)</text>
          <text x="68" y="446" fill="#34d399" fontSize="11.5" fontFamily="monospace" fontWeight="700">CGR ARR_REPLAN_V2 · 94.2%</text>
          <text x="68" y="472" fill="#7dd3fc" fontSize="10" fontFamily="monospace">BLIND RELAY · -84% ENERGY</text>
        </g>
      )}

      {sensor === 'radar' && (
        <g>
          <text x="54" y="92" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="700">WI-FI CSI · 64-SUBCARRIER OFDM</text>
          {/* Wall Obstacle */}
          <rect x="148" y="122" width="24" height="186" rx="4" fill="#334155" stroke="#64748b" strokeDasharray="3 3" />
          <text x="128" y="328" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">WALL (P.2040)</text>
          {/* Scanning Beams */}
          <path d="M 66 215 Q 112 165 148 180 T 246 196" fill="none" stroke="#38bdf8" strokeWidth="2.2" className="s-anim-dash" />
          <path d="M 66 215 Q 112 215 148 215 T 246 215" fill="none" stroke="#34d399" strokeWidth="2.5" className="s-anim-dash" />
          <path d="M 66 215 Q 112 265 148 250 T 246 234" fill="none" stroke="#38bdf8" strokeWidth="2.2" className="s-anim-dash" />
          <circle cx="66" cy="215" r="11" fill="#38bdf8" />
          <circle cx="246" cy="215" r="16" fill="#30d158" fillOpacity="0.25" className="s-anim-pulse" />
          <circle cx="246" cy="215" r="7" fill="#30d158" />
          {/* 64-subcarrier mini bars */}
          <rect x="52" y="366" width="216" height="132" rx="16" fill="#0b192c" stroke="#1e3a5f" />
          <text x="66" y="390" fill="#7dd3fc" fontSize="10" fontFamily="monospace">OFDM AMPLITUDE & PHASE</text>
          {Array.from({ length: 18 }).map((_, i) => {
            const h = 16 + ((i * 29 + 17) % 52);
            return (
              <rect
                key={i}
                x={66 + i * 10.5}
                y={476 - h}
                width="6"
                height={h}
                rx="3"
                fill={i > 7 && i < 12 ? '#30d158' : '#38bdf8'}
                opacity="0.85"
              />
            );
          })}
        </g>
      )}

      {sensor === 'satellite' && (
        <g>
          <text x="54" y="92" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="700">3GPP NTN · LEO 550 KM PASS</text>
          {/* Orbital Arc */}
          <path d="M 54 188 Q 160 100 266 188" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 5" />
          {/* Satellite Icon */}
          <g className="s-anim-float">
            <rect x="148" y="132" width="24" height="14" rx="3" fill="#e2e8f0" />
            <rect x="118" y="136" width="26" height="6" rx="2" fill="#38bdf8" />
            <rect x="176" y="136" width="26" height="6" rx="2" fill="#38bdf8" />
          </g>
          {/* Downlink Cone */}
          <polygon points="160,152 108,332 212,332" fill="#38bdf8" fillOpacity="0.12" />
          <line x1="160" y1="152" x2="160" y2="332" stroke="#30d158" strokeWidth="2.5" className="s-anim-dash" />
          <circle cx="160" cy="332" r="14" fill="#0b192c" stroke="#30d158" strokeWidth="2.5" />
          <rect x="52" y="376" width="216" height="122" rx="16" fill="#0b192c" stroke="#1e3a5f" />
          <text x="68" y="402" fill="#34d399" fontSize="10.5" fontFamily="monospace" fontWeight="700">OEP-NTN 24-BYTE BURST</text>
          <text x="68" y="428" fill="#e2e8f0" fontSize="10" fontFamily="monospace">4F 45 50 04 9C 12 8A F0</text>
          <text x="68" y="450" fill="#94a3b8" fontSize="10" fontFamily="monospace">DOPPLER: -31.4 kHz COMP</text>
          <text x="68" y="474" fill="#38bdf8" fontSize="10" fontFamily="monospace">CRC-16-CCITT: 0x9B4E OK</text>
        </g>
      )}

      {sensor === 'acoustic' && (
        <g>
          <text x="54" y="92" fill="#fbbf24" fontSize="11" fontFamily="monospace" fontWeight="700">MFSK-16 ACOUSTIC MODEM</text>
          <rect x="52" y="114" width="216" height="224" rx="18" fill="#0b192c" stroke="#f59e0b" strokeOpacity="0.45" />
          {Array.from({ length: 16 }).map((_, i) => {
            const h = 34 + ((i * 43 + 19) % 120);
            return (
              <rect
                key={i}
                x={66 + i * 11.8}
                y={226 - h / 2}
                width="7.5"
                height={h}
                rx="4"
                fill={i % 3 === 0 ? '#fbbf24' : '#38bdf8'}
                className="s-anim-pulse"
              />
            );
          })}
          <text x="68" y="324" fill="#fde68a" fontSize="10" fontFamily="monospace">16 TONES · ~300 B ENVELOPE</text>
          <rect x="52" y="366" width="216" height="132" rx="16" fill="#0b192c" stroke="#1e3a5f" />
          <text x="68" y="396" fill="#fbbf24" fontSize="11" fontFamily="monospace" fontWeight="700">ZERO RADIO REQUIRED</text>
          <text x="68" y="424" fill="#e2e8f0" fontSize="10" fontFamily="monospace">FEC: HAMMING(7,4) + CRC-32</text>
          <text x="68" y="450" fill="#94a3b8" fontSize="10" fontFamily="monospace">WORKS: IOS / ANDROID / WEB</text>
          <text x="68" y="476" fill="#34d399" fontSize="10" fontFamily="monospace">DECODED IN NOISE · PASS</text>
        </g>
      )}

      {sensor === 'vision' && (
        <g>
          <text x="54" y="92" fill="#34d399" fontSize="11" fontFamily="monospace" fontWeight="700">BAROMETER + YOLOX-S EDGE</text>
          {/* 3D Building Floor Stack */}
          <rect x="56" y="114" width="96" height="184" rx="12" fill="#0b192c" stroke="#1e3a5f" />
          {[0, 1, 2, 3, 4].map((fl) => (
            <g key={fl}>
              <rect
                x="68"
                y={132 + fl * 32}
                width="72"
                height="22"
                rx="5"
                fill={fl === 1 ? '#0ea5e9' : '#1e293b'}
                fillOpacity={fl === 1 ? 0.35 : 0.9}
                stroke={fl === 1 ? '#38bdf8' : '#334155'}
              />
              <text x="78" y={147 + fl * 32} fill={fl === 1 ? '#e0f2fe' : '#94a3b8'} fontSize="9.5" fontFamily="monospace">
                F{5 - fl} {fl === 1 ? '· FIX' : ''}
              </text>
            </g>
          ))}
          {/* YOLOX Local Privacy Box */}
          <rect x="164" y="114" width="104" height="184" rx="12" fill="#0b192c" stroke="#1e3a5f" />
          <rect x="176" y="142" width="44" height="30" rx="4" fill="none" stroke="#30d158" strokeWidth="2" />
          <text x="178" y="137" fill="#30d158" fontSize="8.5" fontFamily="monospace">VEH #14</text>
          <rect x="208" y="198" width="48" height="34" rx="4" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <text x="210" y="193" fill="#38bdf8" fontSize="8.5" fontFamily="monospace">VEH #15</text>
          <text x="174" y="264" fill="#94a3b8" fontSize="8.5" fontFamily="monospace">NO PLATES</text>
          <text x="174" y="280" fill="#34d399" fontSize="8.5" fontFamily="monospace">LOCAL ONLY</text>

          <rect x="52" y="324" width="216" height="174" rx="16" fill="#0b192c" stroke="#1e3a5f" />
          <text x="68" y="352" fill="#38bdf8" fontSize="10.5" fontFamily="monospace" fontWeight="700">PRESSURE: 1011.2 hPa (F4)</text>
          <text x="68" y="380" fill="#e2e8f0" fontSize="10" fontFamily="monospace">EMS-98 DIGITAL TWIN READY</text>
          <text x="68" y="408" fill="#94a3b8" fontSize="10" fontFamily="monospace">WILDFIRE WIND + FLEET METEO</text>
          <text x="68" y="436" fill="#34d399" fontSize="10" fontFamily="monospace">YOLOX-S + BYTETRACK EDGE</text>
          <text x="68" y="464" fill="#7dd3fc" fontSize="10" fontFamily="monospace">ZERO CLOUD VIDEO UPLOAD</text>
        </g>
      )}
    </svg>
  );
}

export default function SensorShowcase({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const [activeSensor, setActiveSensor] = useState<SensorId>('seismic');
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const els = cardRefs.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.sensorId as SensorId;
            if (id) setActiveSensor(id);
          }
        }
      },
      { rootMargin: '-34% 0px -42% 0px', threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const icons: Record<SensorId, typeof Activity> = {
    seismic: Activity,
    mesh: Bluetooth,
    radar: Radar,
    satellite: Satellite,
    acoustic: Volume2,
    vision: Camera
  };

  const copy = {
    en: {
      eyebrow: 'EVERY SMARTPHONE SENSOR ACTIVATED · HARDWARE REVEAL',
      title: 'Six ordinary phone sensors, turned into an emergency survival stack.',
      lead: 'Scroll down on mobile or desktop (or tap any sensor) to watch how SENDA harnesses every chip already inside your pocket.',
      openModule: 'Launch live module'
    },
    es: {
      eyebrow: 'CADA SENSOR DEL MÓVIL AL SERVICIO DEL RESCATE · MOCKUP INTERACTIVO',
      title: 'Seis sensores que ya llevas en el bolsillo, convertidos en una estación de rescate.',
      lead: 'Baja con el scroll en móvil o escritorio (o pulsa cualquier sensor) para ver cómo SENDA aprovecha cada chip del smartphone en emergencias.',
      openModule: 'Abrir módulo interactivo'
    },
    nl: {
      eyebrow: 'ELKE SMARTPHONESENSOR BENUT · HARDWARE-OVERZICHT',
      title: 'Zes gewone telefoonsensoren, omgevormd tot een reddingssysteem.',
      lead: 'Scroll omlaag op mobiel of desktop (of tik op een sensor) en zie hoe SENDA elke chip in uw telefoon benut.',
      openModule: 'Open interactieve module'
    }
  }[locale];

  const currentSpec = SENSORS.find((s) => s.id === activeSensor) ?? SENSORS[0];

  return (
    <section className="s-section s-sunk" data-testid="sensor-showcase">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">{copy.eyebrow}</p>
          <h2 className="s-h2">{copy.title}</h2>
          <p className="s-lead">{copy.lead}</p>
        </div>

        {/* Mobile/Quick selector pills */}
        <div className="s-tabs-scroller" role="tablist" aria-label={copy.title}>
          {SENSORS.map((s) => {
            const Icon = icons[s.id];
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeSensor === s.id}
                className="s-tab-btn"
                onClick={() => setActiveSensor(s.id)}
                data-testid={`sensor-tab-${s.id}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{s.title[locale]}</span>
              </button>
            );
          })}
        </div>

        <div className="s-sensor-layout">
          {/* Sticky Apple-style Phone Hardware Mockup */}
          <div className="s-sensor-sticky">
            <div className="s-phone-stage">
              <div className="s-between" style={{ width: '100%', padding: '0 6px' }}>
                <span className="s-pill s-mono">{currentSpec.chip}</span>
                <span className="s-pill s-mono" style={{ color: 'var(--s-accent)' }}>{currentSpec.badge}</span>
              </div>
              <PhoneScreenVisual sensor={activeSensor} />
              <div className="s-phone-foot">
                <span className="s-micro s-faint">{currentSpec.metricLabel[locale]}</span>
                <strong className="s-mono s-num">{currentSpec.metricValue}</strong>
              </div>
            </div>
          </div>

          {/* Scroll-driven Sensor Cards */}
          <div className="s-sensor-cards">
            {SENSORS.map((s, idx) => {
              const Icon = icons[s.id];
              const isActive = activeSensor === s.id;
              return (
                <article
                  key={s.id}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  data-sensor-id={s.id}
                  className={`s-card s-sensor-card s-scroll-reveal${isActive ? ' is-active' : ''}`}
                  onClick={() => setActiveSensor(s.id)}
                >
                  <div className="s-between">
                    <span className="s-row" style={{ gap: 10 }}>
                      <span className="s-card-icon" style={{ marginBottom: 0 }}>
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="s-mono s-micro" style={{ color: 'var(--s-accent)', fontWeight: 700 }}>
                        {s.code} · {s.chip}
                      </span>
                    </span>
                    <EvidenceBadge locale={locale} evidenceId={s.evidenceId} compact />
                  </div>
                  <h3 className="s-h3">{s.title[locale]}</h3>
                  <p className="s-small" style={{ color: 'var(--s-text)', fontWeight: 500, margin: 0 }}>
                    {s.subtitle[locale]}
                  </p>
                  <p style={{ margin: 0 }}>{s.copy[audience][locale]}</p>
                  <div className="s-between" style={{ marginTop: 6 }}>
                    <span className="s-pill s-mono">{s.metricValue}</span>
                    <a href={s.href} className="s-link s-row s-small" style={{ gap: 5 }}>
                      <span>{copy.openModule}</span>
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
