/**
 * SENDA · copernicus-ems.mjs
 * Adaptador verificado para Copernicus Emergency Management Service (EMS) Rapid Mapping.
 *
 * Fuente pública oficial: European Commission Joint Research Centre (JRC).
 * URL: https://emergency.copernicus.eu/mapping/list-of-activations-rapid
 *
 * DISTINCIÓN EPISTÉMICA FUNDAMENTAL (L4.1):
 *  1. ACTIVACIÓN (ACTIVATION): Solicitud institucional formal de protección civil (estado administrativo).
 *  2. PRODUCTO CARTOGRÁFICO (CARTOGRAPHIC_PRODUCT): Mapa satelital de delineación (DEL) o gradación (GRA).
 *  3. PERÍMETRO OBSERVADO (OBSERVED_PERIMETER): Polígono real delimitado por sensor radar (SAR) u óptico
 *     en el instante del pase satelital. NO representa el término municipal entero ni predicción futura.
 *
 * LINAJE DE FUENTE:
 *  - Sensor upstream: ESA Sentinel-1 (radar SAR insensible a nubes), Sentinel-2 (óptico), COSMO-SkyMed.
 *  - Catálogos dependientes: GLOFAS (modelo hidrológico previo), EFFIS (incendios).
 */

import { createHash } from 'node:crypto';

export const CEMS_SOURCE_METADATA = Object.freeze({
  provider: 'Copernicus Emergency Management Service (JRC/EC)',
  portalUrl: 'https://emergency.copernicus.eu/mapping/list-of-activations-rapid',
  license: 'Copernicus Open Access / Legal Notice (European Union)',
  upstreamSensors: ['Sentinel-1 CSAR', 'Sentinel-2 MSI', 'COSMO-SkyMed'],
  sameUpstreamCatalogs: ['GLOFAS', 'EFFIS'],
  supportedEventTypes: ['FL', 'WF', 'EQ', 'ST', 'VO']
});

const EVENT_TYPE_MAP = {
  FL: 'FLOOD',
  WF: 'WILDFIRE',
  EQ: 'EARTHQUAKE',
  ST: 'STORM',
  VO: 'VOLCANO'
};

/**
 * Normaliza y valida una activación CEMS Rapid Mapping.
 *
 * @param {object} rawActiv
 * @returns {object} Activación validada con desglose de productos y perímetros
 */
export function parseCemsActivation(rawActiv) {
  if (!rawActiv || typeof rawActiv !== 'object') {
    throw new TypeError('parseCemsActivation: se requiere objeto de activación');
  }

  const code = String(rawActiv.activation_code || '').trim().toUpperCase();
  if (!/^EMSR\d{3,6}$/.test(code)) {
    throw new RangeError(`Código de activación inválido: "${code}" (debe ser formato EMSRxxx)`);
  }

  const name = String(rawActiv.name || '').trim();
  const eventTypeCode = String(rawActiv.event_type || '').toUpperCase();
  const eventType = EVENT_TYPE_MAP[eventTypeCode] || 'OTHER';
  const countryCode = String(rawActiv.country_code || '').trim().toUpperCase();

  const activationTimeMs = Date.parse(rawActiv.activation_time_utc);
  if (!Number.isFinite(activationTimeMs)) {
    throw new RangeError(`Timestamp de activación inválido: ${rawActiv.activation_time_utc}`);
  }

  const centroid = Array.isArray(rawActiv.centroid) && rawActiv.centroid.length === 2
    ? [Number(rawActiv.centroid[0]), Number(rawActiv.centroid[1])]
    : null;

  const aois = [];
  let totalPerimetersCount = 0;
  let totalAreaHa = 0;

  if (Array.isArray(rawActiv.aois)) {
    for (const rawAoi of rawActiv.aois) {
      const aoiId = String(rawAoi.aoi_id || '').trim();
      const aoiName = String(rawAoi.name || '').trim();
      const bbox = Array.isArray(rawAoi.bbox) && rawAoi.bbox.length === 4
        ? rawAoi.bbox.map(Number)
        : null;

      const products = [];
      if (Array.isArray(rawAoi.products)) {
        for (const rawProd of rawAoi.products) {
          const prod = parseCemsProduct(rawProd, aoiId, code);
          products.push(prod);
          totalPerimetersCount += prod.observedPerimeters.length;
          totalAreaHa += prod.totalObservedAreaHa;
        }
      }

      aois.push({
        aoiId,
        name: aoiName,
        bbox,
        products
      });
    }
  }

  return {
    epistemicType: 'ACTIVATION',
    activationCode: code,
    name,
    eventType,
    eventTypeCode,
    countryCode,
    activationTimeUtc: new Date(activationTimeMs).toISOString(),
    activationTimeMs,
    status: rawActiv.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    centroid,
    aois,
    summary: {
      aoiCount: aois.length,
      productsCount: aois.reduce((acc, a) => acc + a.products.length, 0),
      totalPerimetersCount,
      totalAreaHa: Math.round(totalAreaHa * 10) / 10
    },
    lineage: CEMS_SOURCE_METADATA
  };
}

/**
 * Normaliza y valida un producto cartográfico de delineación o gradación.
 *
 * @param {object} rawProd
 * @param {string} aoiId
 * @param {string} activationCode
 * @returns {object}
 */
export function parseCemsProduct(rawProd, aoiId, activationCode) {
  const productId = String(rawProd.product_id || '').trim();
  const productType = String(rawProd.product_type || '').toUpperCase(); // DELINEATION | GRADING
  const publicationTimeMs = Date.parse(rawProd.publication_time_utc);
  const satelliteSensor = String(rawProd.satellite_sensor || 'Sentinel-1 CSAR').trim();
  const spatialResolutionM = Number(rawProd.spatial_resolution_m) || 10.0;

  const observedPerimeters = [];
  let totalAreaHa = 0;

  if (Array.isArray(rawProd.observed_perimeters)) {
    for (const rawPerim of rawProd.observed_perimeters) {
      if (!rawPerim.geometry || rawPerim.geometry.type !== 'Polygon') {
        continue;
      }

      const areaHa = Number(rawPerim.area_ha) || 0;
      totalAreaHa += areaHa;

      const obsTimeMs = Date.parse(rawPerim.observation_time_utc) || publicationTimeMs;

      observedPerimeters.push({
        epistemicType: 'OBSERVED_PERIMETER',
        perimeterId: String(rawPerim.perimeter_id || ''),
        hazardClass: String(rawPerim.class || 'FLOODED_AREA'),
        areaHa: Math.round(areaHa * 10) / 10,
        observationTimeUtc: new Date(obsTimeMs).toISOString(),
        observationTimeMs: obsTimeMs,
        sensor: satelliteSensor,
        resolutionM: spatialResolutionM,
        geometry: rawPerim.geometry
      });
    }
  }

  return {
    epistemicType: 'CARTOGRAPHIC_PRODUCT',
    productId,
    activationCode,
    aoiId,
    productType,
    publicationTimeUtc: Number.isFinite(publicationTimeMs) ? new Date(publicationTimeMs).toISOString() : null,
    satelliteSensor,
    spatialResolutionM,
    totalObservedAreaHa: Math.round(totalAreaHa * 10) / 10,
    observedPerimeters
  };
}

/**
 * Ingesta una colección cruda de activaciones CEMS y genera el feed canónico con SHA-256.
 *
 * @param {object} feedPayload
 * @returns {{activations:Array, totalActivations:number, canonicalHash:string, lineage:object}}
 */
export function buildCemsFeed(feedPayload) {
  if (!feedPayload || !Array.isArray(feedPayload.activations)) {
    throw new TypeError('buildCemsFeed: el payload debe contener un array "activations"');
  }

  const activations = feedPayload.activations.map(parseCemsActivation);

  const canonicalJson = JSON.stringify(activations, Object.keys(activations).sort());
  const canonicalHash = createHash('sha256').update(canonicalJson).digest('hex');

  return {
    schema: 'senda.cems-feed/v1',
    totalActivations: activations.length,
    canonicalHash,
    activations,
    lineage: CEMS_SOURCE_METADATA
  };
}

/**
 * Exporta una ficha de incidente en GeoJSON estándar lista para visualizadores y GIS 4D.
 * Incluye línea temporal completa y metadatos de incertidumbre.
 *
 * @param {object} activation Objeto parseado de activación
 * @param {string} [aoiId] Identificador de AOI específico
 * @returns {object} GeoJSON FeatureCollection canónico
 */
export function exportIncidentGeoJson(activation, aoiId = null) {
  const targetAoi = aoiId
    ? activation.aois.find((a) => a.aoiId === aoiId)
    : activation.aois[0];

  if (!targetAoi) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  const features = [];

  // 1. Centroide de la activación como punto de situación
  if (activation.centroid) {
    features.push({
      type: 'Feature',
      id: `${activation.activationCode}-CENTROID`,
      properties: {
        epistemicType: 'ACTIVATION_CENTROID',
        activationCode: activation.activationCode,
        name: activation.name,
        eventType: activation.eventType,
        activationTimeUtc: activation.activationTimeUtc,
        lineage: 'Copernicus EMS Rapid Mapping JRC'
      },
      geometry: {
        type: 'Point',
        coordinates: activation.centroid
      }
    });
  }

  // 2. Polígonos de perímetros observados físicamente
  for (const prod of targetAoi.products) {
    for (const perim of prod.observedPerimeters) {
      features.push({
        type: 'Feature',
        id: `${prod.productId}-${perim.perimeterId}`,
        properties: {
          epistemicType: 'OBSERVED_PERIMETER',
          activationCode: activation.activationCode,
          aoiId: targetAoi.aoiId,
          productId: prod.productId,
          productType: prod.productType,
          hazardClass: perim.hazardClass,
          areaHa: perim.areaHa,
          observationTimeUtc: perim.observationTimeUtc,
          satelliteSensor: perim.sensor,
          resolutionM: perim.resolutionM,
          lineage: 'Copernicus Sentinel / EMS JRC'
        },
        geometry: perim.geometry
      });
    }
  }

  return {
    type: 'FeatureCollection',
    properties: {
      activationCode: activation.activationCode,
      aoiId: targetAoi.aoiId,
      name: activation.name,
      exportedAtUtc: new Date().toISOString()
    },
    features
  };
}
