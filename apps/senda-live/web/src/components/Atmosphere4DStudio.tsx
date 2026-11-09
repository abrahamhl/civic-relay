import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { renderGeographicTerrain } from './Terrain4DRenderer';
import { loadTerrainGrid, saveTerrainGrid, validateTerrainSnapshot, type TerrainGridSnapshot } from '../offline/terrain-snapshot';
import {
  loadPublicWeatherSnapshot, persistPublicWeatherSnapshot, weatherSnapshotExpired,
  type WeatherMetric, type WeatherSnapshot
} from '../offline/weather-snapshot';

type Vector3 = { x: number; y: number; z: number };
type ScreenPoint = { x: number; y: number; depth: number };
type MetricInfo = { name: string; unit: string; min: number; max: number; color: string };

const METRICS: Record<WeatherMetric, MetricInfo> = {
  temperature_2m: { name: 'Temperatura 2 m', unit: '°C', min: -10, max: 45, color: '#fb7185' },
  wind_speed_10m: { name: 'Viento 10 m', unit: 'km/h', min: 0, max: 90, color: '#38bdf8' },
  precipitation: { name: 'Precipitación horaria', unit: 'mm', min: 0, max: 25, color: '#818cf8' },
  relative_humidity_2m: { name: 'Humedad relativa', unit: '%', min: 0, max: 100, color: '#2dd4bf' }
};

const REGION_CENTERS: Record<string, { lat: number; lon: number; label: string }> = {
  valencia: { lat: 39.4699, lon: -0.3763, label: 'Valencia, España' },
  madrid: { lat: 40.4168, lon: -3.7038, label: 'Madrid, España' },
  arnhem: { lat: 51.9851, lon: 5.8987, label: 'Arnhem, Países Bajos' },
  veenendaal: { lat: 52.0286, lon: 5.5589, label: 'Veenendaal, Países Bajos' }
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function readValue(snapshot: WeatherSnapshot, r: number, c: number, frame: number, metric: WeatherMetric) {
  return snapshot.points[r * 3 + c].values[metric][frame];
}

/** Bilinear smoothing is a visual aid ONLY and does not add independent spatial resolution. */
function sampleValue(snapshot: WeatherSnapshot, u: number, v: number, frame: number, metric: WeatherMetric) {
  const xx = clamp(u * 2, 0, 2), zz = clamp(v * 2, 0, 2);
  const c = Math.min(1, Math.floor(xx)), r = Math.min(1, Math.floor(zz));
  const dx = xx - c, dz = zz - r;
  return mix(
    mix(readValue(snapshot, r, c, frame, metric), readValue(snapshot, r, c + 1, frame, metric), dx),
    mix(readValue(snapshot, r + 1, c, frame, metric), readValue(snapshot, r + 1, c + 1, frame, metric), dx),
    dz
  );
}
function norm(v: number, metric: MetricInfo) {
  return clamp((v - metric.min) / (metric.max - metric.min), 0, 1);
}
function heatColor(t: number, alpha = 0.9) {
  const hue = 224 - t * 204;
  return 'hsla(' + hue.toFixed(0) + ', 87%, ' + (40 + t * 22).toFixed(0) + '%, ' + alpha + ')';
}

function drawScene(
  canvas: HTMLCanvasElement, snapshot: WeatherSnapshot, frame: number,
  metricKey: WeatherMetric, yaw: number, pitch: number, zoom: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#071427');
  bg.addColorStop(1, '#0d2236');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const info = METRICS[metricKey], cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  function project(p: Vector3): ScreenPoint {
    const rx = p.x * cosYaw - p.z * sinYaw;
    const rz = p.x * sinYaw + p.z * cosYaw;
    const ry = p.y * cosPitch - rz * sinPitch;
    const depth = rz * cosPitch + p.y * sinPitch;
    const s = Math.min(w, h) * zoom / (4.5 + depth);
    return { x: w / 2 + rx * s, y: h * 0.58 - ry * s, depth };
  }
  function line(a: Vector3, b: Vector3, stroke: string, weight = 1) {
    const pa = project(a), pb = project(b);
    ctx.strokeStyle = stroke; ctx.lineWidth = weight;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  // Base grid is a reference plane; surface height encodes one selected model variable,
  // NEVER measured terrain or a physically simulated atmospheric altitude.
  for (let i = 0; i <= 8; i++) {
    const k = -1.55 + i * 3.1 / 8;
    line({ x: -1.55, y: -0.12, z: k }, { x: 1.55, y: -0.12, z: k }, '#29445c', 0.7);
    line({ x: k, y: -0.12, z: -1.55 }, { x: k, y: -0.12, z: 1.55 }, '#29445c', 0.7);
  }
  const GRID = 18;
  const vertices: { position: Vector3; value: number; shade: number }[][] = [];
  for (let r = 0; r <= GRID; r++) {
    const row = [];
    for (let c = 0; c <= GRID; c++) {
      const u = c / GRID, v = r / GRID;
      const value = sampleValue(snapshot, u, v, frame, metricKey);
      const shade = norm(value, info);
      row.push({
        position: { x: (u - 0.5) * 3.05, y: 0.15 + 1.7 * shade, z: (v - 0.5) * 3.05 },
        value, shade
      });
    }
    vertices.push(row);
  }
  const faces: { pts: ScreenPoint[]; depth: number; shade: number }[] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const a = vertices[r][c], b = vertices[r][c + 1], d = vertices[r + 1][c], e = vertices[r + 1][c + 1];
    for (const tri of [[a, b, d], [b, e, d]]) {
      const pts = tri.map((t) => project(t.position));
      faces.push({
        pts, depth: pts.reduce((s, p) => s + p.depth, 0) / 3,
        shade: tri.reduce((s, p) => s + p.shade, 0) / 3
      });
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) {
    ctx.beginPath(); ctx.moveTo(f.pts[0].x, f.pts[0].y);
    ctx.lineTo(f.pts[1].x, f.pts[1].y);
    ctx.lineTo(f.pts[2].x, f.pts[2].y);
    ctx.closePath();
    ctx.fillStyle = heatColor(f.shade, 0.88); ctx.fill();
    ctx.strokeStyle = 'rgba(160,210,240,.085)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // Real provider-derived sample locations, distinguishable from visual interpolations.
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    const u = c / 2, v = r / 2;
    const value = snapshot.points[i].values[metricKey][frame];
    const top = { x: (u - .5) * 3.05, y: .15 + 1.7 * norm(value, info), z: (v - .5) * 3.05 };
    line({ ...top, y: -.12 }, top, 'rgba(180,225,255,.55)', 1.1);
    const dot = project(top);
    ctx.beginPath(); ctx.arc(dot.x, dot.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f9ff'; ctx.fill();
    ctx.strokeStyle = '#061221'; ctx.lineWidth = 1.4; ctx.stroke();
    const wind = snapshot.points[i].values.wind_direction_10m[frame];
    const speed = snapshot.points[i].values.wind_speed_10m[frame];
    // Meteorological wind direction denotes FROM north; wind arrow points toward +180°.
    const destinationRadians = (wind + 180) * Math.PI / 180;
    const length = clamp(speed / 100, 0.1, 0.42);
    const next = {
      x: top.x + Math.sin(destinationRadians) * length,
      y: top.y + 0.17,
      z: top.z + Math.cos(destinationRadians) * length
    };
    line({ ...top, y: top.y + .17 }, next, '#a5f3fc', 2);
    const tip = project(next);
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = '#a5f3fc'; ctx.fill();
  }
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(226,242,255,.86)';
  ctx.font = '600 12px system-ui';
  ctx.fillText('NWP · 9 nodos de modelo · 24 horas', 16, 25);
  ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(188,214,235,.75)';
  ctx.fillText('Extruido por variable, no relieve terrestre · interpolación visual', 16, 44);
  ctx.fillText('Arrastrar para orbitar · rueda/pellizco del navegador para acercar', 16, h - 17);
}

export function Atmosphere4DStudio({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [region, setRegion] = useState('valencia');
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [sourceMode, setSourceMode] = useState('WAITING');
  const [terrain, setTerrain] = useState<TerrainGridSnapshot | null>(null);
  const [terrainStatus, setTerrainStatus] = useState('WAITING');
  const [terrainMode, setTerrainMode] = useState<'FORECAST' | 'TERRAIN'>('TERRAIN');
  const [verticalExaggeration, setVerticalExaggeration] = useState(3);
  const [loading, setLoading] = useState(true);
  const [frame, setFrame] = useState(0);
  const [metric, setMetric] = useState<WeatherMetric>('temperature_2m');
  const [yaw, setYaw] = useState(.55);
  const [pitch, setPitch] = useState(.75);
  const [zoom, setZoom] = useState(1.45);
  const [playing, setPlaying] = useState(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPlaying(false);
    setFrame(0);
    setSnapshot(null);
    setSourceMode('WAITING');
    const load = async () => {
      const cached = await loadPublicWeatherSnapshot(region);
      if (!active) return;
      if (cached) {
        setSnapshot(cached);
        setSourceMode(weatherSnapshotExpired(cached) ? 'OFFLINE_EXPIRED_FORECAST' : 'OFFLINE_LOCAL_SNAPSHOT');
      }
      try {
        const remote: any = await api.getWeatherGrid(region);
        if (!active) return;
        if (remote.status === 'SOURCE_SNAPSHOT' || remote.status === 'CACHED_SNAPSHOT' || remote.status === 'STALE_SNAPSHOT') {
          if (remote.schema !== 'senda.atmosphere.grid/1' || remote.region !== region) throw new Error('BAD_SNAPSHOT');
          setSnapshot(remote as WeatherSnapshot);
          await persistPublicWeatherSnapshot(remote as WeatherSnapshot);
          setSourceMode(remote.status === 'STALE_SNAPSHOT' ? 'SERVER_STALE_SNAPSHOT' : 'DOWNLOADED_MODEL_FORECAST');
        } else setSourceMode(cached ? 'OFFLINE_LOCAL_SNAPSHOT' : String(remote.status));
      } catch (error: any) {
        if (!active) return;
        const providerError = error?.code === 'ERROR' || error?.status === 503;
        if (!cached) setSourceMode(providerError ? 'PROVIDER_REQUIRES_CONFIGURATION' : 'NO_NETWORK_OR_PROVIDER');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [region]);

  // Terrain is a static georeferenced raster; it can be viewed independently from weather.
  useEffect(() => {
    let alive = true;
    setTerrain(null);
    setTerrainStatus('LOADING');
    const obtain = async () => {
      const local = await loadTerrainGrid(region);
      if (!alive) return;
      if (local) { setTerrain(local); setTerrainStatus('OFFLINE_LOCAL_DEM'); }
      try {
        const remote: any = await api.getTerrainGrid(region);
        if (!alive) return;
        if (validateTerrainSnapshot(remote) && remote.region === region) {
          setTerrain(remote);
          const saved = await saveTerrainGrid(remote);
          if (alive) setTerrainStatus(remote.status === 'STALE_SNAPSHOT' ? 'SERVER_STALE_DEM' :
            saved ? 'DOWNLOADED_PUBLIC_DEM' : 'DEM_CACHE_UNAVAILABLE');
        } else if (!local) setTerrainStatus('DEM_SOURCE_UNAVAILABLE');
      } catch {
        if (alive) setTerrainStatus(local ? 'OFFLINE_LOCAL_DEM' : 'DEM_SOURCE_UNAVAILABLE');
      }
    };
    void obtain();
    return () => { alive = false; };
  }, [region]);

  useEffect(() => {
    if (!playing || !snapshot) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % snapshot.times.length), 850);
    return () => window.clearInterval(timer);
  }, [playing, snapshot]);

  useEffect(() => {
    if (!canvasRef.current || (!snapshot && !terrain)) return;
    const canvas = canvasRef.current;
    const render = () => {
      if (terrain && (terrainMode === 'TERRAIN' || !snapshot)) {
        renderGeographicTerrain(canvas, terrain, snapshot, frame, metric, yaw, pitch, zoom, verticalExaggeration, !!snapshot);
      } else if (snapshot) drawScene(canvas, snapshot, frame, metric, yaw, pitch, zoom);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [snapshot, terrain, terrainMode, frame, metric, yaw, pitch, zoom, verticalExaggeration]);

  const selected = snapshot && snapshot.times[frame] ? new Date(snapshot.times[frame]) : null;
  const middle = snapshot?.points[4];
  const lastValid = snapshot && weatherSnapshotExpired(snapshot);
  const pointValue = middle?.values[metric]?.[frame];
  const link = REGION_CENTERS[region];
  const wazeUrl = 'https://waze.com/ul?ll=' + encodeURIComponent(link.lat + ',' + link.lon) + '&navigate=yes';

  return (
    <section data-testid="atmosphere4d-workbench" aria-label="SENDA Atmosphere 4D" style={{
      background: '#081625', color: '#e0f2fe', padding: '12px 16px 18px', minHeight: '100%',
      display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'system-ui, sans-serif'
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ fontSize: '17px', letterSpacing: '.06em' }}>SENDA / ATMOSPHERE 4D</strong>
          <div style={{ fontSize: 12, color: '#a9c3d8' }}>Banco geoespacial · evolución horaria · modo offline por snapshot</div>
        </div>
        <button type="button" onClick={onClose} style={{ border: '1px solid #47708b', background: '#0c2a43', color: 'white', padding: '8px 12px', borderRadius: 9 }}>
          Volver al mapa 2D
        </button>
      </header>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12 }}>Zona
          <select aria-label="Zona meteorológica" value={region} onChange={(e) => setRegion(e.target.value)}
            style={{ marginLeft: 6, background: '#18344b', color: 'white', padding: 7, borderRadius: 7 }}>
            {Object.entries(REGION_CENTERS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Superficie
          <select aria-label="Modo de superficie 3D" value={terrainMode} onChange={(e) => setTerrainMode(e.target.value as 'FORECAST' | 'TERRAIN')}
            style={{ marginLeft: 6, background: '#18344b', color: 'white', padding: 7, borderRadius: 7 }}>
            <option value="TERRAIN">Relieve terrestre real (DEM)</option>
            <option value="FORECAST">Superficie de variable meteorológica</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Variable
          <select aria-label="Variable meteorológica" value={metric}
            onChange={(e) => setMetric(e.target.value as WeatherMetric)}
            style={{ marginLeft: 6, background: '#18344b', color: 'white', padding: 7, borderRadius: 7 }}>
            {(Object.keys(METRICS) as WeatherMetric[]).map((key) =>
              <option key={key} value={key}>{METRICS[key].name}</option>)}
          </select>
        </label>
        {terrainMode === 'TERRAIN' && <label style={{ fontSize: 12 }}>Escala vertical ×{verticalExaggeration}
          <input aria-label="Exageración vertical del terreno" type="range" min="1" max="6" step="1" value={verticalExaggeration}
            onChange={(e) => setVerticalExaggeration(Number(e.target.value))} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
        </label>}
        <a href={wazeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7dd3fc', padding: 7 }}>
          Navegar a la zona con Waze
        </a>
      </div>
      <div role="status" aria-live="polite" style={{ fontSize: 12, color: loading ? '#fcd34d' : '#bae6fd', minHeight: 18 }}>
        {loading && !snapshot ? 'Abriendo fuentes locales y consultando proveedor…' :
          !snapshot ? 'Sin predicción utilizable: consulta MET Norway o abre un snapshot guardado previamente.' :
          sourceMode === 'OFFLINE_LOCAL_SNAPSHOT' || sourceMode === 'OFFLINE_EXPIRED_FORECAST'
            ? 'SNAPSHOT LOCAL · sin conexión nueva · ' + (lastValid ? 'predicción caducada' : 'predicción almacenada')
            : sourceMode === 'SERVER_STALE_SNAPSHOT' ? 'SNAPSHOT PREVIO EN SERVIDOR · proveedor sin actualización'
            : 'MODELO METEOROLÓGICO · ' + sourceMode}
      </div>
      <div data-testid="terrain-source-status" role="status" aria-live="polite" style={{ fontSize: 12, color: '#9bd9d5' }}>
        Relieve georreferenciado: {terrain ? terrainStatus + ' · ' + terrain.summary.minElevationM.toFixed(0) + '–' + terrain.summary.maxElevationM.toFixed(0) + ' m' : terrainStatus + ' · sin dato de altitud verificable'}.
      </div>
      <div style={{ position: 'relative', border: '1px solid #27475e', borderRadius: 12, overflow: 'hidden', minHeight: 270, flex: 1 }}>
        {(snapshot || terrain) ? (
          <canvas ref={canvasRef} className="senda-4d-canvas" aria-label="Visualizador tridimensional navegable de relieve geográfico y modelos meteorológicos" role="img" tabIndex={0}
            onPointerDown={(e) => { pointer.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => {
              if (!pointer.current) return;
              const dx = e.clientX - pointer.current.x, dy = e.clientY - pointer.current.y;
              pointer.current = { x: e.clientX, y: e.clientY };
              setYaw((v) => v + dx * .009);
              setPitch((v) => clamp(v + dy * .006, .22, 1.40));
            }}
            onPointerUp={() => { pointer.current = null; }}
            onPointerCancel={() => { pointer.current = null; }}
            onWheel={(e) => { e.preventDefault(); setZoom((v) => clamp(v * (e.deltaY > 0 ? .92 : 1.08), .75, 3)); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setYaw((v) => v - .14);
              if (e.key === 'ArrowRight') setYaw((v) => v + .14);
              if (e.key === 'ArrowUp') setPitch((v) => clamp(v - .10, .22, 1.4));
              if (e.key === 'ArrowDown') setPitch((v) => clamp(v + .10, .22, 1.4));
            }}
            style={{ display: 'block', width: '100%', height: 'clamp(265px, 43vh, 530px)', touchAction: 'none', cursor: 'grab' }} />
        ) : (
          <div style={{ minHeight: 270, padding: '40px 22px', color: '#bae6fd', textAlign: 'center' }}>
            <strong>Sin datos meteorológicos válidos</strong>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>El visor no inventa valores. MET Norway ofrece una fuente meteorológica pública reutilizable con atribución; una vez descargada, la cuadrícula se guarda en este dispositivo para consultarla sin red.</p>
          </div>
        )}
        {(snapshot || terrain) && <div style={{ position: 'absolute', right: 12, top: 12, fontSize: 11, background: '#081625cc',
          padding: 9, borderRadius: 7, textAlign: 'right', pointerEvents: 'none' }}>
          <div>{terrain && terrainMode === 'TERRAIN' ? 'Elevación: Mapzen Terrain Tiles' : 'Modelo: ' + (snapshot?.source.model || 'no disponible')}</div>
          <div>{terrain && terrainMode === 'TERRAIN' ? 'DEM · 33×33 muestras georreferenciadas' : '24 pasos horarios · 9 puntos modelo'}</div>
          <div style={{ color: '#7dd3fc' }}>{terrain && terrainMode === 'TERRAIN' ? 'Altitud raster · datum vertical sin verificar' : 'No es radar ni relieve terrestre'}</div>
        </div>}
      </div>
      {snapshot && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="button" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pausar tiempo' : 'Reproducir tiempo'}
              style={{ background: '#16628a', color: 'white', border: 0, borderRadius: 8, padding: '9px 14px' }}>
              {playing ? '❚❚ Pausa' : '▶ Reproducir'}
            </button>
            <input aria-label="Línea temporal de pronóstico" type="range" min={0} max={snapshot.times.length - 1}
              value={frame} onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
              style={{ flex: 1, minWidth: 100 }} />
            <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{selected?.toLocaleString('es-ES', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} UTC</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, alignItems: 'center' }}>
            <span>Centro del grid: <strong style={{ color: METRICS[metric].color }}>
              {typeof pointValue === 'number' ? pointValue.toFixed(1) : '—'} {METRICS[metric].unit}
            </strong></span>
            <span>Viento: <strong>{middle?.values.wind_speed_10m[frame].toFixed(1)} km/h</strong> desde <strong>
              {middle?.values.wind_direction_10m[frame].toFixed(0)}°</strong></span>
            <span>Precipitación: <strong>{middle?.values.precipitation[frame].toFixed(1)} mm/h</strong></span>
            <span>Temperatura: <strong>{middle?.values.temperature_2m[frame].toFixed(1)} °C</strong></span>
            <button type="button" onClick={() => { setYaw(.55); setPitch(.75); setZoom(1.45); }}
              style={{ background: '#19394f', color: 'white', padding: 6, border: '1px solid #426075', borderRadius: 6 }}>Restablecer cámara</button>
          </div>
          <div style={{ fontSize: 11, color: '#b6cbd9', lineHeight: 1.5 }}>
            Fuente: <a href={snapshot.source.provider === 'MET Norway' ? 'https://api.met.no/weatherapi/locationforecast/2.0/documentation' : 'https://open-meteo.com/en/docs'} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>{snapshot.source.provider}</a>.
            Descarga: {new Date(snapshot.fetchedAt).toLocaleString('es-ES')}. Huella SHA-256: {snapshot.source.rawSha256?.slice(0, 14)}…
            {terrain && terrainMode === 'TERRAIN' ? 'La geometría DEM utiliza elevaciones raster en metros; el color interpola el pronóstico meteorológico sobre ese relieve. El multiplicador vertical es visual.' : 'La superficie 3D extruye una variable, no representa elevaciones reales. La interpolación visual entre 9 muestras no aumenta precisión espacial.'}
            {' '}{lastValid ? 'Las fechas válidas del pronóstico han vencido.' : ''}
          </div>
        </>
      )}
      {terrain && <div style={{ fontSize: 11, color: '#b8cfdf', lineHeight: 1.5 }}>
        Relieve: <a href={terrain.source.registryUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>Mapzen / AWS Terrain Tiles</a>.
        {' '}Atribuciones de las fuentes originales: <a href={terrain.source.attributionUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>licencias y créditos de terreno</a>.
        Fecha de obtención: {new Date(terrain.acquiredAt).toLocaleString('es-ES')}.
        Vertical datum mixto sin verificación local; solo visualización, no decisiones topográficas críticas. Redistribución de paquetes de terreno pendiente de revisión de licencias.
      </div>}
      <footer style={{ fontSize: 11, color: '#9bb5c7', borderTop: '1px solid #25445e', paddingTop: 9 }}>
        Capas de sismos y acontecimientos NASA EONET: disponibles en el mapa 2D. RF, estaciones físicas, vídeo y telemetría personal requieren datos específicos verificables; no se mezclan con el pronóstico meteorológico.
        No se accede a GPS ni se registran desplazamientos al utilizar este visor.
      </footer>
    </section>
  );
}
