/**
 * Enlaces de terceros que SENDA puede aprovechar o tener en cuenta, y de qué dependen.
 *
 * Regla de veracidad: aquí NO hay caudales ni alcances inventados. Cada entrada dice lo que su fuente
 * afirma (`claims`), qué NO aparece en la fuente (`unknown`) y de qué depende para funcionar
 * (`needs`). Un valor sin fuente es `null` («no medido»).
 *
 * Utilidad: saber, para un apagón de red celular, qué enlaces de terceros siguen sirviendo y cuáles
 * caen con la torre. No sustituye a la medida en campo.
 */
export const EXTERNAL_LINKS = Object.freeze({
  V16_CONNECTED: {
    label: 'Baliza V16 conectada (DGT 3.0)', role: 'POSITION_SOURCE',
    needs: ['IOT_NETWORK'], storeAndForward: true, rateBps: null, rangeM: null,
    claims: [
      'Lleva GPS y SIM no extraíble; envía la ubicación a DGT 3.0; conectividad mínima de 12 años incluida en el precio.',
      'Sin cobertura convencional usa redes IoT especializadas; si tampoco hay, sigue como luz y guarda los datos para enviarlos al volver la conexión.',
      'No registra velocidad, no identifica la matrícula ni envía datos personales del conductor.',
    ],
    unknown: ['tecnología exacta de la red (NB-IoT, LTE-M, 2G…)', 'frecuencia de envío', 'API o datos abiertos para terceros', 'si lleva Bluetooth'],
    source: 'https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/interior/paginas/2025/251125-obligacion-baliza-v16-carretera.aspx',
    sourceGrade: 'PRIMARY', checked: '2026-11-23',
  },
  CELL_POC_RADIO: {
    label: 'Walkie 4G de pulsar-para-hablar (PoC) con SIM', role: 'VOICE',
    needs: ['CELL_COVERAGE', 'SIM_DATA_PLAN'], storeAndForward: false, rateBps: null, rangeM: null,
    claims: [
      'Es un dispositivo celular, no una radio: depende de la cobertura 4G y sin ella queda inservible.',
      'La versión con paquete lleva una SIM válida en 41 países durante un año; después hay coste adicional.',
    ],
    unknown: ['precio de renovar la SIM', 'funcionamiento sin SIM (no aparece: el equipo analizado lleva nanoSIM)'],
    source: 'https://techradar.com/pro/phone-communications/rugone-xlink-7-rugged-walkie-talkie-review',
    sourceGrade: 'SECONDARY', checked: '2026-11-23',
  },
  HYBRID_POC_ANALOG_RADIO: {
    label: 'Walkie híbrido (LTE + radio analógica)', role: 'VOICE',
    needs: ['CELL_COVERAGE_OR_ANALOG_PEER'], storeAndForward: false, rateBps: null, rangeM: null,
    claims: ['Existen modelos que combinan LTE con radio analógica y cambian entre ambos según lo disponible.'],
    unknown: ['alcance analógico real', 'licencia/banda aplicable en España', 'fuente primaria del fabricante (solo referencia secundaria)'],
    source: 'https://poclink.com/products/poclink-radio-globalwide-walkie-talkie-long-range-ptt',
    sourceGrade: 'UNVERIFIED', checked: '2026-11-23',
  },
  XIAOMI_OFFLINE_CALL: {
    label: 'Xiaomi «Comunicación Offline» (Bluetooth)', role: 'VOICE',
    needs: ['SIM_INSTALLED', 'XIAOMI_ACCOUNT', 'BLUETOOTH', 'SUPPORTED_MODEL'], storeAndForward: false, rateBps: null,
    rangeM: null,
    rangeClaimOpenAreaM: { 'Xiaomi 15T Pro': 1900, 'Xiaomi 15T': 1300, 'POCO F8 Pro': 1500, 'POCO F8 Ultra': 1500 },
    claims: [
      'Usa Bluetooth y no depende de las estaciones base; requiere SIM instalada, cuenta Xiaomi y Bluetooth activado.',
      'Alcance en zona abierta sin obstáculos según el fabricante; la calidad real puede variar.',
      'El fabricante indica que no está pensada para comunicaciones de emergencia ni para salvar vidas.',
    ],
    unknown: ['alcance medido por terceros', 'lista completa de modelos'],
    source: 'https://www.mi.com/es/support/faq/details/KA-950967/',
    sourceGrade: 'PRIMARY', checked: '2026-11-23',
  },
});

/** Dependencias que caen cuando la red celular (torres) deja de funcionar. */
const CELL_TOWER_DEPENDENCIES = new Set(['CELL_COVERAGE', 'SIM_DATA_PLAN', 'CELL_COVERAGE_OR_ANALOG_PEER']);

/**
 * ¿Sobrevive un enlace a un apagón de la red celular?
 * Devuelve 'NO' si depende de torres, 'STORE_AND_FORWARD' si guarda y envía al volver la red,
 * 'SIN_DATOS' si la fuente no permite afirmar nada (p. ej. depende de una red IoT cuya
 * resistencia a un apagón no está documentada) y 'SI_SEGUN_FABRICANTE' si no depende de torres.
 */
export function survivesCellBlackout(id) {
  const l = EXTERNAL_LINKS[id];
  if (!l) throw new Error(`enlace desconocido: ${id}`);
  if (l.needs.some((n) => CELL_TOWER_DEPENDENCIES.has(n))) return 'NO';
  if (l.needs.includes('IOT_NETWORK')) return l.storeAndForward ? 'STORE_AND_FORWARD' : 'SIN_DATOS';
  return 'SI_SEGUN_FABRICANTE';
}
