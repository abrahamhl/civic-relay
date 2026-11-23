/**
 * Estilo visual de los avisos en el mapa (colores e iconos PROPIOS, inspirados en la lectura rápida de las apps
 * de navegación: color por gravedad y un icono por tipo). No se copia ningún icono ni marca de terceros.
 */
export const CATEGORIES = Object.freeze({
  ACCIDENTE: { label: 'Accidente', color: '#ff3b30', icon: 'crash' },
  TRAFICO: { label: 'Tráfico', color: '#ff9500', icon: 'traffic' },
  PELIGRO: { label: 'Peligro', color: '#ffcc00', icon: 'hazard' },
  PARADO: { label: 'Vehículo parado', color: '#ffcc00', icon: 'car' },
  ANIMAL: { label: 'Animal', color: '#ffcc00', icon: 'animal' },
  OBRAS: { label: 'Obras', color: '#ff9500', icon: 'works' },
  CORTE: { label: 'Corte', color: '#ff3b30', icon: 'closed' },
  CLIMA: { label: 'Tiempo', color: '#5ac8fa', icon: 'weather' },
  CAMARA: { label: 'Cámara DGT', color: '#0a84ff', icon: 'camera' },
});

/** Avisos de SENDA (`REPORT_KINDS` de road-guard) → categoría. */
export const FROM_REPORT = Object.freeze({
  accidente: 'ACCIDENTE', parado: 'PARADO', arcen: 'PARADO', obstaculo: 'PELIGRO', animal: 'ANIMAL',
  niebla: 'CLIMA', hielo: 'CLIMA', retencion: 'TRAFICO', obras: 'OBRAS',
});

/** Incidencia DGT (DATEX II: type + cause) → categoría. */
export function fromDatex({ type, cause } = {}) {
  if (cause === 'accident') return 'ACCIDENTE';
  if (type === 'AbnormalTraffic' || cause === 'abnormalTraffic') return 'TRAFICO';
  if (cause === 'roadMaintenance' || type === 'GeneralObstruction' && cause === 'roadMaintenance') return 'OBRAS';
  if (cause === 'vehicleObstruction') return 'PARADO';
  if (cause === 'poorEnvironment' || type === 'PoorEnvironmentConditions') return 'CLIMA';
  if (type === 'RoadOrCarriagewayOrLaneManagement' && cause === 'roadOrCarriagewayOrLaneManagement') return 'CORTE';
  return 'PELIGRO'; // obstrucción, daño en infraestructura, obstáculo medioambiental, evento, sin causa
}

/** Iconos SVG propios (trazo blanco sobre el círculo de color). */
export const ICONS = Object.freeze({
  crash: '<path d="M5 15l2-5h6l2 5z"/><path d="M15 9l4-3M17 12l3 1M14 6l1-3"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="12.5" cy="16.5" r="1.5"/>',
  traffic: '<rect x="3" y="11" width="7" height="5" rx="1.5"/><rect x="13" y="11" width="7" height="5" rx="1.5"/><path d="M5 11l1-3h3l1 3M15 11l1-3h3l1 3"/>',
  hazard: '<path d="M12 4l9 15H3z"/><path d="M12 10v4M12 16.5v.5"/>',
  car: '<path d="M4 15l2-5h12l2 5v3H4z"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/>',
  animal: '<circle cx="8" cy="7" r="1.8"/><circle cx="16" cy="7" r="1.8"/><circle cx="5" cy="11.5" r="1.8"/><circle cx="19" cy="11.5" r="1.8"/><path d="M8.5 17c0-2.5 1.6-4 3.5-4s3.5 1.5 3.5 4c0 1.6-1.6 2-3.5 2s-3.5-.4-3.5-2z"/>',
  works: '<path d="M10 4h4l3 14H7z"/><path d="M8.5 11h7M7.8 14.5h8.4M5 19h14"/>',
  closed: '<circle cx="12" cy="12" r="8"/><path d="M7 12h10"/>',
  weather: '<path d="M7 16a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 16.5 16z"/><path d="M9 19l-1 2M13 19l-1 2"/>',
  camera: '<rect x="3" y="8" width="13" height="9" rx="2"/><path d="M16 11l5-3v9l-5-3"/>',
});

/** Marcador redondo listo para el mapa (SVG). */
export function markerSvg(cat, size = 34) {
  const c = CATEGORIES[cat] ?? CATEGORIES.PELIGRO;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11.5" fill="${c.color}" stroke="#fff" stroke-width="1.2"/><g fill="none" stroke="${cat === 'PELIGRO' || cat === 'PARADO' || cat === 'ANIMAL' ? '#1c1c1e' : '#fff'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.6 3.6) scale(.7)">${ICONS[c.icon]}</g></svg>`;
}
