'use client';
import { useMemo, useState, useEffect } from 'react';
import type { Locale } from './copy';
import './acoustic-sentinel-survival-lab.css';

export default function AcousticSentinelSurvivalLab({ locale }: { locale: Locale }) {
  const [activeTab, setActiveTab] = useState<'BEAMFORMING' | 'SENTINEL_GATEWAY' | 'SURVIVAL_KIT'>('BEAMFORMING');

  // Controls for Beamforming & Acoustic Camera
  const [micPattern, setMicPattern] = useState<'CARDIOID' | 'SUPERCARDIOID' | 'HYPERCARDIOID' | 'SHOTGUN' | 'ARRAY_4X'>('HYPERCARDIOID');
  const [targetFreqHz, setTargetFreqHz] = useState<number>(1400); // UAV rotor harmonic
  const [steerAzimuthDeg, setSteerAzimuthDeg] = useState<number>(45);
  const [steerElevationDeg, setSteerElevationDeg] = useState<number>(30);

  // Simulation tick
  const [simTick, setSimTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSimTick((prev) => (prev >= 360 ? 0 : +(prev + 1).toFixed(1)));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Controls for Survival Kit
  const [droneDistanceM, setDroneDistanceM] = useState<number>(75);
  const [droneAzimuthDeg, setDroneAzimuthDeg] = useState<number>(130);
  const [beaconActive, setBeaconActive] = useState<boolean>(true);

  // Trilingual texts
  const T = useMemo(() => {
    return {
      es: {
        badge: 'DEFENSA ESPACIAL ACÚSTICA, HARDWARE CENTINELA COTS Y KIT DE SUPERVIVENCIA',
        title: 'Cámara Acústica 3D, Beamforming y Centinelas COTS (< 12 €)',
        desc: 'Tecnología para transformar micrófonos cardioides, hipercardioides, tubos shotgun y matrices MEMS en un radar acústico directivo capaz de dibujar mapas espectrales 2D/3D y dotar a la población de un kit digital de supervivencia desconectado ante cualquier accidente o conflicto.',
        tabs: {
          beamforming: '1. Cámara Acústica y Beamforming',
          sentinel: '2. Centinela Gateway COTS (< 12 €)',
          survival: '3. Kit Digital de Supervivencia'
        },
        controls: {
          pattern: 'Patrón Acústico / Tipo de Sensor',
          freq: 'Frecuencia de Análisis (Firma BPF / Armónico)',
          steerAz: 'Apuntamiento Azimutal Electrónico',
          steerEl: 'Elevación del Haz'
        },
        telemetry: {
          patternTitle: 'Directividad y Ganancia Espacial',
          di: 'Índice de Directividad (DI)',
          frontToBack: 'Rechazo Trasero (180°)',
          snrBoost: 'Ganancia de Relación Señal/Ruido (SNR)',
          bandwidth: 'Resolución Espacial a 100 m'
        },
        bomTitle: 'Lista de Materiales Oficial (BOM COTS < 12 €)',
        bomLead: 'Nodo centinela reproducible con componentes de AliExpress, LCSC o ferretería electrónica local:',
        survival: {
          bannerCritical: 'AMENAZA CRÍTICA INMINENTE: UAV a baja cota detectado',
          bannerMedium: 'ALERTA PREVENTIVA: UAV en aproximación acústica',
          bannerLow: 'PERÍMETRO SEGURO: Sin firmas armónicas de rotores',
          dist: 'Distancia Estimada al UAV',
          evasionAz: 'Azimut Recomendado de Evasión (Ruta Silenciosa)',
          timeToCover: 'Tiempo Estimado de Intercepción',
          beaconStatus: 'Baliza de Rescate Ultrasónica (19.5 - 20.5 kHz)',
          beaconActive: 'EMITIENDO SOCORRO INAUDIBLE (ECDSA P-256)',
          beaconStandby: 'EN ESPERA SILENCIOSA'
        }
      },
      en: {
        badge: 'ACOUSTIC SPATIAL DEFENSE, COTS SENTINEL HARDWARE & DIGITAL SURVIVAL KIT',
        title: '3D Acoustic Camera, Spatial Beamforming & COTS Gateways (< €12)',
        desc: 'Technology transforming cardioid, hypercardioid, shotgun microphones and MEMS arrays into a directional acoustic radar capable of rendering 2D/3D spectro-spatial heatmaps and providing civilians with an offline digital survival kit during crises or conflicts.',
        tabs: {
          beamforming: '1. Acoustic Camera & Beamforming',
          sentinel: '2. COTS Sentinel Gateway (< €12)',
          survival: '3. Digital Survival Kit'
        },
        controls: {
          pattern: 'Acoustic Pattern / Sensor Type',
          freq: 'Analysis Frequency (BPF Harmonic)',
          steerAz: 'Electronic Azimuth Steering',
          steerEl: 'Beam Elevation'
        },
        telemetry: {
          patternTitle: 'Directivity & Spatial Gain',
          di: 'Directivity Index (DI)',
          frontToBack: 'Rear Rejection (180°)',
          snrBoost: 'SNR Processing Gain',
          bandwidth: 'Spatial Resolution at 100 m'
        },
        bomTitle: 'Official Bill of Materials (COTS BOM < €12)',
        bomLead: 'Reproducible sentinel gateway node using components from AliExpress, LCSC or electronic retail:',
        survival: {
          bannerCritical: 'CRITICAL THREAT: Low-altitude hostile UAV detected',
          bannerMedium: 'PREVENTIVE ALERT: Approaching acoustic signature',
          bannerLow: 'SECURE PERIMETER: No rotor harmonics detected',
          dist: 'Estimated UAV Distance',
          evasionAz: 'Recommended Evasion Azimuth (Silent Path)',
          timeToCover: 'Estimated Time to Intercept',
          beaconStatus: 'Ultrasonic Rescue Beacon (19.5 - 20.5 kHz)',
          beaconActive: 'TRANSMITTING INAUDIBLE SOS (ECDSA P-256)',
          beaconStandby: 'STANDBY SILENT MODE'
        }
      },
      nl: {
        badge: 'AKOESTISCHE RUIMTELIJKE DEFENSIE, COTS SENTINEL HARDWARE & DIGITALE OVERLEVINGSKIT',
        title: '3D Akoestische Camera, Spatial Beamforming & COTS Gateways (< €12)',
        desc: 'Technologie om cardioïde, hypercardioïde, shotgunmicrofoons en MEMS-arrays om te vormen tot een directionele akoestische radar die 2D/3D spectro-ruimtelijke warmtekaarten tekent en burgers voorziet van een offline overlevingskit.',
        tabs: {
          beamforming: '1. Akoestische Camera & Beamforming',
          sentinel: '2. COTS Sentinel Gateway (< €12)',
          survival: '3. Digitale Overlevingskit'
        },
        controls: {
          pattern: 'Akoestisch Patroon / Sensortype',
          freq: 'Analysefrequentie (BPF Harmonie)',
          steerAz: 'Elektronische Azimutsturing',
          steerEl: 'Bundelhoogte'
        },
        telemetry: {
          patternTitle: 'Directiviteit & Ruimtelijke Winst',
          di: 'Directiviteitsindex (DI)',
          frontToBack: 'Achterwaartse Demping (180°)',
          snrBoost: 'SNR-verwerkingswinst',
          bandwidth: 'Ruimtelijke Resolutie op 100 m'
        },
        bomTitle: 'Officiële Materiaallijst (COTS BOM < €12)',
        bomLead: 'Reproduceerbaar sentinel-knooppunt gebouwd met AliExpress- en elektronicacomponenten:',
        survival: {
          bannerCritical: 'KRITIEKE DREIGING: Laagvliegende vijandige UAV gedetecteerd',
          bannerMedium: 'VOORZORGSALARM: Naderende akoestische signatuur',
          bannerLow: 'VEILIGE PERIMETER: Geen rotorharmonieën gedetecteerd',
          dist: 'Geschatte Afstand tot UAV',
          evasionAz: 'Aanbevolen Uitwijkingsazimut (Stille Route)',
          timeToCover: 'Geschatte Onderscheppingstijd',
          beaconStatus: 'Ultrasoon Reddingsbaken (19.5 - 20.5 kHz)',
          beaconActive: 'ZENDT ONHOORBAAR SOS UIT (ECDSA P-256)',
          beaconStandby: 'STAND-BY STILLE MODUS'
        }
      }
    }[locale];
  }, [locale]);

  // Polar response calculation
  const polarData = useMemo(() => {
    let di = '4.77 dB';
    let f2b = '-∞ dB';
    let snr = '+12.5 dB';
    let res = '18.5 m';

    if (micPattern === 'HYPERCARDIOID') {
      di = '6.02 dB';
      f2b = '-6.0 dB';
      snr = '+15.2 dB';
      res = '14.0 m';
    } else if (micPattern === 'SUPERCARDIOID') {
      di = '5.72 dB';
      f2b = '-11.7 dB';
      snr = '+14.1 dB';
      res = '15.2 m';
    } else if (micPattern === 'SHOTGUN') {
      di = '9.80 dB';
      f2b = '-20.6 dB';
      snr = '+18.4 dB';
      res = '6.8 m';
    } else if (micPattern === 'ARRAY_4X') {
      di = '12.04 dB';
      f2b = '-24.0 dB';
      snr = '+21.5 dB';
      res = '4.2 m';
    }

    return { di, f2b, snr, res };
  }, [micPattern]);

  // Survival calculations
  const survivalData = useMemo(() => {
    let level: 'CRITICAL' | 'MEDIUM' | 'LOW' = 'LOW';
    if (droneDistanceM < 90) level = 'CRITICAL';
    else if (droneDistanceM < 260) level = 'MEDIUM';

    // Evasion is opposite to drone azimuth (+180°)
    let evasionAz = (droneAzimuthDeg + 180) % 360;
    const timeToCover = level !== 'LOW' ? +(droneDistanceM / 18.0).toFixed(1) : 99.9;

    return { level, evasionAz, timeToCover };
  }, [droneDistanceM, droneAzimuthDeg]);

  return (
    <section className="sentinel-lab-card" aria-label="Acoustic Sentinel Survival Lab">
      <div className="sentinel-badge">{T.badge}</div>
      <h2 className="sentinel-title">{T.title}</h2>
      <p className="sentinel-desc">{T.desc}</p>

      {/* Tabs */}
      <div className="sentinel-tabs" role="tablist">
        <button
          className={`sentinel-tab-btn ${activeTab === 'BEAMFORMING' ? 'active' : ''}`}
          onClick={() => setActiveTab('BEAMFORMING')}
          role="tab"
          aria-selected={activeTab === 'BEAMFORMING'}
        >
          {T.tabs.beamforming}
        </button>
        <button
          className={`sentinel-tab-btn ${activeTab === 'SENTINEL_GATEWAY' ? 'active' : ''}`}
          onClick={() => setActiveTab('SENTINEL_GATEWAY')}
          role="tab"
          aria-selected={activeTab === 'SENTINEL_GATEWAY'}
        >
          {T.tabs.sentinel}
        </button>
        <button
          className={`sentinel-tab-btn ${activeTab === 'SURVIVAL_KIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('SURVIVAL_KIT')}
          role="tab"
          aria-selected={activeTab === 'SURVIVAL_KIT'}
        >
          {T.tabs.survival}
        </button>
      </div>

      {/* TAB 1: BEAMFORMING & ACOUSTIC CAMERA */}
      {activeTab === 'BEAMFORMING' && (
        <div className="sentinel-grid-2col">
          <div className="sentinel-panel">
            <h3>🎛️ {T.controls.pattern}</h3>

            <div className="control-group">
              <label>
                <span>{T.controls.pattern}</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{micPattern}</span>
              </label>
              <select
                value={micPattern}
                onChange={(e) => setMicPattern(e.target.value as any)}
              >
                <option value="CARDIOID">Cardioide Clásico (α = 0.50, DI = 4.8 dB)</option>
                <option value="SUPERCARDIOID">Supercardioide Focalizado (α = 0.634, DI = 5.7 dB)</option>
                <option value="HYPERCARDIOID">Hipercardioide Táctico (α = 0.75, DI = 6.0 dB)</option>
                <option value="SHOTGUN">Tubo de Interferencia Shotgun (25 cm, DI = 9.8 dB)</option>
                <option value="ARRAY_4X">Array MEMS 4x I2S Delay-and-Sum (DI = 12.0 dB)</option>
              </select>
            </div>

            <div className="control-group">
              <label>
                <span>{T.controls.freq}</span>
                <span>{targetFreqHz} Hz</span>
              </label>
              <input
                type="range"
                min="250"
                max="4000"
                step="50"
                value={targetFreqHz}
                onChange={(e) => setTargetFreqHz(+e.target.value)}
              />
            </div>

            <div className="control-group">
              <label>
                <span>{T.controls.steerAz}</span>
                <span>{steerAzimuthDeg}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={steerAzimuthDeg}
                onChange={(e) => setSteerAzimuthDeg(+e.target.value)}
              />
            </div>

            <div className="control-group">
              <label>
                <span>{T.controls.steerEl}</span>
                <span>{steerElevationDeg}°</span>
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={steerElevationDeg}
                onChange={(e) => setSteerElevationDeg(+e.target.value)}
              />
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <div className="telemetry-row">
                <span className="telemetry-label">{T.telemetry.di}</span>
                <span className="telemetry-val">{polarData.di}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">{T.telemetry.frontToBack}</span>
                <span className="telemetry-val">{polarData.f2b}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">{T.telemetry.snrBoost}</span>
                <span className="telemetry-val" style={{ color: '#4ade80' }}>{polarData.snr}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">{T.telemetry.bandwidth}</span>
                <span className="telemetry-val">{polarData.res}</span>
              </div>
            </div>
          </div>

          <div className="sentinel-panel">
            <h3>📷 Cámara Acústica 2D / Heatmap Espectro-Espacial</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>
              Proyección visual del gradiente acústico centrado en el dron detectado a {targetFreqHz} Hz:
            </p>

            <div className="polar-svg-container">
              <svg width="280" height="280" viewBox="-140 -140 280 280">
                {/* Background radar grid */}
                <circle cx="0" cy="0" r="120" fill="none" stroke="#1e293b" strokeWidth="1" />
                <circle cx="0" cy="0" r="90" fill="none" stroke="#1e293b" strokeWidth="1" />
                <circle cx="0" cy="0" r="60" fill="none" stroke="#1e293b" strokeWidth="1" />
                <circle cx="0" cy="0" r="30" fill="none" stroke="#1e293b" strokeWidth="1" />
                <line x1="-130" y1="0" x2="130" y2="0" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="-130" x2="0" y2="130" stroke="#1e293b" strokeWidth="1" />

                {/* Steered Acoustic Beam Lobe */}
                {(() => {
                  const rad = (steerAzimuthDeg * Math.PI) / 180;
                  const bx = Math.sin(rad) * 95;
                  const by = -Math.cos(rad) * 95;
                  return (
                    <g>
                      {/* Main Beam Lobe Envelope */}
                      <path
                        d={`M 0 0 Q ${bx * 0.7 - by * 0.3} ${by * 0.7 + bx * 0.3} ${bx} ${by} Q ${bx * 0.7 + by * 0.3} ${by * 0.7 - bx * 0.3} 0 0 Z`}
                        fill="rgba(56, 189, 248, 0.25)"
                        stroke="#38bdf8"
                        strokeWidth="2"
                      />
                      {/* Target Acoustic Hotspot */}
                      <circle cx={bx} cy={by} r="14" fill="rgba(239, 68, 68, 0.4)" stroke="#ef4444" strokeWidth="2">
                        <animate attributeName="r" values="10;18;10" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={bx} cy={by} r="4" fill="#ffffff" />
                      <text x={bx + 12} y={by + 4} fill="#fca5a5" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        UAV · {targetFreqHz}Hz
                      </text>
                    </g>
                  );
                })()}

                {/* Compass markers */}
                <text x="0" y="-124" fill="#64748b" fontSize="9" textAnchor="middle">0° N</text>
                <text x="124" y="3" fill="#64748b" fontSize="9" textAnchor="start">90° E</text>
                <text x="0" y="132" fill="#64748b" fontSize="9" textAnchor="middle">180° S</text>
                <text x="-124" y="3" fill="#64748b" fontSize="9" textAnchor="end">270° W</text>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SENTINEL GATEWAY COTS */}
      {activeTab === 'SENTINEL_GATEWAY' && (
        <div>
          <div className="sentinel-panel" style={{ marginBottom: '1.5rem' }}>
            <h3>🛠️ {T.bomTitle}</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{T.bomLead}</p>

            <table className="bom-table">
              <thead>
                <tr>
                  <th>Componente COTS</th>
                  <th>Modelo y Prestaciones</th>
                  <th>Rol Táctico</th>
                  <th>Coste (EUR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>ESP32-S3 DevKit</strong></td>
                  <td>Dual-Core LX7 @ 240MHz, 8MB PSRAM, Wi-Fi 4 + BLE 5 Mesh</td>
                  <td>FFT vectorial SIMD hardware, TDoA y nodo Mesh local</td>
                  <td style={{ color: '#38bdf8', fontWeight: 'bold' }}>2,80 €</td>
                </tr>
                <tr>
                  <td><strong>4x Micrófonos MEMS I2S</strong></td>
                  <td>INMP441 Digital (SNR 61 dB, 24-bit ADC, rango 60Hz-15kHz)</td>
                  <td>Array tetraédrico 3D acústico para conformación de haz</td>
                  <td style={{ color: '#38bdf8', fontWeight: 'bold' }}>3,20 € (0,80 € × 4)</td>
                </tr>
                <tr>
                  <td><strong>Mini-Radar Doppler 24 GHz</strong></td>
                  <td>HLK-LD2410 FMCW (Banda ISM 24.0-24.25 GHz, rango 0.2m a 12m)</td>
                  <td>Detección cinemática Doppler de velocidad instantánea</td>
                  <td style={{ color: '#38bdf8', fontWeight: 'bold' }}>3,10 €</td>
                </tr>
                <tr>
                  <td><strong>Microbarómetro I2C</strong></td>
                  <td>BMP280 (Resolución 0.16 Pa / 12 cm de altitud)</td>
                  <td>Microbarografía de estela de rotores y onda de choque</td>
                  <td style={{ color: '#38bdf8', fontWeight: 'bold' }}>1,10 €</td>
                </tr>
                <tr>
                  <td><strong>Carcasa IP65 + USB-C</strong></td>
                  <td>Caja estanca ABS + conector USB-C estanco con filtro ESD</td>
                  <td>Protección intemperie en tejados, fachadas y postes</td>
                  <td style={{ color: '#38bdf8', fontWeight: 'bold' }}>1,50 €</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(56, 189, 248, 0.15)', fontWeight: 'bold' }}>
                  <td colSpan={3} style={{ color: '#ffffff' }}>TOTAL POR NODO CENTINELA COMPLETO</td>
                  <td style={{ color: '#4ade80', fontSize: '1rem' }}>11,70 €</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="sentinel-grid-2col">
            <div className="sentinel-panel">
              <h3>⚡ Telemetría del Centinela en Tiempo Real</h3>
              <div className="telemetry-row">
                <span className="telemetry-label">Potencia Eléctrica Continua</span>
                <span className="telemetry-val">0.42 W (110 mA @ 3.3V)</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Autonomía (Power Bank 10.000 mAh)</span>
                <span className="telemetry-val" style={{ color: '#4ade80' }}>90.9 Horas (~3.8 Días)</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Tiempo de Cálculo FFT 1024-pts</span>
                <span className="telemetry-val">1.18 ms (SIMD Vectorial)</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Alcance Radar Microondas FMCW</span>
                <span className="telemetry-val">12.0 Metros (Doppler 24 GHz)</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Alcance Detección Acústica Shotgun</span>
                <span className="telemetry-val">280 Metros (Límite SNR = 3 dB)</span>
              </div>
            </div>

            <div className="sentinel-panel">
              <h3>📡 Interconexión y Malla Sin Servidores</h3>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                Los centinelas se configuran como una red mallada autónoma mediante <strong>ESP-NOW</strong> y <strong>BLE 5.0 Long Range</strong>.
                Si una antena celular cae o se produce un apagón eléctrico masivo, los centinelas siguen comunicándose
                de tejado a tejado hasta alcanzar los teléfonos móviles de los ciudadanos en refugios y plantas bajas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SURVIVAL KIT */}
      {activeTab === 'SURVIVAL_KIT' && (
        <div>
          {/* Alert Status Banner */}
          <div
            className={`survival-alert-banner ${
              survivalData.level === 'CRITICAL'
                ? 'survival-alert-critical'
                : survivalData.level === 'MEDIUM'
                ? 'survival-alert-medium'
                : 'survival-alert-low'
            }`}
          >
            <div>
              <strong>
                {survivalData.level === 'CRITICAL'
                  ? T.survival.bannerCritical
                  : survivalData.level === 'MEDIUM'
                  ? T.survival.bannerMedium
                  : T.survival.bannerLow}
              </strong>
              <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                Distancia: {droneDistanceM} m · Azimut amenaza: {droneAzimuthDeg}°
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{T.survival.timeToCover}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                {survivalData.level !== 'LOW' ? `${survivalData.timeToCover} s` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="sentinel-grid-2col">
            <div className="sentinel-panel">
              <h3>🧭 Brújula Táctica y Vector de Evasión</h3>
              <div className="control-group">
                <label>
                  <span>Simular Distancia del Dron</span>
                  <span>{droneDistanceM} m</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="5"
                  value={droneDistanceM}
                  onChange={(e) => setDroneDistanceM(+e.target.value)}
                />
              </div>

              <div className="control-group">
                <label>
                  <span>Simular Azimut del Dron</span>
                  <span>{droneAzimuthDeg}°</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="359"
                  step="5"
                  value={droneAzimuthDeg}
                  onChange={(e) => setDroneAzimuthDeg(+e.target.value)}
                />
              </div>

              <div className="survival-compass-box" style={{ marginTop: '1rem' }}>
                <div className="compass-dial">
                  <div
                    className="compass-needle"
                    style={{ transform: `rotate(${survivalData.evasionAz}deg)` }}
                  />
                  <div className="compass-center-dot" />
                </div>
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{T.survival.evasionAz}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
                    {survivalData.evasionAz}° (Rumbo Seguro)
                  </div>
                </div>
              </div>
            </div>

            <div className="sentinel-panel">
              <h3>🔊 {T.survival.beaconStatus}</h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Emisión de baliza FSK acústica a <strong>20.000 Hz</strong> inaudible para humanos. Permite a los equipos de búsqueda y rescate
                o a otros civiles localizar a personas atrapadas bajo escombros o sin cobertura celular:
              </p>

              <div style={{ background: '#030712', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.85rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.78rem', marginBottom: '1rem' }}>
                <div>PORTADORA: 20.000 Hz (Ultrasonidos Civiles)</div>
                <div>MODULACIÓN: FSK 100 baudios (19.5 kHz Mark / 20.5 kHz Space)</div>
                <div>FIRMA: ECDSA P-256 WebCrypto (Integridad Verificada)</div>
                <div style={{ color: '#38bdf8', marginTop: '0.3rem' }}>
                  PAYLOAD HEX: 002A0268AE40FDF12E80028A
                </div>
              </div>

              <button
                className="sentinel-tab-btn"
                style={{
                  width: '100%',
                  background: beaconActive ? '#059669' : '#334155',
                  borderColor: beaconActive ? '#34d399' : '#64748b',
                  color: '#ffffff',
                  padding: '0.75rem'
                }}
                onClick={() => setBeaconActive(!beaconActive)}
              >
                {beaconActive ? `🟢 ${T.survival.beaconActive}` : `⚪ ${T.survival.beaconStandby}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
