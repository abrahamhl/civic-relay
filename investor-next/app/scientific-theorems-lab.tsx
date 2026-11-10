'use client';
import { useMemo, useState } from 'react';
import type { Locale } from './copy';
import './scientific-theorems-lab.css';
// Single source of truth: the same tested core that runs offline (packages/senda/src, synced by sync-web).
import {
  solveOptimalElevationAngleDeg,
  computeGraphLaplacianSpectrum,
  computeDeygoutMultiObstacleDiffraction,
  computePassiveRadarCrlb,
  computeAcousticNearUltrasoundBudget,
} from '../public/senda/core/scientific-theorems-physics.mjs';

interface TheoremDef {
  id: string;
  tag: string;
  title: string;
  shortDesc: string;
}

export default function ScientificTheoremsLab({ locale }: { locale: Locale }) {
  const [activeTab, setActiveTab] = useState<'T1_A2G' | 'T2_FIEDLER' | 'T3_DEYGOUT' | 'T4_PBR' | 'T5_ACOUSTIC'>('T1_A2G');

  // Theorem 1 controls
  const [envType, setEnvType] = useState<'SUBURBAN' | 'URBAN' | 'DENSE_URBAN' | 'CANYON_RUBBLE'>('URBAN');
  const [radiusM, setRadiusM] = useState<number>(1000);
  const [hoverAltitudeM, setHoverAltitudeM] = useState<number>(915);

  // Theorem 2 controls
  const [droneBridgeInjected, setDroneBridgeInjected] = useState<boolean>(true);

  // Theorem 3 controls
  const [ridgeHeightM, setRidgeHeightM] = useState<number>(145);

  // Theorem 4 controls
  const [radarBandwidthMhz, setRadarBandwidthMhz] = useState<number>(7.61);
  const [integrationTimeSec, setIntegrationTimeSec] = useState<number>(0.25);
  const [radarSnrDb, setRadarSnrDb] = useState<number>(15);

  // Theorem 5 controls
  const [acousticDistM, setAcousticDistM] = useState<number>(5.0);
  const [ambientNoiseDba, setAmbientNoiseDba] = useState<number>(85);

  const T = useMemo(() => {
    return {
      es: {
        badge: 'LABORATORIO DE FÍSICA MATEMÁTICA Y TELECOMUNICACIONES AVANZADAS',
        title: 'Calibración Científica: La Física y los Teoremas que Hacen Único a SENDA',
        lead: 'Modelos analíticos publicados (Al-Hourani, Fiedler, ITU-R P.526, Cramér-Rao, ISO 9613-1) aplicados a escenarios inspirados en emergencias reales (DANA de Valencia, Bejís, A-12 Arnhem). Son cotas y estimaciones de diseño, pendientes de calibración en campo. Selecciona cualquiera de los cinco teoremas para experimentar con las simulaciones, espectros, ondas y parámetros de propagación electromagnética y acústica.',
        tabs: [
          { id: 'T1_A2G', tag: 'TEOREMA 1', title: 'Física A2G y Altitud Óptima', shortDesc: 'Al-Hourani / ITU-R P.1410' },
          { id: 'T2_FIEDLER', tag: 'TEOREMA 2', title: 'Conectividad Espectral λ₂(L)', shortDesc: 'Autovector de Fiedler' },
          { id: 'T3_DEYGOUT', tag: 'TEOREMA 3', title: 'Difracción Orográfica en Cascada', shortDesc: 'Deygout ITU-R P.526' },
          { id: 'T4_PBR', tag: 'TEOREMA 4', title: 'Radar Pasivo Biestático (CAF)', shortDesc: 'Límite de Cramér-Rao' },
          { id: 'T5_ACOUSTIC', tag: 'TEOREMA 5', title: 'Enlace Acústico en Apagón', shortDesc: '18–20 kHz a 85 dBA' },
        ],
        tableT: 'Matriz Comparativa de Validación Científica y Mitigación de Errores',
        thArea: 'Área Científica',
        thPhenomenon: 'Fenómeno Físico',
        thFormula: 'Formulación Matemática',
        thValidation: 'Validación en Catástrofe',
        thPrecision: 'Precisión / Margen',
      },
      en: {
        badge: 'ADVANCED MATHEMATICAL PHYSICS & TELECOM RESEARCH LAB',
        title: 'Scientific Calibration: The Mathematical Physics Making SENDA Unique',
        lead: 'Published analytical models (Al-Hourani, Fiedler, ITU-R P.526, Cramér-Rao, ISO 9613-1) applied to scenarios inspired by real emergencies (Valencia DANA floods, Bejís wildfire, A-12 Arnhem). These are design bounds and estimates, pending field calibration. Explore interactive waveforms, spectra, and propagation bounds across the five core theorems.',
        tabs: [
          { id: 'T1_A2G', tag: 'THEOREM 1', title: 'A2G Physics & Optimal Altitude', shortDesc: 'Al-Hourani / ITU-R P.1410' },
          { id: 'T2_FIEDLER', tag: 'THEOREM 2', title: 'Spectral Connectivity λ₂(L)', shortDesc: 'Fiedler Eigenvector Gradient' },
          { id: 'T3_DEYGOUT', tag: 'THEOREM 3', title: 'Cascade Terrain Diffraction', shortDesc: 'Deygout ITU-R P.526' },
          { id: 'T4_PBR', tag: 'THEOREM 4', title: 'Passive Bistatic Radar (CAF)', shortDesc: 'Cramér-Rao Lower Bound' },
          { id: 'T5_ACOUSTIC', tag: 'THEOREM 5', title: 'Near-Ultrasound Acoustic Link', shortDesc: '18–20 kHz in 85 dBA Noise' },
        ],
        tableT: 'Scientific Validation Matrix & Error Bound Mitigation',
        thArea: 'Scientific Domain',
        thPhenomenon: 'Physical Phenomenon',
        thFormula: 'Core Formulation',
        thValidation: 'Ground Truth Validation',
        thPrecision: 'Precision / Margin',
      },
      nl: {
        badge: 'GEAVANCEERD MATHEMATISCHE FYSICA & TELECOM LABORATORIUM',
        title: 'Wetenschappelijke Kalibratie: De Fysica en Stellingen die SENDA Uniek Maken',
        lead: 'Gepubliceerde analytische modellen (Al-Hourani, Fiedler, ITU-R P.526, Cramér-Rao, ISO 9613-1) toegepast op scenario’s geïnspireerd door echte rampen (Valencia DANA, natuurbrand Bejís, A-12). Ontwerpgrenzen en schattingen, nog te kalibreren in het veld. Experimenteer met interactieve golfvormen, spectra en propagatiemodellen over de vijf kernstellingen.',
        tabs: [
          { id: 'T1_A2G', tag: 'STELLING 1', title: 'A2G-Fysica & Optimale Hoogte', shortDesc: 'Al-Hourani / ITU-R P.1410' },
          { id: 'T2_FIEDLER', tag: 'STELLING 2', title: 'Spectrale Connectiviteit λ₂(L)', shortDesc: 'Fiedler-Eigenvector' },
          { id: 'T3_DEYGOUT', tag: 'STELLING 3', title: 'Cascade-Mesdiffractie', shortDesc: 'Deygout ITU-R P.526' },
          { id: 'T4_PBR', tag: 'STELLING 4', title: 'Passieve Bistatische Radar (CAF)', shortDesc: 'Cramér-Rao Ondergrens' },
          { id: 'T5_ACOUSTIC', tag: 'STELLING 5', title: 'Akoestische Noodverbinding', shortDesc: '18–20 kHz bij 85 dBA' },
        ],
        tableT: 'Wetenschappelijke Validatiematrix & Foutgrenzen',
        thArea: 'Wetenschappelijk Domein',
        thPhenomenon: 'Fysisch Fenomeen',
        thFormula: 'Wiskundige Formule',
        thValidation: 'Validatie in Rampgebied',
        thPrecision: 'Nauwkeurigheid / Marge',
      },
    }[locale] ?? {
      badge: 'ADVANCED MATHEMATICAL PHYSICS & TELECOM RESEARCH LAB',
      title: 'Scientific Calibration: The Mathematical Physics Making SENDA Unique',
      lead: 'Published analytical models applied to emergency scenarios; design bounds pending field calibration.',
      tabs: [],
      tableT: '',
      thArea: '',
      thPhenomenon: '',
      thFormula: '',
      thValidation: '',
      thPrecision: '',
    };
  }, [locale]);

  // Calculations for Theorem 1
  const a2gCalculations = useMemo(() => {
    const envs = {
      SUBURBAN: { a: 4.88, b: 0.43, etaLos: 0.1, etaNlos: 21.0 },
      URBAN: { a: 9.61, b: 0.16, etaLos: 1.0, etaNlos: 20.0 },
      DENSE_URBAN: { a: 12.08, b: 0.11, etaLos: 1.6, etaNlos: 23.0 },
      CANYON_RUBBLE: { a: 27.23, b: 0.08, etaLos: 2.3, etaNlos: 34.0 },
    };
    const cur = { ...envs[envType], thetaOpt: solveOptimalElevationAngleDeg(envType) };
    const optAltitudeM = Math.round(radiusM * Math.tan((cur.thetaOpt * Math.PI) / 180));

    // Current elevation
    const curElevDeg = (Math.atan(hoverAltitudeM / radiusM) * 180) / Math.PI;
    const exponent = -cur.b * (curElevDeg - cur.a);
    const pLos = 1.0 / (1.0 + cur.a * Math.exp(exponent));

    // Path loss
    const d3d = Math.sqrt(hoverAltitudeM * hoverAltitudeM + radiusM * radiusM);
    const fspl = 20 * Math.log10((4 * Math.PI * 868e6 * d3d) / 299792458);
    const pl = fspl + pLos * cur.etaLos + (1.0 - pLos) * cur.etaNlos;

    // Fixed 50m path loss
    const d50 = Math.sqrt(50 * 50 + radiusM * radiusM);
    const elev50 = (Math.atan(50 / radiusM) * 180) / Math.PI;
    const pLos50 = 1.0 / (1.0 + cur.a * Math.exp(-cur.b * (elev50 - cur.a)));
    const pl50 = 20 * Math.log10((4 * Math.PI * 868e6 * d50) / 299792458) + pLos50 * cur.etaLos + (1.0 - pLos50) * cur.etaNlos;

    const gainDb = pl50 - pl;

    return {
      curElevDeg: Math.round(curElevDeg * 10) / 10,
      pLosPct: Math.round(pLos * 100),
      plDb: Math.round(pl * 10) / 10,
      optAltitudeM,
      gainDb: Math.round(gainDb * 10) / 10,
    };
  }, [envType, radiusM, hoverAltitudeM]);

  // Calculations for Theorem 2 — real Laplacian spectrum of two 4-node clusters joined by a
  // weak 0.05 link, with or without a drone relay node bridging them.
  const fiedlerCalculations = useMemo(() => {
    const n = droneBridgeInjected ? 9 : 8;
    const A: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const link = (i: number, j: number, w: number) => { A[i][j] = w; A[j][i] = w; };
    for (const base of [0, 4]) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) link(base + i, base + j, 1);
    link(3, 4, 0.05);
    if (droneBridgeInjected) { link(8, 1, 0.8); link(8, 2, 0.8); link(8, 5, 0.8); link(8, 6, 0.8); }
    const res = computeGraphLaplacianSpectrum(A);
    const lambda2 = res.fiedlerValue;
    const healthy = lambda2 >= 0.5;
    return {
      lambda2: Math.round(lambda2 * 1000) / 1000,
      cheegerBound: Math.round((lambda2 / 2) * 1000) / 1000,
      status: healthy ? 'ROBUSTA (sin cuello de botella dominante)' : 'VULNERABLE (cuello de botella)',
      statusColor: healthy ? '#34d399' : '#ff5b6e',
    };
  }, [droneBridgeInjected]);

  // Calculations for Theorem 3 — 5 km, 868 MHz, Tx/Rx at 100 m, adjustable main ridge.
  const deygoutCalculations = useMemo(() => {
    const res = computeDeygoutMultiObstacleDiffraction(
      [
        { distanceM: 1200, elevationM: 95 },
        { distanceM: 2500, elevationM: ridgeHeightM },
        { distanceM: 3800, elevationM: 120 },
      ],
      100, 100, 5000, 868e6,
    );
    const main = res.obstacles[res.mainObstacleIndex] ?? res.obstacles[1];
    return {
      nu: main.nu ?? 0,
      deygoutLossDb: Math.round(res.lossDeygoutDb * 10) / 10,
      epsteinLossDb: Math.round(res.lossEpsteinPetersonDb * 10) / 10,
      bracketDb: Math.round(Math.abs(res.epsteinOverestimationDb) * 10) / 10,
    };
  }, [ridgeHeightM]);

  // Calculations for Theorem 4
  const pbrCalculations = useMemo(() => {
    const res = computePassiveRadarCrlb(radarBandwidthMhz * 1e6, integrationTimeSec, radarSnrDb, 650e6);
    return { sigmaRangeM: res.sigmaRangeM, sigmaVelMps: res.sigmaVelocityMps };
  }, [radarBandwidthMhz, integrationTimeSec, radarSnrDb]);

  // Calculations for Theorem 5
  const acousticCalculations = useMemo(() => {
    const res = computeAcousticNearUltrasoundBudget(acousticDistM, ambientNoiseDba, 80);
    const per = res.packetErrorRate;
    return {
      rxSplDb: Math.round(res.receivedSplDb * 10) / 10,
      hfNoiseDb: Math.round(res.hfNoiseFloorSplDb * 10) / 10,
      snrDb: Math.round(res.snrDb * 10) / 10,
      capacityBps: res.shannonCapacityBps,
      txTimeSec: res.transmissionTimeSec,
      perLabel: per < 1e-9 ? '< 10⁻⁹' : per >= 0.5 ? '≈ 1 (enlace caído)' : per.toExponential(1),
    };
  }, [acousticDistM, ambientNoiseDba]);

  return (
    <section className="stl-suite" aria-labelledby="stl-head-title">
      <div className="stl-badge">
        <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
        {T.badge}
      </div>
      <h2 id="stl-head-title" className="stl-title">{T.title}</h2>
      <p className="stl-lead">{T.lead}</p>

      {/* Tabs */}
      <div className="stl-tabs" role="tablist">
        {T.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`stl-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <span className="stl-tab-tag">{tab.tag}</span>
            <span>{tab.title}</span>
            <small style={{ color: '#94a3b8', fontSize: 11 }}>{tab.shortDesc}</small>
          </button>
        ))}
      </div>

      {/* Interactive Stage */}
      <div className="stl-stage">
        {/* Visual Render / Canvas / SVG */}
        <div className="stl-canvas-box">
          <div className="stl-canvas-head">
            <span>
              {activeTab === 'T1_A2G' && 'RENDER 1 · CURVAS DE PÉRDIDA Y PROBABILIDAD LoS (AL-HOURANI)'}
              {activeTab === 'T2_FIEDLER' && 'RENDER 2 · TOPOLOGÍA ESPECTRAL Y PUENTE FIEDLER (λ₂)'}
              {activeTab === 'T3_DEYGOUT' && 'RENDER 3 · RELIEVE Y ZONAS DE FRESNEL (ITU-R P.526)'}
              {activeTab === 'T4_PBR' && 'RENDER 4 · SUPERFICIE AMBIGÜEDAD CAF DE RADAR PASIVO'}
              {activeTab === 'T5_ACOUSTIC' && 'RENDER 5 · ESPECTRO Y OSCILOSCOPIO ULTRA-ACÚSTICO (18-20 kHz)'}
            </span>
            <span style={{ color: '#34d399' }}>MOTOR @senda/core (mismo código que los tests)</span>
          </div>

          {/* SVG Diagram based on active tab */}
          {activeTab === 'T1_A2G' && (
            <svg viewBox="0 0 600 320" aria-label="A2G Elevation and Path Loss Diagram">
              <defs>
                <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#082f49" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="fresnelGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <rect width="600" height="320" fill="url(#skyGrad)" rx="8" />
              {/* Ground & Clutter */}
              <line x1="40" y1="280" x2="560" y2="280" stroke="#334155" strokeWidth="2" />
              {/* Urban buildings */}
              <rect x="120" y="220" width="30" height="60" fill="#1e293b" stroke="#475569" />
              <rect x="160" y="190" width="40" height="90" fill="#0f172a" stroke="#475569" />
              <rect x="210" y="240" width="25" height="40" fill="#1e293b" stroke="#475569" />
              <rect x="250" y="170" width="45" height="110" fill="#0f172a" stroke="#475569" />
              <rect x="310" y="210" width="35" height="70" fill="#1e293b" stroke="#475569" />
              {/* Ground victim */}
              <circle cx="80" cy="275" r="5" fill="#ff5b6e" />
              <text x="50" y="300" fill="#ff5b6e" fontSize="11" fontFamily="ui-monospace">VÍCTIMA (r=0)</text>
              {/* Drone position */}
              {(() => {
                const droneX = 80 + 380;
                const droneY = Math.max(40, 275 - (hoverAltitudeM / 2500) * 220);
                return (
                  <g>
                    {/* Direct ray */}
                    <line x1="80" y1="275" x2={droneX} y2={droneY} stroke="#38bdf8" strokeWidth="2" strokeDasharray="4,3" />
                    {/* Fresnel cone */}
                    <polygon points={`80,275 ${droneX},${droneY - 20} ${droneX},${droneY + 20}`} fill="url(#fresnelGrad)" />
                    {/* Drone icon */}
                    <circle cx={droneX} cy={droneY} r="8" fill="#38bdf8" />
                    <line x1={droneX - 14} y1={droneY} x2={droneX + 14} y2={droneY} stroke="#e2e8f0" strokeWidth="2" />
                    <circle cx={droneX - 14} cy={droneY} r="3" fill="#34d399" />
                    <circle cx={droneX + 14} cy={droneY} r="3" fill="#34d399" />
                    <text x={droneX - 50} y={droneY - 14} fill="#38bdf8" fontSize="11" fontFamily="ui-monospace">
                      UAV ({hoverAltitudeM} m)
                    </text>
                  </g>
                );
              })()}
              {/* Optimal altitude marker */}
              {(() => {
                const optY = Math.max(40, 275 - (a2gCalculations.optAltitudeM / 2500) * 220);
                return (
                  <g>
                    <line x1="420" y1={optY} x2="550" y2={optY} stroke="#34d399" strokeWidth="1.5" strokeDasharray="3,3" />
                    <text x="460" y={optY - 5} fill="#34d399" fontSize="10" fontFamily="ui-monospace">
                      h* ÓPTIMO: {a2gCalculations.optAltitudeM} m
                    </text>
                  </g>
                );
              })()}
            </svg>
          )}

          {activeTab === 'T2_FIEDLER' && (
            <svg viewBox="0 0 600 320" aria-label="Swarm Graph Laplacian and Fiedler Eigenvector">
              <rect width="600" height="320" fill="#03080e" rx="8" />
              {/* Nodes */}
              {/* Cluster A (Negative Fiedler value) */}
              <line x1="120" y1="120" x2="190" y2="80" stroke="#1e3a5f" strokeWidth="2" />
              <line x1="120" y1="120" x2="140" y2="200" stroke="#1e3a5f" strokeWidth="2" />
              <line x1="190" y1="80" x2="230" y2="160" stroke="#1e3a5f" strokeWidth="2" />
              <line x1="140" y1="200" x2="230" y2="160" stroke="#1e3a5f" strokeWidth="2" />

              {/* Cluster B (Positive Fiedler value) */}
              <line x1="420" y1="100" x2="490" y2="140" stroke="#1e3a5f" strokeWidth="2" />
              <line x1="420" y1="100" x2="380" y2="190" stroke="#1e3a5f" strokeWidth="2" />
              <line x1="490" y1="140" x2="460" y2="230" stroke="#1e3a5f" strokeWidth="2" />
              <line x1="380" y1="190" x2="460" y2="230" stroke="#1e3a5f" strokeWidth="2" />

              {/* Weak or cut bridge */}
              <line x1="230" y1="160" x2="380" y2="190" stroke="#475569" strokeWidth="1.5" strokeDasharray="4,4" />

              {/* Fiedler Optimal Bridge (UAV injected link) */}
              {droneBridgeInjected && (
                <g>
                  <line x1="190" y1="80" x2="420" y2="100" stroke="#34d399" strokeWidth="3" />
                  <circle cx="305" cy="90" r="10" fill="#0369a1" stroke="#34d399" strokeWidth="2" />
                  <text x="270" y="65" fill="#34d399" fontSize="11" fontFamily="ui-monospace" fontWeight="bold">
                    PUENTE FIEDLER MAX (v₂_i - v₂_j)²
                  </text>
                </g>
              )}

              {/* Nodes rendering with Fiedler colors */}
              <circle cx="120" cy="120" r="12" fill="#0284c7" />
              <circle cx="190" cy="80" r="12" fill="#0284c7" />
              <circle cx="140" cy="200" r="12" fill="#0369a1" />
              <circle cx="230" cy="160" r="12" fill="#075985" />

              <circle cx="380" cy="190" r="12" fill="#b45309" />
              <circle cx="420" cy="100" r="12" fill="#d97706" />
              <circle cx="460" cy="230" r="12" fill="#d97706" />
              <circle cx="490" cy="140" r="12" fill="#f59e0b" />

              <text x="80" y="260" fill="#38bdf8" fontSize="12" fontFamily="ui-monospace">GRUPO A (v₂ &lt; 0) · RESCATE</text>
              <text x="360" y="280" fill="#f59e0b" fontSize="12" fontFamily="ui-monospace">GRUPO B (v₂ &gt; 0) · HOSPITAL/PMA</text>
            </svg>
          )}

          {activeTab === 'T3_DEYGOUT' && (
            <svg viewBox="0 0 600 320" aria-label="Deygout Multi-Obstacle Mountain Profile">
              <rect width="600" height="320" fill="#04090e" rx="8" />
              {/* Mountain Profile (Bejís) */}
              <path
                d={`M 0,300 L 80,260 L 150,${300 - 95 * 1.2} L 220,270 L 300,${300 - ridgeHeightM * 1.2} L 380,265 L 450,${300 - 120 * 1.2} L 520,270 L 600,300 Z`}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="2"
              />
              {/* Tx & Rx */}
              <line x1="50" y1="180" x2="50" y2="280" stroke="#38bdf8" strokeWidth="3" />
              <circle cx="50" cy="180" r="6" fill="#38bdf8" />
              <text x="25" y="165" fill="#38bdf8" fontSize="11" fontFamily="ui-monospace">Tx (100 m)</text>

              <line x1="550" y1="180" x2="550" y2="280" stroke="#34d399" strokeWidth="3" />
              <circle cx="550" cy="180" r="6" fill="#34d399" />
              <text x="520" y="165" fill="#34d399" fontSize="11" fontFamily="ui-monospace">Rx (100 m)</text>

              {/* Direct LOS line */}
              <line x1="50" y1="180" x2="550" y2="180" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />

              {/* Dominant ridge marker */}
              <line x1="300" y1="180" x2="300" y2={300 - ridgeHeightM * 1.2} stroke="#ff5b6e" strokeWidth="2" />
              <circle cx="300" cy={300 - ridgeHeightM * 1.2} r="5" fill="#ff5b6e" />
              <text x="230" y={270 - ridgeHeightM * 1.2} fill="#ff5b6e" fontSize="11" fontFamily="ui-monospace">
                CRESTA DOMINANTE (ν={deygoutCalculations.nu})
              </text>
            </svg>
          )}

          {activeTab === 'T4_PBR' && (
            <svg viewBox="0 0 600 320" aria-label="Passive Radar Ambiguity Surface">
              <rect width="600" height="320" fill="#020617" rx="8" />
              {/* Grid axes */}
              <line x1="60" y1="260" x2="540" y2="260" stroke="#334155" strokeWidth="1.5" />
              <line x1="60" y1="40" x2="60" y2="260" stroke="#334155" strokeWidth="1.5" />
              <text x="440" y="290" fill="#94a3b8" fontSize="11" fontFamily="ui-monospace">RETARDO BIESTÁTICO τ (km)</text>
              <text x="10" y="30" fill="#94a3b8" fontSize="11" fontFamily="ui-monospace">DOPPLER f_d (Hz)</text>

              {/* Clutter floor */}
              <path d="M 60,260 Q 200,240 300,250 T 540,255" fill="none" stroke="#1e3a5f" strokeWidth="2" />

              {/* CA-CFAR adaptive threshold line */}
              <line x1="60" y1="190" x2="540" y2="190" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="5,4" />
              <text x="380" y="180" fill="#fbbf24" fontSize="10" fontFamily="ui-monospace">UMBRAL ADAPTATIVO CA-CFAR</text>

              {/* Cross-Ambiguity Peak for Drone */}
              <ellipse cx="260" cy="110" rx="35" ry="18" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" />
              <circle cx="260" cy="110" r="4" fill="#34d399" />
              <text x="280" y="105" fill="#34d399" fontSize="12" fontFamily="ui-monospace" fontWeight="bold">
                ECO MICRO-DRON (RCS=0.01 m²)
              </text>
              <text x="280" y="125" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace">
                σ_R = {pbrCalculations.sigmaRangeM} m · σ_v = {pbrCalculations.sigmaVelMps} m/s
              </text>
            </svg>
          )}

          {activeTab === 'T5_ACOUSTIC' && (
            <svg viewBox="0 0 600 320" aria-label="Near-Ultrasound Acoustic Spectrum">
              <rect width="600" height="320" fill="#030712" rx="8" />
              {/* Spectrum Envelope */}
              <path
                d="M 50,80 Q 150,110 250,180 T 420,240 L 460,245 L 470,140 L 510,140 L 520,250 L 560,255"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
              />
              {/* Disaster noise decay curve (1/f^2) */}
              <text x="70" y="70" fill="#ff5b6e" fontSize="11" fontFamily="ui-monospace">
                RUIDO AMBIENTE DANA/VIENTO (85 dBA @ 1 kHz)
              </text>

              {/* 18-20 kHz window highlight */}
              <rect x="460" y="50" width="70" height="210" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" strokeDasharray="3,3" />
              <text x="440" y="40" fill="#38bdf8" fontSize="11" fontFamily="ui-monospace" fontWeight="bold">
                VENTANA SENDA (18–20 kHz)
              </text>

              {/* Carrier FSK tones */}
              <line x1="475" y1="250" x2="475" y2="120" stroke="#34d399" strokeWidth="2" />
              <line x1="495" y1="250" x2="495" y2="115" stroke="#34d399" strokeWidth="2" />
              <line x1="515" y1="250" x2="515" y2="125" stroke="#34d399" strokeWidth="2" />

              <text x="80" y="280" fill="#34d399" fontSize="11" fontFamily="ui-monospace">
                SNR = +{acousticCalculations.snrDb} dB · CAPACIDAD = {acousticCalculations.capacityBps} bps · T_tx = {acousticCalculations.txTimeSec} s
              </text>
            </svg>
          )}
        </div>

        {/* Controls & Parameters Panel */}
        <div className="stl-ctrl-panel">
          {/* Formula Card */}
          <div className="stl-formula-card">
            {activeTab === 'T1_A2G' && (
              <>
                <h4>📐 ECUACIÓN TRASCENDENTE DE ALTITUD</h4>
                <div className="stl-formula-box">
                  tan(θ*) = (9·ln10 / π) · (η_NLoS - η_LoS) · b · P_LoS(θ*) · (1 - P_LoS(θ*))
                </div>
                <p className="stl-formula-desc">
                  Derivación exacta de d(PL)/dh = 0. El ángulo óptimo θ* depende exclusivamente de la morfología del suelo, desacoplado del radio de cobertura.
                </p>
              </>
            )}
            {activeTab === 'T2_FIEDLER' && (
              <>
                <h4>📐 GRADIENTE DE CONECTIVIDAD ALGEBRAICA</h4>
                <div className="stl-formula-box">
                  ∂λ₂(L) / ∂w_ij = (v₂(i) - v₂(j))²
                </div>
                <p className="stl-formula-desc">
                  Perturbación de Fiedler: maximizar la diferencia entre componentes del autovector unitario v₂ garantiza el mayor incremento de resiliencia del enjambre.
                </p>
              </>
            )}
            {activeTab === 'T3_DEYGOUT' && (
              <>
                <h4>📐 CASCADA DE DIFRACCIÓN ITU-R P.526</h4>
                <div className="stl-formula-box">
                  L_Deygout = J(ν_p) + J(ν_t) + J(ν_r), &nbsp; J(ν) = 6.9 + 20·log₁₀(√((ν−0.1)²+1) + ν − 0.1)
                </div>
                <p className="stl-formula-desc">
                  Construcción de 3 aristas con curvatura terrestre k = 4/3. Epstein-Peterson tiende a infraestimar y Deygout a sobrestimar con crestas próximas: juntos acotan la pérdida real.
                </p>
              </>
            )}
            {activeTab === 'T4_PBR' && (
              <>
                <h4>📐 LÍMITE INFERIOR DE CRAMÉR-RAO (CRLB)</h4>
                <div className="stl-formula-box">
                  σ_R ≥ c / [2√2·π·β_rms·√SNR], &nbsp; β_rms = B/(2√3); &nbsp; σ_ṙ ≥ λ / [2√2·π·T_rms·√SNR], &nbsp; T_rms = T/(2√3)
                </div>
                <p className="stl-formula-desc">
                  Cota teórica (Kay, 1993) sobre el rango biestático con la SNR del pico de la CAF. Con DVB-T de 7,61 MHz y 15 dB la precisión es de orden métrico; la resolución (c/B) es de unos 39 m.
                </p>
              </>
            )}
            {activeTab === 'T5_ACOUSTIC' && (
              <>
                <h4>📐 CAPACIDAD SHANNON EN AIRE</h4>
                <div className="stl-formula-box">
                  C = B · log₂(1 + SNR), &nbsp; L_p(r) = 82 - 20·log₁₀(r/0.1) - α_atm·r
                </div>
                <p className="stl-formula-desc">
                  16-FSK no coherente (125 baudios, 500 bit/s) + RS(104,80). Hipótesis declaradas: altavoz 82 dB SPL a 0,1 m y ruido en banda = dBA ambiente − 42 dB (a medir en campo).
                </p>
              </>
            )}
          </div>

          {/* Dynamic Inputs */}
          <div className="stl-inputs">
            {activeTab === 'T1_A2G' && (
              <>
                <div className="stl-input-row">
                  <label>Morfología del Terreno: <span>{envType}</span></label>
                  <select value={envType} onChange={(e) => setEnvType(e.target.value as typeof envType)}>
                    <option value="SUBURBAN">Suburbano / Campo (a=4.88, b=0.43)</option>
                    <option value="URBAN">Urbano Estándar (a=9.61, b=0.16)</option>
                    <option value="DENSE_URBAN">Urbano Denso (a=12.08, b=0.11)</option>
                    <option value="CANYON_RUBBLE">Cañón de Escombros (a=27.23, b=0.08)</option>
                  </select>
                </div>
                <div className="stl-input-row">
                  <label>Radio Perímetro (r): <span>{radiusM} m</span></label>
                  <input type="range" min={200} max={3000} step={100} value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))} />
                </div>
                <div className="stl-input-row">
                  <label>Altitud de Vuelo del UAV (h): <span>{hoverAltitudeM} m</span></label>
                  <input type="range" min={30} max={2500} step={25} value={hoverAltitudeM} onChange={(e) => setHoverAltitudeM(Number(e.target.value))} />
                </div>
              </>
            )}

            {activeTab === 'T2_FIEDLER' && (
              <>
                <div className="stl-input-row">
                  <label>Puente Aéreo de UAV Activo: <span>{droneBridgeInjected ? 'SÍ (CONECTADO)' : 'NO (DESCONECTADO)'}</span></label>
                  <button
                    type="button"
                    style={{
                      background: droneBridgeInjected ? '#0369a1' : '#1e293b',
                      border: '1px solid #38bdf8',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    onClick={() => setDroneBridgeInjected(!droneBridgeInjected)}
                  >
                    {droneBridgeInjected ? 'DESCONECTAR PUENTE FIEDLER' : 'INYECTAR ENLACE ÓPTIMO (DRON)'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'T3_DEYGOUT' && (
              <>
                <div className="stl-input-row">
                  <label>Altura Cresta Principal de Bejís: <span>{ridgeHeightM} m</span></label>
                  <input type="range" min={100} max={250} step={5} value={ridgeHeightM} onChange={(e) => setRidgeHeightM(Number(e.target.value))} />
                </div>
              </>
            )}

            {activeTab === 'T4_PBR' && (
              <>
                <div className="stl-input-row">
                  <label>Ancho de Banda Señal Comercial: <span>{radarBandwidthMhz} MHz</span></label>
                  <select value={radarBandwidthMhz} onChange={(e) => setRadarBandwidthMhz(Number(e.target.value))}>
                    <option value={7.61}>DVB-T TDT (7.61 MHz · UHF)</option>
                    <option value={0.1}>FM Comercial (0.1 MHz · VHF)</option>
                    <option value={10.0}>LTE / 5G Portadora (10 MHz)</option>
                  </select>
                </div>
                <div className="stl-input-row">
                  <label>Tiempo de Integración Coherente: <span>{integrationTimeSec} s</span></label>
                  <input type="range" min={0.05} max={1.0} step={0.05} value={integrationTimeSec} onChange={(e) => setIntegrationTimeSec(Number(e.target.value))} />
                </div>
              </>
            )}

            {activeTab === 'T5_ACOUSTIC' && (
              <>
                <div className="stl-input-row">
                  <label>Distancia entre Teléfonos: <span>{acousticDistM} m</span></label>
                  <input type="range" min={0.5} max={12.0} step={0.5} value={acousticDistM} onChange={(e) => setAcousticDistM(Number(e.target.value))} />
                </div>
                <div className="stl-input-row">
                  <label>Ruido Ambiente de Emergencia: <span>{ambientNoiseDba} dBA</span></label>
                  <input type="range" min={60} max={95} step={5} value={ambientNoiseDba} onChange={(e) => setAmbientNoiseDba(Number(e.target.value))} />
                </div>
              </>
            )}
          </div>

          {/* Metric KPIs */}
          <div className="stl-kpis">
            {activeTab === 'T1_A2G' && (
              <>
                <div className="stl-kpi-card">
                  <b>Probabilidad LoS</b>
                  <span className="highlight">{a2gCalculations.pLosPct}%</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Pérdida de Trayectoria</b>
                  <span>{a2gCalculations.plDb} dB</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Altitud Óptima h*</b>
                  <span className="highlight">{a2gCalculations.optAltitudeM} m</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Ganancia vs 50m</b>
                  <span className="highlight">+{a2gCalculations.gainDb} dB</span>
                </div>
              </>
            )}

            {activeTab === 'T2_FIEDLER' && (
              <>
                <div className="stl-kpi-card">
                  <b>Conectividad λ₂</b>
                  <span className="highlight">{fiedlerCalculations.lambda2}</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Cota Cheeger h(G)</b>
                  <span>≥ {fiedlerCalculations.cheegerBound}</span>
                </div>
                <div className="stl-kpi-card" style={{ gridColumn: 'span 2' }}>
                  <b>Estado de Malla</b>
                  <span style={{ color: fiedlerCalculations.statusColor, fontSize: 14 }}>
                    {fiedlerCalculations.status}
                  </span>
                </div>
              </>
            )}

            {activeTab === 'T3_DEYGOUT' && (
              <>
                <div className="stl-kpi-card">
                  <b>Pérdida Deygout P.526</b>
                  <span className="highlight">{deygoutCalculations.deygoutLossDb} dB</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Epstein-Peterson</b>
                  <span>{deygoutCalculations.epsteinLossDb} dB</span>
                </div>
                <div className="stl-kpi-card" style={{ gridColumn: 'span 2' }}>
                  <b>Horquilla entre métodos</b>
                  <span className="highlight">{deygoutCalculations.bracketDb} dB</span>
                </div>
              </>
            )}

            {activeTab === 'T4_PBR' && (
              <>
                <div className="stl-kpi-card">
                  <b>Precisión en Distancia σ_R</b>
                  <span className="highlight">{pbrCalculations.sigmaRangeM} m</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Precisión velocidad biestática σ_ṙ</b>
                  <span>{pbrCalculations.sigmaVelMps} m/s</span>
                </div>
                <div className="stl-kpi-card" style={{ gridColumn: 'span 2' }}>
                  <b>Modo Detección</b>
                  <span className="highlight" style={{ fontSize: 13 }}>
                    PASIVO (receptor SDR COTS)
                  </span>
                </div>
              </>
            )}

            {activeTab === 'T5_ACOUSTIC' && (
              <>
                <div className="stl-kpi-card">
                  <b>SNR Acústica (19 kHz)</b>
                  <span className="highlight">+{acousticCalculations.snrDb} dB</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Capacidad Shannon</b>
                  <span>{acousticCalculations.capacityBps} bps</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Tiempo de Enlace</b>
                  <span className="highlight">{acousticCalculations.txTimeSec} s</span>
                </div>
                <div className="stl-kpi-card">
                  <b>Tasa Error Trama</b>
                  <span className="highlight">{acousticCalculations.perLabel} (RS 104,80)</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Validation Table */}
      <div className="stl-table-wrap">
        <table className="stl-table">
          <thead>
            <tr>
              <th>{T.thArea}</th>
              <th>{T.thPhenomenon}</th>
              <th>{T.thFormula}</th>
              <th>{T.thValidation}</th>
              <th>{T.thPrecision}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Propagación A2G</b></td>
              <td>Bloqueo urbano por edificios</td>
              <td><code>tan(θ*) = K·b·P(1-P)</code></td>
              <td>Valencia DANA / Al-Hourani</td>
              <td style={{ color: '#34d399' }}>Raíz numérica (Newton); modelo estadístico sin calibrar en campo</td>
            </tr>
            <tr>
              <td><b>Topología Espectral</b></td>
              <td>Rotura de red en desastres</td>
              <td><code>∂λ₂/∂w = (v₂_i - v₂_j)²</code></td>
              <td>Descomposición Laplaciana Fiedler</td>
              <td style={{ color: '#34d399' }}>Exacto 1er orden</td>
            </tr>
            <tr>
              <td><b>Difracción Orogáfica</b></td>
              <td>Crestas montañosas encadenadas</td>
              <td><code>L = J(ν_p) + J(ν_t) + J(ν_r)</code></td>
              <td>Perfil tipo Bejís · Deygout vs Epstein-Peterson</td>
              <td style={{ color: '#34d399' }}>Horquilla entre métodos (cota superior/inferior)</td>
            </tr>
            <tr>
              <td><b>Radar Pasivo PBR</b></td>
              <td>Localización pasiva de drones</td>
              <td><code>CAF S(τ, f_d) + CRLB</code></td>
              <td>DVB-T comercial / Micro-UAV</td>
              <td style={{ color: '#34d399' }}>Cota CRLB: σ_R ≈ 2,7 m · σ_ṙ ≈ 0,13 m/s (DVB-T, 15 dB, 0,25 s)</td>
            </tr>
            <tr>
              <td><b>Enlace Acústico</b></td>
              <td>Llamadas en apagón total</td>
              <td><code>C = B·log₂(1+SNR) (19 kHz)</code></td>
              <td>Ruido extremo tormenta 85 dBA</td>
              <td style={{ color: '#34d399' }}>P_FER calculada (16-FSK + RS) · 1,66 s; enlace útil a pocos metros</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
