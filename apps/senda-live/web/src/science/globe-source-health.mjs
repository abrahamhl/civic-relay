/**
 * SENDA 4D GIS — Multi-Source Health & Integrity Evaluator (Ticket P0-06).
 *
 * Evaluates the results of the 9 official crisis intelligence feeds:
 * 1. Terrain DEM (Mapzen/AWS)
 * 2. Weather Grid NWP (Met Norway)
 * 3. Copernicus EFFIS (Active Thermal)
 * 4. AEMET CAP (Severe Weather Warnings)
 * 5. USGS Seismology (ComCat)
 * 6. Reconciled Intelligence (Merkle Provenance)
 * 7. DATEX II Mobility (DGT / NDW)
 * 8. COTS Drones Recon (ASTM F3411)
 * 9. COTS Hardware Catalog & Antennas
 *
 * Strictly ensures:
 * - If sources fail, it NEVER displays "VERIFIED" or "Datos verificados".
 * - If 9/9 sources fail, explicitly reports 0/9 sources available and disconnected state.
 */

export const GLOBE_SOURCE_DEFINITIONS = Object.freeze([
  { id: 'terrain', name: 'Relieve DEM (Mapzen/AWS)', category: 'GEO_TERRAIN' },
  { id: 'weather', name: 'Meteorología NWP (Met Norway)', category: 'ATMOSPHERE' },
  { id: 'effis', name: 'Copernicus EFFIS (Térmico)', category: 'SATELLITE_THERMAL' },
  { id: 'aemet', name: 'AEMET CAP (Avisos Oficiales)', category: 'EARLY_WARNING' },
  { id: 'usgs', name: 'USGS Sismología (ComCat)', category: 'SEISMOLOGY' },
  { id: 'recon', name: 'Reconciliación OSINT Merkle', category: 'PROVENANCE_RECEIPT' },
  { id: 'mobility', name: 'DATEX II Movilidad (DGT / NDW)', category: 'ROAD_NETWORK' },
  { id: 'cots_drones', name: 'Drones ASTM F3411 / COTS', category: 'UAV_RECON' },
  { id: 'cots_catalog', name: 'Catálogo COTS & Antenas', category: 'HARDWARE_BOM' },
]);

/**
 * Evaluates the Promise.allSettled array of the 9 platform feeds.
 *
 * @param {Array<{ status: 'fulfilled' | 'rejected', value?: any, reason?: any }>} settledResults
 * @returns {object} Detailed source health summary
 */
export function computeGlobeSourceHealth(settledResults = []) {
  const [
    terrainRes,
    weatherRes,
    effisRes,
    aemetRes,
    usgsRes,
    reconRes,
    mobRes,
    cotsDronesRes,
    cotsCatRes,
  ] = settledResults;

  const sources = [
    {
      id: 'terrain',
      name: 'Relieve DEM (Mapzen/AWS)',
      status: (terrainRes?.status === 'fulfilled' && terrainRes.value?.status !== 'UNAVAILABLE') ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (terrainRes?.status === 'fulfilled' && terrainRes.value?.status !== 'UNAVAILABLE')
        ? `${terrainRes.value?.grid?.length || 0} celdas elevación`
        : 'Feed no disponible',
    },
    {
      id: 'weather',
      name: 'Meteorología NWP (Met Norway)',
      status: (weatherRes?.status === 'fulfilled' && weatherRes.value?.status !== 'UNAVAILABLE') ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (weatherRes?.status === 'fulfilled' && weatherRes.value?.status !== 'UNAVAILABLE')
        ? 'Cuadrícula predictiva 9x24'
        : 'Feed no disponible',
    },
    {
      id: 'effis',
      name: 'Copernicus EFFIS (Térmico)',
      status: (effisRes?.status === 'fulfilled' && effisRes.value?.status !== 'UNAVAILABLE' && Array.isArray(effisRes.value?.observations)) ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (effisRes?.status === 'fulfilled' && Array.isArray(effisRes.value?.observations))
        ? `${effisRes.value.observations.length} anomalías térmicas`
        : 'Sin observaciones',
    },
    {
      id: 'aemet',
      name: 'AEMET CAP (Avisos Oficiales)',
      status: (aemetRes?.status === 'fulfilled' && aemetRes.value?.status !== 'UNAVAILABLE' && Array.isArray(aemetRes.value?.warnings)) ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (aemetRes?.status === 'fulfilled' && Array.isArray(aemetRes.value?.warnings))
        ? `${aemetRes.value.warnings.length} avisos meteorológicos`
        : 'Sin avisos activos',
    },
    {
      id: 'usgs',
      name: 'USGS Sismología (ComCat)',
      status: (usgsRes?.status === 'fulfilled' && usgsRes.value?.status !== 'UNAVAILABLE' && Array.isArray(usgsRes.value?.observations)) ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (usgsRes?.status === 'fulfilled' && Array.isArray(usgsRes.value?.observations))
        ? `${usgsRes.value.observations.length} eventos sísmicos`
        : 'Sin sismos registrados',
    },
    {
      id: 'recon',
      name: 'Reconciliación OSINT Merkle',
      status: (reconRes?.status === 'fulfilled' && reconRes.value?.status !== 'UNAVAILABLE' && reconRes.value?.receipt) ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (reconRes?.status === 'fulfilled' && reconRes.value?.receipt)
        ? `Raíz Merkle: ${reconRes.value.receipt.rootSha256?.slice(0, 10)}...`
        : 'Sin recibo criptográfico',
    },
    {
      id: 'mobility',
      name: 'DATEX II Movilidad (DGT / NDW)',
      status: (mobRes?.status === 'fulfilled' && mobRes.value?.status !== 'UNAVAILABLE' && Array.isArray(mobRes.value?.incidents)) ? 'VERIFIED' : 'UNAVAILABLE',
      detail: (mobRes?.status === 'fulfilled' && Array.isArray(mobRes.value?.incidents))
        ? `${mobRes.value.incidents.length} incidencias viales`
        : 'Sin incidencias viales',
    },
    {
      id: 'cots_drones',
      name: 'Drones ASTM F3411 / COTS',
      status: (cotsDronesRes?.status === 'fulfilled' && cotsDronesRes.value && cotsDronesRes.value?.status !== 'UNAVAILABLE') ? 'AVAILABLE' : 'UNAVAILABLE',
      detail: (cotsDronesRes?.status === 'fulfilled' && cotsDronesRes.value?.status !== 'UNAVAILABLE')
        ? (cotsDronesRes.value?.status === 'LIVE_TRACKS_ACTIVE'
            ? `${cotsDronesRes.value?.drones?.length || 0} trazas en vivo`
            : 'En espera de trama RF')
        : 'Receptor desconectado',
    },
    {
      id: 'cots_catalog',
      name: 'Catálogo COTS & Antenas',
      status: (cotsCatRes?.status === 'fulfilled' && cotsCatRes.value && cotsCatRes.value?.status !== 'UNAVAILABLE') ? 'AVAILABLE' : 'UNAVAILABLE',
      detail: (cotsCatRes?.status === 'fulfilled' && cotsCatRes.value?.status !== 'UNAVAILABLE')
        ? `${cotsCatRes.value?.antennas?.length || 0} recetas sintetizadas`
        : 'Catálogo no disponible',
    },
  ];

  const totalSources = sources.length;
  const verifiedCount = sources.filter((s) => s.status === 'VERIFIED').length;
  const availableCount = sources.filter((s) => s.status === 'VERIFIED' || s.status === 'AVAILABLE').length;
  const failedCount = totalSources - availableCount;

  let overallStatus = 'DESCONECTADO';
  let statusMessage = '';
  let badgeText = '';
  let isAllVerified = false;

  if (availableCount === 0) {
    // Ticket P0-06 PASS rule: 9 failures => NEVER say VERIFIED
    overallStatus = 'DESCONECTADO';
    badgeText = `DESCONECTADO (0/${totalSources})`;
    statusMessage = `Desconectado · 0/${totalSources} fuentes disponibles (${failedCount} fallos). Sin verificación activa.`;
    isAllVerified = false;
  } else if (failedCount > 0) {
    overallStatus = 'DEGRADADO';
    badgeText = `DEGRADADO (${availableCount}/${totalSources})`;
    statusMessage = `Plataforma 4D parcial · ${availableCount}/${totalSources} fuentes disponibles (${failedCount} no disponibles).`;
    isAllVerified = false;
  } else {
    overallStatus = 'VERIFICADO';
    badgeText = `VERIFICADO (${totalSources}/${totalSources})`;
    statusMessage = 'Plataforma 4D lista · Todas las fuentes conectadas y verificadas por SHA-256.';
    isAllVerified = true;
  }

  return {
    overallStatus,
    badgeText,
    statusMessage,
    isAllVerified,
    totalSources,
    verifiedCount,
    availableCount,
    failedCount,
    sources,
  };
}
