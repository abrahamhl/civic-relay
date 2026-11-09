import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { Atmosphere4DStudio } from './Atmosphere4DStudio';

interface Props {
  events: any[];
  onSelectEvent: (eventId: string) => void;
}

export const MapView: React.FC<Props> = ({ events, onSelectEvent }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const usgsLayerRef = useRef<L.FeatureGroup | null>(null);
  const wildfireLayerRef = useRef<L.FeatureGroup | null>(null);
  const gdacsLayerRef = useRef<L.FeatureGroup | null>(null);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUsgs, setShowUsgs] = useState(false);
  const [usgsStatus, setUsgsStatus] = useState('');
  const [showWildfires, setShowWildfires] = useState(false);
  const [showAtmosphere4D, setShowAtmosphere4D] = useState(false);
  const [wildfireStatus, setWildfireStatus] = useState('');
  const [showGdacs, setShowGdacs] = useState(false);
  const [gdacsStatus, setGdacsStatus] = useState('');

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
      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = 'bold';
      titleEl.style.fontSize = '14px';
      titleEl.style.marginBottom = '4px';
      titleEl.textContent = String(ev.title ?? 'Acontecimiento');
      popupContent.appendChild(titleEl);

      const locEl = document.createElement('div');
      locEl.style.fontSize = '11px';
      locEl.style.color = '#666';
      locEl.style.marginBottom = '6px';
      locEl.textContent = '📍 ' + String(ev.location?.label || 'Ubicación aproximada (~1 km)');
      popupContent.appendChild(locEl);

      const statusEl = document.createElement('div');
      statusEl.style.display = 'inline-block';
      statusEl.style.padding = '2px 6px';
      statusEl.style.borderRadius = '10px';
      statusEl.style.fontSize = '10px';
      statusEl.style.fontWeight = 'bold';
      statusEl.style.backgroundColor = color + '22';
      statusEl.style.color = color;
      statusEl.style.marginBottom = '8px';
      statusEl.textContent = String(ev.status ?? 'UNVERIFIED_REPORT');
      popupContent.appendChild(statusEl);

      const btnContainer = document.createElement('div');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.backgroundColor = '#e11d48';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.padding = '4px 8px';
      btn.style.fontSize = '12px';
      btn.style.fontWeight = 'bold';
      btn.style.cursor = 'pointer';
      btn.style.width = '100%';
      btn.textContent = 'Ver acontecimiento';
      btn.addEventListener('click', () => {
        onSelectEvent(ev.id);
      });
      btnContainer.appendChild(btn);
      popupContent.appendChild(btnContainer);
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
    const layer = L.featureGroup().addTo(map);
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
      if (layer.getLayers().length > 0) {
        map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 5 });
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


  // Curated source records, not observed fire fronts or model predictions.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !showWildfires) {
      wildfireLayerRef.current?.clearLayers();
      return;
    }
    let active = true;
    const layer = L.featureGroup().addTo(map);
    wildfireLayerRef.current = layer;
    setWildfireStatus('Consultando acontecimientos NASA EONET...');
    api.getEonetWildfires().then((snapshot: any) => {
      if (!active) return;
      const entries = Array.isArray(snapshot.observations) ? snapshot.observations : [];
      for (const event of entries) {
        if (!Number.isFinite(event.location?.lat) || !Number.isFinite(event.location?.lon)) continue;
        const point = L.circleMarker([event.location.lat, event.location.lon], {
          radius: 7, color: '#9a3412', fillColor: '#fb923c', fillOpacity: 0.78, weight: 2,
        });
        const popup = document.createElement('div');
        popup.style.minWidth = '210px';
        const title = document.createElement('strong');
        title.textContent = String(event.title || 'Incendio registrado');
        popup.append(title);
        const date = document.createElement('div');
        date.textContent = 'Fecha del registro: ' + new Date(event.observedAt).toLocaleString('es-ES');
        popup.append(date);
        const sources = document.createElement('div');
        const sourceLabels = Array.isArray(event.reportedSources) ? event.reportedSources.join(', ') : '';
        sources.textContent = 'Referencias: ' + (sourceLabels || 'Consultar NASA EONET');
        popup.append(sources);
        const legend = document.createElement('div');
        legend.textContent = 'Punto de catálogo · No delimita el incendio ni es una alerta';
        legend.style.fontSize = '11px';
        popup.append(legend);
        try {
          const href = new URL(event.url);
          if (href.protocol === 'https:' && href.hostname === 'eonet.gsfc.nasa.gov' &&
              /^\/api\/v3\/events\/[A-Za-z0-9_-]+\/?$/.test(href.pathname)) {
            const link = document.createElement('a');
            link.href = href.origin + href.pathname;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Abrir referencia EONET';
            popup.append(link);
          }
        } catch { /* no valid source link */ }
        point.bindPopup(popup).addTo(layer);
      }
      if (!showUsgs && layer.getLayers().length) {
        map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 5 });
      }
      const checkedAt = snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString('es-ES') : 'sin fecha';
      const freshness = snapshot.status === 'STALE_SNAPSHOT' ? 'Copia anterior; proveedor no disponible' :
        snapshot.status === 'CACHED_SNAPSHOT' ? 'Copia reciente en servidor' : 'Consulta a fuente pública';
      setWildfireStatus(entries.length + ' acontecimientos catalogados (consulta de 30 días' +
        (snapshot.resultLimitReached ? ', muestra limitada a ' + snapshot.requestedLimit : '') + '). ' +
        freshness + '. Fuente: NASA EONET · descarga ' + checkedAt +
        '. No son perímetros, detecciones instantáneas ni alertas.');
    }).catch(() => {
      if (active) setWildfireStatus('NASA EONET no disponible; no se representan incendios ficticios.');
    });
    return () => {
      active = false; layer.remove();
      if (wildfireLayerRef.current === layer) wildfireLayerRef.current = null;
    };
  }, [showWildfires, showUsgs]);


  // GDPR safe: read only public disaster catalogs. No user GPS, no people OSINT.
  // GDACS risk levels are issuer-specific; NOT official government evacuation orders.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !showGdacs) {
      gdacsLayerRef.current?.clearLayers();
      return;
    }
    let active = true;
    const layer = L.featureGroup().addTo(map);
    gdacsLayerRef.current = layer;
    setGdacsStatus('Consultando GDACS y comparando catálogos públicos...');
    api.getOsintCorrelations().then((result: any) => {
      if (!active) return;
      const events = Array.isArray(result.observations) ? result.observations : [];
      const levelColors: Record<string, string> = {
        Red: '#dc2626', Orange: '#f59e0b', Green: '#10b981'
      };
      for (const e of events) {
        if (!Number.isFinite(e.location?.lat) || !Number.isFinite(e.location?.lon) ||
            !Object.prototype.hasOwnProperty.call(levelColors, e.alertLevel)) continue;
        const marker = L.circleMarker([e.location.lat, e.location.lon], {
          radius: e.alertLevel === 'Red' ? 10 : 7,
          color: '#152d42', fillColor: levelColors[e.alertLevel], fillOpacity: .83,
          weight: 2
        });
        const popup = document.createElement('div');
        popup.style.minWidth = '220px';
        const title = document.createElement('strong');
        title.textContent = String(e.title || 'GDACS risk event');
        popup.append(title);
        const meta = document.createElement('div');
        meta.textContent = 'GDACS · ' + String(e.eventType || '') + ' · nivel ' +
          String(e.alertLevel) + (e.country ? ' · ' + String(e.country) : '');
        popup.append(meta);
        const date = document.createElement('div');
        date.textContent = 'Publicado por GDACS: ' + new Date(e.updatedAt).toLocaleString('es-ES');
        popup.append(date);
        const explain = document.createElement('div');
        explain.style.cssText = 'font-size:11px;color:#475569;margin:6px 0';
        explain.textContent = 'Punto representativo del catálogo. No es área afectada ni alerta de evacuación de SENDA.';
        popup.append(explain);
        const candidates = document.createElement('div');
        candidates.style.fontSize = '11px';
        const overlaps = Array.isArray(e.crossCatalogCandidates) ? e.crossCatalogCandidates : [];
        candidates.textContent = overlaps.length ?
          'Coincidencias espaciales/temporales candidatas: ' + overlaps.length +
          '. No es corroboración independiente.' :
          'Sin coincidencia contrastable en fuentes disponibles (' + String(e.crossCatalogStatus || '') + ').';
        popup.append(candidates);
        const link = document.createElement('a');
        // Never use provider-authored href; allow an exact origin and known report path.
        try {
          const url = new URL(String(e.sourceUrl || ''));
          if (url.protocol === 'https:' && url.hostname === 'www.gdacs.org' && url.pathname === '/report.aspx') {
            link.href = url.toString();
            link.rel = 'noopener noreferrer';
            link.target = '_blank';
            link.textContent = 'Consultar el reporte original GDACS';
            popup.append(link);
          }
        } catch { /* untrusted URL discarded */ }
        marker.bindPopup(popup).addTo(layer);
      }
      const freshness = result.status === 'STALE_SNAPSHOT'
        ? 'Copia anterior; origen no actualizado' : result.status === 'CACHED_SNAPSHOT'
          ? 'Copia reciente del servidor' : 'Fuente pública consultada';
      setGdacsStatus(events.length + ' eventos GDACS de riesgo (' + freshness + '). ' +
        (result.source?.rawSha256 ? 'SHA-256: ' + String(result.source.rawSha256).slice(0, 12) + '… ' : '') +
        'Coincidencias entre catálogos NO equivalen a confirmación independiente ni alertas SENDA.');
    }).catch(() => {
      if (active) setGdacsStatus('GDACS no disponible; no se muestran eventos inventados.');
    });
    return () => {
      active = false;
      layer.remove();
      if (gdacsLayerRef.current === layer) gdacsLayerRef.current = null;
    };
  }, [showGdacs]);

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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showWildfires} onChange={(e) => setShowWildfires(e.target.checked)} />
          Incendios NASA EONET (catálogo)
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', fontSize: '.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showGdacs} onChange={(e) => setShowGdacs(e.target.checked)} />
          GDACS · inteligencia de desastres
        </label>
        <button type="button" aria-pressed={showAtmosphere4D}
          onClick={() => setShowAtmosphere4D((value) => !value)}
          style={{ padding: '0.45rem 0.75rem', borderRadius: 9,
            border: '1px solid #2563eb', background: showAtmosphere4D ? '#1d4ed8' : '#e0f2fe', color: showAtmosphere4D ? 'white' : '#0c4a6e', cursor: 'pointer', fontWeight: 700 }}>
          {showAtmosphere4D ? 'Cerrar visor 4D' : 'Abrir Atmosphere 4D'}
        </button>
      </div>
      {showUsgs && (
        <div role="status" aria-live="polite" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'var(--bg-secondary)' }}>
          {usgsStatus} {' '}
          <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noopener noreferrer">Metodología y fuente</a>.
        </div>
      )}

      {showWildfires && (
        <div role="status" aria-live="polite" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'var(--bg-secondary)' }}>
          {wildfireStatus}{' '}
          <a href="https://eonet.gsfc.nasa.gov/docs/v3" target="_blank" rel="noopener noreferrer">NASA EONET · metodología</a>.
        </div>
      )}

      {showGdacs && (
        <div data-testid="gdacs-status" role="status" aria-live="polite" style={{ padding: '.4rem 1rem', fontSize: '.8rem', background: 'var(--bg-secondary)' }}>
          {gdacsStatus}{' '}
          <a href="https://www.gdacs.org/feed_reference.aspx" target="_blank" rel="noopener noreferrer">Fuente y referencia GDACS</a>
        </div>
      )}

      {/* Persistent map view; Atmosphere 4D overlays without destroying the community layers. */}
      <div style={{ flex: 1, width: '100%', minHeight: '400px', position: 'relative' }}>
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        {showAtmosphere4D && (
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 800, background: '#081625' }}>
            <Atmosphere4DStudio onClose={() => setShowAtmosphere4D(false)} />
          </div>
        )}
      </div>
    </div>
  );
};
