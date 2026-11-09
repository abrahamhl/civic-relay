'use client';
import { useMemo, useState, useEffect } from 'react';
import type { Locale } from './copy';
import './vehicular-doppler-lab.css';

export default function VehicularDopplerLab({ locale }: { locale: Locale }) {
  const [activeTab, setActiveTab] = useState<'V_TRACKING' | 'V_DOPPLER_WAVES' | 'V_GATEWAY_0RTT' | 'V_RAIL_ROAD_BRIDGE'>('V_TRACKING');

  // Multi-vehicle tracking controls
  const [selectedVehicleId, setSelectedVehicleId] = useState<number>(1);
  const [trafficDensity, setTrafficDensity] = useState<'LIGHT' | 'MODERATE' | 'DENSE'>('MODERATE');

  // Doppler & wave controls
  const [carSpeedKmh, setCarSpeedKmh] = useState<number>(120);
  const [radarFreqGhz, setRadarFreqGhz] = useState<number>(24.125); // 24.125 GHz (K-band) or 77 GHz
  const [cpaDistanceM, setCpaDistanceM] = useState<number>(8);
  const [simTimeSec, setSimTimeSec] = useState<number>(-1.5); // Centered around 0

  // Gateway 0-RTT controls
  const [rsuRadiusM, setRsuRadiusM] = useState<number>(50);
  const [payloadBytes, setPayloadBytes] = useState<number>(320);

  // Cross-modal catastrophe simulation
  const [incidentStep, setIncidentStep] = useState<number>(2); // 0 to 4

  // Tick timer for smooth wave & car motion
  useEffect(() => {
    const timer = setInterval(() => {
      setSimTimeSec((prev) => (prev >= 2.5 ? -2.5 : +(prev + 0.05).toFixed(2)));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Text copies in ES, EN, NL
  const L = useMemo(() => {
    return {
      es: {
        badge: 'FÍSICA ONDULATORIA VEHICULAR, RADAR FMCW Y PASARELAS V2I EN EMERGENCIA',
        title: 'Sincronía Vídeo-Física: Ondas, Efecto Doppler y Rescate Multimodal en Carretera',
        lead: 'Por qué un coche en movimiento no es solo una imagen: es una plataforma osciladora que comprime y expande frentes de onda electromagnéticos al interactuar con radares, cámaras y pórticos. Descubre cómo SENDA convierte el paso de vehículos en mulas de datos deterministas para rescatar accidentes ferroviarios o viales aislados sin cobertura en menos de 90 segundos.',
        tabs: [
          { id: 'V_TRACKING', tag: 'MÓDULO 1', title: 'Tracking Multi-Vehicular Real', shortDesc: 'YOLOX + ByteTrack en autovía' },
          { id: 'V_DOPPLER_WAVES', tag: 'MÓDULO 2', title: 'Física de Ondas y Doppler', shortDesc: 'Curva en S y compresión 24/77 GHz' },
          { id: 'V_GATEWAY_0RTT', tag: 'MÓDULO 3', title: 'Pasarela V2I en Radares DGT', shortDesc: 'Ráfaga 0-RTT sin IP lenta' },
          { id: 'V_RAIL_ROAD_BRIDGE', tag: 'MÓDULO 4', title: 'Puente Tren-Coche-112', shortDesc: 'Rescate en trinchera sin red' },
        ],
        trackTitle: 'Demostración de Tracking Multi-Vehicular Simultáneo en Autovía',
        trackDesc: 'El vídeo de prueba inicial de cámara fija muestra 1 vehículo en 30 segundos (entorno de aparcamiento de baja densidad del benchmark Intel IoT DevKit). En condiciones reales de autovía (como el vídeo dashcam o cámaras DGT), SENDA rastrea múltiples vehículos en tiempo real, midiendo distancias, velocidades relativas y contactos con la calzada contraria sin registrar matrículas ni rostros.',
        dopplerTitle: 'Efecto Doppler en Aproximación a Radares de Tráfico (Curva en S)',
        dopplerDesc: 'Al aproximarse al radar, la onda reflejada se comprime en frecuencia (blue-shift); al alejarse, se elonga (red-shift). En el punto de máximo acercamiento (CPA), el Doppler cruza exactamente por cero con una pendiente analítica proporcional a v²/(λ·d_cpa).',
        gatewayTitle: 'Por qué el TCP/IP Convencional Falla a 120 km/h y Cómo SENDA lo Resuelve',
        gatewayDesc: 'A 120 km/h, un coche pasa por el cono de cobertura de un radar o poste SOS en menos de 3 segundos. Una negociación TCP/IP + WPA3 + DHCP tarda más de 3 segundos, causando desconexión total. SENDA utiliza ráfagas autónomas 0-RTT pre-firmadas que transfieren la alerta completa en menos de 20 milisegundos.',
        bridgeTitle: 'Escenario Catastrófico: Accidente Ferroviario Rescatado por la Carretera',
        bridgeDesc: 'Un tren de pasajeros descarrila en una trinchera rural (patrón Adamuz) donde las antenas móviles están caídas. La baliza acústica ultrasónica (19 kHz) y BLE es captada por un turismo en la carretera paralela a 120 m. El coche actúa como mula de datos DTN y descarga la alerta firmada en el siguiente radar de velocidad DGT a 2,3 km, alertando al 112 en 87 segundos.',
        kpiSpeed: 'Velocidad Vehicular',
        kpiDopplerMax: 'Doppler Máx (+Azul)',
        kpiDopplerInstant: 'Doppler Instantáneo',
        kpiCpaSlope: 'Pendiente en CPA',
        kpiTimeInRange: 'Permanencia en RSU',
        kpiBurstTime: 'Ráfaga SENDA 0-RTT',
        kpiTcpLatency: 'Handshake TCP/IP',
        kpiSafetyMargin: 'Margen Temporal',
        formulaDoppler: 'f_d(t) = - (2·v·f_c / c) · [v·t / √(v²·t² + d_cpa²)]   |   df_d/dt|_cpa = - 2·v² / (λ·d_cpa)',
        formulaFmcw: 'f_beat = (2·B·R) / (c·T_chirp) + f_d   |   Resolución en Rango: ΔR = c / (2·B) = 0,15 m (1 GHz)',
        formula0rtt: 'T_tx = (Payload + Firma) · 8 / R_phy = 352 B · 8 / 1 Mbps = 2,8 ms  (18,5 ms con 3 copias)',
      },
      en: {
        badge: 'VEHICULAR WAVE PHYSICS, FMCW RADAR & V2I OPPORTUNISTIC GATEWAYS',
        title: 'Video-Physics Synchrony: Waves, Doppler Effect and Cross-Modal Roadside Rescue',
        lead: 'Why a moving car is never just a visual box: it is an oscillating physical platform that compresses and elongates electromagnetic wavefronts as it interacts with radars, CCTV poles, and gantries. Discover how SENDA turns passing traffic into deterministic data mules to rescue isolated rail or road incidents without cellular coverage in under 90 seconds.',
        tabs: [
          { id: 'V_TRACKING', tag: 'MODULE 1', title: 'Real Multi-Vehicle Tracking', shortDesc: 'YOLOX + ByteTrack on highway' },
          { id: 'V_DOPPLER_WAVES', tag: 'MODULE 2', title: 'Wave Physics & Doppler', shortDesc: 'S-Curve & 24/77 GHz compression' },
          { id: 'V_GATEWAY_0RTT', tag: 'MODULE 3', title: 'V2I Gateway at Speed Radars', shortDesc: '0-RTT burst without slow IP' },
          { id: 'V_RAIL_ROAD_BRIDGE', tag: 'MODULE 4', title: 'Train-Car-112 Catastrophe Bridge', shortDesc: 'Cutting derailment relay' },
        ],
        trackTitle: 'Simultaneous Multi-Vehicle Highway Tracking Demonstration',
        trackDesc: 'The initial fixed-camera test video shows 1 car in 30 seconds (low-density parking lot test case from Intel IoT DevKit). Under real motorway conditions (such as the dashcam footage or DGT cameras), SENDA tracks multiple vehicles simultaneously, estimating distances, relative speeds, and oncoming carriageway contacts without logging number plates or faces.',
        dopplerTitle: 'Doppler Shift Approaching Roadside Radars (S-Curve Signature)',
        dopplerDesc: 'As a vehicle approaches the radar, the reflected wave is compressed in frequency (blue-shift); as it departs, it elongates (red-shift). At the Closest Point of Approach (CPA), Doppler crosses exactly zero with an analytical slope proportional to v²/(λ·d_cpa).',
        gatewayTitle: 'Why Standard TCP/IP Fails at 120 km/h and How SENDA Solves It',
        gatewayDesc: 'At 120 km/h, a vehicle traverses the coverage bubble of a radar or SOS pole in under 3 seconds. Standard TCP/IP + WPA3 + DHCP handshakes take over 3 seconds, causing connection failure. SENDA uses pre-signed 0-RTT autonomous bursts completing the transfer in under 20 milliseconds.',
        bridgeTitle: 'Catastrophic Scenario: Rail Derailment Rescued via Highway Data Mule',
        bridgeDesc: 'A passenger train derails in a rural cutting (Adamuz pattern) where cellular masts are dead. The ultrasonic acoustic beacon (19 kHz) and BLE signal is picked up by a passing car 120 m away. The vehicle acts as a DTN data mule and offloads the signed alert at the next DGT speed radar 2.3 km away, alerting 112 in 87 seconds.',
        kpiSpeed: 'Vehicle Speed',
        kpiDopplerMax: 'Max Doppler (+Blue)',
        kpiDopplerInstant: 'Instant Doppler',
        kpiCpaSlope: 'Slope at CPA',
        kpiTimeInRange: 'Time in RSU Bubble',
        kpiBurstTime: 'SENDA 0-RTT Burst',
        kpiTcpLatency: 'TCP/IP Handshake',
        kpiSafetyMargin: 'Safety Factor',
        formulaDoppler: 'f_d(t) = - (2·v·f_c / c) · [v·t / √(v²·t² + d_cpa²)]   |   df_d/dt|_cpa = - 2·v² / (λ·d_cpa)',
        formulaFmcw: 'f_beat = (2·B·R) / (c·T_chirp) + f_d   |   Range Resolution: ΔR = c / (2·B) = 0.15 m (1 GHz)',
        formula0rtt: 'T_tx = (Payload + Signature) · 8 / R_phy = 352 B · 8 / 1 Mbps = 2.8 ms  (18.5 ms with 3 copies)',
      },
      nl: {
        badge: 'VOERTUIG-GOLFFYSICA, FMCW-RADAR & V2I OPPORTUNISTISCHE GATEWAYS',
        title: 'Video-Fysica Synchronisatie: Golven, Doppler-effect en Multimodale Wegredding',
        lead: 'Waarom een rijdende auto nooit slechts een visueel object is: het is een oscillerend platform dat elektromagnetische golffronten comprimeert en uitrekt in interactie met radars en portalen. Ontdek hoe SENDA passerend verkeer omzet in deterministische datakoeriers om geïsoleerde trein- of wegongevallen zonder mobiel bereik in minder dan 90 seconden te redden.',
        tabs: [
          { id: 'V_TRACKING', tag: 'MODULE 1', title: 'Realtime Multi-Voertuig Tracking', shortDesc: 'YOLOX + ByteTrack op snelweg' },
          { id: 'V_DOPPLER_WAVES', tag: 'MODULE 2', title: 'Golffysica & Doppler-effect', shortDesc: 'S-curve & 24/77 GHz compressie' },
          { id: 'V_GATEWAY_0RTT', tag: 'MODULE 3', title: 'V2I-Gateway bij Snelheidsradars', shortDesc: '0-RTT burst zonder trage IP' },
          { id: 'V_RAIL_ROAD_BRIDGE', tag: 'MODULE 4', title: 'Trein-Auto-112 Catastrofebrug', shortDesc: 'Spoorongevalrelais zonder net' },
        ],
        trackTitle: 'Gelijktijdige Multi-Voertuig Tracking op Snelweg',
        trackDesc: 'De initiële testvideo van een vaste camera toont 1 auto in 30 seconden (parkeerterrein met lage dichtheid van Intel IoT DevKit). Onder reële snelwegomstandigheden volgt SENDA meerdere voertuigen tegelijkertijd, met afstands- en snelheidsbepaling zonder kentekens of gezichten.',
        dopplerTitle: 'Doppler-verschuiving bij Nadering van Verkeersradars (S-Curve)',
        dopplerDesc: 'Bij nadering van de radar wordt de gereflecteerde golf in frequentie gecomprimeerd (blauwverschuiving); bij het wegrijden rekt deze uit (roodverschuiving). Op het dichtste naderingspunt (CPA) kruist de Doppler exact nul met een analytische helling v²/(λ·d_cpa).',
        gatewayTitle: 'Waarom Klassiek TCP/IP Faalt bij 120 km/u en Hoe SENDA dit Oplost',
        gatewayDesc: 'Bij 120 km/u passeert een auto de dekkingsbubbel van een radar of praatpaal in minder dan 3 seconden. Een volledige TCP/IP + WPA3 + DHCP onderhandeling duurt meer dan 3 seconden en faalt. SENDA gebruikt 0-RTT autonome bursts die binnen 20 milliseconden voltooien.',
        bridgeTitle: 'Noodscenario: Treinontsporing Gered via Snelweg-Datakoerier',
        bridgeDesc: 'Een passagierstrein ontspoort in een afgelegen spoorinsnijding zonder mobiel bereik. Een ultrasoon baken (19 kHz) en BLE-signaal wordt opgevangen door een passerende auto op 120 m afstand. Het voertuig downloadt het alarm bij de volgende snelheidsradar op 2,3 km, waardoor meldkamer 112 binnen 87 seconden gealarmeerd is.',
        kpiSpeed: 'Voertuigsnelheid',
        kpiDopplerMax: 'Max Doppler (+Blauw)',
        kpiDopplerInstant: 'Actuele Doppler',
        kpiCpaSlope: 'Helling bij CPA',
        kpiTimeInRange: 'Tijd in Dekkingszone',
        kpiBurstTime: 'SENDA 0-RTT Burst',
        kpiTcpLatency: 'TCP/IP Handshake',
        kpiSafetyMargin: 'Veiligheidsfactor',
        formulaDoppler: 'f_d(t) = - (2·v·f_c / c) · [v·t / √(v²·t² + d_cpa²)]   |   df_d/dt|_cpa = - 2·v² / (λ·d_cpa)',
        formulaFmcw: 'f_beat = (2·B·R) / (c·T_chirp) + f_d   |   Bereikresolutie: ΔR = c / (2·B) = 0,15 m (1 GHz)',
        formula0rtt: 'T_tx = (Payload + Handtekening) · 8 / R_phy = 352 B · 8 / 1 Mbps = 2,8 ms  (18,5 ms met 3 kopieën)',
      },
    }[locale];
  }, [locale]);

  // Derived physics calculations
  const physics = useMemo(() => {
    const c = 299792458;
    const vMps = (carSpeedKmh * 1000) / 3600;
    const fcHz = radarFreqGhz * 1e9;
    const lambdaM = c / fcHz;
    const maxDopplerHz = (2 * vMps * fcHz) / c;
    const slopeCpa = -(2 * vMps * vMps) / (lambdaM * cpaDistanceM);

    // Instantaneous Doppler at simTimeSec
    const x = vMps * simTimeSec;
    const slantDistM = Math.sqrt(x * x + cpaDistanceM * cpaDistanceM);
    const cosTheta = slantDistM > 0 ? x / slantDistM : 0;
    const currentFdHz = -maxDopplerHz * cosTheta;

    // Gateway 0-RTT metrics
    const chordM = 2 * Math.sqrt(Math.max(0, rsuRadiusM * rsuRadiusM - cpaDistanceM * cpaDistanceM));
    const timeInRangeS = chordM / Math.max(0.1, vMps);
    const burstDurationMs = ((payloadBytes + 32) * 8 * 3) / 1e3; // 3 copies in ms at 1 Mbps
    const safetyFactor = (timeInRangeS * 1000) / Math.max(1, burstDurationMs);

    return {
      vMps: +vMps.toFixed(2),
      lambdaMm: +(lambdaM * 1000).toFixed(2),
      maxDopplerHz: Math.round(maxDopplerHz),
      currentFdHz: Math.round(currentFdHz),
      slopeCpa: Math.round(slopeCpa),
      slantDistM: +slantDistM.toFixed(1),
      chordM: +chordM.toFixed(1),
      timeInRangeS: +timeInRangeS.toFixed(2),
      burstDurationMs: +burstDurationMs.toFixed(1),
      safetyFactor: Math.round(safetyFactor),
    };
  }, [carSpeedKmh, radarFreqGhz, cpaDistanceM, simTimeSec, rsuRadiusM, payloadBytes]);

  // Multi-vehicle mock data for Tab 1
  const highwayVehicles = useMemo(() => {
    return [
      { id: 1, lane: 'Lane 1 (North)', type: 'Sedan', distM: 28, speedKmh: 118, ttcS: 4.8, fdHz: +5270, color: '#38bdf8' },
      { id: 2, lane: 'Lane 2 (North)', type: 'SUV', distM: 52, speedKmh: 124, ttcS: 6.2, fdHz: +5540, color: '#34d399' },
      { id: 3, lane: 'Lane 1 (North)', type: 'Van', distM: 84, speedKmh: 105, ttcS: 8.9, fdHz: +4690, color: '#fbbf24' },
      { id: 4, lane: 'Lane 3 (South)', type: 'Sedan (Oncoming)', distM: 45, speedKmh: 120, ttcS: 0.9, fdHz: -5360, color: '#ff7756' },
      { id: 5, lane: 'Lane 4 (South)', type: 'Truck (Oncoming)', distM: 110, speedKmh: 92, ttcS: 1.8, fdHz: -4110, color: '#b79cff' },
    ];
  }, []);

  return (
    <div className="v-doppler-lab" id="vehicular-doppler-lab" data-testid="vehicular-doppler-lab">
      {/* Header */}
      <div className="v-doppler-header">
        <span className="v-doppler-badge">{L.badge}</span>
        <h2 className="v-doppler-title">{L.title}</h2>
        <p className="v-doppler-subtitle">{L.lead}</p>
      </div>

      {/* Tabs */}
      <div className="v-doppler-nav" role="tablist">
        {L.tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`v-doppler-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <strong>{tab.tag}: </strong> {tab.title}
          </button>
        ))}
      </div>

      {/* Tab 1: Real Multi-Vehicle Tracking */}
      {activeTab === 'V_TRACKING' && (
        <div className="v-doppler-body">
          <div className="v-doppler-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.trackTitle}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.trackDesc}</p>

            <div className="v-doppler-kpis">
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">Vehículos Seguidos</div>
                <div className="v-doppler-kpi-val">5 <span className="v-doppler-kpi-unit">en cuadro</span></div>
              </div>
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">Calzada Contraria</div>
                <div className="v-doppler-kpi-val">2 <span className="v-doppler-kpi-unit">mulas DTN</span></div>
              </div>
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">K-Anonimato (DGT)</div>
                <div className="v-doppler-kpi-val">k ≥ 5 <span className="v-doppler-kpi-unit">garantizado</span></div>
              </div>
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">Detector IA</div>
                <div className="v-doppler-kpi-val">YOLOX <span className="v-doppler-kpi-unit">ONNX / CPU</span></div>
              </div>
            </div>

            {/* Visual multi-vehicle road canvas */}
            <div className="v-doppler-canvas-wrap" style={{ height: '240px' }}>
              <svg width="100%" height="100%" viewBox="0 0 800 240" style={{ display: 'block' }}>
                {/* Motorway tarmac */}
                <rect x="0" y="20" width="800" height="200" fill="#0b1722" />
                <line x1="0" y1="70" x2="800" y2="70" stroke="#1e3547" strokeDasharray="12 8" strokeWidth="2" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="#f1f5f9" strokeWidth="3" />
                <line x1="0" y1="170" x2="800" y2="170" stroke="#1e3547" strokeDasharray="12 8" strokeWidth="2" />

                {/* Radar Mast / CCTV Pole */}
                <circle cx="400" cy="12" r="8" fill="#38bdf8" />
                <text x="400" y="8" fill="#91d7e8" fontSize="10" textAnchor="middle" fontFamily="monospace">RADAR DGT / RSU</text>

                {/* Vehicles on highway */}
                {highwayVehicles.map((v) => {
                  const isSelected = selectedVehicleId === v.id;
                  const isNorth = v.lane.includes('North');
                  // Animate x based on simTimeSec
                  const baseX = isNorth ? 150 + v.id * 100 : 700 - v.id * 80;
                  const currentX = ((baseX + (isNorth ? 1 : -1) * simTimeSec * 40) % 760 + 760) % 760 + 20;
                  const currentY = isNorth ? (v.lane.includes('1') ? 45 : 95) : (v.lane.includes('3') ? 145 : 195);

                  return (
                    <g key={v.id} onClick={() => setSelectedVehicleId(v.id)} style={{ cursor: 'pointer' }}>
                      {/* Bounding Box */}
                      <rect
                        x={currentX - 25}
                        y={currentY - 14}
                        width="50"
                        height="28"
                        rx="6"
                        fill={isSelected ? 'rgba(56,189,248,0.3)' : 'rgba(15,23,42,0.85)'}
                        stroke={isSelected ? '#38bdf8' : v.color}
                        strokeWidth={isSelected ? 3 : 1.5}
                      />
                      {/* Direction vector */}
                      <line
                        x1={currentX + (isNorth ? 25 : -25)}
                        y1={currentY}
                        x2={currentX + (isNorth ? 42 : -42)}
                        y2={currentY}
                        stroke={v.color}
                        strokeWidth="2"
                        markerEnd="url(#arrow)"
                      />
                      {/* Vehicle Label */}
                      <text x={currentX} y={currentY + 4} fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">
                        V{v.id}
                      </text>
                      {/* Telemetry pill */}
                      <text x={currentX} y={currentY - 18} fill={v.color} fontSize="9" textAnchor="middle" fontFamily="monospace">
                        {v.speedKmh} km/h | {v.fdHz > 0 ? `+${v.fdHz}` : v.fdHz} Hz
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected vehicle telemetry details */}
            <div style={{ marginTop: '14px', background: '#0b1722', border: '1px solid #1e3547', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong style={{ color: '#38bdf8' }}>Vehículo Seleccionado: V{selectedVehicleId}</strong>
                <span style={{ marginLeft: '12px', fontSize: '13px', color: '#94a3b8' }}>
                  {highwayVehicles.find(v => v.id === selectedVehicleId)?.lane} · Tipo: {highwayVehicles.find(v => v.id === selectedVehicleId)?.type}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontFamily: 'monospace', fontSize: '13px' }}>
                <span>Distancia: <b style={{ color: '#f8fafc' }}>{highwayVehicles.find(v => v.id === selectedVehicleId)?.distM} m</b></span>
                <span>TTC Freno: <b style={{ color: '#34d399' }}>{highwayVehicles.find(v => v.id === selectedVehicleId)?.ttcS} s</b></span>
                <span>Doppler: <b style={{ color: '#38bdf8' }}>{highwayVehicles.find(v => v.id === selectedVehicleId)?.fdHz} Hz</b></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wave Physics & Doppler Effect */}
      {activeTab === 'V_DOPPLER_WAVES' && (
        <div className="v-doppler-body">
          <div className="v-doppler-grid-2">
            {/* Wave animation and S-curve */}
            <div className="v-doppler-card">
              <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.dopplerTitle}</h3>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.dopplerDesc}</p>

              <div className="v-doppler-formula-box">
                {L.formulaDoppler}
              </div>

              {/* Animated Wavefronts and Car SVG */}
              <div className="v-doppler-canvas-wrap" style={{ height: '220px' }}>
                <svg width="100%" height="100%" viewBox="0 0 450 220" style={{ display: 'block' }}>
                  {/* Radar Origin */}
                  <circle cx="225" cy="40" r="10" fill="#38bdf8" />
                  <text x="225" y="24" fill="#91d7e8" fontSize="10" textAnchor="middle" fontFamily="monospace">Radar 24 GHz</text>

                  {/* Concentric waves propagating */}
                  {[30, 60, 90, 120, 150].map((r, i) => (
                    <circle
                      key={i}
                      cx="225"
                      cy="40"
                      r={r + ((simTimeSec * 40) % 30)}
                      fill="none"
                      stroke="rgba(56,189,248,0.25)"
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* Road */}
                  <rect x="0" y="140" width="450" height="60" fill="#0c1924" />
                  <line x1="0" y1="170" x2="450" y2="170" stroke="#1e3547" strokeDasharray="8 6" strokeWidth="2" />

                  {/* Moving Car */}
                  {(() => {
                    const carX = 225 + simTimeSec * 70;
                    const isApproaching = simTimeSec < 0;
                    return (
                      <g transform={`translate(${carX}, 170)`}>
                        <rect x="-24" y="-12" width="48" height="24" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                        <text x="0" y="4" fill="#f8fafc" fontSize="10" textAnchor="middle" fontWeight="bold">COCHE</text>
                        {/* Doppler wave compression indicator */}
                        {isApproaching ? (
                          <g>
                            <path d="M 28 -8 Q 36 0 28 8" stroke="#38bdf8" strokeWidth="2" fill="none" />
                            <path d="M 34 -12 Q 44 0 34 12" stroke="#38bdf8" strokeWidth="2" fill="none" />
                            <text x="50" y="4" fill="#38bdf8" fontSize="9" fontFamily="monospace">+Δf</text>
                          </g>
                        ) : (
                          <g>
                            <path d="M -28 -14 Q -44 0 -28 14" stroke="#ff7756" strokeWidth="2" fill="none" />
                            <text x="-56" y="4" fill="#ff7756" fontSize="9" fontFamily="monospace">-Δf</text>
                          </g>
                        )}
                        {/* LoS ray to radar */}
                        <line x1="0" y1="-12" x2={225 - carX} y2={-130} stroke="rgba(251,191,36,0.6)" strokeDasharray="3 3" />
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Interactive S-Curve Plot & Controls */}
            <div className="v-doppler-card">
              <h4 style={{ margin: '0 0 12px 0', color: '#f8fafc' }}>Firma Espectral Doppler f_d(t) en Tiempo Real</h4>

              <div className="v-doppler-kpis">
                <div className="v-doppler-kpi">
                  <div className="v-doppler-kpi-label">{L.kpiDopplerInstant}</div>
                  <div className="v-doppler-kpi-val">{physics.currentFdHz > 0 ? `+${physics.currentFdHz}` : physics.currentFdHz} <span className="v-doppler-kpi-unit">Hz</span></div>
                </div>
                <div className="v-doppler-kpi">
                  <div className="v-doppler-kpi-label">{L.kpiDopplerMax}</div>
                  <div className="v-doppler-kpi-val">+{physics.maxDopplerHz} <span className="v-doppler-kpi-unit">Hz</span></div>
                </div>
                <div className="v-doppler-kpi">
                  <div className="v-doppler-kpi-label">{L.kpiCpaSlope}</div>
                  <div className="v-doppler-kpi-val">{physics.slopeCpa} <span className="v-doppler-kpi-unit">Hz/s</span></div>
                </div>
              </div>

              {/* S-curve chart SVG */}
              <div className="v-doppler-canvas-wrap" style={{ height: '140px', marginBottom: '14px' }}>
                <svg width="100%" height="100%" viewBox="0 0 400 140" style={{ display: 'block' }}>
                  {/* Axis */}
                  <line x1="40" y1="70" x2="380" y2="70" stroke="#334155" strokeWidth="1" />
                  <line x1="210" y1="15" x2="210" y2="125" stroke="#334155" strokeWidth="1" />
                  <text x="380" y="65" fill="#64748b" fontSize="9" textAnchor="end">t (s)</text>
                  <text x="215" y="25" fill="#64748b" fontSize="9">f_d = 0</text>

                  {/* S-curve line: f_d(t) */}
                  <path
                    d={`M 50 25 C 150 25, 170 35, 210 70 C 250 105, 270 115, 370 115`}
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    fill="none"
                  />

                  {/* Current Position Marker */}
                  {(() => {
                    const markerX = 210 + (simTimeSec / 2.5) * 150;
                    // Normalized Y position on S-curve
                    const normY = 70 - (physics.currentFdHz / Math.max(1, physics.maxDopplerHz)) * 45;
                    return (
                      <g>
                        <circle cx={markerX} cy={normY} r="5" fill="#fbbf24" stroke="#000" strokeWidth="1.5" />
                        <line x1={markerX} y1="15" x2={markerX} y2="125" stroke="#fbbf24" strokeDasharray="2 2" strokeWidth="1" />
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* Parameter Controls */}
              <div className="v-doppler-controls">
                <div className="v-doppler-control-row">
                  <label>{L.kpiSpeed}: {carSpeedKmh} km/h</label>
                  <input
                    type="range"
                    min="40"
                    max="180"
                    step="5"
                    value={carSpeedKmh}
                    onChange={(e) => setCarSpeedKmh(+e.target.value)}
                  />
                </div>
                <div className="v-doppler-control-row">
                  <label>Distancia Lateral CPA: {cpaDistanceM} m</label>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="1"
                    value={cpaDistanceM}
                    onChange={(e) => setCpaDistanceM(+e.target.value)}
                  />
                </div>
                <div className="v-doppler-control-row">
                  <label>Frecuencia Portadora Radar:</label>
                  <select
                    value={radarFreqGhz}
                    onChange={(e) => setRadarFreqGhz(+e.target.value)}
                  >
                    <option value={24.125}>24.125 GHz (Radar K-Band DGT)</option>
                    <option value={77.0}>77.0 GHz (Radar Automotriz FMCW)</option>
                    <option value={5.9}>5.9 GHz (C-V2X Sidelink PC5)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Roadside Gateway 0-RTT Burst */}
      {activeTab === 'V_GATEWAY_0RTT' && (
        <div className="v-doppler-body">
          <div className="v-doppler-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.gatewayTitle}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.gatewayDesc}</p>

            <div className="v-doppler-formula-box">
              {L.formula0rtt}
            </div>

            <div className="v-doppler-kpis">
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">{L.kpiTimeInRange}</div>
                <div className="v-doppler-kpi-val">{physics.timeInRangeS} <span className="v-doppler-kpi-unit">segundos</span></div>
              </div>
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">{L.kpiBurstTime}</div>
                <div className="v-doppler-kpi-val" style={{ color: '#34d399' }}>{physics.burstDurationMs} <span className="v-doppler-kpi-unit">ms</span></div>
              </div>
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">{L.kpiTcpLatency}</div>
                <div className="v-doppler-kpi-val" style={{ color: '#ff7756' }}>&gt; 3 000 <span className="v-doppler-kpi-unit">ms (FALLA)</span></div>
              </div>
              <div className="v-doppler-kpi">
                <div className="v-doppler-kpi-label">{L.kpiSafetyMargin}</div>
                <div className="v-doppler-kpi-val" style={{ color: '#38bdf8' }}>{physics.safetyFactor}× <span className="v-doppler-kpi-unit">holgura</span></div>
              </div>
            </div>

            {/* Visual Comparison: Traditional TCP/IP vs SENDA 0-RTT */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#0b1722', border: '1px solid #1e3547', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#ff7756' }}>Modelo Clásico (Wi-Fi + DHCP + TCP Handshake + TLS 1.3): INVIABLE</strong>
                  <span style={{ color: '#ff7756', fontFamily: 'monospace' }}>Tiempo Requerido: 3.2 s &gt; {physics.timeInRangeS} s disponibles</span>
                </div>
                <div style={{ height: '14px', background: '#1e293b', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: '100%', height: '100%', background: '#ff7756', opacity: 0.8 }} />
                </div>
                <small style={{ color: '#94a3b8', display: 'block', marginTop: '6px' }}>El vehículo abandona el lóbulo de la antena antes de completar la autenticación. 0 bytes entregados.</small>
              </div>

              <div style={{ background: '#0b1722', border: '1px solid #1e3547', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#34d399' }}>Protocolo SENDA 0-RTT Sidelink Autonomous Burst (Firma Ed25519)</strong>
                  <span style={{ color: '#34d399', fontFamily: 'monospace' }}>Tiempo Requerido: {physics.burstDurationMs} ms &lt;&lt; {physics.timeInRangeS} s</span>
                </div>
                <div style={{ height: '14px', background: '#1e293b', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${Math.min(100, (physics.burstDurationMs / (physics.timeInRangeS * 10)) * 100)}%`, height: '100%', background: '#34d399' }} />
                </div>
                <small style={{ color: '#94a3b8', display: 'block', marginTop: '6px' }}>Paquete pre-autenticado emitido sin negociación. Entrega confirmada con 3 copias redundantes en {physics.burstDurationMs} ms.</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cross-Modal Rail-to-Road Catastrophe Bridge */}
      {activeTab === 'V_RAIL_ROAD_BRIDGE' && (
        <div className="v-doppler-body">
          <div className="v-doppler-card">
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{L.bridgeTitle}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>{L.bridgeDesc}</p>

            {/* Stepper buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
              {[
                { step: 0, label: 'T=0s: Impacto Tren' },
                { step: 1, label: 'T=1s: Baliza Ultrasónica' },
                { step: 2, label: 'T=2s: Interceptación Coche' },
                { step: 3, label: 'T=85s: Mula DTN en Carretera' },
                { step: 4, label: 'T=87s: Descarga Radar DGT y 112' },
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setIncidentStep(s.step)}
                  className={`v-doppler-tab-btn ${incidentStep === s.step ? 'active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Animated SVG Diagram of the Cross-Modal Scene */}
            <div className="v-doppler-canvas-wrap" style={{ height: '260px' }}>
              <svg width="100%" height="100%" viewBox="0 0 800 260" style={{ display: 'block' }}>
                {/* Railway Track in Cutting */}
                <rect x="0" y="200" width="800" height="40" fill="#1e293b" />
                <line x1="0" y1="210" x2="800" y2="210" stroke="#64748b" strokeWidth="2" />
                <line x1="0" y1="230" x2="800" y2="230" stroke="#64748b" strokeWidth="2" />
                <text x="50" y="225" fill="#94a3b8" fontSize="10" fontFamily="monospace">VÍA FÉRREA (EN TRINCHERA - SIN COBERTURA CELULAR)</text>

                {/* Derailed Train at x=120 */}
                <rect x="100" y="204" width="70" height="32" rx="4" fill="#dc2626" stroke="#f87171" strokeWidth="2" />
                <text x="135" y="224" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">TREN</text>

                {/* Embankment / Terrain Ridge between Railway and Road */}
                <path d="M 0 180 Q 200 160 400 175 T 800 165 L 800 195 L 0 195 Z" fill="#0f172a" stroke="#1e293b" />

                {/* Roadway (Parallel at 120m) */}
                <rect x="0" y="60" width="800" height="50" fill="#09141f" />
                <line x1="0" y1="85" x2="800" y2="85" stroke="#334155" strokeDasharray="10 8" strokeWidth="2" />
                <text x="50" y="52" fill="#94a3b8" fontSize="10" fontFamily="monospace">CARRETERA PARALELA A-12 / N-320 (A 120 METROS)</text>

                {/* Ultrasonic / BLE Emission Ripples from Train (Steps 1+) */}
                {incidentStep >= 1 && (
                  <g>
                    <circle cx="135" cy="220" r="40" fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="135" cy="220" r="90" fill="none" stroke="rgba(251,191,36,0.3)" strokeWidth="2" />
                    <circle cx="135" cy="220" r="140" fill="none" stroke="rgba(251,191,36,0.2)" strokeWidth="1.5" />
                    <text x="145" y="150" fill="#fbbf24" fontSize="10" fontFamily="monospace">Baliza 19 kHz + BLE (SNR +14 dB)</text>
                  </g>
                )}

                {/* Passing Car position according to step */}
                {(() => {
                  let carX = 60;
                  if (incidentStep === 1) carX = 110;
                  if (incidentStep === 2) carX = 150;
                  if (incidentStep === 3) carX = 420;
                  if (incidentStep === 4) carX = 720;

                  return (
                    <g transform={`translate(${carX}, 85)`}>
                      <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                      <text x="0" y="4" fill="#38bdf8" fontSize="9" textAnchor="middle" fontWeight="bold">COCHE</text>
                      {incidentStep >= 2 && (
                        <circle cx="0" cy="-14" r="5" fill="#34d399" />
                      )}
                    </g>
                  );
                })()}

                {/* Radar Gateway at x=730 (Step 4) */}
                <g transform="translate(730, 45)">
                  <circle cx="0" cy="0" r="10" fill="#38bdf8" />
                  <line x1="0" y1="10" x2="0" y2="40" stroke="#38bdf8" strokeWidth="3" />
                  <text x="0" y="-12" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="monospace">RADAR DGT (km 144,8)</text>
                  <text x="0" y="55" fill="#34d399" fontSize="9" textAnchor="middle">Troncal Fibra/112</text>
                  {incidentStep === 4 && (
                    <circle cx="0" cy="0" r="45" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="3 3" />
                  )}
                </g>
              </svg>
            </div>

            {/* Step-by-Step Chronology Cards */}
            <div style={{ marginTop: '16px' }}>
              <div className={`v-doppler-timeline-step ${incidentStep === 0 ? 'active' : ''}`}>
                <span className="v-doppler-time-tag">T = 0.0 s</span>
                <div className="v-doppler-step-content">
                  <strong>Impacto y Descarrilamiento de Tren en Trinchera Rural</strong>
                  <p>El convoy se detiene en un corte de terreno sin visibilidad hacia las antenas celulares lejanas. La red comercial no da servicio.</p>
                </div>
              </div>

              <div className={`v-doppler-timeline-step ${incidentStep === 1 ? 'active' : ''}`}>
                <span className="v-doppler-time-tag">T = 0.5 s</span>
                <div className="v-doppler-step-content">
                  <strong>Activación Automática de Baliza Acústica Ultrasónica (19 kHz) y BLE</strong>
                  <p>La unidad de control del tren emite pulsos en banda no audible por humanos donde el ruido de la carretera decae según 1/f², logrando SNR &gt; +14 dB a 120 m.</p>
                </div>
              </div>

              <div className={`v-doppler-timeline-step ${incidentStep === 2 ? 'active' : ''}`}>
                <span className="v-doppler-time-tag">T = 2.1 s</span>
                <div className="v-doppler-step-content">
                  <strong>Interceptación por Móvil/Dashcam de Coche en Tránsito</strong>
                  <p>Un turismo que circula a 100 km/h por la carretera paralela capta la baliza, valida la firma criptográfica y empaqueta el incidente en su cola local DTN.</p>
                </div>
              </div>

              <div className={`v-doppler-timeline-step ${incidentStep === 3 ? 'active' : ''}`}>
                <span className="v-doppler-time-tag">T = 85.0 s</span>
                <div className="v-doppler-step-content">
                  <strong>Transporte Vehicular DTN a lo Largo de 2,3 km</strong>
                  <p>El coche recorre la distancia física a velocidad constante transportando el sobre sellado de emergencia hacia la primera infraestructura conectada.</p>
                </div>
              </div>

              <div className={`v-doppler-timeline-step ${incidentStep === 4 ? 'active' : ''}`}>
                <span className="v-doppler-time-tag">T = 87.0 s</span>
                <div className="v-doppler-step-content">
                  <strong>Descarga 0-RTT en Radar DGT y Alerta en Sala 112</strong>
                  <p>Al cruzar el pórtico del radar de velocidad, el coche inyecta la ráfaga de 18,5 ms. El radar reenvía el bundle CAP por su fibra troncal hacia la central de emergencias.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
