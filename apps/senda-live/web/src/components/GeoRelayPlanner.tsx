import React, { useMemo, useState } from 'react';
import type { TerrainGridSnapshot } from '../offline/terrain-snapshot';
import {
  RELAY_PRESETS, RELAY_SITES, relaySiteCoordinates, analyzeTerrainLink,
  computeRadioShadowField,
  estimateEqualMastHeight, planRelayCorridor, type RelayGeometryResult
} from '../science/relay-geometry.mjs';

/**
 * SENDA GeoRelay — terrain-aware radiosight investigation.
 * The plotted sites are abstract places on the DEM grid, NOT actual equipment.
 * No location permission, scan, network access, radio activation or personal data.
 */
const PANEL = '#102c40';
const TEXT = '#dceef9';
const MUTED = '#9db8c8';
const statusTone: Record<string, string> = {
  MODEL_INDICATES_CLEARANCE: '#34d399',
  MODEL_INDICATES_OBSTRUCTION: '#fb7185',
  MARGINAL_OR_UNRESOLVED: '#fbbf24',
};

function CrossSection({ analysis }: { analysis: RelayGeometryResult }) {
  const profile = analysis.profile;
  const low = Math.min(...profile.map((p) => p.groundElevationM), ...profile.map((p) => p.rayElevationM - .6 * p.firstFresnelM)) - 12;
  const high = Math.max(...profile.map((p) => p.groundElevationM), ...profile.map((p) => p.rayElevationM + p.firstFresnelM)) + 12;
  const w = 780, h = 254, pad = 34;
  const y = (height: number) => (h - pad) - (height - low) / Math.max(1, high - low) * (h - 2 * pad);
  const x = (p: { fraction: number }) => pad + p.fraction * (w - 2 * pad);
  const path = (fn: (p: typeof profile[number]) => number) =>
    profile.map((p, i) => (i ? 'L' : 'M') + x(p).toFixed(1) + ',' + y(fn(p)).toFixed(1)).join(' ');
  const terrainPath = path((p) => p.groundElevationM) + 'L' + (w - pad) + ',' + (h - pad) +
    'L' + pad + ',' + (h - pad) + 'Z';
  const clearance = path((p) => p.rayElevationM - .6 * p.firstFresnelM);
  const ray = path((p) => p.rayElevationM);
  const mid = analysis.bottleneckAt;
  return (
    <svg viewBox="0 0 780 254" role="img" aria-label="Perfil topográfico con rayo de radio y despeje de Fresnel"
      style={{ display: 'block', width: '100%', borderRadius: 12, background: '#061827', maxHeight: 310 }}>
      <title>Geometría del relieve, rayo de radio y primera zona de Fresnel estimada</title>
      {[0, .25, .5, .75, 1].map((i) => (
        <g key={i}>
          <line x1={pad + i * (w - 2 * pad)} x2={pad + i * (w - 2 * pad)}
            y1={pad} y2={h - pad} stroke="#29485b" strokeWidth="1" strokeDasharray="3 5" />
          <text x={pad + i * (w - 2 * pad)} y={h - 11} fill={MUTED} textAnchor="middle" fontSize="11">
            {(analysis.distanceM / 1000 * i).toFixed(1)} km
          </text>
        </g>
      ))}
      <path d={terrainPath} fill="#356d65" opacity=".9" />
      <path d={path((p) => p.groundElevationM)} stroke="#9ce2be" strokeWidth="1.8" fill="none" />
      <path d={clearance} stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 4" fill="none" />
      <path d={ray} stroke="#7dd3fc" strokeWidth="2.5" fill="none" />
      <circle cx={x(mid)} cy={y(mid.groundElevationM)} r="5" fill="#fb7185" stroke="#061827" strokeWidth="2" />
      <g fontSize="11" fill="#dbeafe">
        <text x="14" y="18">Radio: azul · exigencia Fresnel 60%: amarillo · relieve: verde</text>
        <text x={w - 10} y="18" textAnchor="end">ITU-R P.526 · cribado geométrico</text>
      </g>
    </svg>
  );
}

export function GeoRelayPlanner({ terrain }: { terrain: TerrainGridSnapshot }) {
  const [fromSite, setFromSite] = useState('A');
  const [toSite, setToSite] = useState('E');
  const [frequencyMHz, setFrequencyMHz] = useState(2400);
  const [mastHeightM, setMastHeightM] = useState(35);
  const [maxHopKm, setMaxHopKm] = useState(15);
  const [graphView, setGraphView] = useState(true);
  const [showShadowField, setShowShadowField] = useState(false);
  const from = useMemo(() => relaySiteCoordinates(terrain, fromSite), [terrain, fromSite]);
  const to = useMemo(() => relaySiteCoordinates(terrain, toSite), [terrain, toSite]);
  const analysis = useMemo(() => {
    if (fromSite === toSite) return null;
    return analyzeTerrainLink(terrain, {
      from: { lat: from.lat, lon: from.lon, antennaHeightM: mastHeightM },
      to: { lat: to.lat, lon: to.lon, antennaHeightM: mastHeightM },
      frequencyMHz
    });
  }, [terrain, from, to, fromSite, toSite, mastHeightM, frequencyMHz]);
  const minimumMast = useMemo(() => fromSite === toSite ? null :
    estimateEqualMastHeight(terrain, { from, to, frequencyMHz }), [terrain, from, to, frequencyMHz]);
  const graph = useMemo(() => planRelayCorridor(terrain, {
    startSite: fromSite, endSite: toSite === fromSite ? 'E' : toSite,
    frequencyMHz, mastHeightM, maxHopKm
  }), [terrain, fromSite, toSite, frequencyMHz, mastHeightM, maxHopKm]);
  const shadow = useMemo(() => showShadowField ? computeRadioShadowField(terrain, {
    originSite: fromSite, frequencyMHz, transmitterHeightM: mastHeightM,
    receiverHeightM: 15, gridSize: 11, maxRangeKm: Math.max(10, maxHopKm),
  }) : null, [terrain, showShadowField, fromSite, frequencyMHz, mastHeightM, maxHopKm]);
  const tone = analysis ? statusTone[analysis.status] : MUTED;
  const inputStyle: React.CSSProperties = {
    background: '#0b2639', border: '1px solid #476277', borderRadius: 8,
    padding: '6px 8px', color: TEXT, fontSize: 12, maxWidth: 200,
  };
  const labelStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 };
  const smallCard: React.CSSProperties = { background: PANEL, border: '1px solid #2d5064', borderRadius: 10, padding: 12, flex: '1 1 160px' };

  return (
    <section data-testid="senda-rf-geometry-lab" aria-label="SENDA GeoRelay - análisis de enlaces sobre terreno"
      style={{ background: '#071b2b', padding: 14, color: TEXT, border: '1px solid #255875', borderRadius: 13, display: 'grid', gap: 12 }}>
      <header>
        <strong style={{ letterSpacing: '.055em', fontSize: 15 }}>GEORELAY / RADIO SHADOW LAB</strong>
        <p style={{ fontSize: 12, color: MUTED, margin: '5px 0 0' }}>
          Alturas DEM + curvatura terrestre + zona de Fresnel · simulación geométrica offline de nodos hipotéticos
        </p>
      </header>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={labelStyle}>Origen
          <select value={fromSite} aria-label="Nodo de origen" onChange={(e) => {
            setFromSite(e.target.value);
            if (e.target.value === toSite) setToSite(e.target.value === 'E' ? 'A' : 'E');
          }} style={inputStyle}>
            {RELAY_SITES.map((site) => <option key={site.id} value={site.id}>{site.id} · {site.label}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Destino
          <select value={toSite} aria-label="Nodo de destino" onChange={(e) => {
            setToSite(e.target.value);
            if (e.target.value === fromSite) setFromSite(e.target.value === 'A' ? 'E' : 'A');
          }} style={inputStyle}>
            {RELAY_SITES.map((site) => <option key={site.id} value={site.id}>{site.id} · {site.label}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Banda
          <select value={frequencyMHz} aria-label="Frecuencia de cribado" onChange={(e) => setFrequencyMHz(Number(e.target.value))} style={inputStyle}>
            {Object.entries(RELAY_PRESETS).map(([key, band]) => (
              <option key={key} value={band.frequencyMHz}>{band.label}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>Antena {mastHeightM} m
          <input type="range" min="2" max="120" step="1" aria-label="Altura hipotética de antena"
            value={mastHeightM} onChange={(e) => setMastHeightM(Number(e.target.value))} />
        </label>
      </div>

      {analysis && <>
        <div role="status" aria-live="polite" style={{ border: '1px solid ' + tone, background: PANEL,
          color: tone, padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
          {analysis.status === 'MODEL_INDICATES_CLEARANCE' ? 'TRAZADO GEOMÉTRICAMENTE DESPEJADO' :
            analysis.status === 'MODEL_INDICATES_OBSTRUCTION' ? 'OBSTÁCULO TOPOGRÁFICO EN EL TRAYECTO' :
              'DESPEJE MARGINAL O INCIERTO'} · No equivale a enlace de radio demostrado
        </div>
        <CrossSection analysis={analysis} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={smallCard}><div style={{ color: MUTED, fontSize: 11 }}>Distancia sobre superficie</div>
            <strong>{(analysis.distanceM / 1000).toFixed(2)} km</strong></div>
          <div style={smallCard}><div style={{ color: MUTED, fontSize: 11 }}>Despeje mínimo 60% F1</div>
            <strong style={{ color: tone }}>{analysis.minFresnelClearanceM.toFixed(1)} m</strong></div>
          <div style={smallCard}><div style={{ color: MUTED, fontSize: 11 }}>Pérdida ideal en espacio libre</div>
            <strong>{analysis.idealFreeSpaceLossDb.toFixed(1)} dB</strong></div>
          <div style={smallCard}><div style={{ color: MUTED, fontSize: 11 }}>Altura igual mínima orientativa</div>
            <strong>{minimumMast?.requiredHeightM == null ? 'No determinada ≤120 m' : minimumMast.requiredHeightM + ' m'}</strong></div>
        </div>
      </>}

      <div style={{ borderTop: '1px solid #35516a', paddingTop: 12, display: 'grid', gap: 10 }}>
        <label style={{ ...labelStyle, justifyContent: 'space-between' }}>
          <span>Planificación de rebotes hipotéticos</span>
          <input type="checkbox" checked={graphView} onChange={(e) => setGraphView(e.target.checked)}
            aria-label="Mostrar grafo de repetidores" />
        </label>
        {graphView && <>
          <label style={labelStyle}>Máximo por salto {maxHopKm} km
            <input type="range" aria-label="Distancia máxima por salto" min="3" max="40" step="1"
              value={maxHopKm} onChange={(e) => setMaxHopKm(Number(e.target.value))} />
          </label>
          <svg role="img" aria-label="Mapa conceptual de nodos potenciales y enlaces geométricos"
            viewBox="0 0 640 270" style={{ width: '100%', maxHeight: 280, background: '#092234', borderRadius: 10 }}>
            {graph.allScreenedEdges.map((edge) => {
              const a = RELAY_SITES.find((s) => s.id === edge.fromSite)!;
              const b = RELAY_SITES.find((s) => s.id === edge.toSite)!;
              const inRoute = graph.candidateSiteIds.some((id, i) =>
                graph.candidateSiteIds[i + 1] === edge.toSite && id === edge.fromSite ||
                graph.candidateSiteIds[i + 1] === edge.fromSite && id === edge.toSite);
              return <line key={edge.fromSite + edge.toSite} x1={a.u * 600 + 20} y1={a.v * 245 + 10}
                x2={b.u * 600 + 20} y2={b.v * 245 + 10}
                stroke={inRoute ? '#38bdf8' : edge.status === 'MODEL_INDICATES_CLEARANCE' ? '#28594a' : '#6b3345'}
                strokeWidth={inRoute ? 4 : 1.2} strokeOpacity={inRoute ? 1 : .55} />;
            })}
            {RELAY_SITES.map((site) => (
              <g key={site.id}>
                <circle cx={site.u * 600 + 20} cy={site.v * 245 + 10} r="12"
                  fill={graph.candidateSiteIds.includes(site.id) ? '#0f768b' : '#154258'} stroke="#a5f3fc" strokeWidth="1.6" />
                <text x={site.u * 600 + 20} y={site.v * 245 + 14} textAnchor="middle"
                  fill="#fff" fontWeight="bold" fontSize="12">{site.id}</text>
              </g>
            ))}
            <text x="12" y="258" fill="#a7cbd7" fontSize="10">A–G: emplazamientos geométricos propuestos, NO estaciones instaladas</text>
          </svg>
          <div data-testid="relay-corridor-status" role="status" style={{ fontSize: 12 }}>
            {graph.status === 'GEOMETRIC_RELAY_CANDIDATE'
              ? 'CADENA HIPOTÉTICA: ' + graph.candidateSiteIds.join(' → ') + ' · ' + graph.hopCount + ' saltos geométricos'
              : 'No se ha encontrado una cadena geométrica con estos supuestos.'}
          </div>
        </>}
      </div>
      <div style={{ display: 'grid', gap: 9, borderTop: '1px solid #35516a', paddingTop: 12 }}>
        <label style={{ ...labelStyle, justifyContent: 'space-between' }}>
          <span>Mapa de sombra geométrica RF · origen {fromSite} · receptor hipotético 15 m</span>
          <input type="checkbox" aria-label="Mostrar campo de sombra RF" checked={showShadowField}
            onChange={(e) => setShowShadowField(e.target.checked)} />
        </label>
        {shadow && <>
          <svg viewBox="0 0 350 350" role="img" aria-label="Campo de sombra radioeléctrica geométrica basado en DEM"
            style={{ width: '100%', maxWidth: 420, borderRadius: 10, background: '#061827', margin: '0 auto' }}>
            <text x="175" y="19" textAnchor="middle" fill="#a5deff" fontSize="12">N ↑ · proyección local sobre DEM</text>
            {shadow.cells.map((cell) => {
              const n = shadow.gridSize, unit = 306 / n;
              const color = cell.status === 'MODEL_INDICATES_CLEARANCE' ? '#16a34a' :
                cell.status === 'MODEL_INDICATES_OBSTRUCTION' ? '#e11d48' :
                cell.status === 'MARGINAL_OR_UNRESOLVED' ? '#f59e0b' : '#334155';
              return <rect key={cell.row + '-' + cell.col} x={22 + cell.col * unit}
                y={25 + cell.row * unit} width={unit - .8} height={unit - .8}
                fill={color} opacity=".85" stroke="#0a2230" strokeWidth=".5">
                <title>{cell.status} · {cell.distanceM} m · margen Fresnel {cell.minFresnelClearanceM ?? 'N/A'} m</title>
              </rect>;
            })}
            {RELAY_SITES.filter((site) => site.id === fromSite).map((site) => (
              <g key={site.id}>
                <circle cx={22 + site.u * 306} cy={25 + site.v * 306} r="6" fill="#fff" stroke="#102a43" strokeWidth="2" />
                <text x={22 + site.u * 306 + 10} y={25 + site.v * 306 - 4} fill="#fff" fontSize="12">TX {site.id}</text>
              </g>
            ))}
            <text x="175" y="346" textAnchor="middle" fill="#a5bfd1" fontSize="10">
              Cribado matemático, NO señal medida ni cobertura garantizada
            </text>
          </svg>
          <div data-testid="rf-shadow-counts" style={{ fontSize: 12, display: 'flex', gap: 15, flexWrap: 'wrap' }}>
            <span style={{ color: '#34d399' }}>Despejes estimados: {shadow.summary.modelClear}</span>
            <span style={{ color: '#fb7185' }}>Bloqueos estimados: {shadow.summary.modelObstructed}</span>
            <span style={{ color: '#fbbf24' }}>No resueltos: {shadow.summary.modelUncertain}</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
            Malla 11 × 11, campo calculado sobre relieve público; los colores NO predicen recepción de señal, velocidad, operador ni cobertura de emergencia.
            El rango actual sirve solo como límite de distancia. Cada celda necesita validación topográfica y radio real.
          </p>
        </>}
      </div>
      <footer style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
        Dato base: {terrain.source.provider} · {terrain.source.dataset} · {terrain.acquiredAt}.
        Referencia: <a href="https://www.itu.int/rec/R-REC-P.526-16-202511-I/en" target="_blank"
          rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>UIT-R P.526-16</a>.
        Factor de radio terrestre k = 4/3 (supuesto), 60% de Fresnel, tolerancia de decisión 10 m
        <strong> no calibrada</strong>. Malla DEM 33×33 sin obstáculos de edificios/árboles, sin
        difracción ni pérdidas reales de radio. Verificar in situ, permisos del operador, banda y potencia.
        No se obtiene GPS del usuario ni se activa ningún transmisor.
      </footer>
    </section>
  );
}
