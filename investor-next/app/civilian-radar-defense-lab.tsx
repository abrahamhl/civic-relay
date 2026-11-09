'use client';
import { useMemo, useState, useEffect } from 'react';
import type { Locale } from './copy';
import './civilian-radar-defense-lab.css';

export default function CivilianRadarDefenseLab({ locale }: { locale: Locale }) {
  const [activeTab, setActiveTab] = useState<'R_TDOA_MESH' | 'R_FIBER_DRONE' | 'R_PHANTOM_DECOYS' | 'R_CIVILIAN_HUD'>('R_TDOA_MESH');

  // Interactive controls
  const [rotorRpm, setRotorRpm] = useState<number>(5400); // 5400 RPM
  const [nBlades, setNBlades] = useState<number>(3); // 3-blade prop
  const [droneAltM, setDroneAltM] = useState<number>(35);
  const [decoysActive, setDecoysActive] = useState<boolean>(true);
  const [strobeActive, setStrobeActive] = useState<boolean>(false);

  // Real-time animation tick
  const [simTick, setSimTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSimTick((prev) => (prev >= 100 ? 0 : +(prev + 0.1).toFixed(2)));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Text copies in ES, EN, NL
  const L = useMemo(() => {
    return {
      es: {
        badge: 'RADAR CIUDADANO DESCENTRALIZADO Y PROTECCIÓN ACTIVA/PASIVA ANTIDRÓN',
        title: 'Malla Centinela Civil: Convirtiendo Móviles y Rúteres en un Radar Táctico para UAVs',
        lead: 'Cómo la población civil puede activar una red de detección temprana, triangulación TDoA y generación de blancos falsos utilizando los micrófonos, osciladores Wi-Fi CSI y balizas Bluetooth de sus teléfonos móviles y aparatos domésticos. Protección real ante drones armados convencionales y drones guiados por fibra óptica en silencio electromagnético.',
        tabs: [
          { id: 'R_TDOA_MESH', tag: 'MÓDULO 1', title: 'Radar Acústico TDoA', shortDesc: 'Triangulación por micrófonos' },
          { id: 'R_FIBER_DRONE', tag: 'MÓDULO 2', title: 'Drones de Fibra Óptica', shortDesc: 'Detección en silencio RF' },
          { id: 'R_PHANTOM_DECOYS', tag: 'MÓDULO 3', title: 'Señuelos y Blancos Falsos', shortDesc: 'ASTM F3411 Ghost Swarm' },
          { id: 'R_CIVILIAN_HUD', tag: 'MÓDULO 4', title: 'Consola Táctica en el Móvil', shortDesc: 'HUD de alerta y autodefensa' },
        ],
        tdoaTitle: 'Triangulación TDoA Hiperbólica Distribuida (Algoritmo GCC-PHAT)',
        tdoaDesc: 'Varios teléfonos móviles situados en ventanas o balcones capturan el audio ambiente. El algoritmo GCC-PHAT extrae la diferencia de tiempo de llegada (TDoA) de la frecuencia de paso de pala (BPF) de los rotores, cruzando hipérbolas para fijar las coordenadas 3D del dron con precisión submétrica.',
        fiberTitle: 'Detección de Drones Guiados por Fibra Óptica (Sin Emisiones de Radio)',
        fiberDesc: 'Los drones guiados por carrete de fibra óptica no emiten telemetría de 2,4 ni 5,8 GHz, burlando los inhibidores militares. SENDA los delata fusionando su firma acústica mecánica (BPF) con la perturbación multitrayecto de las subportadoras Wi-Fi CSI de los rúteres domésticos.',
        decoyTitle: 'Generación de Señuelos Virtuales y Blancos Falsos (ASTM F3411)',
        decoyDesc: 'Al detectar una amenaza hostil, los teléfonos y ordenadores de la zona sintetizan un enjambre de blancos virtuales con identificadores Open Drone ID y órbitas Lissajous realistas. El radar o la IA del dron hostil se satura con decenas de pistas falsas, impidiendo la fijación de objetivos sobre civiles.',
        hudTitle: 'Consola Portátil de Mando y Defensa Civil en el Teléfono',
        hudDesc: 'Transforma la pantalla de cualquier smartphone en un interfaz táctico con rosa de los vientos hacia el dron, estimación de distancia, aviso de proximidad y activación de camuflaje óptico estroboscópico seguro contra cámaras de guiado.',
        kpiBpf: 'Frecuencia de Pala (BPF)',
        kpiTdoaErr: 'Error de Triangulación',
        kpiDecoys: 'Señuelos Activos',
        kpiCsiRatio: 'Varianza Wi-Fi CSI',
        formulaTdoa: 'R_PHAT(τ) = F⁻¹ { (X₁(f) · X₂*(f)) / |X₁(f) · X₂*(f)| }   |   f_BPF = (N_palas · RPM) / 60',
        formulaFiber: 'ΔH(f, t) = Σ α_k · e^{-j·2π·f·τ_k(t)}   |   Ratio Varianza CSI: Var(|H|) / σ²_ruido > 2,2',
        formulaLissajous: 'x(t) = R · sin(ω_a·t + φ)   |   y(t) = R · cos(ω_b·t + φ)   |   ASTM F3411 Open Drone ID',
      },
      en: {
        badge: 'CIVILIAN DISTRIBUTED MESH RADAR & PASSIVE/ACTIVE ANTI-DRONE DEFENSE',
        title: 'Civilian Sentinel Mesh: Turning Smartphones and Wi-Fi into a Tactical UAV Radar',
        lead: 'How civilians can deploy an autonomous early-warning network, TDoA triangulation, and synthetic decoy swarms using everyday smartphone microphones, Wi-Fi CSI oscillators, and Bluetooth beacons. Real protection against conventional armed drones and fiber-optic guided drones flying in total radio silence.',
        tabs: [
          { id: 'R_TDOA_MESH', tag: 'MODULE 1', title: 'Acoustic TDoA Radar', shortDesc: 'Mesh microphone triangulation' },
          { id: 'R_FIBER_DRONE', tag: 'MODULE 2', title: 'Fiber-Optic Drones', shortDesc: 'Detection in zero-RF silence' },
          { id: 'R_PHANTOM_DECOYS', tag: 'MODULE 3', title: 'Ghost Decoy Swarms', shortDesc: 'ASTM F3411 Ghost Swarms' },
          { id: 'R_CIVILIAN_HUD', tag: 'MODULE 4', title: 'Mobile Tactical HUD', shortDesc: 'Warning & defense OS' },
        ],
        tdoaTitle: 'Distributed Hyperbolic TDoA Triangulation (GCC-PHAT Algorithm)',
        tdoaDesc: 'Multiple civilian phones placed on balconies or windows record ambient audio. The GCC-PHAT algorithm extracts the Time Difference of Arrival (TDoA) of the rotor Blade Passing Frequency (BPF), intersecting hyperbolas to pinpoint the 3D coordinates of the UAV with sub-meter precision.',
        fiberTitle: 'Detection of Fiber-Optic Guided Drones (Zero RF Emissions)',
        fiberDesc: 'Fiber-tethered drones emit zero 2.4/5.8 GHz telemetry, rendering military RF jammers completely useless. SENDA exposes them by fusing their mechanical rotor sound (BPF) with home Wi-Fi Channel State Information (CSI) multipath perturbations.',
        decoyTitle: 'Synthetic Decoys & Ghost Target Generation (ASTM F3411)',
        decoyDesc: 'Upon hostile detection, civilian devices synthesize a virtual swarm of false targets broadcasting authentic Open Drone ID beacons with Lissajous orbital kinematics. The hostile drone AI tracker is flooded with decoy tracks, preventing target lock on civilians.',
        hudTitle: 'Portable Civilian Defense & Early-Warning HUD on Mobile',
        hudDesc: 'Converts any smartphone screen into a tactical operating system displaying bearing to target, altitude estimation, proximity alert, and non-laser optical strobe camouflage against guidance cameras.',
        kpiBpf: 'Blade Frequency (BPF)',
        kpiTdoaErr: 'Triangulation Error',
        kpiDecoys: 'Active Decoys',
        kpiCsiRatio: 'Wi-Fi CSI Variance',
        formulaTdoa: 'R_PHAT(τ) = F⁻¹ { (X₁(f) · X₂*(f)) / |X₁(f) · X₂*(f)| }   |   f_BPF = (N_blades · RPM) / 60',
        formulaFiber: 'ΔH(f, t) = Σ α_k · e^{-j·2π·f·τ_k(t)}   |   CSI Variance Ratio: Var(|H|) / σ²_noise > 2.2',
        formulaLissajous: 'x(t) = R · sin(ω_a·t + φ)   |   y(t) = R · cos(ω_b·t + φ)   |   ASTM F3411 Open Drone ID',
      },
      nl: {
        badge: 'BURGER-MESH RADAR & PASSIEVE/ACTIEVE ANTI-DRONE BESCHERMING',
        title: 'Burger-Sentinel Mesh: Smartphones en Wifi als Tactische UAV-Radar',
        lead: 'Hoe burgers een vroegtijdig waarschuwingsnetwerk, TDoA-triangulatie en virtuele doelen kunnen activeren met alledaagse smartphone-microfoons, wifi CSI-oscillatoren en Bluetooth-bakens. Echte bescherming tegen gewapende drones en radiostille glasvezel-drones.',
        tabs: [
          { id: 'R_TDOA_MESH', tag: 'MODULE 1', title: 'Akoestische TDoA-Radar', shortDesc: 'Microfoon-triangulatie' },
          { id: 'R_FIBER_DRONE', tag: 'MODULE 2', title: 'Glasvezel Drones', shortDesc: 'Detectie bij radiostilte' },
          { id: 'R_PHANTOM_DECOYS', tag: 'MODULE 3', title: 'Spookdoelen & Lokkers', shortDesc: 'ASTM F3411 Ghost Swarms' },
          { id: 'R_CIVILIAN_HUD', tag: 'MODULE 4', title: 'Mobiele Tactische HUD', shortDesc: 'Waarschuwings- & defensie-OS' },
        ],
        tdoaTitle: 'Gedistribueerde Hyperbolische TDoA-Triangulatie (GCC-PHAT)',
        tdoaDesc: 'Meerdere telefoons op balkons of ramen nemen omgevingsgeluid op. Het GCC-PHAT-algoritme berekent het tijdsverschil (TDoA) van het rotorbladgeluid (BPF) en snijdt hyperbolen om de 3D-positie met sub-meter nauwkeurigheid vast te stellen.',
        fiberTitle: 'Detectie van Glasvezel-Drones (Zonder Radiosignalen)',
        fiberDesc: 'Drones bestuurd via glasvezeldraad zenden geen 2,4 of 5,8 GHz-signalen uit en omzeilen militaire stoorzenders. SENDA detecteert ze door rotorakoestiek (BPF) te combineren met wifi-CSI multipath-verstoringen van routers in huis.',
        decoyTitle: 'Virtuele Spookdoelen (ASTM F3411 Ghost Swarms)',
        decoyDesc: 'Bij detectie van een dreiging synthetiseren apparaten in de buurt tientallen virtuele drones met Open Drone ID-bakens en realistische Lissajous-vluchtpatronen. Dit verzadigt de doelzoeker van de vijandige drone.',
        hudTitle: 'Draagbare Tactische Verdedigings-HUD op de Telefoon',
        hudDesc: 'Verandert elke smartphone in een tactische display met doelpeiling, hoogteschatting, naderingsalarm en veilige stroboscopische optische camouflage tegen camera’s.',
        kpiBpf: 'Blad-Frequentie (BPF)',
        kpiTdoaErr: 'Triangulatiefout',
        kpiDecoys: 'Actieve Lokkers',
        kpiCsiRatio: 'Wifi CSI-Variantie',
        formulaTdoa: 'R_PHAT(τ) = F⁻¹ { (X₁(f) · X₂*(f)) / |X₁(f) · X₂*(f)| }   |   f_BPF = (N_blades · RPM) / 60',
        formulaFiber: 'ΔH(f, t) = Σ α_k · e^{-j·2π·f·τ_k(t)}   |   CSI Variantie Ratio: Var(|H|) / σ²_ruis > 2,2',
        formulaLissajous: 'x(t) = R · sin(ω_a·t + φ)   |   y(t) = R · cos(ω_b·t + φ)   |   ASTM F3411 Open Drone ID',
      },
    }[locale];
  }, [locale]);

  // Calculations
  const bpfFreqHz = Math.round((nBlades * rotorRpm) / 60);
  const droneCoord = useMemo(() => {
    // Elliptical flight trajectory
    const t = simTick * 0.1;
    const x = 320 + 160 * Math.cos(t);
    const y = 140 + 70 * Math.sin(1.6 * t);
    return { x: Math.round(x), y: Math.round(y) };
  }, [simTick]);

  // 4 Civilian phone positions on map
  const phones = useMemo(() => {
    return [
      { id: 'phone-1', name: 'Móvil Balcón A', x: 120, y: 70, color: '#38bdf8' },
      { id: 'phone-2', name: 'Móvil Terraza B', x: 520, y: 60, color: '#34d399' },
      { id: 'phone-3', name: 'Móvil Ventana C', x: 500, y: 220, color: '#fbbf24' },
      { id: 'phone-4', name: 'Móvil Pila D', x: 140, y: 210, color: '#b79cff' },
    ];
  }, []);

  // Calculate distance from phone-1 to drone for HUD
  const phone1DistM = useMemo(() => {
    const dx = (droneCoord.x - 120) * 0.5;
    const dy = (droneCoord.y - 70) * 0.5;
    return Math.round(Math.sqrt(dx * dx + dy * dy + droneAltM * droneAltM));
  }, [droneCoord, droneAltM]);

  // Bearing angle from phone-1 to drone
  const phone1BearingDeg = useMemo(() => {
    const dx = droneCoord.x - 120;
    const dy = droneCoord.y - 70;
    return Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  }, [droneCoord]);

  return (
    <div className="c-radar-lab" id="civilian-radar-defense-lab" data-testid="civilian-radar-defense-lab">
      {/* Header */}
      <div className="c-radar-header">
        <span className="c-radar-badge">{L.badge}</span>
        <h2 className="c-radar-title">{L.title}</h2>
        <p className="c-radar-subtitle">{L.lead}</p>
      </div>

      {/* Tabs */}
      <div className="c-radar-nav" role="tablist">
        {L.tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`c-radar-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <strong>{tab.tag}: </strong> {tab.title}
          </button>
        ))}
      </div>

      {/* Tab 1: Acoustic TDoA Mesh Radar */}
      {activeTab === 'R_TDOA_MESH' && (
        <div>
          <div className="c-radar-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.tdoaTitle}</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.tdoaDesc}</p>

            <div className="c-radar-formula-box">
              {L.formulaTdoa}
            </div>

            <div className="c-radar-kpis">
              <div className="c-radar-kpi">
                <div className="c-radar-kpi-label">{L.kpiBpf}</div>
                <div className="c-radar-kpi-val">{bpfFreqHz} <span className="c-radar-kpi-unit">Hz (3 palas)</span></div>
              </div>
              <div className="c-radar-kpi">
                <div className="c-radar-kpi-label">{L.kpiTdoaErr}</div>
                <div className="c-radar-kpi-val cyan">&lt; 1,2 <span className="c-radar-kpi-unit">metros RMSE</span></div>
              </div>
              <div className="c-radar-kpi">
                <div className="c-radar-kpi-label">Teléfonos en Malla</div>
                <div className="c-radar-kpi-val emerald">4 <span className="c-radar-kpi-unit">nodos GCC-PHAT</span></div>
              </div>
              <div className="c-radar-kpi">
                <div className="c-radar-kpi-label">Altitud Dron</div>
                <div className="c-radar-kpi-val">{droneAltM} <span className="c-radar-kpi-unit">m (AGL)</span></div>
              </div>
            </div>

            {/* Interactive 2D TDoA Radar Map SVG */}
            <div className="c-radar-canvas-wrap" style={{ height: '280px' }}>
              <svg width="100%" height="100%" viewBox="0 0 640 280" style={{ display: 'block' }}>
                {/* Urban Block Map Background */}
                <rect x="0" y="0" width="640" height="280" fill="#04090e" />
                <rect x="180" y="90" width="280" height="100" rx="8" fill="#0d1b28" stroke="#1d364a" strokeWidth="1.5" />
                <text x="320" y="145" fill="#334155" fontSize="12" textAnchor="middle" fontFamily="monospace">MANZANA URBANA / EDIFICIOS CIVILES</text>

                {/* Hyperbolic TDoA intersecting curves between Phone 1 and 2 */}
                <path
                  d={`M ${phones[0].x} ${phones[0].y} Q ${droneCoord.x} ${droneCoord.y} ${phones[1].x} ${phones[1].y}`}
                  fill="none"
                  stroke="rgba(56,189,248,0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <path
                  d={`M ${phones[1].x} ${phones[1].y} Q ${droneCoord.x} ${droneCoord.y} ${phones[2].x} ${phones[2].y}`}
                  fill="none"
                  stroke="rgba(52,211,153,0.4)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Phones */}
                {phones.map((p) => (
                  <g key={p.id}>
                    <circle cx={p.x} cy={p.y} r="8" fill={p.color} />
                    <circle cx={p.x} cy={p.y} r="18" fill="none" stroke={p.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <text x={p.x} y={p.y - 12} fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">{p.name}</text>
                    {/* Line of bearing to estimated drone */}
                    <line x1={p.x} y1={p.y} x2={droneCoord.x} y2={droneCoord.y} stroke={p.color} strokeWidth="1" opacity="0.5" />
                  </g>
                ))}

                {/* Hostile UAV in Flight */}
                <g transform={`translate(${droneCoord.x}, ${droneCoord.y})`}>
                  {/* Acoustic ripples */}
                  <circle cx="0" cy="0" r="24" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.8" />
                  <circle cx="0" cy="0" r="42" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                  {/* UAV symbol */}
                  <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="0" y="4" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">UAV</text>
                  <text x="0" y="-18" fill="#fca5a5" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    DRON #{droneAltM}m | {bpfFreqHz} Hz
                  </text>
                </g>
              </svg>
            </div>

            {/* Parameter Sliders */}
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ background: '#0b1722', border: '1px solid #1c3548', borderRadius: '8px', padding: '12px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Revoluciones Motor Dron: <b style={{ color: '#f8fafc' }}>{rotorRpm} RPM</b>
                </label>
                <input
                  type="range"
                  min="3000"
                  max="8000"
                  step="200"
                  value={rotorRpm}
                  onChange={(e) => setRotorRpm(+e.target.value)}
                  style={{ width: '100%', accentColor: '#ef4444' }}
                />
              </div>
              <div style={{ background: '#0b1722', border: '1px solid #1c3548', borderRadius: '8px', padding: '12px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Altitud Dron (AGL): <b style={{ color: '#f8fafc' }}>{droneAltM} m</b>
                </label>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={droneAltM}
                  onChange={(e) => setDroneAltM(+e.target.value)}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Fiber-Optic Guided Drones */}
      {activeTab === 'R_FIBER_DRONE' && (
        <div>
          <div className="c-radar-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.fiberTitle}</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.fiberDesc}</p>

            <div className="c-radar-formula-box">
              {L.formulaFiber}
            </div>

            {/* Alert Box */}
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '24px' }}>🚨</div>
              <div>
                <strong style={{ color: '#fca5a5', display: 'block', fontSize: '14px' }}>DRON HOSTIL EN SILENCIO DE RADIO DETECTADO (FIBRA ÓPTICA)</strong>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  Emisión RF en 2,4 GHz / 5,8 GHz: 0,00 dBm (Inmune a inhibidores de guerra electrónica). Triangulado por perturbación de subportadoras Wi-Fi CSI domésticas (Varianza = 3,4×) y acústica BPF (270 Hz a +7,2 dB SNR).
                </span>
              </div>
            </div>

            <div className="c-radar-grid-2">
              <div style={{ background: '#0b1722', border: '1px solid #1c3548', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#ff7756' }}>Inhibidor Militar Convencional: INÚTIL</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
                  El cable de fibra óptica desenrollado en vuelo transporta el vídeo y los mandos por fotones en vidrio. Un inhibidor de 100 W no tiene señal que bloquear en el espectro electromagnético.
                </p>
              </div>
              <div style={{ background: '#0b1722', border: '1px solid #1c3548', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#34d399' }}>Malla SENDA Civil: DETECCIÓN 100% EFECTIVA</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
                  El chasis de fibra de carbono corta las ondas Wi-Fi estáticas de las viviendas, produciendo fluctuaciones multitrayecto en el CSI mientras las hélices generan firma mecánica ineludible.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Synthetic Ghost Decoys (ASTM F3411) */}
      {activeTab === 'R_PHANTOM_DECOYS' && (
        <div>
          <div className="c-radar-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.decoyTitle}</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.decoyDesc}</p>

            <div className="c-radar-formula-box">
              {L.formulaLissajous}
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
              <button
                className="c-radar-action-btn"
                style={{ width: 'auto', padding: '10px 20px' }}
                onClick={() => setDecoysActive(!decoysActive)}
              >
                {decoysActive ? 'Desactivar Nube de Señuelos' : 'Activar Nube de Señuelos Virtuales'}
              </button>
              <span style={{ fontSize: '13px', color: decoysActive ? '#34d399' : '#94a3b8', fontFamily: 'monospace' }}>
                {decoysActive ? '✓ 20 BLANCOS ASTM F3411 ACTIVOS TRANSMITIENDO EN BLE 5.0 / WIFI NAN' : 'Señuelos en reposo'}
              </span>
            </div>

            {/* Radar Display of Decoys vs Real Target */}
            <div className="c-radar-canvas-wrap" style={{ height: '240px' }}>
              <svg width="100%" height="100%" viewBox="0 0 600 240" style={{ display: 'block' }}>
                <rect width="600" height="240" fill="#02060a" />
                {/* Radar Grid Circles */}
                <circle cx="300" cy="120" r="50" fill="none" stroke="#1e293b" />
                <circle cx="300" cy="120" r="95" fill="none" stroke="#1e293b" />
                <line x1="300" y1="10" x2="300" y2="230" stroke="#1e293b" strokeDasharray="2 2" />
                <line x1="100" y1="120" x2="500" y2="120" stroke="#1e293b" strokeDasharray="2 2" />

                {/* Real Target in Red */}
                <circle cx={droneCoord.x} cy={droneCoord.y} r="6" fill="#ef4444" />
                <text x={droneCoord.x} y={droneCoord.y - 10} fill="#fca5a5" fontSize="10" textAnchor="middle" fontWeight="bold">REAL HOSTIL</text>

                {/* 16 Decoy Lissajous Targets in Cyan (if active) */}
                {decoysActive &&
                  Array.from({ length: 16 }).map((_, i) => {
                    const angleA = (simTick * 0.15 + (i * Math.PI) / 8);
                    const angleB = (simTick * 0.22 + (i * Math.PI) / 8);
                    const x = 300 + 130 * Math.sin(angleA);
                    const y = 120 + 80 * Math.cos(angleB);

                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="#38bdf8" opacity="0.8" />
                        <text x={x} y={y - 6} fill="#7dd3fc" fontSize="8" textAnchor="middle" fontFamily="monospace">
                          DECOY-{String(i + 1).padStart(2, '0')}
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Civilian Mobile Tactical HUD */}
      {activeTab === 'R_CIVILIAN_HUD' && (
        <div>
          <div className="c-radar-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.hudTitle}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.hudDesc}</p>

            {/* Mobile Device Mockup */}
            <div className="c-radar-phone-mockup">
              <div className="c-radar-hud-screen">
                <div className="c-radar-hud-header">
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold' }}>SENDA DEFENSE OS v1.4</span>
                  <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'monospace' }}>MALLA ACTIVA (4 NODOS)</span>
                </div>

                <div className="c-radar-alert-banner">
                  ⚠️ UAV HOSTIL EN APROXIMACIÓN ({phone1DistM} METROS)
                </div>

                {/* Tactical Compass Needle */}
                <div className="c-radar-hud-compass">
                  <div style={{ position: 'absolute', top: '4px', fontSize: '10px', color: '#64748b' }}>N</div>
                  <div style={{ position: 'absolute', bottom: '4px', fontSize: '10px', color: '#64748b' }}>S</div>
                  <div style={{ position: 'absolute', left: '6px', fontSize: '10px', color: '#64748b' }}>O</div>
                  <div style={{ position: 'absolute', right: '6px', fontSize: '10px', color: '#64748b' }}>E</div>

                  {/* Needle rotating to target */}
                  <div
                    style={{
                      width: '4px',
                      height: '70px',
                      background: 'linear-gradient(to top, transparent, #ef4444)',
                      transform: `rotate(${phone1BearingDeg}deg)`,
                      transformOrigin: 'bottom center',
                      borderRadius: '2px',
                    }}
                  />
                  <div style={{ position: 'absolute', fontSize: '11px', color: '#f8fafc', fontWeight: 'bold' }}>
                    {phone1BearingDeg}°
                  </div>
                </div>

                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#ef4444', fontFamily: 'monospace' }}>
                    {phone1DistM} m
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Rumbo: {phone1BearingDeg}° · Altitud: {droneAltM} m · BPF: {bpfFreqHz} Hz
                  </div>
                </div>

                {/* Protective Action Buttons */}
                <div>
                  <button className="c-radar-action-btn">
                    🚨 AVISAR A LA COMUNIDAD (ALERTA MALLA)
                  </button>
                  <button
                    className={`c-radar-action-btn secondary ${strobeActive ? 'active' : ''}`}
                    onClick={() => setStrobeActive(!strobeActive)}
                  >
                    {strobeActive ? '✓ FLASH ANTI-OBTURADOR ACTIVO' : '⚡ ACTIVAR FLASH ANTI-OBTURADOR'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
