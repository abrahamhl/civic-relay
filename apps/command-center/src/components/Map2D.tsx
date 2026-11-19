import { useEffect, useMemo, useRef, useState } from 'react';
import type { CameraRecord } from '../types';
import { boundsOf, makeProjector } from '../lib/geo';

const COLORS: Record<string, string> = {
  tfl: '#3fe0c4',
  caltrans: '#63a8ff',
};

export function Map2D({
  cameras,
  selectedId,
  onSelect,
  label,
}: {
  cameras: CameraRecord[];
  selectedId: string | null;
  onSelect: (camera: CameraRecord) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 460 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.max(rect.width, 320), height: Math.max(rect.height, 300) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(
    () => cameras.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon)),
    [cameras],
  );

  const bounds = useMemo(
    () => boundsOf(points.map((c) => ({ lon: c.lon as number, lat: c.lat as number }))),
    [points],
  );

  const projector = useMemo(
    () => (bounds ? makeProjector(bounds, { ...size, padding: 56 }) : null),
    [bounds, size],
  );

  if (points.length === 0 || !projector || !bounds) {
    return (
      <div className="map-frame">
        <div className="map-empty">
          No hay cámaras en la selección actual. Activa una capa o cambia de conjunto.
        </div>
      </div>
    );
  }

  const gridLines = 6;

  return (
    <div className="map-frame" ref={ref}>
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`Mapa 2D offline con ${points.length} cámaras reales (${label})`}
      >
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#0d1a26" />
            <stop offset="100%" stopColor="#060a10" />
          </radialGradient>
        </defs>
        <rect width={size.width} height={size.height} fill="url(#map-glow)" />

        {Array.from({ length: gridLines + 1 }).map((_, index) => {
          const x = (size.width / gridLines) * index;
          const y = (size.height / gridLines) * index;
          return (
            <g key={`grid-${index}`} stroke="rgba(120,160,200,0.10)" strokeWidth={1}>
              <line x1={x} y1={0} x2={x} y2={size.height} />
              <line x1={0} y1={y} x2={size.width} y2={y} />
            </g>
          );
        })}

        {points.map((camera) => {
          const point = projector({ lon: camera.lon as number, lat: camera.lat as number });
          const selected = camera.id === selectedId;
          const color = COLORS[camera.dataset] ?? '#93a3b8';
          const outOfService = camera.status === 'OUT_OF_SERVICE';
          return (
            <g
              key={camera.id}
              transform={`translate(${point.x} ${point.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${camera.name}, ${camera.provider}, ${outOfService ? 'fuera de servicio' : 'en servicio'}`}
              onClick={() => onSelect(camera)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(camera);
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {selected && <circle r={16} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={2} />}
              <circle r={9} fill="rgba(6,10,16,0.9)" stroke={color} strokeWidth={2} />
              <circle
                r={outOfService ? 3 : 4.5}
                fill={outOfService ? 'transparent' : color}
                stroke={outOfService ? color : 'none'}
                strokeWidth={1.5}
              />
              {outOfService && (
                <line x1={-5} y1={-5} x2={5} y2={5} stroke={color} strokeWidth={1.5} />
              )}
              {(selected || points.length <= 26) && (
                <text className="marker-label" x={13} y={4}>
                  {camera.name.length > 34 ? `${camera.name.slice(0, 33)}…` : camera.name}
                </text>
              )}
              <title>
                {camera.name} · {camera.dataset.toUpperCase()} · {camera.status}
              </title>
            </g>
          );
        })}

        <text x={16} y={size.height - 16} fill="#5f6f84" fontSize={10} fontFamily="var(--mono)">
          {bounds.minLat.toFixed(2)}..{bounds.maxLat.toFixed(2)}°N ·{' '}
          {bounds.minLon.toFixed(2)}..{bounds.maxLon.toFixed(2)}°E · sin teselas externas
        </text>
      </svg>

      <div className="map-overlay">
        <span className="chip">
          <span className="dot info" aria-hidden="true" />
          Proyección equirectangular offline
        </span>
        <span className="chip">
          <span className="dot warn" aria-hidden="true" />
          Sin basemap: no se descargan teselas
        </span>
      </div>
    </div>
  );
}
