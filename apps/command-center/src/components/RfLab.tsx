import { useMemo, useState } from 'react';
import { getRfCapabilities } from '../data/adapter.mjs';
import {
  MATERIALS,
  RF_STATUS,
  getRfLegalGates,
  linkBudget,
  materialAttenuationDb,
  throughWallFeasibility,
} from '../science/rf.mjs';
import {
  DEMO_FLOOR,
  presenceHeatmap,
  summarizeHeatmap,
} from '../science/structure.mjs';

const TONE: Record<string, string> = {
  ARCHITECTURE_VIEWER_ONLY: 'info',
  NOT_AVAILABLE_NO_HARDWARE: 'bad',
};

const GATE_TONE: Record<string, string> = {
  REQUIRED: 'warn',
  PROHIBITED: 'bad',
  SIMULATION_ONLY: 'sim',
  NOT_IMPLEMENTED: 'muted',
};

const WALL_COLOR: Record<string, string> = {
  concrete: '#7f8ea3',
  reinforced_concrete: '#ff6b7a',
  brick: '#c98a5a',
  drywall: '#b9c4d2',
  metal: '#ff6b7a',
  glass: '#63a8ff',
  wood: '#a5916a',
  earth: '#8a7a5a',
};

export function RfLab() {
  const capabilities = getRfCapabilities();
  const gates = getRfLegalGates();
  const [probe, setProbe] = useState<'idle' | 'running' | 'not-found'>('idle');
  const [material, setMaterial] = useState('concrete');
  const [thicknessM, setThicknessM] = useState(0.2);
  const [freqGHz, setFreqGHz] = useState(2.4);
  const [distanceM, setDistanceM] = useState(5);
  const [rssi, setRssi] = useState({ S1: -62, S2: -70 });

  const freqHz = freqGHz * 1e9;
  const wall = { material, thicknessM };

  const attenuation = materialAttenuationDb({ material, thicknessM, freqHz });
  const budget = linkBudget({
    txPowerDbm: 0,
    txGainDbi: 2,
    rxGainDbi: 2,
    distanceM,
    freqHz,
    walls: [{ material, thicknessM }],
  });
  const feasibility = throughWallFeasibility({
    freqHz,
    distanceM,
    walls: [wall],
  });

  const sensors = DEMO_FLOOR.sensors.map((sensor) => ({
    ...sensor,
    rssiDbm: rssi[sensor.id as 'S1' | 'S2'],
  }));

  const heatmap = useMemo(
    () =>
      presenceHeatmap({
        bounds: DEMO_FLOOR.bounds,
        resolution: 30,
        sensors,
        walls: DEMO_FLOOR.walls,
        freqHz,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rssi.S1, rssi.S2, freqHz],
  );
  const summary = summarizeHeatmap(heatmap);

  return (
    <div className="view">
      <div>
        <h2>RF &amp; Rescue Lab</h2>
        <p className="lede">
          Propagación, atenuación por material y un campo de verosimilitud de presencia marcado
          <span className="mono"> SIMULATOR</span>. No es una imagen de radar, no atraviesa paredes
          y no identifica a nadie. La detección real exige radar UWB/mmWave o SDR autorizado,
          calibración y consentimiento.
        </p>
      </div>

      <h3 className="section-label">Puertas legales</h3>
      <div className="card-grid">
        {gates.map((gate) => (
          <article className="cap-card" key={gate.id}>
            <h3 className="mono" style={{ fontSize: 11 }}>
              {gate.id}
            </h3>
            <span
              className="status"
              style={{ color: `var(--${GATE_TONE[gate.status] ?? 'muted'})` }}
            >
              {gate.status}
            </span>
            <p>{gate.statement}</p>
          </article>
        ))}
      </div>

      <h3 className="section-label">Calculadora de atenuación</h3>
      <div className="rf-grid">
        <div className="rf-controls">
          <label className="field">
            <span>Material</span>
            <select
              className="select"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            >
              {Object.entries(MATERIALS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Espesor · {thicknessM.toFixed(3)} m</span>
            <input
              type="range"
              min={0.001}
              max={0.5}
              step={0.001}
              value={thicknessM}
              onChange={(event) => setThicknessM(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Frecuencia · {freqGHz.toFixed(1)} GHz</span>
            <input
              type="range"
              min={0.4}
              max={8}
              step={0.1}
              value={freqGHz}
              onChange={(event) => setFreqGHz(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Distancia · {distanceM.toFixed(1)} m</span>
            <input
              type="range"
              min={1}
              max={40}
              step={0.5}
              value={distanceM}
              onChange={(event) => setDistanceM(Number(event.target.value))}
            />
          </label>
          <div className="muted" style={{ fontSize: 11 }}>
            {MATERIALS[material].note}. Modelo de ingeniería, no una medición del edificio.
          </div>
        </div>

        <div className="rf-readout">
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="stat">
              <div className="k">Atenuación del muro</div>
              <div className="v" style={{ fontSize: 20 }}>
                {attenuation.toFixed(1)}
                <span className="muted" style={{ fontSize: 12 }}>
                  {' '}
                  dB
                </span>
              </div>
              <div className="h">una dirección</div>
            </div>
            <div className="stat">
              <div className="k">Pérdida total</div>
              <div className="v" style={{ fontSize: 20 }}>
                {budget.totalDb.toFixed(1)}
                <span className="muted" style={{ fontSize: 12 }}>
                  {' '}
                  dB
                </span>
              </div>
              <div className="h">espacio libre + muro</div>
            </div>
            <div className="stat">
              <div className="k">Potencia recibida</div>
              <div className="v" style={{ fontSize: 20 }}>
                {budget.receivedDbm.toFixed(0)}
                <span className="muted" style={{ fontSize: 12 }}>
                  {' '}
                  dBm
                </span>
              </div>
              <div className="h">con 0 dBm y 2+2 dBi</div>
            </div>
            <div className="stat">
              <div className="k">Viabilidad</div>
              <div
                className="v"
                style={{
                  fontSize: 13,
                  color:
                    feasibility.capability === 'SIMULATION_ONLY' ? 'var(--sim)' : 'var(--text)',
                }}
              >
                {feasibility.status}
              </div>
              <div className="h">siempre SIMULATION_ONLY</div>
            </div>
          </div>
          <div className={`notice ${budget.status === RF_STATUS.BLOCKED ? 'bad' : 'warn'}`}>
            <strong>{budget.status}.</strong> Margen {budget.marginDb.toFixed(1)} dB frente a una
            sensibilidad de −95 dBm. {feasibility.note}
          </div>
        </div>
      </div>

      <h3 className="section-label">Campo de presencia · simulador</h3>
      <div className="rf-grid">
        <div className="floor-plan">
          <svg viewBox="0 0 20 12" role="img" aria-label="Planta sintética con campo de presencia">
            <rect x="0" y="0" width="20" height="12" fill="#080d14" />
            {Array.from({ length: heatmap.values.length }, (_, index) => {
              const col = index % heatmap.cols;
              const row = Math.floor(index / heatmap.cols);
              const value = heatmap.values[index];
              if (value < 0.08) return null;
              return (
                <rect
                  key={index}
                  x={col * heatmap.cellW}
                  y={row * heatmap.cellH}
                  width={heatmap.cellW}
                  height={heatmap.cellH}
                  fill={`rgba(63, 224, 196, ${(0.06 + 0.7 * value).toFixed(3)})`}
                />
              );
            })}
            {DEMO_FLOOR.walls.map((item) => (
              <line
                key={item.id}
                x1={item.a.x}
                y1={item.a.y}
                x2={item.b.x}
                y2={item.b.y}
                stroke={WALL_COLOR[item.material] ?? '#93a3b8'}
                strokeWidth={Math.max(0.06, item.thicknessM * 2.2)}
                strokeLinecap="round"
              />
            ))}
            {DEMO_FLOOR.sensors.map((sensor) => (
              <g key={sensor.id}>
                <circle cx={sensor.x} cy={sensor.y} r="0.35" fill="#63a8ff" />
                <text
                  x={sensor.x + 0.5}
                  y={sensor.y + 0.2}
                  fill="#cfe3ff"
                  fontSize="0.55"
                  fontFamily="var(--mono)"
                >
                  {sensor.id}
                </text>
              </g>
            ))}
            <g>
              <circle
                cx={heatmap.peak.x}
                cy={heatmap.peak.y}
                r="0.42"
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.08"
              />
              <text
                x={heatmap.peak.x + 0.6}
                y={heatmap.peak.y - 0.4}
                fill="#ffffff"
                fontSize="0.5"
                fontFamily="var(--mono)"
              >
                PICO SIMULADO
              </text>
            </g>
          </svg>
          <div className="prov-chip" style={{ marginTop: 6 }}>
            {heatmap.provenance} · {heatmap.sensorCount} sensores · {heatmap.cols}×
            {heatmap.rows} celdas
          </div>
        </div>

        <div className="rf-controls">
          {DEMO_FLOOR.sensors.map((sensor) => (
            <label className="field" key={sensor.id}>
              <span>
                RSSI {sensor.id} · {rssi[sensor.id as 'S1' | 'S2']} dBm
              </span>
              <input
                type="range"
                min={-95}
                max={-40}
                step={1}
                value={rssi[sensor.id as 'S1' | 'S2']}
                onChange={(event) =>
                  setRssi((prev) => ({ ...prev, [sensor.id]: Number(event.target.value) }))
                }
              />
            </label>
          ))}
          <div className="notice sim">
            <strong>SIMULATOR.</strong> Verosimilitud relativa, no probabilidad calibrada. Pico en (
            {heatmap.peak.x.toFixed(1)}, {heatmap.peak.y.toFixed(1)}) m. Celdas ≥ 0.5:{' '}
            {(summary.fractionAboveHalf * 100).toFixed(0)}% de la planta.
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            Cambiar los RSSI mueve el campo. Los muros atenúan según el modelo. El resultado sigue
            siendo una hipótesis de simulación, no una persona localizada.
          </div>
        </div>
      </div>

      <h3 className="section-label">Capacidades declaradas</h3>
      <div className="card-grid">
        {capabilities.map((cap) => (
          <article className="cap-card" key={cap.id}>
            <h3>{cap.name}</h3>
            <span className="status" style={{ color: `var(--${TONE[cap.status] ?? 'muted'})` }}>
              {cap.status}
            </span>
            <p>{cap.statement}</p>
            <div className="req">
              Hardware: {cap.requiresHardware ? 'requerido' : 'no requerido'} · Consentimiento:{' '}
              {cap.requiresConsent ? 'requerido' : 'no'}
            </div>
          </article>
        ))}
      </div>

      <div className="hstack">
        <button
          type="button"
          onClick={() => {
            setProbe('running');
            window.setTimeout(() => setProbe('not-found'), 450);
          }}
          disabled={probe === 'running'}
        >
          {probe === 'running' ? 'Buscando instrumento…' : 'Comprobar instrumento conectado'}
        </button>
        {probe === 'not-found' && (
          <span className="prov-chip" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}>
            NOT_AVAILABLE_NO_HARDWARE · no se detecta radar UWB/mmWave ni SDR autorizado
          </span>
        )}
      </div>

      <div className="notice">
        <strong>X-Ray Architecture ≠ ver a través de paredes.</strong> El visor 3D puede mostrar un
        modelo IFC/BIM autorizado con secciones transparentes y capas de sensores con permiso. No
        infiere cuerpos, movimiento ni vida en el interior.
      </div>
    </div>
  );
}
