import { useMemo, useState } from 'react';
import {
  DEMO_FORECASTS,
  crpsEnsemble,
  dewPointC,
  fosbergFireWeatherIndex,
  gaussianPlumeGroundLevel,
  heatIndexC,
  summarizeVerification,
  windChillC,
} from '../science/meteorology.mjs';

const STABILITY = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function MeteorologyLab() {
  const [tempC, setTempC] = useState(28);
  const [rh, setRh] = useState(45);
  const [windKmh, setWindKmh] = useState(18);

  const [emission, setEmission] = useState(10);
  const [windMs, setWindMs] = useState(3);
  const [stack, setStack] = useState(0);
  const [stability, setStability] = useState<(typeof STABILITY)[number]>('D');
  const [downwind, setDownwind] = useState(500);

  const dew = dewPointC(tempC, rh);
  const heat = heatIndexC(tempC, rh);
  const chill = windChillC(tempC, windKmh);
  const fire = fosbergFireWeatherIndex({ tempC, rhPercent: rh, windKmh });

  const plume = gaussianPlumeGroundLevel({
    emissionRateGps: emission,
    windSpeedMs: windMs,
    stackHeightM: stack,
    stabilityClass: stability,
    downwindM: Math.max(10, downwind),
  });

  const forecasts = useMemo(() => [...DEMO_FORECASTS], []);
  const verification = useMemo(() => summarizeVerification(forecasts), [forecasts]);
  const crps = useMemo(() => crpsEnsemble([18, 20, 22, 24, 26], 23), []);

  const chart = { width: 380, height: 180, pad: 26 };
  const innerW = chart.width - chart.pad * 2;
  const innerH = chart.height - chart.pad * 2;
  const sx = (p: number) => chart.pad + p * innerW;
  const sy = (v: number) => chart.pad + (1 - v) * innerH;

  return (
    <div className="view">
      <div>
        <h2>Meteorology &amp; Forecast Lab</h2>
        <p className="lede">
          Diagnósticos deterministas y verificación probabilística. No hay ingesta en vivo en este
          build: los valores son cálculos <span className="mono">MODEL_DERIVED</span> sobre entradas
          que tú mueves, y la verificación usa un conjunto <span className="mono">SIMULATOR</span>.
          La integración NOAA/ERA5 con hash y hora de adquisición es la siguiente fase.
        </p>
      </div>

      <h3 className="section-label">Diagnóstico de incendio y confort</h3>
      <div className="rf-grid">
        <div className="rf-controls">
          <label className="field">
            <span>Temperatura · {tempC.toFixed(0)} °C</span>
            <input
              type="range"
              min={-10}
              max={45}
              step={1}
              value={tempC}
              onChange={(event) => setTempC(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Humedad relativa · {rh.toFixed(0)} %</span>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={rh}
              onChange={(event) => setRh(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Viento · {windKmh.toFixed(0)} km/h</span>
            <input
              type="range"
              min={0}
              max={80}
              step={1}
              value={windKmh}
              onChange={(event) => setWindKmh(Number(event.target.value))}
            />
          </label>
          <div className="muted" style={{ fontSize: 11 }}>
            Fórmulas: Magnus-Tetens, Rothfusz, JAG/TI y Fosberg. Aplican rangos de validez; fuera de
            ellos se devuelve la temperatura del aire.
          </div>
        </div>

        <div className="rf-readout">
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="stat">
              <div className="k">Punto de rocío</div>
              <div className="v" style={{ fontSize: 20 }}>
                {dew.toFixed(1)}
                <span className="muted" style={{ fontSize: 12 }}>
                  {' '}
                  °C
                </span>
              </div>
              <div className="h">Magnus-Tetens</div>
            </div>
            <div className="stat">
              <div className="k">Sensación (calor)</div>
              <div className="v" style={{ fontSize: 20 }}>
                {heat.toFixed(1)}
                <span className="muted" style={{ fontSize: 12 }}>
                  {' '}
                  °C
                </span>
              </div>
              <div className="h">Rothfusz</div>
            </div>
            <div className="stat">
              <div className="k">Sensación (frío)</div>
              <div className="v" style={{ fontSize: 20 }}>
                {chill.toFixed(1)}
                <span className="muted" style={{ fontSize: 12 }}>
                  {' '}
                  °C
                </span>
              </div>
              <div className="h">JAG/TI</div>
            </div>
            <div className="stat">
              <div className="k">Fosberg FFWI</div>
              <div className="v" style={{ fontSize: 20, color: 'var(--warn)' }}>
                {fire.ffwi.toFixed(0)}
              </div>
              <div className="h">{fire.class}</div>
            </div>
          </div>
          <div className={`notice ${fire.class === 'EXTREME' ? 'bad' : 'sim'}`}>
            <strong>Modelo, no pronóstico.</strong> El FFWI combina humedad equivalente y viento.
            Clase actual <span className="mono">{fire.class}</span>; humedad de combustible{' '}
            {fire.moisturePercent.toFixed(1)}%. No sustituye a una predicción oficial.
          </div>
        </div>
      </div>

      <h3 className="section-label">Dispersión gaussiana · penacho</h3>
      <div className="rf-grid">
        <div className="rf-controls">
          <label className="field">
            <span>Emisión · {emission.toFixed(0)} g/s</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={emission}
              onChange={(event) => setEmission(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Viento · {windMs.toFixed(1)} m/s</span>
            <input
              type="range"
              min={0.5}
              max={15}
              step={0.1}
              value={windMs}
              onChange={(event) => setWindMs(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Altura de chimenea · {stack.toFixed(0)} m</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={stack}
              onChange={(event) => setStack(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Estabilidad Pasquill</span>
            <select
              className="select"
              value={stability}
              onChange={(event) => setStability(event.target.value as (typeof STABILITY)[number])}
            >
              {STABILITY.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Distancia a favor del viento · {downwind.toFixed(0)} m</span>
            <input
              type="range"
              min={10}
              max={5000}
              step={10}
              value={downwind}
              onChange={(event) => setDownwind(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="rf-readout">
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="stat">
              <div className="k">Concentración</div>
              <div className="v" style={{ fontSize: 18 }}>
                {plume.concentrationUgM3.toFixed(2)}
                <span className="muted" style={{ fontSize: 11 }}>
                  {' '}
                  µg/m³
                </span>
              </div>
              <div className="h">nivel de suelo</div>
            </div>
            <div className="stat">
              <div className="k">σy</div>
              <div className="v" style={{ fontSize: 18 }}>
                {plume.sigmaYM.toFixed(0)} m
              </div>
              <div className="h">Briggs campo abierto</div>
            </div>
            <div className="stat">
              <div className="k">σz</div>
              <div className="v" style={{ fontSize: 18 }}>
                {plume.sigmaZM.toFixed(0)} m
              </div>
              <div className="h">Briggs campo abierto</div>
            </div>
          </div>
          <div className="notice sim">
            <strong>SUPOSICIONES:</strong> {plume.assumptions.join(' · ')}. Sin química, sin
            deposición, sin relieve, sin edificios. Un número aquí no es una medición de calidad del
            aire.
          </div>
        </div>
      </div>

      <h3 className="section-label">Verificación probabilística · SIMULATOR</h3>
      <div className="rf-grid">
        <div className="floor-plan">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label="Diagrama de fiabilidad de pronósticos"
          >
            <rect x="0" y="0" width={chart.width} height={chart.height} fill="#080d14" />
            <line
              x1={sx(0)}
              y1={sy(0)}
              x2={sx(1)}
              y2={sy(1)}
              stroke="#3a4a5e"
              strokeDasharray="4 4"
            />
            <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(1)} stroke="#3a4a5e" />
            <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(0)} stroke="#3a4a5e" />
            <text x={chart.width / 2} y={chart.height - 4} fill="#93a3b8" fontSize="9" textAnchor="middle">
              probabilidad media pronosticada
            </text>
            {verification.reliability.map((bin) => (
              <g key={bin.lower}>
                <rect
                  x={sx(bin.meanProbability) - 6}
                  y={sy(bin.observedFrequency) - 6}
                  width="12"
                  height="12"
                  rx="2"
                  fill="rgba(63,224,196,0.35)"
                  stroke="#3fe0c4"
                  strokeWidth="1"
                />
                <text
                  x={sx(bin.meanProbability)}
                  y={sy(bin.observedFrequency) - 10}
                  fill="#cfe3ff"
                  fontSize="8"
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                >
                  {bin.count}
                </text>
              </g>
            ))}
            <text x={chart.pad} y={chart.pad - 8} fill="#93a3b8" fontSize="9">
              observado
            </text>
          </svg>
          <div className="prov-chip" style={{ marginTop: 6 }}>
            {verification.provenance} · {verification.count} casos · diagonal = calibración perfecta
          </div>
        </div>

        <div className="rf-readout">
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="stat">
              <div className="k">Brier</div>
              <div className="v" style={{ fontSize: 18 }}>
                {verification.brier.toFixed(3)}
              </div>
              <div className="h">menor es mejor</div>
            </div>
            <div className="stat">
              <div className="k">Brier skill</div>
              <div className="v" style={{ fontSize: 18 }}>
                {verification.brierSkill.toFixed(3)}
              </div>
              <div className="h">frente a 0.5</div>
            </div>
            <div className="stat">
              <div className="k">ROC AUC</div>
              <div className="v" style={{ fontSize: 18 }}>
                {verification.auc.toFixed(3)}
              </div>
              <div className="h">discriminación</div>
            </div>
            <div className="stat">
              <div className="k">CRPS ensemble</div>
              <div className="v" style={{ fontSize: 18 }}>
                {crps.toFixed(2)}
              </div>
              <div className="h">[18,20,22,24,26] vs 23</div>
            </div>
          </div>
          <div className="notice sim">
            <strong>Conjunto sintético.</strong> 16 casos etiquetados a mano para ejercitar las
            métricas. No es un pronóstico real ni una validación operativa. La calibración se mide,
            no se declara.
          </div>
        </div>
      </div>

      <div className="notice warn">
        <strong>Rigor:</strong> Brier y CRPS se calculan sobre pares (probabilidad, resultado) y
        (ensemble, observación). Añadir datos reales exige registrar fuente, hora de adquisición,
        hash y versión del modelo. Sin eso, un score es decoración.
      </div>
    </div>
  );
}
