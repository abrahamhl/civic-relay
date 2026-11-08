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

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      // Centro por defecto: Valencia / España
      const map = L.map(mapContainerRef.current).setView([39.4699, -0.3763], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | SENDA LIVE',
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
      return ev.location?.lat != null && ev.location?.lon != null;
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

      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '200px';
      popupContent.innerHTML = `
        <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${ev.title}</div>
        <div style="font-size:11px;color:#666;margin-bottom:6px;">📍 ${ev.location.label || 'Ubicación aproximada (~1 km)'}</div>
        <div style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;background:${color}22;color:${color};margin-bottom:8px;">
          ${ev.status}
        </div>
        <div>
          <button id="btn-ev-${ev.id}" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:bold;cursor:pointer;width:100%;">
            Ver Acontecimiento
          </button>
        </div>
      `;

      popupContent.querySelector(`#btn-ev-${ev.id}`)?.addEventListener('click', () => {
        onSelectEvent(ev.id);
      });

      marker.bindPopup(popupContent);
      markersLayerRef.current?.addLayer(marker);
    });
  }, [events, filterType, filterStatus, searchQuery, onSelectEvent]);

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
      </div>

      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', minHeight: '400px' }} />
    </div>
  );
};
