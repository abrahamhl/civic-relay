import type { TerrainGridSnapshot } from '../offline/terrain-snapshot';
import type { WeatherMetric, WeatherSnapshot } from '../offline/weather-snapshot';

/**
 * Deterministic perspective painter for sampled Earth elevations.
 * Geographic dimensions are scaled in approximate meters, not fictitious heights.
 * Vertical exaggeration is a declared visualization parameter and must be 1–6.
 */
type Vec3 = { x: number; y: number; z: number };
type Screen = { x: number; y: number; d: number };
type Triangle = { pts: Screen[]; depth: number; color: string };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function modelValue(model: WeatherSnapshot, u: number, vNorthToSouth: number, frame: number, metric: WeatherMetric): number {
  const x = clamp(u, 0, 1) * 2;
  const y = (1 - clamp(vNorthToSouth, 0, 1)) * 2; // weather provider's rows are south-to-north
  const c = Math.min(1, Math.floor(x)), r = Math.min(1, Math.floor(y));
  const dx = x - c, dy = y - r;
  const at = (row: number, col: number) => model.points[row * 3 + col].values[metric][frame];
  return lerp(lerp(at(r, c), at(r, c + 1), dx), lerp(at(r + 1, c), at(r + 1, c + 1), dx), dy);
}

const VARIABLE_RANGE: Record<WeatherMetric, [number, number]> = {
  temperature_2m: [-10, 45],
  wind_speed_10m: [0, 90],
  precipitation: [0, 30],
  relative_humidity_2m: [0, 100]
};

function groundColor(elevationM: number, lo: number, hi: number, light = 1): string {
  const t = clamp((elevationM - lo) / Math.max(1, hi - lo), 0, 1);
  const hue = lerp(132, 30, t);
  return 'hsl(' + hue.toFixed(0) + ', ' + (50 * light).toFixed(0) + '%, ' + (33 + t * 33).toFixed(0) + '%)';
}
function weatherColor(v: number, metric: WeatherMetric): string {
  const [min, max] = VARIABLE_RANGE[metric];
  const t = clamp((v - min) / (max - min), 0, 1);
  return 'hsla(' + (220 - t * 205).toFixed(0) + ', 84%, ' + (36 + t * 22).toFixed(0) + '%, 0.92)';
}

/**
 * Produces a topographic mesh with wind observation model overlays in 3D.
 * IMPORTANT: DEM comes from derived raster static heights; no real building interiors.
 * Weather at these locations is interpolated from nine forecast points, not sampled
 * from local sensors. Visual layers share georeference, not measurement precision.
 */
export function renderGeographicTerrain(
  canvas: HTMLCanvasElement, terrain: TerrainGridSnapshot,
  forecast: WeatherSnapshot | null, frame: number, metric: WeatherMetric,
  yaw: number, pitch: number, zoom: number, exaggeration = 3,
  overlayWeather = true
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const backdrop = ctx.createLinearGradient(0, 0, 0, h);
  backdrop.addColorStop(0, '#051425');
  backdrop.addColorStop(1, '#102c3a');
  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, w, h);

  const M = Math.max(terrain.georeference.approximateWidthM, terrain.georeference.approximateHeightM);
  const worldW = 3.05 * terrain.georeference.approximateWidthM / M;
  const worldH = 3.05 * terrain.georeference.approximateHeightM / M;
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const terrainHeights = terrain.elevationsM;
  const minHeight = terrain.summary.minElevationM;
  const exag = clamp(exaggeration, 1, 6);
  const nx = terrain.columns, ny = terrain.rows;

  const project = (p: Vec3): Screen => {
    const rx = p.x * cosYaw - p.z * sinYaw;
    const rz = p.x * sinYaw + p.z * cosYaw;
    const ry = p.y * cosPitch - rz * sinPitch;
    const depth = rz * cosPitch + p.y * sinPitch;
    const scale = Math.min(w, h) * zoom / Math.max(2, 4.5 + depth);
    return { x: w / 2 + rx * scale, y: h * .56 - ry * scale, d: depth };
  };
  const heightAt = (row: number, col: number) => terrainHeights[row * nx + col];
  const coordinate = (row: number, col: number): Vec3 => ({
    x: (col / (nx - 1) - .5) * worldW,
    z: (row / (ny - 1) - .5) * worldH,
    y: .08 + (heightAt(row, col) - minHeight) * 3.05 / M * exag,
  });
  const line = (a: Vec3, b: Vec3, stroke: string, weight = 1) => {
    const p = project(a), q = project(b);
    ctx.strokeStyle = stroke; ctx.lineWidth = weight;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  };

  const time = forecast && forecast.times[frame] ? forecast.times[frame] : null;
  const canOverlay = Boolean(forecast && time && overlayWeather);
  const faces: Triangle[] = [];
  for (let row = 0; row < ny - 1; row++) for (let col = 0; col < nx - 1; col++) {
    const indices = [
      [row, col], [row, col + 1], [row + 1, col], [row + 1, col + 1]
    ];
    const mesh = indices.map(([r, c]) => ({
      position: coordinate(r, c),
      h: heightAt(r, c),
      weather: canOverlay ? modelValue(forecast!, c / (nx - 1), r / (ny - 1), frame, metric) : 0
    }));
    for (const tri of [[mesh[0], mesh[1], mesh[2]], [mesh[1], mesh[3], mesh[2]]]) {
      const pts = tri.map((p) => project(p.position));
      const value = tri.reduce((acc, p) => acc + p.h, 0) / 3;
      const weather = tri.reduce((acc, p) => acc + p.weather, 0) / 3;
      faces.push({
        pts,
        depth: pts.reduce((acc, p) => acc + p.d, 0) / 3,
        color: canOverlay ? weatherColor(weather, metric) : groundColor(value, minHeight, terrain.summary.maxElevationM),
      });
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  for (const face of faces) {
    ctx.beginPath();
    ctx.moveTo(face.pts[0].x, face.pts[0].y);
    ctx.lineTo(face.pts[1].x, face.pts[1].y);
    ctx.lineTo(face.pts[2].x, face.pts[2].y);
    ctx.closePath();
    ctx.fillStyle = face.color; ctx.fill();
    ctx.strokeStyle = 'rgba(207,234,246,.09)'; ctx.lineWidth = .35; ctx.stroke();
  }
  // Nine meteorological sample positions are drawn on top of real terrain, not placed
  // at a fictitious atmospheric altitude. Only valid when weather data are present.
  if (canOverlay && forecast) {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const r = Math.round(row * (ny - 1) / 2);
      const c = Math.round(col * (nx - 1) / 2);
      const pos = coordinate(r, c);
      const indicator = project({ ...pos, y: pos.y + .025 });
      ctx.beginPath();
      ctx.arc(indicator.x, indicator.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#eff6ff'; ctx.fill();
      ctx.strokeStyle = '#020617'; ctx.lineWidth = 1.2; ctx.stroke();
      const weatherIndex = (2 - row) * 3 + col;
      const met = forecast.points[weatherIndex].values;
      const speed = met.wind_speed_10m[frame];
      const fromDirection = met.wind_direction_10m[frame];
      const towardRad = (fromDirection + 180) * Math.PI / 180;
      // +x east and +z south. Meteorological direction is FROM true north.
      const length = clamp(speed / 150, .06, .30);
      const end = { x: pos.x + Math.sin(towardRad) * length,
        y: pos.y + .10, z: pos.z - Math.cos(towardRad) * length };
      line({ ...pos, y: pos.y + .10 }, end, '#a5f3fc', 1.8);
    }
  }

  // Geospatial border and known dimensions (approx geodesic; DEM vertical datum unverified).
  const base = (r: number, c: number): Vec3 => ({ ...coordinate(r, c), y: 0 });
  line(base(0, 0), base(0, nx - 1), '#7dd3fc', 1.2);
  line(base(0, nx - 1), base(ny - 1, nx - 1), '#7dd3fc', 1.2);
  line(base(ny - 1, nx - 1), base(ny - 1, 0), '#7dd3fc', 1.2);
  line(base(ny - 1, 0), base(0, 0), '#7dd3fc', 1.2);
  ctx.textAlign = 'left';
  ctx.font = '600 12px system-ui'; ctx.fillStyle = '#e2f7ff';
  ctx.fillText('DEM MAPZEN · RELIEVE GEOGRÁFICO REAL', 16, 25);
  ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(196,224,237,.86)';
  ctx.fillText('Elevación ' + terrain.summary.minElevationM.toFixed(0) + '–' +
    terrain.summary.maxElevationM.toFixed(0) + ' m · escala vertical ×' + exag, 16, 43);
  ctx.fillText('EPSG:4326 · ' + (terrain.georeference.approximateWidthM / 1000).toFixed(1) +
    ' × ' + (terrain.georeference.approximateHeightM / 1000).toFixed(1) + ' km · datum vertical sin validar', 16, 60);
  ctx.fillText(canOverlay ? 'Color: pronóstico meteorológico interpolado · puntos blancos: modelo' :
    'Color: altitud DEM · la geometría procede de raster público', 16, h - 18);
}
