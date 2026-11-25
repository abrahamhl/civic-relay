/**
 * Catálogo de módulos de la app (portada tipo plataforma). Cada módulo apunta a una página que existe
 * en la web empaquetada y declara el rol mínimo para verlo desbloqueado.
 * Los candados ordenan la interfaz: el contenido va dentro de la app y NO queda cifrado por ellos.
 */
import { ROLES } from './app-roles.mjs';

const C = ROLES.CIUDADANO, O = ROLES.OBSERVADOR_TOTAL, A = ROLES.ADMIN;
export const RANK = Object.freeze({ [C]: 0, [O]: 1, [A]: 2 });

export const SECTIONS = Object.freeze([
  { id: 'emergencia', title: 'Emergencia', color: '#ff5b6e', icon: 'sos' },
  { id: 'mando', title: 'Mando y sala', color: '#ff7756', icon: 'grid' },
  { id: 'ver', title: 'Ver: cámaras y vías', color: '#0a84ff', icon: 'eye' },
  { id: 'riesgos', title: 'Riesgos: fuego, agua y edificios', color: '#fbbf24', icon: 'flame' },
  { id: 'redes', title: 'Redes sin cobertura', color: '#34d399', icon: 'wave' },
  { id: 'simular', title: 'Simular y explicar', color: '#91d7e8', icon: 'cube' },
  { id: 'ciencia', title: 'Ciencia', color: '#a78bfa', icon: 'book' },
  { id: 'admin', title: 'Administración', color: '#8e8e93', icon: 'key' },
]);

/** [página, título corto, subtítulo, sección, rol mínimo] */
const M = [
  ['index', 'SOS y estado', 'Avisar a los tuyos sin red', 'emergencia', C],
  ['mensaje', 'Mensaje sin red', 'Cifrado, por sonido o archivo', 'emergencia', C],
  ['llamada', 'Llamada sin Internet', 'Voz entre móviles cercanos', 'emergencia', C],
  ['avisos', 'Avisos de peligro', 'Lo que pasa a tu alrededor', 'emergencia', C],
  ['reportar', 'Reportar peligro', 'Aviso firmado Ed25519 sin red y difuminado local', 'emergencia', C],
  ['triaje', 'Triaje', 'Primeros auxilios guiados', 'emergencia', C],
  ['monte', 'Perdido en el monte', 'Qué hacer y cómo avisar', 'emergencia', C],
  ['conducir', 'Conducir', 'Cámara en el salpicadero, avisos y radar', 'emergencia', C],
  ['copiloto', 'Copiloto 5D', 'Adherencia, entorno directo/indirecto, calibración y Android Auto', 'emergencia', C],
  ['drive', 'SENDA Drive', 'Arranque automático en el coche', 'emergencia', C],
  ['carretera', 'Ruta protectora', 'Salir por el camino seguro', 'emergencia', C],
  ['sala', 'Sala de decisión', 'Vista de operador', 'mando', O],
  ['comite', 'Comité N0–N5', 'Peritaje ciudadano y puerta humana N5', 'mando', O],
  ['centro', 'Centro', 'Panel de control', 'mando', O],
  ['consola', 'Consola', 'Fuentes y estado', 'mando', O],
  ['radar', 'Radar de avisos', 'Avisos oficiales en vivo', 'mando', O],
  ['incidente', 'Incidente ferroviario', 'Panel de coordinación', 'mando', O],
  ['explorador', 'Explorador 3D', 'Cualquier lugar en 3D: topografía, edificios y sol', 'ver', C],
  ['ruta', 'Ruta', 'Elige calles, evita peligros, ve cámaras', 'ver', C],
  ['camaras', 'Cámaras públicas', 'Fuentes con licencia', 'ver', O],
  ['trafico', 'Visión de tráfico', 'Conteo en cámaras', 'ver', O],
  ['dgt', 'Infraestructura DGT', 'Datos abiertos de tráfico', 'ver', O],
  ['vehiculos', 'Coches conectados', 'El coche como sensor', 'ver', O],
  ['roadsafe', 'RoadSafe', 'Seguridad en carretera', 'ver', O],
  ['via', 'Vigilancia ferroviaria', 'Vía y trenes', 'ver', O],
  ['atlas', 'Atlas', 'Mapa de capas', 'ver', O],
  ['ojo', 'Ojo de SENDA', 'Satélites y casos', 'ver', O],
  ['incendio4d', 'Incendio 4D', 'San Martín 2026: relieve, tiempo y humo', 'riesgos', C],
  ['dana4d', 'DANA 4D', 'Valencia 2024: agua vista por satélite, cauces y cuencas en 3D', 'riesgos', C],
  ['tren4d', 'Tren 4D', 'Adamuz 2026: cronología al segundo, física del frenado y respuesta', 'riesgos', C],
  ['personas', 'Radar de personas', 'Sensor mmWave de 24 GHz por USB: seguimiento y calibración', 'riesgos', C],
  ['incendio', 'Incendio forestal', 'Avisar antes de la antena', 'riesgos', O],
  ['fuego', 'Seguimiento de incendio', 'Frente y viento', 'riesgos', O],
  ['fuego3d', 'Incendio en 3D', 'Terreno real', 'riesgos', O],
  ['agua', 'Riadas y maremotos', 'Agua que sube', 'riesgos', O],
  ['agua-nl', 'Agua en Países Bajos', 'Niveles oficiales', 'riesgos', O],
  ['aislamiento', 'Aislamiento por inundación', 'Quién queda incomunicado', 'riesgos', O],
  ['edificios', 'Edificios afectados', 'Gemelo digital', 'riesgos', O],
  ['evacuacion', 'Evacuación', 'Coches, cámaras y fuego', 'riesgos', O],
  ['red', 'Red y previsión de apagón', 'Satélites, LoRa y drones', 'redes', O],
  ['radio', 'Planificador de radio', 'Relieve real', 'redes', O],
  ['mulas', 'Autobuses como mulas', 'Datos que viajan', 'redes', O],
  ['reserva', 'Batería de Internet', 'Reserva para sin red', 'redes', C],
  ['dron', 'Censo de radio con dron', 'Quién sigue vivo', 'redes', O],
  ['barrido', 'Dron casa por casa', 'Barrido de señales', 'redes', O],
  ['viaje', 'Viaje sin datos', 'Pasarela de un desconocido', 'redes', O],
  ['sentidos', 'Sentidos ampliados', 'Ver lo invisible', 'redes', O],
  ['simulador', 'Simulador 3D', 'Fuego, agua y sismo', 'simular', O],
  ['ciclo', 'El ciclo completo', 'Ver, prevenir, dirigir', 'simular', O],
  ['visor', 'Visor 4D', 'Tiempo y espacio', 'simular', O],
  ['vuelo', 'Sobrevuelo Langtang', 'Terreno real', 'simular', O],
  ['demo', 'Demo guiada', 'Recorrido de 5 minutos', 'simular', C],
  ['explica', 'SENDA explicado', 'La idea completa', 'simular', C],
  ['arquitectura', 'Arquitectura', 'Cómo está hecho', 'ciencia', O],
  ['paper', 'Paper V', 'Incendios y viento 3D', 'ciencia', O],
  ['referencias', 'Incendios de referencia', 'Casos reales', 'ciencia', O],
  ['paises', 'España y Países Bajos', 'Marco de cada país', 'ciencia', C],
  ['estado', 'Verificación', 'Pruebas de esta versión', 'ciencia', C],
  ['plataforma', 'Plataforma', 'Integraciones', 'admin', O],
  ['organismo', 'Organismos', 'Anclas y credenciales', 'admin', A],
];

/** Módulos nativos: no son una página web, los abre la app Android por su puente. */
export const NATIVE = Object.freeze({ drive: 'openDrive' });

export const MODULES = Object.freeze(M.map(([page, title, sub, section, minRole]) =>
  Object.freeze({ page, href: NATIVE[page] ? `#nativo-${page}` : page === 'index' ? '/senda' : `/senda/${page}`, title, sub, section, minRole, native: NATIVE[page] ?? null })));

export const allowed = (mod, role) => (RANK[role] ?? 0) >= RANK[mod.minRole];

export function search(query, mods = MODULES) {
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  return q ? mods.filter((m) => norm(`${m.title} ${m.sub} ${m.page}`).includes(q)) : mods;
}
