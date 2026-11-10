'use client';
import { useMemo, useState } from 'react';
import type { Locale } from './copy';
import './rail-safety-lab.css';

export default function RailSafetyLab({ locale }: { locale: Locale }) {
  const [activeTab, setActiveTab] = useState<'T1_TEMPI' | 'T2_BUCKLING' | 'T3_GUIDED_WAVES' | 'T4_LEVEL_CROSSING' | 'T5_BEACON'>('T1_TEMPI');

  // Tab 1 controls (Interlocking & Conflict)
  const [train1SpeedKmh, setTrain1SpeedKmh] = useState<number>(140);
  const [train2SpeedKmh, setTrain2SpeedKmh] = useState<number>(90);
  const [distanceKm, setDistanceKm] = useState<number>(12);
  const [isSingleTrack, setIsSingleTrack] = useState<boolean>(true);
  const [switchDiscordance, setSwitchDiscordance] = useState<boolean>(false);

  // Tab 2 controls (Thermal Buckling / Sun Kinks)
  const [ambientTempC, setAmbientTempC] = useState<number>(41);
  const [solarRadiationWm2, setSolarRadiationWm2] = useState<number>(950);
  const [ballastResistanceKNm, setBallastResistanceKNm] = useState<number>(6.5);
  const [initialMisalignmentMm, setInitialMisalignmentMm] = useState<number>(12);

  // Tab 3 controls (Guided Waves & Crack detection)
  const [crackDistanceM, setCrackDistanceM] = useState<number>(2200);
  const [crackSeverity, setCrackSeverity] = useState<'NONE' | 'FISSURE' | 'FULL_BREAK'>('FULL_BREAK');

  // Tab 4 controls (Level Crossing C-ITS)
  const [trainApproachSpeedKmh, setTrainApproachSpeedKmh] = useState<number>(120);
  const [distanceToPnM, setDistanceToPnM] = useState<number>(1100);
  const [carStalledOnTrack, setCarStalledOnTrack] = useState<boolean>(true);

  // Tab 5 controls (Emergency Beacon)
  const [trappedPassengers, setTrappedPassengers] = useState<number>(8);
  const [severeInjuries, setSevereInjuries] = useState<number>(14);

  const T = useMemo(() => {
    return {
      es: {
        badge: 'LABORATORIO DE SEGURIDAD Y FÍSICA FERROVIARIA AVANZADA',
        title: 'Prevención de Catástrofes Ferroviarias: Fusión C-ITS, Ondas Guiadas y Pandeo Térmico',
        lead: 'Modelos analíticos de física aplicada para erradicar las causas raíz de accidentes históricos documentados (Tempi 2023, Balasore 2023, Adamuz 2026, Gelida 2026). Experimenta en tiempo real con las simulaciones interactivas.',
        tabs: [
          { id: 'T1_TEMPI', tag: 'MÓDULO 1', title: 'Conflicto Vía Única y Agujas', shortDesc: 'Patrón Tempi / Balasore' },
          { id: 'T2_BUCKLING', tag: 'MÓDULO 2', title: 'Pandeo Térmico de Carril', shortDesc: 'Sun Kinks / Modelo Kerr' },
          { id: 'T3_GUIDED_WAVES', tag: 'MÓDULO 3', title: 'Ultrasonidos Guiados (5.100 m/s)', shortDesc: 'Detección Rotura Adamuz' },
          { id: 'T4_LEVEL_CROSSING', tag: 'MÓDULO 4', title: 'C-ITS Paso a Nivel (T2V)', shortDesc: 'Aviso Directo a Coches' },
          { id: 'T5_BEACON', tag: 'MÓDULO 5', title: 'Baliza Multimodal en Túnel', shortDesc: 'BLE + LoRa + Acústica' },
        ],
        footerNote: 'Arquitectura analítica basada en principios de interoperabilidad europea ETCS/ERTMS, Recomendaciones CIAF y normas C-ITS.',
        paperLinkText: 'Consultar Paper IV: C-ITS Vehicular y Telecomunicaciones Críticas ↗'
      },
      en: {
        badge: 'ADVANCED RAIL SAFETY & APPLIED PHYSICS LABORATORY',
        title: 'Railway Catastrophe Prevention: C-ITS Fusion, Guided Waves & Thermal Buckling',
        lead: 'Analytical physical models developed to eliminate the root causes of documented railway disasters (Tempi 2023, Balasore 2023, Adamuz 2026, Gelida 2026). Explore interactive real-time simulations.',
        tabs: [
          { id: 'T1_TEMPI', tag: 'MODULE 1', title: 'Single-Track & Switch Conflicts', shortDesc: 'Tempi / Balasore Pattern' },
          { id: 'T2_BUCKLING', tag: 'MODULE 2', title: 'Thermal Track Buckling', shortDesc: 'Sun Kinks / Kerr Model' },
          { id: 'T3_GUIDED_WAVES', tag: 'MODULE 3', title: 'Guided Ultrasonic Waves (5,100 m/s)', shortDesc: 'Adamuz Crack Detection' },
          { id: 'T4_LEVEL_CROSSING', tag: 'MODULE 4', title: 'C-ITS Level Crossing (T2V)', shortDesc: 'Direct In-Car Warnings' },
          { id: 'T5_BEACON', tag: 'MODULE 5', title: 'Multi-Bearer Tunnel Beacon', shortDesc: 'BLE + LoRa + Rail Sound' },
        ],
        footerNote: 'Analytical architecture aligned with European ETCS/ERTMS interoperability standards, accident investigations, and C-ITS directives.',
        paperLinkText: 'Read Paper IV: Extreme Resilience Vehicular C-ITS ↗'
      },
      nl: {
        badge: 'GEAVANCEERD SPOORWEGVEILIGHEID EN FYSICA LABORATORIUM',
        title: 'Spoorwegcatastrofe Preventie: C-ITS Fusie, Geleide Golven en Thermische Knik',
        lead: 'Analytische natuurkundige modellen om de hoofdoorzaken van gedocumenteerde spoorwegrampen uit te bannen (Tempi 2023, Balasore 2023, Adamuz 2026, Gelida 2026).',
        tabs: [
          { id: 'T1_TEMPI', tag: 'MODULE 1', title: 'Enkelspoor- & Wisselconflict', shortDesc: 'Tempi / Balasore Patroon' },
          { id: 'T2_BUCKLING', tag: 'MODULE 2', title: 'Thermische Spoorknikking', shortDesc: 'Sun Kinks / Kerr-Model' },
          { id: 'T3_GUIDED_WAVES', tag: 'MODULE 3', title: 'Geleide Ultrasone Golven', shortDesc: 'Adamuz Breukdetectie' },
          { id: 'T4_LEVEL_CROSSING', tag: 'MODULE 4', title: 'C-ITS Spoorwegovergang', shortDesc: 'Directe Voertuigwaarschuwing' },
          { id: 'T5_BEACON', tag: 'MODULE 5', title: 'Multimodale Tunnelbaken', shortDesc: 'BLE + LoRa + Akoestiek' },
        ],
        footerNote: 'Analytische architectuur conform Europese ETCS/ERTMS standaarden en C-ITS regelgeving.',
        paperLinkText: 'Lees Paper IV: C-ITS en Voertuigtelecom ↗'
      }
    }[locale];
  }, [locale]);

  // Tab 1 Calculations (Tempi / Balasore)
  const tempiCalc = useMemo(() => {
    const vRelMs = (train1SpeedKmh + train2SpeedKmh) / 3.6;
    const distM = distanceKm * 1000;
    const ttcSec = vRelMs > 0 ? Math.round(distM / vRelMs) : 9999;
    const brakeDecel = 1.2; // m/s^2
    const stopDist1M = Math.round((Math.pow(train1SpeedKmh / 3.6, 2) / (2 * brakeDecel)));
    const stopDist2M = Math.round((Math.pow(train2SpeedKmh / 3.6, 2) / (2 * brakeDecel)));
    const totalRequiredStoppingDistM = stopDist1M + stopDist2M;

    const hasConflict = isSingleTrack || switchDiscordance;
    const isImminent = hasConflict && distM < totalRequiredStoppingDistM * 1.5;

    return {
      vRelKmh: train1SpeedKmh + train2SpeedKmh,
      ttcSec,
      totalRequiredStoppingDistM,
      hasConflict,
      isImminent,
      verdict: switchDiscordance
        ? 'AGUJA_DISCORDANTE_DETENER_INMEDIATO'
        : hasConflict
        ? ttcSec <= 180
          ? 'PROPUESTA_AVISO_FRENADO_EMERGENCIA_T2T (Aviso asistencial, no SIL-4)'
          : 'CANTON_CONVERGENTE_ALARMA_BLOQUEO'
        : 'TRAFICO_SEGURO_EN_CANTÓN'
    };
  }, [train1SpeedKmh, train2SpeedKmh, distanceKm, isSingleTrack, switchDiscordance]);

  // Tab 2 Calculations (Thermal Buckling)
  const bucklingCalc = useMemo(() => {
    const heatTransfer = 15.0 + 8.5 * Math.pow(1.5, 0.78);
    const deltaTSolar = (0.90 * solarRadiationWm2) / heatTransfer;
    const railTempC = Math.round((ambientTempC + deltaTSolar) * 10) / 10;
    const neutralTemp = 28.0;
    const deltaT = Math.max(0, railTempC - neutralTemp);

    const E = 210e9;
    const A = 7.684e-3;
    const alpha = 11.5e-6;
    const axialForcePerRailN = E * A * alpha * deltaT;
    const totalAxialForceKN = Math.round((2 * axialForcePerRailN) / 1000);

    // Inercia lateral I_z = 5.12e-6 m^4 (512 cm^4, carril UIC 60E1 conforme a Kerr & Kish)
    const IzLateral = 5.12e-6;
    const effectiveEI = 2 * E * IzLateral;
    const ballastNPerM = ballastResistanceKNm * 1000;
    const delta0 = Math.max(0.002, initialMisalignmentMm / 1000);
    const criticalForceN = Math.sqrt((8 * effectiveEI * ballastNPerM) / (Math.PI * Math.PI * delta0));
    const criticalForceKN = Math.round(criticalForceN / 1000);

    const stabilityRatio = Math.round((totalAxialForceKN / Math.max(10, criticalForceKN)) * 1000) / 1000;
    const isCritical = stabilityRatio >= 0.85;
    const isModerate = stabilityRatio >= 0.65;

    return {
      railTempC,
      totalAxialForceKN,
      criticalForceKN,
      stabilityRatio,
      isCritical,
      isModerate,
      maxSafeSpeed: isCritical ? 30 : isModerate ? 80 : 300,
      verdict: isCritical
        ? 'RIESGO CRÍTICO DE SUN KINK (Vmax → 30 km/h)'
        : isModerate
        ? 'PRECAUCIÓN: DEGRADACIÓN LATERAL (Vmax → 80 km/h)'
        : 'VÍA ESTABLE (Sin riesgo de pandeo)'
    };
  }, [ambientTempC, solarRadiationWm2, ballastResistanceKNm, initialMisalignmentMm]);

  // Tab 3 Calculations (Guided Waves)
  const guidedCalc = useMemo(() => {
    const speedOfSound = 5100; // m/s (modo longitudinal guiado en acero)
    const tofSec = (2 * crackDistanceM) / speedOfSound;
    const tofMs = Math.round(tofSec * 10000) / 10;
    const amp = crackSeverity === 'FULL_BREAK' ? 0.88 : crackSeverity === 'FISSURE' ? 0.42 : 0.05;

    return {
      tofMs,
      amp,
      detected: crackSeverity !== 'NONE',
      verdict: crackSeverity === 'FULL_BREAK'
        ? 'ROTURA COMPLETA DE SOLDADURA DETECTADA (ToF = ' + tofMs + ' ms)'
        : crackSeverity === 'FISSURE'
        ? 'FISURA INCIPIENTE DE CARRIL (Amplitud = ' + amp + ')'
        : 'CARRIL ÍNTEGRO (Eco por debajo del ruido base)'
    };
  }, [crackDistanceM, crackSeverity]);

  // Tab 4 Calculations (Level Crossing C-ITS)
  const pnCalc = useMemo(() => {
    const trainSpeedMs = trainApproachSpeedKmh / 3.6;
    const etaSec = trainSpeedMs > 0 ? Math.round(distanceToPnM / trainSpeedMs) : 9999;
    const brakeDecel = 1.3;
    const brakeDistM = Math.round((trainSpeedMs * trainSpeedMs) / (2 * brakeDecel) + trainSpeedMs * 1.5);
    const canStop = distanceToPnM >= brakeDistM;

    return {
      etaSec,
      brakeDistM,
      canStop,
      collisionAvoidable: carStalledOnTrack ? canStop : true,
      alertText: etaSec <= 60
        ? `AVISO C-ITS (ITS-G5 5.9 GHz): Tren aproximándose a paso a nivel en ${etaSec} s (${trainApproachSpeedKmh} km/h). CRUCE PROHIBIDO.`
        : 'Paso a nivel despejado.'
    };
  }, [trainApproachSpeedKmh, distanceToPnM, carStalledOnTrack]);

  // Tab 5 Calculations (Beacon OEP-RAIL v2 28 Bytes con HMAC-4 y Anti-Replay)
  const beaconHex = useMemo(() => {
    const pkHex = (35200).toString(16).padStart(6, '0');
    const trappedHex = Math.min(255, trappedPassengers).toString(16).padStart(2, '0');
    const severeHex = Math.min(255, severeInjuries).toString(16).padStart(2, '0');
    const seqHex = (1).toString(16).padStart(8, '0');
    const mockHmacHex = 'B3F8A1C9'; // HMAC-4 simulado en interfaz
    const crcHex = '4A12';
    return `AA03${pkHex}0246AE4D${trappedHex}${severeHex}${seqHex}${mockHmacHex}${crcHex}020000`.toUpperCase();
  }, [trappedPassengers, severeInjuries]);

  return (
    <section className="rsl-suite" id="rail-safety-lab" aria-label="Rail Safety Lab">
      <div className="rsl-badge">
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
        {T.badge}
      </div>
      <h2 className="rsl-title">{T.title}</h2>
      <p className="rsl-lead">{T.lead}</p>

      {/* Tabs */}
      <div className="rsl-tabs" role="tablist">
        {T.tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`rsl-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <span className="rsl-tab-tag">{tab.tag}</span>
            <span style={{ fontWeight: 700 }}>{tab.title}</span>
            <small style={{ color: '#94a3b8', fontSize: '11px' }}>{tab.shortDesc}</small>
          </button>
        ))}
      </div>

      {/* Stage Layout */}
      <div className="rsl-stage">
        {/* Visual Render / Canvas / SVG */}
        <div className="rsl-canvas-box">
          <div className="rsl-canvas-head">
            <span>
              {activeTab === 'T1_TEMPI' && 'SIMULADOR 1 · GRAFO TOPOLÓGICO DE CANTÓN Y ENCLAVAMIENTO (TEMPI / BALASORE)'}
              {activeTab === 'T2_BUCKLING' && 'SIMULADOR 2 · RESISTENCIA LATERAL DE BANQUETA Y PANDEO TÉRMICO (KERR)'}
              {activeTab === 'T3_GUIDED_WAVES' && 'SIMULADOR 3 · REFLECTOMETRÍA ACÚSTICA GUIADA EN CARRIL A 5.100 m/s'}
              {activeTab === 'T4_LEVEL_CROSSING' && 'SIMULADOR 4 · ENLACE C-ITS TREN-VEHÍCULO EN PASO A NIVEL'}
              {activeTab === 'T5_BEACON' && 'SIMULADOR 5 · BALIZA DE EMERGENCIA MULTIMODAL (TÚNEL / TRINCHERA)'}
            </span>
            <span style={{ color: '#38bdf8' }}>64-BIT DYNAMICS</span>
          </div>

          {/* SVG Diagram based on active tab */}
          {activeTab === 'T1_TEMPI' && (
            <svg className="rsl-canvas-svg" viewBox="0 0 540 260">
              <rect width="540" height="260" fill="#040812" rx="8" />
              {/* Rail Line */}
              <line x1="30" y1="130" x2="510" y2="130" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
              <line x1="30" y1="130" x2="510" y2="130" stroke={tempiCalc.hasConflict ? '#ef4444' : '#38bdf8'} strokeWidth="2.5" />

              {/* Single Track zone */}
              {isSingleTrack && (
                <rect x="140" y="115" width="260" height="30" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
              )}

              {/* Train 1 (Left, Blue) */}
              <g transform="translate(60, 105)">
                <rect width="70" height="20" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                <polygon points="70,0 80,10 70,20" fill="#0284c7" />
                <text x="35" y="-6" fill="#38bdf8" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                  TREN 1 ({train1SpeedKmh} km/h)
                </text>
              </g>

              {/* Train 2 (Right, Orange/Red) */}
              <g transform="translate(390, 105)">
                <polygon points="0,10 10,0 10,20" fill={tempiCalc.hasConflict ? '#ef4444' : '#10b981'} />
                <rect x="10" width="70" height="20" rx="4" fill={tempiCalc.hasConflict ? '#b91c1c' : '#047857'} stroke={tempiCalc.hasConflict ? '#ef4444' : '#10b981'} strokeWidth="1.5" />
                <text x="45" y="-6" fill={tempiCalc.hasConflict ? '#fca5a5' : '#6ee7b7'} fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                  TREN 2 ({train2SpeedKmh} km/h)
                </text>
              </g>

              {/* Collision alert marker if converging */}
              {tempiCalc.hasConflict && (
                <g transform="translate(270, 100)">
                  <circle cx="0" cy="30" r="14" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="2" />
                  <text x="0" y="34" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">!</text>
                  <text x="0" y="65" fill="#ef4444" fontSize="10" fontFamily="ui-monospace" fontWeight="bold" textAnchor="middle">
                    TTC: {tempiCalc.ttcSec} s
                  </text>
                </g>
              )}

              {/* Legend */}
              <text x="40" y="225" fill="#94a3b8" fontSize="10" fontFamily="system-ui">
                Distancia entre trenes: {distanceKm} km · V_rel: {tempiCalc.vRelKmh} km/h
              </text>
              <text x="40" y="242" fill={tempiCalc.isImminent ? '#ef4444' : '#34d399'} fontSize="10" fontFamily="ui-monospace" fontWeight="bold">
                Distancia mínima de frenada combinada: {tempiCalc.totalRequiredStoppingDistM} m
              </text>
            </svg>
          )}

          {activeTab === 'T2_BUCKLING' && (
            <svg className="rsl-canvas-svg" viewBox="0 0 540 260">
              <rect width="540" height="260" fill="#040812" rx="8" />
              {/* Sun icon */}
              <circle cx="460" cy="50" r="18" fill="#f97316" opacity="0.8" />
              <text x="460" y="85" fill="#f97316" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                {solarRadiationWm2} W/m²
              </text>

              {/* Rails with buckled sine wave if critical */}
              {bucklingCalc.isCritical ? (
                <path
                  d="M 40,140 L 160,140 Q 230,80 270,140 Q 310,200 380,140 L 500,140"
                  stroke="#ef4444"
                  strokeWidth="4"
                  fill="none"
                />
              ) : bucklingCalc.isModerate ? (
                <path
                  d="M 40,140 L 180,140 Q 270,115 360,140 L 500,140"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  fill="none"
                />
              ) : (
                <line x1="40" y1="140" x2="500" y2="140" stroke="#38bdf8" strokeWidth="3" />
              )}

              {/* Lateral Ballast Arrows */}
              <g stroke="#64748b" strokeWidth="1" strokeDasharray="3 2">
                <line x1="200" y1="180" x2="200" y2="150" />
                <line x1="270" y1="180" x2="270" y2="150" />
                <line x1="340" y1="180" x2="340" y2="150" />
              </g>
              <text x="270" y="200" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                Resistencia Balasto: {ballastResistanceKNm} kN/m
              </text>

              {/* Gauge text */}
              <text x="40" y="45" fill="#cbd5e1" fontSize="11" fontFamily="system-ui">
                T_carril: <tspan fill="#f97316" fontWeight="bold">{bucklingCalc.railTempC} °C</tspan> (T_aire: {ambientTempC} °C)
              </text>
              <text x="40" y="65" fill="#cbd5e1" fontSize="11" fontFamily="system-ui">
                Fuerza Axial Compresión: <tspan fill="#f8fafc" fontWeight="bold">{bucklingCalc.totalAxialForceKN} kN</tspan>
              </text>
              <text x="40" y="85" fill="#cbd5e1" fontSize="11" fontFamily="system-ui">
                Carga Crítica de Pandeo (Kerr): <tspan fill="#34d399">{bucklingCalc.criticalForceKN} kN</tspan>
              </text>
              <text x="40" y="105" fill={bucklingCalc.isCritical ? '#ef4444' : '#38bdf8'} fontSize="11" fontFamily="ui-monospace" fontWeight="bold">
                Razón de Estabilidad S: {bucklingCalc.stabilityRatio} · Vmax Segura: {bucklingCalc.maxSafeSpeed} km/h
              </text>
            </svg>
          )}

          {activeTab === 'T3_GUIDED_WAVES' && (
            <svg className="rsl-canvas-svg" viewBox="0 0 540 260">
              <rect width="540" height="260" fill="#040812" rx="8" />
              {/* Oscilloscope Grid */}
              <g stroke="#1e293b" strokeWidth="0.8">
                <line x1="40" y1="60" x2="500" y2="60" />
                <line x1="40" y1="130" x2="500" y2="130" />
                <line x1="40" y1="200" x2="500" y2="200" />
                <line x1="155" y1="30" x2="155" y2="230" />
                <line x1="270" y1="30" x2="270" y2="230" />
                <line x1="385" y1="30" x2="385" y2="230" />
              </g>

              {/* Initial Tx pulse at t=0 */}
              <path d="M 50,130 L 60,40 L 70,220 L 80,130" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
              <text x="65" y="30" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace" textAnchor="middle">TX PULSE</text>

              {/* Echo pulse at ToF */}
              {guidedCalc.detected && (
                <g>
                  {(() => {
                    const echoX = 80 + (crackDistanceM / 4000) * 380;
                    const peakY = 130 - guidedCalc.amp * 80;
                    const valleyY = 130 + guidedCalc.amp * 80;
                    return (
                      <g>
                        <path
                          d={`M ${echoX - 15},130 L ${echoX - 5},${peakY} L ${echoX + 5},${valleyY} L ${echoX + 15},130`}
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <line x1={echoX} y1="30" x2={echoX} y2="230" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
                        <text x={echoX} y="25" fill="#ef4444" fontSize="10" fontFamily="ui-monospace" fontWeight="bold" textAnchor="middle">
                          ECO REFLEJADO ({guidedCalc.tofMs} ms)
                        </text>
                      </g>
                    );
                  })()}
                </g>
              )}

              {/* Rail speed text */}
              <text x="40" y="245" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace">
                Velocidad onda guiada en acero: 5.100 m/s · Distancia calculada: {crackDistanceM} m
              </text>
            </svg>
          )}

          {activeTab === 'T4_LEVEL_CROSSING' && (
            <svg className="rsl-canvas-svg" viewBox="0 0 540 260">
              <rect width="540" height="260" fill="#040812" rx="8" />
              {/* Rail track */}
              <line x1="30" y1="130" x2="510" y2="130" stroke="#38bdf8" strokeWidth="3" />
              {/* Road crossing */}
              <polygon points="340,30 380,30 360,230 320,230" fill="#1e293b" opacity="0.8" />

              {/* Approaching Train */}
              {(() => {
                const trainX = Math.max(40, 340 - (distanceToPnM / 2500) * 300);
                return (
                  <g transform={`translate(${trainX}, 115)`}>
                    <rect width="55" height="18" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                    <polygon points="55,0 65,9 55,18" fill="#0284c7" />
                    <text x="25" y="-6" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace" textAnchor="middle">
                      {trainApproachSpeedKmh} km/h
                    </text>
                  </g>
                );
              })()}

              {/* Stalled car at crossing */}
              {carStalledOnTrack && (
                <g transform="translate(340, 120)">
                  <rect width="18" height="20" rx="3" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
                  <circle cx="9" cy="4" r="3" fill="#f59e0b" />
                  <text x="9" y="-6" fill="#ef4444" fontSize="9" fontFamily="ui-monospace" fontWeight="bold" textAnchor="middle">
                    COCHE CALADO
                  </text>
                </g>
              )}

              {/* Direct radio link */}
              <path d="M 220,110 Q 280,60 340,110" stroke="#10b981" strokeWidth="2" strokeDasharray="3 3" fill="none" />
              <text x="280" y="65" fill="#10b981" fontSize="9" fontFamily="ui-monospace" textAnchor="middle">
                C-ITS DENM DIRECTO (38 ms)
              </text>

              <text x="40" y="225" fill="#cbd5e1" fontSize="10" fontFamily="system-ui">
                ETA Paso a Nivel: <tspan fill="#38bdf8" fontWeight="bold">{pnCalc.etaSec} s</tspan> · Distancia disponible: {distanceToPnM} m
              </text>
              <text x="40" y="242" fill={pnCalc.canStop ? '#34d399' : '#ef4444'} fontSize="10" fontFamily="ui-monospace" fontWeight="bold">
                Distancia Frenada Emergencia: {pnCalc.brakeDistM} m ({pnCalc.canStop ? 'FRENADO SEGURO POSIBLE' : 'IMPACTO INEVITABLE SIN FRENO ANTICIPADO'})
              </text>
            </svg>
          )}

          {activeTab === 'T5_BEACON' && (
            <svg className="rsl-canvas-svg" viewBox="0 0 540 260">
              <rect width="540" height="260" fill="#040812" rx="8" />
              {/* Tunnel Outline */}
              <path d="M 40,220 L 40,80 Q 270,10 500,80 L 500,220" stroke="#334155" strokeWidth="4" fill="none" />
              <text x="270" y="45" fill="#64748b" fontSize="11" fontFamily="ui-monospace" textAnchor="middle">
                TÚNEL / TRINCHERA PROFUNDA (SIN 4G/5G)
              </text>

              {/* Train inside tunnel */}
              <rect x="80" y="140" width="160" height="35" rx="5" fill="#1e293b" stroke="#ef4444" strokeWidth="2" />
              <text x="160" y="162" fill="#fca5a5" fontSize="11" fontFamily="ui-monospace" fontWeight="bold" textAnchor="middle">
                ALVIA ACCIDENTADO
              </text>

              {/* Multi-Bearer Wavefronts */}
              {/* 1. BLE to outside road */}
              <circle cx="240" cy="155" r="30" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="240" cy="155" r="60" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="320" y="135" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace">
                1. BLE C-ITS (Coches M-501)
              </text>

              {/* 2. LoRa 868 MHz */}
              <path d="M 240,140 Q 300,70 420,90" stroke="#10b981" strokeWidth="2" fill="none" />
              <text x="380" y="80" fill="#10b981" fontSize="9" fontFamily="ui-monospace">
                2. LoRa 868 MHz (&gt; 5 km)
              </text>

              {/* 3. Rail Ultrasound */}
              <line x1="80" y1="180" x2="480" y2="180" stroke="#f59e0b" strokeWidth="3" />
              <text x="320" y="200" fill="#f59e0b" fontSize="9" fontFamily="ui-monospace">
                3. Acústica de Carril (19 kHz)
              </text>

              <text x="40" y="245" fill="#cbd5e1" fontSize="10" fontFamily="ui-monospace">
                Trama Binaria Sellada: <tspan fill="#a5f3fc">{beaconHex}</tspan>
              </text>
            </svg>
          )}

          {/* KPI Banner */}
          <div className="rsl-kpis">
            {activeTab === 'T1_TEMPI' && (
              <>
                <div className="rsl-kpi-card">
                  <b>Tiempo a Colisión</b>
                  <span className={`rsl-kpi-val ${tempiCalc.ttcSec <= 180 ? 'danger' : 'highlight'}`}>
                    {tempiCalc.ttcSec} s
                  </span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Velocidad Relativa</b>
                  <span className="rsl-kpi-val">{tempiCalc.vRelKmh} km/h</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Frenado Requerido</b>
                  <span className="rsl-kpi-val">{tempiCalc.totalRequiredStoppingDistM} m</span>
                </div>
              </>
            )}

            {activeTab === 'T2_BUCKLING' && (
              <>
                <div className="rsl-kpi-card">
                  <b>Temperatura Carril</b>
                  <span className={`rsl-kpi-val ${bucklingCalc.railTempC > 55 ? 'danger' : 'highlight'}`}>
                    {bucklingCalc.railTempC} °C
                  </span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Fuerza Axial</b>
                  <span className="rsl-kpi-val">{bucklingCalc.totalAxialForceKN} kN</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Razón Estabilidad</b>
                  <span className={`rsl-kpi-val ${bucklingCalc.isCritical ? 'danger' : 'safe'}`}>
                    {bucklingCalc.stabilityRatio}
                  </span>
                </div>
              </>
            )}

            {activeTab === 'T3_GUIDED_WAVES' && (
              <>
                <div className="rsl-kpi-card">
                  <b>Time-of-Flight (ToF)</b>
                  <span className="rsl-kpi-val highlight">{guidedCalc.tofMs} ms</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Distancia a Rotura</b>
                  <span className="rsl-kpi-val">{crackDistanceM} m</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Amplitud Reflexión</b>
                  <span className={`rsl-kpi-val ${guidedCalc.amp > 0.5 ? 'danger' : 'safe'}`}>
                    {guidedCalc.amp}
                  </span>
                </div>
              </>
            )}

            {activeTab === 'T4_LEVEL_CROSSING' && (
              <>
                <div className="rsl-kpi-card">
                  <b>ETA Paso a Nivel</b>
                  <span className="rsl-kpi-val highlight">{pnCalc.etaSec} s</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Distancia Frenada</b>
                  <span className="rsl-kpi-val">{pnCalc.brakeDistM} m</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Parada Segura</b>
                  <span className={`rsl-kpi-val ${pnCalc.canStop ? 'safe' : 'danger'}`}>
                    {pnCalc.canStop ? 'SÍ' : 'NO'}
                  </span>
                </div>
              </>
            )}

            {activeTab === 'T5_BEACON' && (
              <>
                <div className="rsl-kpi-card">
                  <b>Atrapados / Graves</b>
                  <span className="rsl-kpi-val danger">{trappedPassengers} / {severeInjuries}</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Canales Activos</b>
                  <span className="rsl-kpi-val safe">3 Canales</span>
                </div>
                <div className="rsl-kpi-card">
                  <b>Retransmisión DTN</b>
                  <span className="rsl-kpi-val highlight">&lt; 30 s</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Controls Column */}
        <div className="rsl-controls-box">
          <h3 style={{ fontSize: '15px', color: '#fff', margin: 0 }}>
            Parámetros de Control y Calibración
          </h3>

          {activeTab === 'T1_TEMPI' && (
            <>
              <div className="rsl-control-group">
                <label>Velocidad Tren 1: <span>{train1SpeedKmh} km/h</span></label>
                <input
                  type="range"
                  min="40"
                  max="220"
                  step="5"
                  value={train1SpeedKmh}
                  onChange={e => setTrain1SpeedKmh(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Velocidad Tren 2: <span>{train2SpeedKmh} km/h</span></label>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="5"
                  value={train2SpeedKmh}
                  onChange={e => setTrain2SpeedKmh(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Distancia entre convoyes: <span>{distanceKm} km</span></label>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={distanceKm}
                  onChange={e => setDistanceKm(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Topología de Vía:</label>
                <select
                  className="rsl-select"
                  value={isSingleTrack ? 'SINGLE' : 'DOUBLE'}
                  onChange={e => setIsSingleTrack(e.target.value === 'SINGLE')}
                >
                  <option value="SINGLE">Vía Única (Cuello de botella Tempi)</option>
                  <option value="DOUBLE">Vía Doble Independiente</option>
                </select>
              </div>
              <div className="rsl-control-group">
                <label>Aguja / Enclavamiento:</label>
                <select
                  className="rsl-select"
                  value={switchDiscordance ? 'DISCORDANCE' : 'NORMAL'}
                  onChange={e => setSwitchDiscordance(e.target.value === 'DISCORDANCE')}
                >
                  <option value="NORMAL">Aguja Normal y Concordante con CTC</option>
                  <option value="DISCORDANCE">Discrepancia Aguja vs CTC (Balasore)</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'T2_BUCKLING' && (
            <>
              <div className="rsl-control-group">
                <label>Temperatura Ambiente: <span>{ambientTempC} °C</span></label>
                <input
                  type="range"
                  min="15"
                  max="46"
                  step="1"
                  value={ambientTempC}
                  onChange={e => setAmbientTempC(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Radiación Solar Directa: <span>{solarRadiationWm2} W/m²</span></label>
                <input
                  type="range"
                  min="100"
                  max="1100"
                  step="50"
                  value={solarRadiationWm2}
                  onChange={e => setSolarRadiationWm2(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Resistencia Lateral Balasto: <span>{ballastResistanceKNm} kN/m</span></label>
                <input
                  type="range"
                  min="4.0"
                  max="12.0"
                  step="0.5"
                  value={ballastResistanceKNm}
                  onChange={e => setBallastResistanceKNm(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Desalineación Inicial Vía: <span>{initialMisalignmentMm} mm</span></label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={initialMisalignmentMm}
                  onChange={e => setInitialMisalignmentMm(+e.target.value)}
                />
              </div>
            </>
          )}

          {activeTab === 'T3_GUIDED_WAVES' && (
            <>
              <div className="rsl-control-group">
                <label>Distancia al Defecto: <span>{crackDistanceM} m</span></label>
                <input
                  type="range"
                  min="500"
                  max="3800"
                  step="50"
                  value={crackDistanceM}
                  onChange={e => setCrackDistanceM(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Estado Físico del Carril:</label>
                <select
                  className="rsl-select"
                  value={crackSeverity}
                  onChange={e => setCrackSeverity(e.target.value as typeof crackSeverity)}
                >
                  <option value="FULL_BREAK">Rotura Completa de Soldadura (Adamuz)</option>
                  <option value="FISSURE">Fisura Incipiente en Alma de Carril</option>
                  <option value="NONE">Carril Íntegro (Sin discontinuidades)</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'T4_LEVEL_CROSSING' && (
            <>
              <div className="rsl-control-group">
                <label>Velocidad Tren Aproximación: <span>{trainApproachSpeedKmh} km/h</span></label>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="5"
                  value={trainApproachSpeedKmh}
                  onChange={e => setTrainApproachSpeedKmh(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Distancia a Paso a Nivel: <span>{distanceToPnM} m</span></label>
                <input
                  type="range"
                  min="150"
                  max="2400"
                  step="50"
                  value={distanceToPnM}
                  onChange={e => setDistanceToPnM(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Estado en Vía del Paso a Nivel:</label>
                <select
                  className="rsl-select"
                  value={carStalledOnTrack ? 'STALLED' : 'CLEAR'}
                  onChange={e => setCarStalledOnTrack(e.target.value === 'STALLED')}
                >
                  <option value="STALLED">Coche Averiado / Bloqueado en Vía</option>
                  <option value="CLEAR">Paso a Nivel Despejado</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'T5_BEACON' && (
            <>
              <div className="rsl-control-group">
                <label>Pasajeros Atrapados: <span>{trappedPassengers}</span></label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={trappedPassengers}
                  onChange={e => setTrappedPassengers(+e.target.value)}
                />
              </div>
              <div className="rsl-control-group">
                <label>Heridos Graves: <span>{severeInjuries}</span></label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={severeInjuries}
                  onChange={e => setSevereInjuries(+e.target.value)}
                />
              </div>
            </>
          )}

          {/* Real-time Verdict Callout */}
          <div
            className={`rsl-verdict-banner ${
              activeTab === 'T1_TEMPI'
                ? tempiCalc.isImminent || switchDiscordance ? 'danger' : tempiCalc.hasConflict ? 'warning' : 'safe'
                : activeTab === 'T2_BUCKLING'
                ? bucklingCalc.isCritical ? 'danger' : bucklingCalc.isModerate ? 'warning' : 'safe'
                : activeTab === 'T3_GUIDED_WAVES'
                ? guidedCalc.detected ? 'danger' : 'safe'
                : activeTab === 'T4_LEVEL_CROSSING'
                ? carStalledOnTrack ? (pnCalc.canStop ? 'warning' : 'danger') : 'safe'
                : 'danger'
            }`}
          >
            <span>
              {activeTab === 'T1_TEMPI' && tempiCalc.verdict}
              {activeTab === 'T2_BUCKLING' && bucklingCalc.verdict}
              {activeTab === 'T3_GUIDED_WAVES' && guidedCalc.verdict}
              {activeTab === 'T4_LEVEL_CROSSING' && (carStalledOnTrack ? (pnCalc.canStop ? 'FRENO AUTOMÁTICO T2I: PARADA A TIEMPO' : 'COLISIÓN INEVITABLE: FALTA DISTANCIA') : 'PASO A NIVEL DESPEJADO')}
              {activeTab === 'T5_BEACON' && 'BALIZA MULTIMODAL ACTIVA: DIFUSIÓN EN TÚNEL'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Callout */}
      <div className="rsl-footer-callout">
        <span>{T.footerNote}</span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a href="/media/renders/render-rail-safety-topology.svg" target="_blank" rel="noopener noreferrer">
            Ver Esquema Vectorial Completo (SVG) ↗
          </a>
          <a href="/senda/papers/paper-v16-c-its.html">
            {T.paperLinkText}
          </a>
        </div>
      </div>
    </section>
  );
}
