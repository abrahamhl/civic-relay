import React, { useState, useEffect, useRef } from 'react';
import {
  ScenarioEngine,
  SCENARIO_CATALOG
} from '../models/scenario-engine';

interface Props {
  user: any;
}

export const LabView: React.FC<Props> = ({ user }) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('A_CORRIDOR_CRISIS');
  const [engine, setEngine] = useState<ScenarioEngine>(() => new ScenarioEngine({ scenarioId: 'A_CORRIDOR_CRISIS' }));
  const [state, setState] = useState<any>(() => engine.getState());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'engine' | 'demo1' | 'demo2' | 'demo3'>('engine');

  // Custom parameters
  const [windSpeed, setWindSpeed] = useState<number>(38);
  const [moisture, setMoisture] = useState<number>(6.5);
  const [cellularCutTime, setCellularCutTime] = useState<number>(120);

  // Demo interactive states
  const [demo1Step, setDemo1Step] = useState<number>(1);
  const [demo2Step, setDemo2Step] = useState<number>(1);
  const [demo3Step, setDemo3Step] = useState<number>(1);
  const [demoEvidence, setDemoEvidence] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Re-instantiate engine when scenario or key parameters change
  const reinitEngine = (scenId = selectedScenario) => {
    const newEngine = new ScenarioEngine({
      scenarioId: scenId,
      customParams: {
        windSpeedKmh: windSpeed,
        moistureFuelPct: moisture,
        cellularFailureAtT: cellularCutTime,
      }
    });
    setEngine(newEngine);
    setState(newEngine.getState());
    setIsRunning(false);
  };

  useEffect(() => {
    reinitEngine(selectedScenario);
  }, [selectedScenario]);

  // Simulation tick loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const newState = engine.step(1.0 * simSpeed);
      setState(newState);
      if (newState.executionState === 'COMPLETED') {
        setIsRunning(false);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, simSpeed, engine]);

  // Draw 2D Scientific Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background: Dark GIS terrain
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (selectedScenario === 'A_CORRIDOR_CRISIS') {
      // Draw Highway A-3
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.moveTo(40, h * 0.65);
      ctx.bezierCurveTo(w * 0.35, h * 0.62, w * 0.65, h * 0.68, w - 40, h * 0.64);
      ctx.stroke();

      // Road markings
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(40, h * 0.65);
      ctx.bezierCurveTo(w * 0.35, h * 0.62, w * 0.65, h * 0.68, w - 40, h * 0.64);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fire Front Origin & Spread
      const frontPx = Math.min(w * 0.7, 80 + state.inference.fireSpread.frontKm * 60);
      const smokeRadius = Math.min(180, 40 + state.inference.fireSpread.smokeOpticalDensity * 120);

      // Smoke plume (Radial gradient)
      const smokeGrad = ctx.createRadialGradient(frontPx, h * 0.35, 10, frontPx + 30, h * 0.45, smokeRadius);
      smokeGrad.addColorStop(0, 'rgba(120, 113, 108, 0.75)');
      smokeGrad.addColorStop(0.5, 'rgba(87, 83, 78, 0.45)');
      smokeGrad.addColorStop(1, 'rgba(41, 37, 36, 0)');
      ctx.fillStyle = smokeGrad;
      ctx.beginPath();
      ctx.arc(frontPx + 30, h * 0.45, smokeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Fire Flame front
      const fireGrad = ctx.createRadialGradient(frontPx, h * 0.32, 5, frontPx, h * 0.32, 45);
      fireGrad.addColorStop(0, '#fef08a');
      fireGrad.addColorStop(0.3, '#f97316');
      fireGrad.addColorStop(0.7, '#ef4444');
      fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(frontPx, h * 0.32, 45, 0, Math.PI * 2);
      ctx.fill();

      // Fire label
      ctx.fillStyle = '#fee2e2';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(`🔥 Frente: ${state.inference.fireSpread.frontKm.toFixed(2)} km (ROS: ${state.inference.fireSpread.rateOfSpreadMpm} m/min)`, frontPx - 50, h * 0.32 - 50);

      // Vehicles on road
      const density = state.inference.traffic.densityVehPerKm;
      const numCars = Math.min(30, Math.max(5, Math.floor(density / 4)));
      for (let i = 0; i < numCars; i++) {
        const u = (i + 0.5) / numCars;
        const cx = 50 + u * (w - 100);
        const cy = h * 0.65 + Math.sin(u * Math.PI) * 10;
        ctx.fillStyle = u > 0.4 && u < 0.7 && state.inference.traffic.visibilityM < 300 ? '#ef4444' : '#38bdf8';
        ctx.fillRect(cx - 6, cy - 3, 12, 6);
      }

      // Antenna Tower
      const towerX = w * 0.52;
      const towerY = h * 0.48;
      ctx.fillStyle = state.inference.network.wanUp ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(towerX, towerY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = state.inference.network.wanUp ? '#34d399' : '#f87171';
      ctx.stroke();
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '10px monospace';
      ctx.fillText(state.inference.network.wanUp ? '📡 4G ACTIVA (PK 42)' : '⚠️ 4G CAÍDA (DTN ACTIVO)', towerX - 45, towerY - 14);

    } else if (selectedScenario === 'B_URBAN_FLOOD') {
      // River basin
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.moveTo(w * 0.4, 0);
      ctx.bezierCurveTo(w * 0.45, h * 0.4, w * 0.38, h * 0.7, w * 0.42, h);
      ctx.lineTo(w * 0.58, h);
      ctx.bezierCurveTo(w * 0.54, h * 0.7, w * 0.62, h * 0.4, w * 0.56, 0);
      ctx.closePath();
      ctx.fill();

      // Water height representation
      const waterLvl = state.inference.hydrology.waterLevelM;
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(`🌊 Caudal: ${state.inference.hydrology.riverFlowM3s} m³/s | Nivel: ${waterLvl} m`, w * 0.35, 30);
    } else {
      // Generic node mesh representation
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui';
      ctx.fillText(`Simulación activa: ${state.meta.title}`, 20, 30);
    }
  }, [state, selectedScenario]);

  const handleStep = (dt: number) => {
    const newState = engine.step(dt);
    setState(newState);
  };

  const handleExportManifest = () => {
    const manifest = engine.exportEvidenceManifest();
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senda-evidence-${selectedScenario}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Top Bar: Tabs & Scenario Selection */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--brand-primary)' }}>🔬 SENDA LAB</span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <button className={`tab-btn ${activeTab === 'engine' ? 'active' : ''}`} onClick={() => setActiveTab('engine')}>Scenario Engine</button>
          <button className={`tab-btn ${activeTab === 'demo1' ? 'active' : ''}`} onClick={() => setActiveTab('demo1')}>Demo 1: Social→Event→Command</button>
          <button className={`tab-btn ${activeTab === 'demo2' ? 'active' : ''}`} onClick={() => setActiveTab('demo2')}>Demo 2: Camera→Fusion→DTN</button>
          <button className={`tab-btn ${activeTab === 'demo3' ? 'active' : ''}`} onClick={() => setActiveTab('demo3')}>Demo 3: Twin→Simulation→Video</button>
        </div>

        {activeTab === 'engine' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              {Object.values(SCENARIO_CATALOG).map((sc: any) => (
                <option key={sc.id} value={sc.id}>{sc.title}</option>
              ))}
            </select>
            <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={handleExportManifest}>
              📄 Exportar Evidencia
            </button>
          </div>
        )}
      </div>

      {activeTab === 'engine' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Interactive Canvas & Physics Products */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
            {/* 2D Scientific Canvas View */}
            <div style={{ flex: 1, position: 'relative', background: '#090d16' }}>
              <canvas
                ref={canvasRef}
                width={800}
                height={420}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(15, 23, 42, 0.85)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>Epistemic State:</span> COUPLED_NUMERICAL_SIMULATION · Seed: {engine.seed}
              </div>
            </div>

            {/* Simulation Controls Bar */}
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className={`btn ${isRunning ? 'btn-outline' : 'btn-primary'}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  onClick={() => setIsRunning(!isRunning)}
                >
                  {isRunning ? '⏸️ Pausar' : '▶️ Ejecutar'}
                </button>
                <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleStep(5.0)}>
                  ⏩ +5s
                </button>
                <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => reinitEngine()}>
                  🔄 Reiniciar
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
                <span><strong>Reloj:</strong> {state.clock.t.toFixed(1)} s / {state.clock.totalDurationS} s</span>
                <span><strong>Paso:</strong> #{state.clock.stepCount}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>Vel:</span>
                  {[1, 2, 5].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setSimSpeed(spd)}
                      style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: simSpeed === spd ? 'var(--brand-primary)' : 'transparent', color: simSpeed === spd ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-primary)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>FRENTE DE FUEGO</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f97316' }}>{state.inference.fireSpread.frontKm.toFixed(2)} km</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ROS: {state.inference.fireSpread.rateOfSpreadMpm} m/min</div>
              </div>

              <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TRÁFICO LWR</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: state.inference.traffic.levelOfService === 'F' ? '#ef4444' : '#38bdf8' }}>
                  {state.inference.traffic.densityVehPerKm} veh/km (LOS {state.inference.traffic.levelOfService})
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Visibilidad: {state.inference.traffic.visibilityM} m</div>
              </div>

              <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RED Y PORTADOR</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: state.inference.network.wanUp ? '#10b981' : '#f59e0b' }}>
                  {state.inference.network.wanUp ? '4G WAN ACTIVA' : 'MALLA DTN ACTIVA'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Custodia: {state.inference.network.dtnCustodyMessages} | Verif: {state.inference.network.verifiedReceipts}</div>
              </div>

              <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INCERTIDUMBRE (p10 / p50 / p90)</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a855f7' }}>
                  {state.uncertainty.fireReachKm.p10} / {state.uncertainty.fireReachKm.p50} / {state.uncertainty.fireReachKm.p90} km
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Retardo DTN: {state.uncertainty.delaySecondsDtn.p50}s</div>
              </div>
            </div>
          </div>

          {/* Right: Parameters & Event Timeline */}
          <div style={{ width: '340px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.85rem' }}>
              ⚙️ Parámetros del Modelo
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <span>Viento de Cabeza:</span>
                  <strong>{windSpeed} km/h</strong>
                </div>
                <input
                  type="range" min="10" max="80" value={windSpeed}
                  onChange={(e) => { setWindSpeed(Number(e.target.value)); reinitEngine(); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <span>Humedad de Combustible:</span>
                  <strong>{moisture}%</strong>
                </div>
                <input
                  type="range" min="3" max="20" step="0.5" value={moisture}
                  onChange={(e) => { setMoisture(Number(e.target.value)); reinitEngine(); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <span>Corte de Antena Celular:</span>
                  <strong>t = {cellularCutTime} s</strong>
                </div>
                <input
                  type="range" min="30" max="300" step="10" value={cellularCutTime}
                  onChange={(e) => { setCellularCutTime(Number(e.target.value)); reinitEngine(); }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Timeline Events */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-tertiary)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                LÍNEA TEMPORAL DE ACONTECIMIENTOS ({state.timeline.length})
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {state.timeline.map((ev: any, idx: number) => (
                  <div key={idx} style={{ padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>t={ev.t.toFixed(0)}s · {ev.code}</span>
                      <span className={`badge ${ev.epistemicState === 'OBSERVED' ? 'badge-official' : ev.epistemicState === 'CORROBORATED' ? 'badge-corroborated' : 'badge-unverified'}`}>
                        {ev.epistemicState}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{ev.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEMO 1: SOCIAL -> EVENT -> COMMAND */}
      {activeTab === 'demo1' && (
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>DEMO 1 — SOCIAL → ACONTECIMIENTO → CENTRO DE MANDO</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            Demostración del flujo completo desde el reporte ciudadano hasta la corroboración oficial con firma de Bomberos y apertura de expediente de mando.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: demo1Step >= 1 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius)', border: demo1Step === 1 ? '2px solid var(--brand-primary)' : '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Paso 1: Observación Ciudadana Publicada</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Usuario @ciudadano_valencia publica: "Fuerte columna de humo cerca del PK 42 en la A-3, tráfico ralentizándose"</p>
              {demo1Step === 1 && (
                <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => setDemo1Step(2)}>
                  Crear Publicación y Vincular a Acontecimiento
                </button>
              )}
            </div>

            <div style={{ padding: '1rem', background: demo1Step >= 2 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius)', border: demo1Step === 2 ? '2px solid var(--brand-primary)' : '1px solid var(--border)', opacity: demo1Step >= 2 ? 1 : 0.6 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Paso 2: Hipótesis de Acontecimiento Creada</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estado inicial: <span className="badge badge-unverified">UNVERIFIED_REPORT</span> (Incertidumbre: ~1.1 km). Cruzado automáticamente con detector DGT A-3 (velocidad cae a 32 km/h).</p>
              {demo1Step === 2 && (
                <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => setDemo1Step(3)}>
                  Revisar y Corroborar por Bomberos / Autoridad
                </button>
              )}
            </div>

            <div style={{ padding: '1rem', background: demo1Step >= 3 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius)', border: demo1Step === 3 ? '2px solid var(--brand-primary)' : '1px solid var(--border)', opacity: demo1Step >= 3 ? 1 : 0.6 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Paso 3: Corroboración Institucional y Despacho a Command</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Operador de Emergencias emite confirmación con firma Ed25519. Estado pasa a <span className="badge badge-official">OFFICIAL_SOURCE_CONFIRMED</span>. Alerta enviada a 1,420 suscripciones del corredor.</p>
              {demo1Step === 3 && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#022c22', borderRadius: '4px', border: '1px solid #059669', color: '#6ee7b7', fontSize: '0.75rem' }}>
                  ✅ Flujo Social → Evento → Mando verificado exitosamente sin contaminación de datos personales.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DEMO 2: CAMERA -> FUSION -> DTN */}
      {activeTab === 'demo2' && (
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>DEMO 2 — CÁMARA → FUSIÓN MULTISENSOR → CUSTODIA DTN</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            Ingesta de cámara vehicular (dashcam YOLOX), cruce con sensor de espira vial, corte deliberado de 4G y entrega criptográfica garantizada por malla DTN.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontWeight: 700 }}>1. Detección por Visión Edge (YOLOX + ByteTrack)</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dashcam detecta frenada de emergencia (-4.4 m/s²), humo denso y luces de avería encendidas.</p>
              <button className="btn btn-outline" style={{ marginTop: '0.5rem' }} onClick={() => setDemo2Step(2)}>
                Ingestar en Corridor Fabric
              </button>
            </div>

            {demo2Step >= 2 && (
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontWeight: 700 }}>2. Ruptura de Conexión WAN y Conmutación a DTN</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Antena de telefonía cae fuera de servicio. El sobre SENDA v2 pasa a estado <span className="badge badge-unverified">IN_CUSTODY</span> en nodo vehicular.</p>
                <button className="btn btn-outline" style={{ marginTop: '0.5rem' }} onClick={() => setDemo2Step(3)}>
                  Transportar por Malla y Verificar Recibo
                </button>
              </div>
            )}

            {demo2Step >= 3 && (
              <div style={{ padding: '1rem', background: '#022c22', borderRadius: 'var(--radius)', border: '1px solid #059669', color: '#6ee7b7' }}>
                <div style={{ fontWeight: 700 }}>3. Acuse de Recibo Criptográfico (2 Checks)</div>
                <p style={{ fontSize: '0.8rem' }}>Recibo firmado entregado a través del salto vehicular intermedio. Estado: <span className="badge badge-official">VERIFIED</span>.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEMO 3: DIGITAL TWIN -> SIMULATION -> VIDEO */}
      {activeTab === 'demo3' && (
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>DEMO 3 — GEMELO DIGITAL → SIMULACIÓN → EVIDENCIA Y VÍDEO</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            Ejecución del modelo físico de propagación acoplado al tráfico vial, cálculo de incertidumbre y generación de trazabilidad directa al vídeo M95.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Parámetros de Entrada Acoplados:</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>• Viento: 45 km/h (Azimut 245°)</div>
                <div>• Combustible: Matorral seco (6.5% humedad)</div>
                <div>• Tráfico entrante: 1,800 veh/h</div>
                <div>• Densidad de atasco: 140 veh/km</div>
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Trazabilidad al Render de Vídeo M95:</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div><strong>Vídeo Canónico:</strong> <code>senda-m95-film-en.mp4</code> (530.12 s, 1080p, SHA-256: <code>7d53e52c...</code>)</div>
                <div><strong>Escena Acoplada:</strong> Escena 12b (<em>The proof you can inspect</em>)</div>
                <div><strong>Etiqueta Epistémica:</strong> <code>SIMULATION · COMPUTED FROM THE APP CORE</code></div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={handleExportManifest}>
                Exportar Manifiesto de Reproducibilidad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
