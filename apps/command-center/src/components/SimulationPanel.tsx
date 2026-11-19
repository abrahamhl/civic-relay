import { useMemo, useState } from 'react';
import { buildSimulationScenario } from '../data/adapter.mjs';
import { ProvenanceChip } from './ProvenanceChip';

export function SimulationPanel() {
  const [intensity, setIntensity] = useState(0.5);
  const scenario = useMemo(
    () => buildSimulationScenario({ seconds: 90, intensity, seed: 20261106 }),
    [intensity],
  );
  const max = Math.max(...scenario.points.map((p) => p.value), 1);

  return (
    <div className="view">
      <div>
        <h2>Simulation Lab</h2>
        <p className="lede">
          Escenario sintético para probar la UI. Cada valor lleva la etiqueta{' '}
          <span className="mono">SIMULATOR</span> y vive fuera de la tabla de observaciones reales.
          No se exporta como evidencia ni entra en fusión empírica.
        </p>
      </div>

      <div className="notice sim">
        <strong>{scenario.warning}</strong>
      </div>

      <div className="hstack">
        <ProvenanceChip provenance={scenario.provenance} />
        <span className="muted">Semilla 20261106 · 90 s · resolución 5 s</span>
      </div>

      <div className="sim-chart" role="img" aria-label="Serie sintética de tráfico; no es una medición">
        {scenario.points.map((point) => (
          <div
            key={point.t}
            className="sim-bar"
            style={{ height: `${Math.max((point.value / max) * 100, 2)}%` }}
            title={`t=${point.t}s · ${point.value} ${scenario.unit} · SIMULATOR`}
          />
        ))}
      </div>

      <div className="slider-row">
        <label htmlFor="intensity">Intensidad</label>
        <input
          id="intensity"
          type="range"
          min={0.1}
          max={1.5}
          step={0.05}
          value={intensity}
          onChange={(event) => setIntensity(Number(event.target.value))}
        />
        <span className="mono">{intensity.toFixed(2)}</span>
      </div>

      <div className="notice">
        <strong>Separación de datos.</strong> El adaptador de evidencias filtra cualquier registro
        con procedencia <span className="mono">SIMULATOR</span> antes de construir la tabla de
        observaciones. Esta comprobación está cubierta por un test ejecutable.
      </div>
    </div>
  );
}
