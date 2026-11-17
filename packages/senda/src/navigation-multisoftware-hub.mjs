/**
 * SENDA · Hub de Integración Multisoftware con Navegadores y Sistemas GPS Populares
 *
 * Módulo isomórfico (Node.js + Navegador / Android WebView / PWA / Head Units / CarPlay / iOS)
 * Proporciona:
 *  1. Generador Universal de Enlaces e Intents Nativos (buildUniversalNavLinks):
 *     Google Maps (Android Navigation Intent & GeoURI), Waze (Deep Linking & Reportes),
 *     Apple Maps (CarPlay / iOS maps://), OsmAnd / Organic Maps (RFC 5870 GeoURI & API),
 *     Sygic GPS Navigation, TomTom AmiGO y HERE WeGo.
 *  2. Generador de Capas GPX 1.1 de Peligros en Tiempo Real (generateHazardGpxOverlay):
 *     Flujo XML interoperable para importar avisos en navegadores offline (OsmAnd, Garmin, Locus Map).
 *  3. Generador de Feed CIFS para Waze for Cities (generateWazeCifsFeed):
 *     Estructura GeoJSON/JSON oficial compatible con el programa de socios públicos de Waze.
 *  4. Orquestador de Navegación Multisoftware (NavigationMultisoftwareHub):
 *     Despacha la mejor ruta e incidencia según el sistema operativo del cliente.
 */

import { HAZARD } from './road-guard.mjs';

function finite(val, min = -Infinity, max = Infinity) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. GENERADOR UNIVERSAL DE ENLACES E INTENTS NATIVOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera todos los enlaces profundos (deep-links), esquemas de URL nativos e intents
 * para los navegadores GPS más populares del mercado en Android, iOS y Web.
 *
 * @param {{
 *   lat: number,
 *   lon: number,
 *   label?: string,
 *   hazardType?: string,
 *   roadId?: string,
 *   speedKmh?: number
 * }} params Parámetros de destino / peligro
 * @returns {{
 *   googleMaps: {
 *     androidNavigationIntent: string,
 *     androidDirectIntent: string,
 *     webUniversal: string,
 *     geoUri: string
 *   },
 *   waze: {
 *     nativeDeepLink: string,
 *     webUniversal: string,
 *     reportHazardUri: string
 *   },
 *   appleMaps: {
 *     nativeScheme: string,
 *     webUniversal: string,
 *     carPlayCompatibleUri: string
 *   },
 *   osmAndOrganic: {
 *     osmandApiUri: string,
 *     organicMapsUri: string,
 *     rfc5870GeoUri: string
 *   },
 *   sygic: {
 *     nativeDriveUri: string
 *   },
 *   hereWeGo: {
 *     nativeRouteUri: string
 *   },
 *   tomTomAmiGo: {
 *     nativeAmiGoUri: string
 *   },
 *   recommendedForPlatform: (platform: 'ANDROID'|'IOS'|'WEB'|'CARPLAY'|'AAOS') => string
 * }}
 */
export function buildUniversalNavLinks({
  lat,
  lon,
  label = 'Peligro Vial SENDA',
  hazardType = HAZARD.OBSTACLE,
  roadId = 'Vía',
  speedKmh = 90,
} = {}) {
  const latitude = finite(lat, -90, 90) ? lat : 40.4168;
  const longitude = finite(lon, -180, 180) ? lon : -3.7038;
  const safeLabel = encodeURIComponent(label || 'Incidencia SENDA');
  const latStr = latitude.toFixed(6);
  const lonStr = longitude.toFixed(6);

  // 1. Google Maps (Android / iOS / Web)
  // - google.navigation:q=lat,lon&mode=d (Abre directamente la navegación paso a paso guiada por voz)
  // - intent:// con fallback a Google Play si no estuviera instalado
  const googleAndroidNav = `google.navigation:q=${latStr},${lonStr}&mode=d`;
  const googleAndroidDirectIntent = `intent://maps.google.com/maps?daddr=${latStr},${lonStr}&mode=d#Intent;scheme=https;package=com.google.android.apps.maps;end`;
  const googleWebUniversal = `https://www.google.com/maps/dir/?api=1&destination=${latStr},${lonStr}&travelmode=driving`;
  const googleGeoUri = `geo:${latStr},${lonStr}?q=${latStr},${lonStr}(${safeLabel})`;

  // 2. Waze (Android / iOS / Web)
  // - waze://?ll=lat,lon&navigate=yes (Navegación nativa en un toque)
  // - Reporte automático en Waze
  const wazeCategory = hazardType === HAZARD.CRASH ? 'accident' : 'hazard';
  const wazeNative = `waze://?ll=${latStr},${lonStr}&navigate=yes`;
  const wazeWeb = `https://waze.com/ul?ll=${latStr},${lonStr}&navigate=yes&utm_source=senda`;
  const wazeReport = `waze://?q=${safeLabel}&category=${wazeCategory}&ll=${latStr},${lonStr}`;

  // 3. Apple Maps (iOS / macOS / CarPlay)
  // - maps://?daddr=lat,lon&dirflg=d (Navegación guiada en Apple Maps y Apple CarPlay)
  const appleNative = `maps://?daddr=${latStr},${lonStr}&dirflg=d&t=m`;
  const appleWeb = `https://maps.apple.com/?daddr=${latStr},${lonStr}&dirflg=d`;
  const appleCarPlay = `maps://?daddr=${latStr},${lonStr}&dirflg=d`;

  // 4. OsmAnd & Organic Maps (OpenStreetMap sin conexión)
  // - RFC 5870: geo:lat,lon;u=10 (Estándar IETF universal soportado por todos los teléfonos)
  // - OsmAnd API deep link
  const rfc5870Geo = `geo:${latStr},${lonStr};u=10?z=16&q=${latStr},${lonStr}(${safeLabel})`;
  const osmandApi = `osmand.api://navigate?lat=${latStr}&lon=${lonStr}&profile=car`;
  const organicMaps = `om://map?v=1&ll=${latStr},${lonStr}&n=${safeLabel}`;

  // 5. Sygic GPS Navigation
  // - com.sygic.aura://coordinate|lon|lat|drive
  const sygicNative = `com.sygic.aura://coordinate|${lonStr}|${latStr}|drive`;

  // 6. HERE WeGo & TomTom AmiGO
  const hereWeGoNative = `here-route://${latStr},${lonStr}`;
  const tomtomAmiGoNative = `amigo://navigate?lat=${latStr}&lon=${lonStr}`;

  return {
    googleMaps: {
      androidNavigationIntent: googleAndroidNav,
      androidDirectIntent: googleAndroidDirectIntent,
      webUniversal: googleWebUniversal,
      geoUri: googleGeoUri,
    },
    waze: {
      nativeDeepLink: wazeNative,
      webUniversal: wazeWeb,
      reportHazardUri: wazeReport,
    },
    appleMaps: {
      nativeScheme: appleNative,
      webUniversal: appleWeb,
      carPlayCompatibleUri: appleCarPlay,
    },
    osmAndOrganic: {
      osmandApiUri: osmandApi,
      organicMapsUri: organicMaps,
      rfc5870GeoUri: rfc5870Geo,
    },
    sygic: {
      nativeDriveUri: sygicNative,
    },
    hereWeGo: {
      nativeRouteUri: hereWeGoNative,
    },
    tomTomAmiGo: {
      nativeAmiGoUri: tomtomAmiGoNative,
    },
    recommendedForPlatform(platform = 'ANDROID') {
      const p = String(platform).toUpperCase();
      if (p === 'ANDROID' || p === 'AAOS') {
        return googleAndroidNav;
      }
      if (p === 'IOS' || p === 'CARPLAY') {
        return appleNative;
      }
      return googleWebUniversal;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. GENERADOR DE CAPAS GPX 1.1 DE PELIGROS VIALES EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera un archivo o flujo XML GPX 1.1 válido con los waypoints de incidentes y peligros
 * para ser importado o suscrito directamente en OsmAnd, Garmin, Locus Map, TwoNav o QGIS.
 *
 * @param {Array<{
 *   id?: string,
 *   lat: number,
 *   lon: number,
 *   title?: string,
 *   description?: string,
 *   hazardType?: string,
 *   severity?: string,
 *   timestampUtc?: string
 * }>} hazards Lista de peligros detectados o comunicados
 * @param {string} [name='SENDA Live Road Hazard Overlay'] Nombre del conjunto GPX
 * @returns {string} Flujo XML GPX 1.1 listo para servir o guardar (.gpx)
 */
export function generateHazardGpxOverlay(hazards = [], name = 'SENDA Live Road Hazard Overlay') {
  const nowIso = new Date().toISOString();
  let waypointsXml = '';

  for (const h of hazards) {
    if (!h || !finite(h.lat) || !finite(h.lon)) continue;
    const lat = h.lat.toFixed(6);
    const lon = h.lon.toFixed(6);
    const title = (h.title || 'Peligro Vial').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const desc = (h.description || `Severidad: ${h.severity || 'ALTA'}`).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sym = h.hazardType === HAZARD.CRASH ? 'Accident' : 'Danger';
    const time = h.timestampUtc || nowIso;

    waypointsXml += `  <wpt lat="${lat}" lon="${lon}">
    <time>${time}</time>
    <name>${title}</name>
    <desc>${desc}</desc>
    <sym>${sym}</sym>
    <type>${h.hazardType || 'HAZARD'}</type>
  </wpt>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SENDA Civil Relay Engine - https://github.com/abrahamhl/civic-relay" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>Capa de incidencias y avisos viales generada en tiempo real por la red soberana SENDA</desc>
    <time>${nowIso}</time>
  </metadata>
${waypointsXml}</gpx>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. GENERADOR DE FEED CIFS PARA WAZE FOR CITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera el feed institucional en formato CIFS (Connected Citizens Program / Waze for Cities)
 * para sincronizar incidencias confirmadas con el mapa en vivo de Waze.
 *
 * @param {Array<{
 *   id: string,
 *   lat: number,
 *   lon: number,
 *   hazardType: string,
 *   roadId?: string,
 *   description?: string,
 *   startTimeIso?: string
 * }>} hazards Lista de incidentes confirmados
 * @param {string} [publisher='SENDA / Red Nacional de Proteccion Civil']
 * @returns {{
 *   incidents: Array<object>,
 *   metadata: { publisher: string, timestamp: string, version: string }
 * }}
 */
export function generateWazeCifsFeed(hazards = [], publisher = 'SENDA / Red Nacional de Proteccion Civil') {
  const wazeTypeMap = {
    [HAZARD.CRASH]: 'ACCIDENT',
    [HAZARD.STOPPED]: 'HAZARD',
    [HAZARD.OBSTACLE]: 'HAZARD',
    [HAZARD.QUEUE]: 'JAM',
    [HAZARD.FOG]: 'WEATHERHAZARD',
    [HAZARD.ICE]: 'WEATHERHAZARD',
    [HAZARD.WORKS]: 'CONSTRUCTION',
  };

  const incidents = hazards
    .filter((h) => h && finite(h.lat) && finite(h.lon))
    .map((h) => {
      const cifsType = wazeTypeMap[h.hazardType] || 'HAZARD';
      return {
        id: `senda-cifs-${h.id || Math.random().toString(16).slice(2, 10)}`,
        type: cifsType,
        location: {
          x: Math.round(h.lon * 1000000) / 1000000,
          y: Math.round(h.lat * 1000000) / 1000000,
        },
        street: h.roadId || 'Carretera',
        starttime: h.startTimeIso || new Date().toISOString(),
        description: h.description || `Aviso verificado SENDA: ${h.hazardType}`,
        confidence: 0.95,
        reliability: 10,
        provider: 'SENDA_CIVIC_RELAY',
      };
    });

  return {
    incidents,
    metadata: {
      publisher,
      timestamp: new Date().toISOString(),
      version: 'CIFS-v2.3',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ORQUESTADOR DE NAVEGACIÓN MULTISOFTWARE
// ═══════════════════════════════════════════════════════════════════════════

export class NavigationMultisoftwareHub {
  constructor({ platform = 'ANDROID', preferredApp = 'AUTO' } = {}) {
    this.platform = platform.toUpperCase();
    this.preferredApp = preferredApp.toUpperCase();
    this.activeHazards = new Map();
  }

  registerHazard(hazard) {
    if (hazard && hazard.id) {
      this.activeHazards.set(hazard.id, hazard);
    }
  }

  clearHazard(hazardId) {
    this.activeHazards.delete(hazardId);
  }

  /**
   * Obtiene la URI o URL óptima de lanzamiento inmediato según la plataforma detectada.
   */
  getLaunchUriForDestination({ lat, lon, label = 'Destino' }) {
    const links = buildUniversalNavLinks({ lat, lon, label });

    if (this.preferredApp === 'WAZE') return links.waze.nativeDeepLink;
    if (this.preferredApp === 'GOOGLE') return links.googleMaps.androidNavigationIntent;
    if (this.preferredApp === 'APPLE') return links.appleMaps.nativeScheme;
    if (this.preferredApp === 'OSMAND') return links.osmAndOrganic.osmandApiUri;
    if (this.preferredApp === 'SYGIC') return links.sygic.nativeDriveUri;

    // Selección automática
    return links.recommendedForPlatform(this.platform);
  }

  /**
   * Exporta la capa de avisos actual en formato GPX 1.1 para navegadores offline.
   */
  exportGpxOverlay() {
    return generateHazardGpxOverlay(Array.from(this.activeHazards.values()));
  }

  /**
   * Exporta el feed CIFS para Waze for Cities.
   */
  exportWazeCifsFeed() {
    return generateWazeCifsFeed(Array.from(this.activeHazards.values()));
  }
}
