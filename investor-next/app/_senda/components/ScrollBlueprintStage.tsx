'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Layers,
  Lock,
  Pause,
  Play,
  Radio,
  Satellite,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';
import type { Locale, LocalizedText } from '../data/types';

interface BlueprintBeat {
  step: string;
  tag: LocalizedText;
  title: LocalizedText;
  whatHappens: LocalizedText;
  whyUnique: LocalizedText;
  metric: string;
  metricLabel: LocalizedText;
  evidenceId: string;
  accent: string;
}

const BEATS: BlueprintBeat[] = [
  {
    step: '01',
    tag: { es: 'CAPA 01 · FALLO DE RED CONVENCIONAL', en: 'LAYER 01 · CELLULAR BLACKOUT', nl: 'LAAG 01 · MOBIELE UITVAL' },
    title: {
      es: 'Cuando caen las torres, las apps clásicas se quedan mudas.',
      en: 'When cell towers fall, conventional apps fail in silence.',
      nl: 'Als zendmasten uitvallen, vallen gewone apps direct stil.'
    },
    whatHappens: {
      es: 'Un incendio forestal, una DANA o el apagón ibérico deja sin energía ni fibra a las antenas locales. WhatsApp, Telegram y las llamadas reintentan contra la nube durante horas con 0 % de entrega.',
      en: 'A wildfire, flash flood, or regional blackout cuts tower power and backhaul. Cloud messaging apps retry blindly for hours with 0% delivery.',
      nl: 'Natuurbrand, overstroming of stroomuitval schakelt zendmasten uit. Cloud-apps proberen urenlang vergeefs te verbinden met 0% bezorging.'
    },
    whyUnique: {
      es: 'SENDA no espera a que vuelva la antena: la PWA arranca en modo avión desde IndexedDB y activa inmediatamente una cola local determinista.',
      en: 'SENDA never waits for cellular recovery: the offline PWA launches in airplane mode from IndexedDB with a deterministic local queue.',
      nl: 'SENDA wacht niet op herstel: de PWA start in vliegtuigmodus vanuit IndexedDB met een deterministische lokale wachtrij.'
    },
    metric: '0 % → 94,2 %',
    metricLabel: { es: 'Salto de entrega sin cobertura', en: 'Off-grid delivery jump', nl: 'Offline bezorgsprong' },
    evidenceId: 'EV-S01-ROUTE',
    accent: '#ff6b4a'
  },
  {
    step: '02',
    tag: { es: 'CAPA 02 · SOBRE CIFRADO E2EE + REED-SOLOMON', en: 'LAYER 02 · E2EE ENVELOPE + REED-SOLOMON', nl: 'LAAG 02 · E2EE-ENVELOP + REED-SOLOMON' },
    title: {
      es: 'Tu aviso se sella criptográficamente y se divide en fragmentos indestructibles.',
      en: 'Your SOS is sealed end-to-end and split into resilient shards.',
      nl: 'Uw noodbericht wordt end-to-end verzegeld en opgesplitst in fragmenten.'
    },
    whatHappens: {
      es: 'El teléfono firma el paquete con ECDSA P-256, cifra el contenido con ECDH + AES-GCM y aplica corrección de borrado Reed-Solomon k-de-n (basta que lleguen 3 de 5 fragmentos para reconstruir el mensaje entero).',
      en: 'The handset signs the packet with ECDSA P-256, encrypts payload with ECDH + AES-GCM, and encodes k-of-n Reed-Solomon shards (any 3 of 5 reconstruct the full message).',
      nl: 'Het toestel ondertekent met ECDSA P-256, versleutelt met ECDH + AES-GCM en maakt k-van-n Reed-Solomon-fragmenten (3 van 5 volstaan).'
    },
    whyUnique: {
      es: 'Además comprime una ráfaga crítica en solo 24 bytes para caber en un único paquete satelital 3GPP NTN o una transmisión acústica breve.',
      en: 'Simultaneously compresses a critical SOS into a 24-byte burst compact enough for a single 3GPP NTN satellite frame or short acoustic chirp.',
      nl: 'Comprimeert bovendien een kritieke SOS tot slechts 24 bytes voor een enkel 3GPP NTN-satellietpakket of korte geluidspuls.'
    },
    metric: '24 B · 3/5',
    metricLabel: { es: 'Ráfaga NTN y recuperación k-de-n', en: 'NTN burst & k-of-n recovery', nl: 'NTN-burst & k-van-n herstel' },
    evidenceId: 'EV-CORE-506',
    accent: '#38bdf8'
  },
  {
    step: '03',
    tag: { es: 'CAPA 03 · CARRERA MULTICANAL EN 5 VÍAS', en: 'LAYER 03 · 5-CHANNEL MULTIPATH RACE', nl: 'LAAG 03 · 5-KANAALS MULTIPATH-RACE' },
    title: {
      es: 'Cinco canales físicos compiten en paralelo sin intervención del usuario.',
      en: 'Five physical carriers race in parallel automatically.',
      nl: 'Vijf fysieke kanalen werken automatisch parallel.'
    },
    whatHappens: {
      es: 'El planificador Contact Graph Routing (ARR_REPLAN_V2) dispara el paquete por Bluetooth LE, Wi-Fi Direct, sonido MFSK-16 (altavoz a micrófono), LoRa 868 MHz y puente satelital LEO vecino.',
      en: 'Contact Graph Routing (ARR_REPLAN_V2) dispatches over Bluetooth LE, Wi-Fi Direct, MFSK-16 sound (speaker to mic), 868 MHz LoRa, and neighbor LEO satellite relays.',
      nl: 'Contact Graph Routing (ARR_REPLAN_V2) verzendt via BLE, Wi-Fi Direct, MFSK-16 geluid, 868 MHz LoRa en satellietbruggen.'
    },
    whyUnique: {
      es: 'Ahorra un 84 % de batería frente a la inundación epidémica (694 mJ frente a 4.420 mJ) porque solo despierta relés con probabilidad física real de contacto.',
      en: 'Saves 84% battery compared to epidemic flooding (694 mJ vs 4,420 mJ) by waking only relays with proven physical contact probability.',
      nl: 'Bespaart 84% accu t.o.v. epidemische flooding (694 mJ vs 4.420 mJ) door alleen kansrijke relays te wekken.'
    },
    metric: '-84 % mJ',
    metricLabel: { es: 'Energía vs difusión epidémica', en: 'Energy vs epidemic flooding', nl: 'Energiebesparing' },
    evidenceId: 'EV-ARR-V2',
    accent: '#22d3ee'
  },
  {
    step: '04',
    tag: { es: 'CAPA 04 · FUSIÓN OSINT (16.699 FUENTES) Y GEMELOS 3D', en: 'LAYER 04 · OSINT FUSION (16,699 SOURCES) & 3D TWINS', nl: 'LAAG 04 · OSINT-FUSIE & 3D-TWINS' },
    title: {
      es: 'Cada aviso se cruza al instante con satélites, cámaras públicas y física 3D.',
      en: 'Every alert correlates instantly with satellites, public cameras, and 3D physics.',
      nl: 'Elke melding wordt direct gecorreleerd met satellieten, camera’s en 3D-fysica.'
    },
    whatHappens: {
      es: 'La consola unifica DGT, NDW, USGS, EMSC, GDACS, Copernicus EMS, incendios 3D, gemelos estructurales y visión vial YOLOX sin guardar matrículas ni biometría (k-anonimato k >= 5).',
      en: 'The console fuses DGT, NDW, USGS, EMSC, GDACS, Copernicus EMS, 3D wildfire spread, building twins, and privacy-first YOLOX traffic vision (k >= 5).',
      nl: 'De console fuseert DGT, NDW, USGS, EMSC, GDACS, Copernicus EMS, 3D-brandfysica en privacyvriendelijke YOLOX-visie.'
    },
    whyUnique: {
      es: 'Unifica alertas ciudadanas offline con inteligencia geoespacial abierta en una sola vista auditable y transparente para operadores 112 y protección civil.',
      en: 'Unites offline citizen SOS beacons with open geospatial intelligence in one auditable operational picture for civil protection.',
      nl: 'Combineert offline burger-SOS met open geospatiale intelligentie in één auditeerbaar operationeel beeld.'
    },
    metric: '16.699',
    metricLabel: { es: 'Fuentes abiertas correlacionadas', en: 'Open sources correlated', nl: 'Open bronnen gecorreleerd' },
    evidenceId: 'EV-CONSOLE-16K',
    accent: '#a78bfa'
  },
  {
    step: '05',
    tag: { es: 'CAPA 05 · RECIBO FIRMADO (ACK) Y PURGA CIEGA', en: 'LAYER 05 · SIGNED ACK & BLIND RELAY PURGE', nl: 'LAAG 05 · ONDERTEKENDE ACK & PURGE' },
    title: {
      es: 'Solo confirmamos entrega con recibo criptográfico y borramos las copias intermedias.',
      en: 'Delivery is confirmed only by signed receipt, auto-purging intermediate relays.',
      nl: 'Bezorging geldt pas bij cryptografische ACK, waarna kopieën direct verdwijnen.'
    },
    whatHappens: {
      es: 'Al llegar a tu familia o al centro de coordinación, vuelve un ACK firmado ECDSA. Cada móvil intermedio recibe la lápida anti-replay y purga su copia cifrada al instante.',
      en: 'Once received by family or operations, a signed ECDSA ACK returns. Every intermediate phone receives an anti-replay tombstone and wipes its cached copy.',
      nl: 'Zodra familie of coördinatie het bericht ontvangt, keert een ECDSA-ACK terug en wissen tussenstations hun kopie direct.'
    },
    whyUnique: {
      es: 'En el escenario S01 de apagón de 8 horas, el mensaje llega en 4 minutos frente a 91 minutos por satélite directo o 480 minutos esperando a que vuelva la torre móvil.',
      en: 'In the 8-hour blackout benchmark (S01), delivery completes in 4 minutes versus 91 minutes via direct-to-cell satellite or 480 minutes waiting for cellular repair.',
      nl: 'In het 8-uurs uitvalscenario (S01) arriveert het bericht in 4 minuten tegenover 91 min (satelliet) of 480 min (mobiel).'
    },
    metric: '4 min',
    metricLabel: { es: 'Frente a 480 min sin SENDA', en: 'vs 480 min cellular-only', nl: 't.o.v. 480 min regulier' },
    evidenceId: 'EV-S01-ROUTE',
    accent: '#34d399'
  }
];

export default function ScrollBlueprintStage({ locale }: { locale: Locale }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const nodes = stepRefs.current.filter(Boolean) as HTMLElement[];
    if (nodes.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
            const idx = Number((entry.target as HTMLElement).dataset.stepIdx);
            if (!Number.isNaN(idx)) {
              bestRatio = entry.intersectionRatio;
              bestIdx = idx;
            }
          }
        }
        if (bestIdx >= 0) setActiveIdx(bestIdx);
      },
      { rootMargin: '-28% 0px -38% 0px', threshold: [0.15, 0.35, 0.6] }
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const current = BEATS[activeIdx] ?? BEATS[0];
  const progressPct = Math.round(((activeIdx + 1) / BEATS.length) * 100);

  const ui = {
    es: {
      eyebrow: 'CONSTRUCCIÓN EN VIVO AL HACER SCROLL · ARQUITECTURA INTERACTIVA',
      title: 'Mira cómo se construye SENDA capa a capa mientras recorres la página.',
      lead: 'Baja despacio (o pulsa cualquier capa 01–05): el plano táctico permanece fijo y ensambla en tiempo real el sobre cifrado, los 5 canales físicos, los satélites, la fusión OSINT y el recibo firmado ACK.',
      whatHappens: 'QUÉ OCURRE EN ESTA CAPA',
      whyUnique: 'QUÉ APORTA SENDA DE NUEVO',
      pauseMotion: 'Pausar pulsos',
      resumeMotion: 'Reanudar pulsos',
      liveLayer: 'CAPA ACTIVA'
    },
    en: {
      eyebrow: 'SCROLL-BUILT ARCHITECTURE · LIVE INTERACTIVE BLUEPRINT',
      title: 'Watch SENDA assemble layer by layer as you scroll down.',
      lead: 'Scroll smoothly (or tap layers 01–05): the tactical blueprint stays locked in view and builds the E2EE envelope, 5-carrier race, orbital bridge, OSINT fusion, and signed ACK in real time.',
      whatHappens: 'WHAT HAPPENS AT THIS LAYER',
      whyUnique: 'WHAT SENDA BRINGS THAT IS NEW',
      pauseMotion: 'Pause pulses',
      resumeMotion: 'Resume pulses',
      liveLayer: 'ACTIVE LAYER'
    },
    nl: {
      eyebrow: 'SCROLL-GEBOUWDE ARCHITECTUUR · LIVE INTERACTIEVE BLAUWDRUK',
      title: 'Zie hoe SENDA laag voor laag wordt opgebouwd terwijl u scrolt.',
      lead: 'Scroll rustig omlaag (of tik op laag 01–05): de tactische blauwdruk blijft in beeld en bouwt E2EE-versleuteling, 5 kanalen, satelliet, OSINT-fusie en ACK live op.',
      whatHappens: 'WAT ER IN DEZE LAAG GEBEURT',
      whyUnique: 'WAT SENDA NIEUW TOEVOEGT',
      pauseMotion: 'Pauzeer pulsen',
      resumeMotion: 'Hervat pulsen',
      liveLayer: 'ACTIEVE LAAG'
    }
  }[locale];

  return (
    <section
      className={`s-section s-blueprint-band${motionPaused ? ' is-motion-paused' : ''}`}
      data-testid="scroll-blueprint-stage"
      aria-label={ui.title}
    >
      <div className="s-container s-stack-lg">
        <div className="s-between" style={{ alignItems: 'flex-end', gap: 16 }}>
          <div className="s-read">
            <p className="s-eyebrow">
              <Layers size={15} aria-hidden="true" />
              <span>{ui.eyebrow}</span>
            </p>
            <h2 className="s-h2">{ui.title}</h2>
            <p className="s-lead">{ui.lead}</p>
          </div>
          <button
            type="button"
            className="s-btn s-btn-secondary s-btn-sm"
            onClick={() => setMotionPaused((p) => !p)}
            data-testid="blueprint-motion-toggle"
          >
            {motionPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            <span>{motionPaused ? ui.resumeMotion : ui.pauseMotion}</span>
          </button>
        </div>

        {/* Sticky visual stage + 5 scrolling architecture chapters */}
        <div className="s-blueprint-grid">
          {/* STICKY TACTICAL BLUEPRINT CANVAS (Pinned on desktop AND sticky compact HUD on mobile!) */}
          <div className="s-blueprint-sticky">
            <div className="s-blueprint-hud" style={{ borderColor: `color-mix(in srgb, ${current.accent} 48%, var(--s-line-strong))` }}>
              <div className="s-blueprint-hud-top">
                <div className="s-row" style={{ gap: 8 }}>
                  <span className="s-live-dot" style={{ background: current.accent }} aria-hidden="true" />
                  <span className="s-mono s-micro" style={{ color: current.accent, fontWeight: 700 }}>
                    {ui.liveLayer} {current.step}/05
                  </span>
                </div>
                <div className="s-blueprint-dots" role="tablist" aria-label={ui.eyebrow}>
                  {BEATS.map((b, idx) => (
                    <button
                      key={b.step}
                      type="button"
                      role="tab"
                      aria-selected={activeIdx === idx}
                      className={`s-blueprint-dot-btn${activeIdx === idx ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveIdx(idx);
                        stepRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      data-testid={`blueprint-dot-${b.step}`}
                    >
                      {b.step}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic High-Precision SVG Render Morphing Across Layers 0..4 */}
              <div className="s-blueprint-canvas-wrap">
                <svg
                  viewBox="0 0 640 360"
                  role="img"
                  aria-label={current.title[locale]}
                  className="s-blueprint-svg"
                >
                  <defs>
                    <linearGradient id="bpGradCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                    <linearGradient id="bpGradCoral" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff6b4a" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                    <pattern id="bpGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
                    </pattern>
                  </defs>

                  <rect width="640" height="360" rx="16" fill="#040912" />
                  <rect width="640" height="360" rx="16" fill="url(#bpGrid)" />

                  {/* Layer 01: Cellular Outage Rings */}
                  <g opacity={activeIdx === 0 ? 1 : 0.24} className="s-bp-layer">
                    <circle cx="320" cy="180" r="108" fill="rgba(255,107,74,0.07)" stroke="#ff6b4a" strokeWidth="1.5" strokeDasharray="6 6" className="s-bp-pulse" />
                    <circle cx="320" cy="180" r="56" fill="rgba(255,107,74,0.12)" stroke="#ff6b4a" strokeWidth="2" />
                    <line x1="320" y1="138" x2="320" y2="222" stroke="#ff6b4a" strokeWidth="3" />
                    <line x1="298" y1="158" x2="342" y2="202" stroke="#ff6b4a" strokeWidth="2.5" />
                    <line x1="342" y1="158" x2="298" y2="202" stroke="#ff6b4a" strokeWidth="2.5" />
                    {activeIdx === 0 && (
                      <text x="320" y="316" textAnchor="middle" fill="#fda4af" fontFamily="monospace" fontSize="13" fontWeight="700">
                        4G/5G BACKHAUL DOWN · 0 ROUTES · APPS CONVENCIONALES = SILENCIO
                      </text>
                    )}
                  </g>

                  {/* Origin Phone Node (always visible, energizes from Layer 02+) */}
                  <g transform="translate(52,132)">
                    <rect
                      width="96"
                      height="96"
                      rx="16"
                      fill="#0b1525"
                      stroke={activeIdx >= 1 ? '#38bdf8' : '#ff6b4a'}
                      strokeWidth="2.5"
                    />
                    <text x="48" y="34" textAnchor="middle" fill="#94a3b8" fontFamily="monospace" fontSize="10">SENDA PWA</text>
                    <text x="48" y="54" textAnchor="middle" fill="#f8fafc" fontFamily="monospace" fontSize="12" fontWeight="700">MODO AVIÓN</text>
                    <rect x="16" y="66" width="64" height="18" rx="9" fill={activeIdx >= 1 ? 'rgba(56,189,248,0.22)' : 'rgba(255,107,74,0.22)'} />
                    <text x="48" y="79" textAnchor="middle" fill={activeIdx >= 1 ? '#7dd3fc' : '#fda4af'} fontFamily="monospace" fontSize="10" fontWeight="700">
                      {activeIdx === 0 ? 'SOS QUEUED' : 'E2EE SEALED'}
                    </text>
                  </g>

                  {/* Layer 02: E2EE + Reed-Solomon k-of-n Shards + 24B NTN */}
                  <g opacity={activeIdx >= 1 ? 1 : 0.08} className="s-bp-layer">
                    {[0, 1, 2, 3, 4].map((shard) => {
                      const y = 78 + shard * 46;
                      const recovered = shard < 3;
                      return (
                        <g key={shard} transform={`translate(182,${y})`}>
                          <rect
                            width="112"
                            height="30"
                            rx="8"
                            fill={recovered ? 'rgba(56,189,248,0.16)' : 'rgba(148,163,184,0.08)'}
                            stroke={recovered ? '#38bdf8' : '#475569'}
                            strokeWidth="1.5"
                          />
                          <text x="10" y="19" fill={recovered ? '#e0f2fe' : '#94a3b8'} fontFamily="monospace" fontSize="10.5" fontWeight="700">
                            RS #{shard + 1}/5 {recovered ? 'OK' : 'REDUND.'}
                          </text>
                        </g>
                      );
                    })}
                    {activeIdx === 1 && (
                      <text x="320" y="332" textAnchor="middle" fill="#7dd3fc" fontFamily="monospace" fontSize="12.5" fontWeight="700">
                        ECDH P-256 + AES-GCM + REED-SOLOMON (3/5) + RÁFAGA NTN 24 BYTES
                      </text>
                    )}
                  </g>

                  {/* Layer 03: 5-Carrier Parallel Race Curves */}
                  <g opacity={activeIdx >= 2 ? 1 : 0.06} className="s-bp-layer">
                    {/* Orbital Satellite Arc */}
                    <path
                      d="M 148 164 Q 332 22 508 164"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={activeIdx === 2 ? 3 : 2}
                      strokeDasharray="10 6"
                      className="s-route-anim"
                    />
                    <circle cx="332" cy="56" r="14" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
                    <text x="332" y="34" textAnchor="middle" fill="#fde68a" fontFamily="monospace" fontSize="11" fontWeight="700">
                      SAT LEO 3GPP NTN · 24 B
                    </text>

                    {/* BLE + Wi-Fi Direct middle race */}
                    <path
                      d="M 294 148 C 365 130, 425 130, 494 166"
                      fill="none"
                      stroke="url(#bpGradCyan)"
                      strokeWidth="3.2"
                      className="s-route-anim"
                    />
                    <text x="394" y="122" textAnchor="middle" fill="#7dd3fc" fontFamily="monospace" fontSize="11" fontWeight="700">
                      BLE MESH + WI-FI DIRECT
                    </text>

                    {/* Acoustic MFSK-16 & LoRa bottom race */}
                    <path
                      d="M 294 218 C 365 268, 430 268, 494 202"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeDasharray="7 5"
                      className="s-route-anim"
                    />
                    <text x="394" y="276" textAnchor="middle" fill="#6ee7b7" fontFamily="monospace" fontSize="11" fontWeight="700">
                      SONIDO MFSK-16 + LORA 868 MHz
                    </text>
                  </g>

                  {/* Layer 04: OSINT Fusion 16,699 Sources + 3D Twins Halo */}
                  <g opacity={activeIdx >= 3 ? 1 : 0.05} className="s-bp-layer">
                    <rect x="330" y="148" width="144" height="72" rx="14" fill="rgba(167,139,250,0.16)" stroke="#a78bfa" strokeWidth="2" />
                    <text x="402" y="172" textAnchor="middle" fill="#ddd6fe" fontFamily="monospace" fontSize="11" fontWeight="700">
                      OSINT FUSIÓN
                    </text>
                    <text x="402" y="191" textAnchor="middle" fill="#f8fafc" fontFamily="monospace" fontSize="13" fontWeight="700">
                      16.699 FUENTES
                    </text>
                    <text x="402" y="209" textAnchor="middle" fill="#c4b5fd" fontFamily="monospace" fontSize="9.5">
                      DGT · NDW · EMSC · 3D DEM
                    </text>
                  </g>

                  {/* Destination + Layer 05: Signed ACK & Blind Relay Purge */}
                  <g transform="translate(494,132)">
                    <rect
                      width="102"
                      height="96"
                      rx="16"
                      fill={activeIdx === 4 ? 'rgba(52,211,153,0.18)' : '#0b1525'}
                      stroke={activeIdx === 4 ? '#34d399' : '#334155'}
                      strokeWidth="2.5"
                    />
                    <text x="51" y="34" textAnchor="middle" fill="#94a3b8" fontFamily="monospace" fontSize="10">DESTINO / 112</text>
                    <text x="51" y="54" textAnchor="middle" fill="#f8fafc" fontFamily="monospace" fontSize="12" fontWeight="700">
                      {activeIdx === 4 ? 'ACK FIRMADO' : 'RECEPTOR'}
                    </text>
                    <rect x="14" y="66" width="74" height="18" rx="9" fill={activeIdx === 4 ? 'rgba(52,211,153,0.28)' : 'rgba(148,163,184,0.14)'} />
                    <text x="51" y="79" textAnchor="middle" fill={activeIdx === 4 ? '#6ee7b7' : '#cbd5e1'} fontFamily="monospace" fontSize="10" fontWeight="700">
                      {activeIdx === 4 ? '4 MIN · PURGA' : 'ESPERANDO'}
                    </text>
                  </g>

                  {activeIdx === 4 && (
                    <g>
                      <path
                        d="M 494 218 Q 320 326 148 218"
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="3"
                        strokeDasharray="10 6"
                        className="s-route-anim"
                      />
                      <text x="320" y="334" textAnchor="middle" fill="#6ee7b7" fontFamily="monospace" fontSize="12.5" fontWeight="700">
                        RECIBO ECDSA VERIFICADO · PURGA DE RELÉS CIEGOS · 4 MIN VS 480 MIN
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Sticky Telemetry Footer */}
              <div className="s-blueprint-hud-foot">
                <div>
                  <span className="s-micro s-faint s-mono">{current.metricLabel[locale]}</span>
                  <strong className="s-num" style={{ display: 'block', fontSize: 22, color: current.accent }}>
                    {current.metric}
                  </strong>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div className="s-blueprint-progress-track">
                    <div
                      className="s-blueprint-progress-fill"
                      style={{ transform: `scaleX(${progressPct / 100})`, background: current.accent }}
                    />
                  </div>
                  <span className="s-micro s-faint s-mono" style={{ display: 'block', marginTop: 4 }}>
                    {current.tag[locale]}
                  </span>
                </div>
                <EvidenceBadge locale={locale} evidenceId={current.evidenceId} compact />
              </div>
            </div>
          </div>

          {/* 5 SCROLLING STORYTELLING CHAPTER CARDS */}
          <div className="s-blueprint-steps">
            {BEATS.map((beat, idx) => {
              const isActive = idx === activeIdx;
              const StepIcon = [ShieldAlert, Lock, Radio, Satellite, CheckCircle2][idx] ?? Activity;
              return (
                <article
                  key={beat.step}
                  ref={(el) => {
                    stepRefs.current[idx] = el;
                  }}
                  data-step-idx={idx}
                  data-testid={`blueprint-step-${beat.step}`}
                  className={`s-blueprint-step s-scroll-build${isActive ? ' is-active' : ''}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  <div className="s-between">
                    <span className="s-pill s-mono" style={{ color: beat.accent, borderColor: `color-mix(in srgb, ${beat.accent} 45%, var(--s-line))` }}>
                      <StepIcon size={13} aria-hidden="true" />
                      <span>{beat.tag[locale]}</span>
                    </span>
                    <span className="s-mono s-micro s-faint">{beat.step} / 05</span>
                  </div>

                  <h3 className="s-h3" style={{ marginTop: 12, marginBottom: 10 }}>
                    {beat.title[locale]}
                  </h3>

                  <div className="s-innov-block is-how" style={{ borderLeftColor: beat.accent, marginBottom: 10 }}>
                    <div className="s-innov-label">
                      <Activity size={13} aria-hidden="true" />
                      <span>{ui.whatHappens}</span>
                    </div>
                    <p>{beat.whatHappens[locale]}</p>
                  </div>

                  <div className="s-innov-block is-innov">
                    <div className="s-innov-label">
                      <Sparkles size={13} aria-hidden="true" />
                      <span>{ui.whyUnique}</span>
                    </div>
                    <p>{beat.whyUnique[locale]}</p>
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
