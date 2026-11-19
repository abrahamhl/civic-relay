'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, Crosshair, Layers } from 'lucide-react';
import type { Locale } from '../data/types';
import type { LayerId, MapEntity, PlatformScenario } from './platform-data';

interface LandData {
  rings: number[][];
}

export interface SnapshotPoint {
  id: string;
  source: 'GDACS' | 'DGT' | 'NDW' | 'USGS';
  lat: number;
  lon: number;
  title: string;
}

interface TacticalMapProps {
  locale: Locale;
  scenario: PlatformScenario;
  layers: Record<LayerId, boolean>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentMinute: number;
  zoneDeclared: boolean;
  relayActive: boolean;
  snapshotPoints: SnapshotPoint[];
}

export default function TacticalMap({
  locale,
  scenario,
  layers,
  selectedId,
  onSelect,
  currentMinute,
  zoneDeclared,
  relayActive,
  snapshotPoints
}: TacticalMapProps) {
  const [land, setLand] = useState<LandData | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const maplibreRef = useRef<HTMLDivElement>(null);
  const [maplibreReady, setMaplibreReady] = useState(false);

  // Reset pan/zoom when scenario changes
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  }, [scenario.id]);

  // Load offline Natural Earth 1:110m land rings once
  useEffect(() => {
    let active = true;
    fetch('/geo/land-110m.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.rings) setLand(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Optional progressive MapLibre GL vector backdrop (offline GeoJSON style, fails gracefully if WebGL absent)
  useEffect(() => {
    const container = maplibreRef.current;
    if (!container || !land) return;
    let mapInstance: { remove: () => void } | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        // Test WebGL support first to avoid noisy console errors in headless environments
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) return;

        const maplibregl = await import('maplibre-gl');
        if (cancelled) return;
        if (typeof maplibregl.setWorkerUrl === 'function') {
          maplibregl.setWorkerUrl('/vendor/maplibre-gl-worker.mjs');
        }

        const features = land.rings
          .filter((ring) => ring.length >= 8)
          .map((ring) => {
            const coords: [number, number][] = [];
            for (let i = 0; i < ring.length - 1; i += 2) {
              coords.push([ring[i], ring[i + 1]]);
            }
            if (coords.length > 0) coords.push(coords[0]);
            return {
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'Polygon' as const, coordinates: [coords] }
            };
          });

        const isDark =
          document.documentElement.getAttribute('data-theme') === 'dark' ||
          (document.documentElement.getAttribute('data-theme') !== 'light' &&
            window.matchMedia?.('(prefers-color-scheme: dark)').matches);

        const map = new maplibregl.Map({
          container,
          interactive: false,
          attributionControl: false,
          center: scenario.regionCenter,
          zoom: scenario.regionZoom,
          style: {
            version: 8,
            sources: {
              land: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features }
              }
            },
            layers: [
              {
                id: 'bg',
                type: 'background',
                paint: { 'background-color': isDark ? '#0b0e14' : '#eef2f7' }
              },
              {
                id: 'land-fill',
                type: 'fill',
                source: 'land',
                paint: {
                  'fill-color': isDark ? '#151b26' : '#ffffff',
                  'fill-outline-color': isDark ? '#273244' : '#cbd5e1'
                }
              }
            ]
          }
        });
        mapInstance = map;
        map.on('load', () => {
          if (!cancelled) setMaplibreReady(true);
        });
      } catch {
        // Cleanly fall back to SVG Natural Earth projection
      }
    };

    init();
    return () => {
      cancelled = true;
      setMaplibreReady(false);
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch {
          // ignore
        }
      }
    };
  }, [land, scenario.id, scenario.regionCenter, scenario.regionZoom]);

  const W = 900;
  const H = 560;

  // Project lon/lat into SVG viewport around scenario bbox
  const project = useMemo(() => {
    const { minLon, maxLon, minLat, maxLat } = scenario.bbox;
    const padLon = (maxLon - minLon) * 0.25;
    const padLat = (maxLat - minLat) * 0.25;
    const lo0 = minLon - padLon;
    const lo1 = maxLon + padLon;
    const la0 = minLat - padLat;
    const la1 = maxLat + padLat;
    return (lon: number, lat: number): [number, number] => {
      const x = ((lon - lo0) / (lo1 - lo0)) * W;
      const y = H - ((lat - la0) / (la1 - la0)) * H;
      return [x, y];
    };
  }, [scenario.bbox]);

  // Precompute visible coastline SVG paths when MapLibre is not active
  const landPaths = useMemo(() => {
    if (!land || maplibreReady) return [];
    const { minLon, maxLon, minLat, maxLat } = scenario.bbox;
    const marginLon = (maxLon - minLon) * 2.5 + 8;
    const marginLat = (maxLat - minLat) * 2.5 + 8;
    const out: string[] = [];
    for (const ring of land.rings) {
      let intersects = false;
      for (let i = 0; i < ring.length - 1; i += 2) {
        const lo = ring[i];
        const la = ring[i + 1];
        if (
          lo >= minLon - marginLon &&
          lo <= maxLon + marginLon &&
          la >= minLat - marginLat &&
          la <= maxLat + marginLat
        ) {
          intersects = true;
          break;
        }
      }
      if (!intersects) continue;
      let d = '';
      for (let i = 0; i < ring.length - 1; i += 2) {
        const [x, y] = project(ring[i], ring[i + 1]);
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      out.push(`${d}Z`);
    }
    return out;
  }, [land, maplibreReady, project, scenario.bbox]);

  const visibleEntities = scenario.entities.filter((e) => layers[e.layer]);

  // Filter real snapshot points inside extended viewport
  const visibleSnapshots = useMemo(() => {
    if (!layers.incidents && !layers.hazard && !layers.infrastructure) return [];
    const { minLon, maxLon, minLat, maxLat } = scenario.bbox;
    const mLon = (maxLon - minLon) * 1.2 + 2.5;
    const mLat = (maxLat - minLat) * 1.2 + 2.0;
    return snapshotPoints
      .filter(
        (pt) =>
          pt.lon >= minLon - mLon &&
          pt.lon <= maxLon + mLon &&
          pt.lat >= minLat - mLat &&
          pt.lat <= maxLat + mLat
      )
      .slice(0, 28);
  }, [layers.hazard, layers.incidents, layers.infrastructure, scenario.bbox, snapshotPoints]);

  const [anchorX, anchorY] = project(scenario.regionCenter[0], scenario.regionCenter[1]);
  const routeDelivered = currentMinute >= scenario.sendaEtaMin;

  const colorForEntity = (e: MapEntity) => {
    if (e.kind === 'event') return 'var(--s-crit)';
    if (e.kind === 'sensor') return 'var(--s-warn)';
    if (e.kind === 'route') return 'var(--s-accent)';
    if (e.kind === 'team') return 'var(--s-ok)';
    return 'var(--s-sim)';
  };

  return (
    <div
      style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', height: '100%', userSelect: 'none' }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, [data-entity-node]')) return;
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      }}
      onPointerMove={(e) => {
        if (!dragging || !dragStart.current) return;
        setPan({
          x: dragStart.current.px + (e.clientX - dragStart.current.x),
          y: dragStart.current.py + (e.clientY - dragStart.current.y)
        });
      }}
      onPointerUp={() => {
        setDragging(false);
        dragStart.current = null;
      }}
      onPointerLeave={() => {
        setDragging(false);
        dragStart.current = null;
      }}
    >
      {/* MapLibre GL canvas backdrop (offline GeoJSON style) */}
      <div
        ref={maplibreRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: maplibreReady ? 0.92 : 0,
          pointerEvents: 'none'
        }}
      />

      {/* Interactive Tactical Vector Overlay */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={scenario.name[locale]}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: dragging ? 'grabbing' : 'grab'
        }}
      >
        <defs>
          <pattern id="cc-grid" width="45" height="45" patternUnits="userSpaceOnUse">
            <path d="M45 0H0V45" fill="none" stroke="var(--s-text)" strokeOpacity="0.08" strokeWidth="1" />
          </pattern>
        </defs>

        {!maplibreReady && <rect width={W} height={H} fill="var(--s-bg-sunk)" />}
        <rect width={W} height={H} fill="url(#cc-grid)" />

        <g transform={`translate(${W / 2 + pan.x}, ${H / 2 + pan.y}) scale(${zoomScale}) translate(${-W / 2}, ${-H / 2})`}>
          {/* Fallback Natural Earth coastlines */}
          {!maplibreReady &&
            landPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="var(--s-accent-soft)"
                fillOpacity="0.45"
                stroke="var(--s-line-strong)"
                strokeWidth={1.2 / zoomScale}
              />
            ))}

          {/* Topographic reference range rings around anchor */}
          <g opacity={0.45}>
            <circle cx={anchorX} cy={anchorY} r={190} fill="none" stroke="var(--s-line-strong)" strokeWidth={1 / zoomScale} strokeDasharray="2 6" />
            <circle cx={anchorX} cy={anchorY} r={280} fill="none" stroke="var(--s-line-strong)" strokeWidth={1 / zoomScale} strokeDasharray="2 8" />
          </g>

          {/* Coverage / Outage Zone */}
          {layers.coverage && (
            <g>
              <circle
                cx={anchorX}
                cy={anchorY}
                r={zoneDeclared ? 128 : 96}
                fill={zoneDeclared ? 'var(--s-accent)' : 'var(--s-crit)'}
                fillOpacity={zoneDeclared ? 0.1 : 0.08}
                stroke={zoneDeclared ? 'var(--s-accent)' : 'var(--s-crit)'}
                strokeWidth={1.6 / zoomScale}
                strokeDasharray="6 5"
              />
              {relayActive && (
                <circle
                  cx={anchorX}
                  cy={anchorY}
                  r={154}
                  fill="none"
                  stroke="var(--s-ok)"
                  strokeWidth={1.4 / zoomScale}
                  strokeDasharray="3 5"
                />
              )}
            </g>
          )}

          {/* Real Observed Snapshot Markers (GDACS / DGT / NDW / USGS) */}
          {visibleSnapshots.map((pt) => {
            const [sx, sy] = project(pt.lon, pt.lat);
            return (
              <g key={pt.id} opacity={0.78}>
                <circle
                  cx={sx}
                  cy={sy}
                  r={3.5 / zoomScale}
                  fill="var(--s-obs)"
                  stroke="var(--s-bg-elev)"
                  strokeWidth={1 / zoomScale}
                >
                  <title>{`[OBSERVED SNAPSHOT · ${pt.source}] ${pt.title}`}</title>
                </circle>
              </g>
            );
          })}

          {/* Multipath Routes */}
          {layers.routes &&
            scenario.routes.map((route) => {
              const [x1, y1] = project(route.from[0], route.from[1]);
              const [x2, y2] = project(route.to[0], route.to[1]);
              const [vx, vy] = route.via
                ? project(route.via[0], route.via[1])
                : [(x1 + x2) / 2, (y1 + y2) / 2 - 42];
              const active = currentMinute >= Math.min(route.etaMin, 2);
              const delivered = currentMinute >= route.etaMin;
              const stroke =
                route.channel === 'ble-sat'
                  ? delivered
                    ? 'var(--s-ok)'
                    : 'var(--s-accent)'
                  : 'var(--s-warn)';

              return (
                <g key={route.id} opacity={active ? 0.95 : 0.35}>
                  <path
                    d={`M${x1},${y1} Q${vx},${vy} ${x2},${y2}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={(route.channel === 'ble-sat' ? 2.6 : 1.7) / zoomScale}
                    className={active ? 's-route-anim' : undefined}
                  />
                  <text
                    x={vx}
                    y={vy - 10 / zoomScale}
                    textAnchor="middle"
                    fill="var(--s-text-2)"
                    fontSize={11 / zoomScale}
                    fontWeight="600"
                  >
                    {route.label[locale]}
                  </text>
                </g>
              );
            })}

          {/* Interactive Scenario Entities */}
          {visibleEntities.map((entity) => {
            const [ex, ey] = project(entity.lon, entity.lat);
            const isSelected = entity.id === selectedId;
            const visibleAtTime = currentMinute >= entity.timeOffsetMin || entity.kind === 'event';
            const color = colorForEntity(entity);

            return (
              <g
                key={entity.id}
                data-entity-node={entity.id}
                transform={`translate(${ex}, ${ey})`}
                opacity={visibleAtTime ? 1 : 0.4}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={entity.title[locale]}
                onClick={() => onSelect(entity.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect(entity.id);
                  }
                }}
              >
                {isSelected && (
                  <circle
                    r={18 / zoomScale}
                    fill={color}
                    fillOpacity="0.2"
                    stroke={color}
                    strokeWidth={1.6 / zoomScale}
                  />
                )}
                {entity.kind === 'event' && (
                  <circle r={13 / zoomScale} fill={color} fillOpacity="0.22" className="s-pulse" />
                )}
                <circle
                  r={(isSelected ? 8.5 : 6.5) / zoomScale}
                  fill={color}
                  stroke="var(--s-bg-elev)"
                  strokeWidth={2 / zoomScale}
                />
                <rect
                  x={11 / zoomScale}
                  y={-12 / zoomScale}
                  width={Math.min(186, entity.title[locale].length * 6.6 + 18) / zoomScale}
                  height={22 / zoomScale}
                  rx={6 / zoomScale}
                  fill="var(--s-bg-elev)"
                  fillOpacity="0.92"
                  stroke={isSelected ? color : 'var(--s-line)'}
                  strokeWidth={1 / zoomScale}
                />
                <text
                  x={18 / zoomScale}
                  y={3 / zoomScale}
                  fill="var(--s-text)"
                  fontSize={11 / zoomScale}
                  fontWeight={isSelected ? '600' : '500'}
                >
                  {entity.title[locale].slice(0, 28)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom / Reset Controls */}
      <div className="cc-map-controls" role="group" aria-label="Map controls">
        <button
          type="button"
          className="cc-map-btn"
          aria-label="Zoom in"
          onClick={() => setZoomScale((z) => Math.min(3, +(z * 1.25).toFixed(2)))}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="cc-map-btn"
          aria-label="Zoom out"
          onClick={() => setZoomScale((z) => Math.max(0.65, +(z / 1.25).toFixed(2)))}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="cc-map-btn"
          aria-label="Reset view"
          onClick={() => {
            setZoomScale(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Crosshair size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Floating Status Legend */}
      <div className="cc-map-legend">
        <span className="s-row" style={{ gap: 5 }}>
          <Layers size={13} aria-hidden="true" />
          <strong style={{ color: 'var(--s-text)' }}>
            {maplibreReady ? 'MapLibre GL (Offline GeoJSON)' : 'Offline Vector Projection'}
          </strong>
        </span>
        <span className="s-row" style={{ gap: 5 }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--s-obs)', display: 'inline-block' }} />
          <span>
            {locale === 'es' ? `Snapshots reales (${visibleSnapshots.length})` : locale === 'nl' ? `Echte snapshots (${visibleSnapshots.length})` : `Real snapshots (${visibleSnapshots.length})`}
          </span>
        </span>
        <span className="s-row" style={{ gap: 5 }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: routeDelivered ? 'var(--s-ok)' : 'var(--s-accent)', display: 'inline-block' }} />
          <span>
            {routeDelivered
              ? locale === 'es'
                ? 'ACK simulado entregado'
                : locale === 'nl'
                ? 'Gesimuleerde ACK bezorgd'
                : 'Simulated ACK delivered'
              : locale === 'es'
              ? 'En tránsito (Simulado)'
              : locale === 'nl'
              ? 'Onderweg (Gesimuleerd)'
              : 'In transit (Simulated)'}
          </span>
        </span>
      </div>
    </div>
  );
}
