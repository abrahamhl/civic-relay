import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api/client';

interface Props {
  events: any[];
  onSelectEvent: (eventId: string) => void;
}

export const MapView: React.FC<Props> = ({ events, onSelectEvent }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const usgsLayerRef = useRef<L.LayerGroup | null>(null);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUsgs, setShowUsgs] = useState(false);
  const [usgsStatus, setUsgsStatus] = useState('');

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      // Centro por defecto: Valencia / España
      const map = L.map(mapContainerRef.current).setView([39.4699, -0.3763], 11);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> | SENDA LIVE',
        maxZoom: 18
      }).addTo(map);

      const markers = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = markers;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Actualizar marcadores al cambiar eventos o filtros
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    const filtered = events.filter((ev) => {
      if (filterType !== 'all' && ev.type !== filterType) return false;
      if (filterStatus !== 'all' && ev.status !== filterStatus) return false;
      if (searchQuery && !ev.title.toLowerCase().includes(searchQuery.toLowerCase()) && !ev.location?.label?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return Number.isFinite(ev.location?.lat) && Number.isFinite(ev.location?.lon);
    });

    filtered.forEach((ev) => {
      const isOfficial = ev.status === 'OFFICIAL_SOURCE_CONFIRMED';
      const isCorroborated = ev.status === 'CORROBORATED';
      const isDisputed = ev.status === 'DISPUTED';

      const color = isOfficial ? '#ef4444' : isCorroborated ? '#10b981' : isDisputed ? '#a855f7' : '#f59e0b';

      const customIcon = L.divIcon({
        className: 'senda-map-marker',
        html: `<div style="background-color:${color};width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;">!</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([ev.location.lat, ev.location.lon], { icon: customIcon });

      // Never interpolate community-authored titles or locations into innerHTML.
      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '200px';
      const heading = document.createElement('strong');
      heading.textContent = String(ev.title ?? 'Acontecimiento');
      popupContent.append(heading);
      const place = document.createElement('div');
      place.style.cssText = 'font-size:11px;color:#666;margin:6px 0';
      place.textContent = '📍 ' + String(ev.location.label || 'Ubicación aproximada (~1 km)');
      popupContent.append(place);
      const badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;margin-bottom:8px;';
      badge.style.backgroundColor = color + '22';
      badge.style.color = color;
      badge.textContent = String(ev.status ?? 'UNVERIFIED_REPORT');
      popupContent.append(badge);
      const buttonRow = document.createElement('div');
      const open = document.createElement('button');
      open.type = 'button';
      open.style.cssText = 'background:#e11d48;color:white;border:0;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:bold;cursor:pointer;width:100%';
      open.textContent = 'Ver acontecimiento';
      open.addEventListener('click', () => onSelectEvent(ev.id));
      buttonRow.append(open);
      popupContent.append(buttonRow);
      marker.bindPopup(popupContent);
      markersLayerRef.current?.addLayer(marker);
    });
  }, [events, filterType, filterStatus, searchQuery, onSelectEvent]);

  // Explicit opt-in source layer. Reports are historical USGS observations, never official crisis alerts.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !showUsgs) {
      usgsLayerRef.current?.clearLayers();
      return;
    }
    let active = true;
    const layer = L.layerGroup().addTo(map);
    usgsLayerRef.current = layer;
    setUsgsStatus('Consultando observaciones USGS...');
    api.getUsgsEarthquakes().then((snapshot: any) => {
      if (!active) return;
      const observations = Array.isArray(snapshot.observations) ? snapshot.observations : [];
      for (const obs of observations) {
        if (!Number.isFinite(obs.location?.lat) || !Number.isFinite(obs.location?.lon)) continue;
        const point = L.circleMarker([obs.location.lat, obs.location.lon], {
          radius: Math.max(5, Math.min(13, obs.magnitude * 1.4)),
          color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 0.65, weight: 1.5,
        });
        const detail = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = 'USGS · Magnitud ' + String(obs.magnitude);
        detail.append(title);
        const location = document.createElement('div');
        location.textContent = String(obs.place || 'Ubicación no indicada');
        detail.append(location);
        const date = document.createElement('small');
        date.textContent = 'Observado: ' + new Date(obs.observedAt).toLocaleString('es-ES');
        detail.append(date);
        const notice = document.createElement('div');
        notice.textContent = 'Dato del catálogo USGS · No es una alerta SENDA';
        notice.style.fontSize = '11px';
        detail.append(notice);
        if (typeof obs.url === 'string' && obs.url.startsWith('https://earthquake.usgs.gov/earthquakes/eventpage/')) {
          const link = document.createElement('a');
          link.href = obs.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Abrir registro original USGS';
          detail.append(link);
        }
        point.bindPopup(detail).addTo(layer);
      }
      const stamp = snapshot.source?.generatedAt ?? snapshot.fetchedAt;
      const time = stamp ? new Date(stamp).toLocaleString('es-ES') : 'desconocida';
      const freshness = snapshot.status === 'STALE_SNAPSHOT' ? 'Copia anterior; sin conexión actual' :
        snapshot.status === 'CACHED_SNAPSHOT' ? 'Copia reciente en servidor' : 'Consulta a fuente pública';
      setUsgsStatus(String(observations.length) + ' observaciones M≥4,5 (7 días). ' + freshness + '. Fuente: USGS · ' + time + '.');
    }).catch(() => {
      if (active) setUsgsStatus('Fuente USGS no disponible; no se muestran eventos inventados.');
    });
    return () => { active = false; layer.remove(); if (usgsLayerRef.current === layer) usgsLayerRef.current = null; };
  }, [showUsgs]);

  return (
    <div style={{ height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column' }}>
      {/* Map Control Bar */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar municipio, vía o suceso..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', flex: '1 1 200px', fontSize: '0.875rem' }}
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
        >
          <option value="all">Todas las categorías</option>
          <option value="flood">Inundaciones</option>
          <option value="fire">Incendios</option>
          <option value="traffic">Tráfico y cortes</option>
          <option value="weather">Meteorología</option>
          <option value="outage">Cortes de servicios</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
        >
          <option value="all">Todos los estados</option>
          <option value="OFFICIAL_SOURCE_CONFIRMED">Oficial confirmado</option>
          <option value="CORROBORATED">Corroborado (≥2 fuentes)</option>
          <option value="UNVERIFIED_REPORT">Reporte ciudadano</option>
          <option value="DISPUTED">En disputa</option>
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showUsgs} onChange={(e) => setShowUsgs(e.target.checked)} />
          Sismos USGS (M≥4,5)
        </label>
      </div>
      {showUsgs && (
        <div role="status" aria-live="polite" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'var(--bg-secondary)' }}>
          {usgsStatus} {' '}
          <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noopener noreferrer">Metodología y fuente</a>.
        </div>
      )}

      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', minHeight: '400px' }} />
    </div>
  );
};
