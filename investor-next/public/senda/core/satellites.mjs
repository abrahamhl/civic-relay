/**
 * SENDA · Catálogo de redes satelitales utilizables, por nivel de acceso.
 *
 * Regla: solo datos con fuente pública (campo `sources`). Si un dato no está confirmado se
 * marca así; nada se presenta como operativo si la fuente dice «en desarrollo».
 * Estados: OPERATIONAL · ROLLING_OUT (por país/operador) · UNDER_DEVELOPMENT · PLANNED.
 * Acceso: PUBLIC_PHONE (móvil de serie) · PUBLIC_ACCESSORY (se compra un módulo) ·
 * AMATEUR_LICENSED (licencia de radioaficionado; sin cifrado por ley) · RECEIVE_ONLY ·
 * GOVERNMENT (servicios para autoridades, requieren convenio).
 */
export const ACCESS = Object.freeze(['PUBLIC_PHONE', 'PUBLIC_ACCESSORY', 'AMATEUR_LICENSED', 'RECEIVE_ONLY', 'GOVERNMENT']);

export const SATELLITE_NETWORKS = Object.freeze([
  {
    id: 'STARLINK_D2C', label: 'Starlink Direct to Cell (vía operador móvil)', access: 'PUBLIC_PHONE', status: 'ROLLING_OUT', orbit: 'LEO',
    capability: 'SMS y ubicación; voz en pruebas; algunas apps en Reino Unido', twoWay: true, hardware: 'Ninguno: móvil compatible + operador socio',
    europe: 'Reino Unido (Virgin Media O2, feb. 2026) y Ucrania (Kyivstar); Deutsche Telekom anuncia Europa para 2028',
    sendaUse: 'Fragmentos k-de-n por SMS cuando el móvil ve el satélite y no hay antena',
    sources: ['https://spacenews.com/virgin-media-o2-launches-europes-first-starlink-direct-to-smartphone-service/', 'https://www.veon.com/newsroom/press-releases/kyivstar-launches-starlink-direct-to-cell-satellite-connectivity-in-ukraine', 'https://www.telekom.com/en/newsroom/latest-updates/media-information/2026/3/telekom-and-starlink-close-whitespots-across-europe'],
  },
  {
    id: 'SKYLO_NTN', label: 'Skylo NB-NTN (SOS y SMS por satélite en Android)', access: 'PUBLIC_PHONE', status: 'ROLLING_OUT', orbit: 'GEO (banda L)',
    capability: 'SOS por satélite y SMS en móviles 3GPP Rel-17 (Pixel 9/10, Galaxy S25 con operador)', twoWay: true, hardware: 'Ninguno: móvil Rel-17 compatible',
    europe: 'SOS en Pixel ampliado a países europeos; SMS de Orange para Pixel anunciado (empresas en 2026)',
    sendaUse: 'Canal de último recurso para SOS/estado; SENDA prepara el texto compacto y firmado',
    sources: ['https://www.androidcentral.com/phones/google-pixel/pixel-9-10-gain-brief-satellite-texting-exclusivity-via-european-carrier-orange', 'https://en.wikipedia.org/wiki/Skylo'],
  },
  {
    id: 'IRIDIUM_SBD', label: 'Iridium Short Burst Data (módulo RockBLOCK 9603)', access: 'PUBLIC_ACCESSORY', status: 'OPERATIONAL', orbit: 'LEO (cobertura global)',
    capability: 'Mensajes binarios de hasta 340 B de subida y 270 B de bajada', twoWay: true, hardware: 'Módulo RockBLOCK 9603 + antena con cielo despejado; crédito prepago',
    cost: 'Crédito 0,08–0,20 USD; 1 crédito por 50 B en el datasheet del 9602 (confirmar en 9603)',
    sendaUse: 'Pasarela de barrio / vehículo de emergencias: sube fragmentos SENDA al relé desde cualquier punto del planeta',
    sources: ['https://docs.rockblock.rock7.com/docs/transmit-binary-data', 'https://www.groundcontrol.com/product/rockblock-9603/'],
  },
  {
    id: 'QO100', label: 'Es\'hail-2 / QO-100 (transpondedor geoestacionario de radioaficionado)', access: 'AMATEUR_LICENSED', status: 'OPERATIONAL', orbit: 'GEO 25,9° E',
    capability: 'Transpondedor lineal: subida 2,4 GHz, bajada 10,45 GHz; ~1/3 de la Tierra (Europa, África, Oriente Medio, India, parte de Brasil)',
    twoWay: true, hardware: 'Transverter 2,4 GHz + amplificador + parábola ≥60–75 cm (LHCP) + LNB de 10 GHz; licencia de radioaficionado',
    legal: 'Banda de aficionado: prohibido cifrar. SENDA solo envía estados públicos firmados (sin cifrar)',
    sendaUse: 'Enlace de largo alcance entre radioaficionados voluntarios y protección civil sin ninguna infraestructura terrestre',
    sources: ['https://en.wikipedia.org/wiki/Es%27hail_2', 'https://wordpress.amsat-uk.org/satellites/geo/eshail-2'],
  },
  {
    id: 'COSPAS_SARSAT_GALILEO_RLS', label: 'Cospas-Sarsat / Galileo SAR con Return Link', access: 'PUBLIC_ACCESSORY', status: 'OPERATIONAL', orbit: 'MEO (Galileo) + LEO/GEO',
    capability: 'Radiobalizas personales (PLB) 406 MHz; Galileo confirma al usuario que su alerta se recibió (Return Link, operativo desde 2020)', twoWay: false,
    hardware: 'Radiobaliza PLB con Galileo RLS',
    sendaUse: 'SENDA registra la baliza del usuario y cruza su posición con el gemelo de edificios y las respuestas',
    sources: ['https://www.esa.int/Applications/Satellite_navigation/Galileo_now_replying_to_SOS_messages_worldwide', 'https://www.gsc-europa.eu/galileo/services/search-and-rescue-sar-galileo-service'],
  },
  {
    id: 'GALILEO_EWSS', label: 'Galileo Emergency Warning Satellite Service (EWSS)', access: 'RECEIVE_ONLY', status: 'UNDER_DEVELOPMENT', orbit: 'MEO',
    capability: 'Alertas de protección civil directas a móviles con Galileo, sin red celular', twoWay: false, hardware: 'Ninguno (receptor Galileo del móvil, cuando el SO lo soporte)',
    sendaUse: 'Fuente de alerta oficial adicional para activar el modo relé preautorizado (como CAP/EU-Alert)',
    sources: ['https://www.euspa.europa.eu/galileo-ewss', 'https://www.gsc-europa.eu/news/galileo-emergency-warning-satellite-service-is-underway'],
  },
  {
    id: 'GOVSATCOM_IRIS2', label: 'EU GOVSATCOM / IRIS² (conectividad segura gubernamental)', access: 'GOVERNMENT', status: 'PLANNED', orbit: 'GEO/LEO/MEO',
    capability: 'Conectividad satelital segura para autoridades; el sistema EUCCS tendrá acceso a ella', twoWay: true, hardware: 'Terminales gubernamentales',
    sendaUse: 'Troncal segura entre el relé SENDA del organismo y los centros de mando (con convenio)',
    sources: ['https://home-affairs.ec.europa.eu/news/enhancing-europes-capacity-react-preparing-european-critical-communication-system-2026-01-30_en'],
  },
  {
    id: 'SATNOGS', label: 'SatNOGS (red abierta de estaciones terrenas)', access: 'RECEIVE_ONLY', status: 'OPERATIONAL', orbit: 'LEO',
    capability: 'Observaciones y telemetría abiertas de satélites', twoWay: false, hardware: 'Estación SatNOGS (SDR + antena) opcional',
    sendaUse: 'Ya integrado como fuente (feeds.mjs) para conocer pasos y salud de satélites',
    sources: ['https://satnogs.org'],
  },
]);

export function networksByAccess() {
  return ACCESS.map((a) => ({ access: a, networks: SATELLITE_NETWORKS.filter((n) => n.access === a) }));
}
