import type { LocalizedText } from './types';

export interface ProductScene {
  num: string;
  eyebrow: LocalizedText;
  title: LocalizedText;
  body: LocalizedText;
  detail: LocalizedText;
  evidenceId: string;
}

export const PRODUCT_SCENES: ProductScene[] = [
  {
    num: '01',
    eyebrow: { en: '01 / THE CHALLENGE', es: '01 / EL RETO', nl: '01 / DE UITDAGING' },
    title: {
      en: 'When a tower loses power, conventional messaging stalls.',
      es: 'Cuando la antena pierde energía, la mensajería convencional se detiene.',
      nl: 'Als een zendmast uitvalt, stopt reguliere communicatie.'
    },
    body: {
      en: 'During floods, wildfires, or regional blackouts, alerts and messaging apps share a single point of failure: the cellular tower. SENDA is designed specifically to bridge that gap and keep critical status flowing.',
      es: 'En inundaciones, incendios o apagones, los avisos y la mensajería dependen de un único punto de fallo: la antena móvil. SENDA nace exactamente para tender puentes sobre ese corte y mantener vivo el contacto crítico.',
      nl: 'Bij overstromingen, branden of stroomuitval hangt communicatie af van één schakel: de zendmast. SENDA overbrugt precies die uitval.'
    },
    detail: {
      en: 'In Scenario S01 (Arnhem -> San Martín, 8 h outage), standard cellular waits 480 min for tower restoration while SENDA finds an active route in ≈4 min.',
      es: 'En el escenario S01 (Arnhem -> San Martín, apagón de 8 h), la red móvil espera 480 min mientras SENDA encuentra una ruta activa en ≈4 min.',
      nl: 'In scenario S01 (Arnhem -> San Martín, 8 uur uitval) wacht regulier verkeer 480 min terwijl SENDA in ≈4 min een actieve route vindt.'
    },
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    num: '02',
    eyebrow: { en: '02 / MULTIPATH FABRIC', es: '02 / MALLA MULTICANAL', nl: '02 / MULTIKANAAL-NETWERK' },
    title: {
      en: 'Every phone, every surviving channel, one adaptive path.',
      es: 'Cada móvil, cada canal disponible, un camino adaptativo.',
      nl: 'Elke telefoon, elk overlevend kanaal, één adaptief pad.'
    },
    body: {
      en: 'SENDA continuously evaluates and races every surviving channel: nearby phones over Bluetooth or Wi-Fi Direct, a neighbor with satellite Internet or another carrier, SMS, direct-to-cell satellite passes, LoRa gateways, and MFSK-16 sound.',
      es: 'SENDA evalúa y compite en paralelo por cualquier canal vivo en ese instante: vecinos por Bluetooth o Wi-Fi Direct, alguien con Internet satelital u otro operador, SMS, ventanas de satélite directo, pasarelas LoRa y módem acústico MFSK-16.',
      nl: 'SENDA benut elk beschikbaar kanaal parallel: nabije toestellen via Bluetooth of Wi-Fi Direct, satellietinternet bij buren, sms, satellietvensters, LoRa-gateways en MFSK-16 geluid.'
    },
    detail: {
      en: 'Contact Graph Routing + Receding-Horizon Custody (ARR_REPLAN_V2) reaches 94.2% delivery while cutting energy usage by 84% vs epidemic flooding.',
      es: 'Contact Graph Routing + custodia móvil (ARR_REPLAN_V2) alcanza 94,2 % de entrega reduciendo el gasto energético un 84 % frente a difusión epidémica.',
      nl: 'Contact Graph Routing + ARR_REPLAN_V2 bereikt 94,2% bezorging met 84% lager energieverbruik dan epidemische verspreiding.'
    },
    evidenceId: 'EV-ARR-V2'
  },
  {
    num: '03',
    eyebrow: { en: '03 / DETERMINISTIC PIPELINE', es: '03 / CANALIZACIÓN DETERMINISTA', nl: '03 / DETERMINISTISCHE PIPELINE' },
    title: {
      en: 'Six verifiable stages from intent to signed receipt.',
      es: 'Seis etapas verificables del envío al recibo firmado.',
      nl: 'Zes verifieerbare stappen van bericht tot ondertekende ACK.'
    },
    body: {
      en: 'Every envelope is end-to-end encrypted (ECDH P-256 + AES-GCM + ECDSA) so intermediate blind relays inspect only routing metadata, priority, and TTL. Duplicate copies collapse automatically and signed ACKs purge intermediate queues.',
      es: 'Cada sobre viaja cifrado de extremo a extremo (ECDH P-256 + AES-GCM + ECDSA) para que los relés ciegos solo consulten cabecera, prioridad y caducidad. Las copias duplicadas se unifican y el ACK firmado purga las colas.',
      nl: 'Elke envelop is end-to-end versleuteld (ECDH P-256 + AES-GCM + ECDSA) zodat blinde relays alleen routemetadata zien. Kopieën worden ontdubbeld en ondertekende ACK’s schonen buffers op.'
    },
    detail: {
      en: 'MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK. Verified across 506/506 core tests and 49/49 offline Chromium E2E runs.',
      es: 'MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK. Verificado en 506/506 pruebas del núcleo y 49/49 E2E sin red en Chromium.',
      nl: 'MESSAGE -> STORE -> ROUTE -> MULTIPATH -> DEDUP -> ACK. Geverifieerd in 506/506 kerntests en 49/49 offline Chromium E2E-runs.'
    },
    evidenceId: 'EV-CORE-506'
  },
  {
    num: '04',
    eyebrow: { en: '04 / PRE-AUTHORIZED RELAY', es: '04 / MODO RELÉ PREAUTORIZADO', nl: '04 / VOORAF GEAUTORISEERDE RELAY' },
    title: {
      en: 'Automatic relay activation governed by authority, consent, and battery quotas.',
      es: 'Activación automática gobernada por autoridad, consentimiento y cuotas de batería.',
      nl: 'Automatische relay-activering onder gezags-, toestemmings- en accugrenzen.'
    },
    body: {
      en: 'When an authority declares an emergency zone (CAP / EU-Alert) or multi-source seismic catalogs corroborate an event, participating phones smoothly enter pre-authorized relay mode within user-approved battery and data budgets.',
      es: 'Cuando una autoridad declara una zona de emergencia (CAP / EU-Alert) o varios sismógrafos corroboran un evento, los teléfonos participantes activan el modo relé preautorizado dentro de los límites de batería y datos aprobados por el usuario.',
      nl: 'Zodra een autoriteit een noodzone verklaart (CAP / NL-Alert) of meerdere seismische bronnen een beving bevestigen, schakelen deelnemende toestellen automatisch over naar relay-modus binnen goedgekeurde limieten.'
    },
    detail: {
      en: 'Respects Android/iOS radio permissions, keeps silence accurately classified as UNKNOWN, and complements official 112 / EU-Alert systems.',
      es: 'Respeta los permisos de radio de Android/iOS, clasifica siempre la falta de respuesta como UNKNOWN y complementa los sistemas oficiales 112 / ES-Alert.',
      nl: 'Respecteert Android/iOS-rechten, classificeert stilte altijd als UNKNOWN en vult officiële 112 / NL-Alert-systemen aan.'
    },
    evidenceId: 'EV-02-SWEEP'
  },
  {
    num: '05',
    eyebrow: { en: '05 / FULL ECOSYSTEM & SCIENCE', es: '05 / ECOSISTEMA Y CIENCIA APLICADA', nl: '05 / VOLLEDIG ECOSYSTEEM & WETENSCHAP' },
    title: {
      en: 'From family check-ins to 3D wildfire physics, flood graphs, and rescue twins.',
      es: 'De avisos familiares a física 3D de incendios, riadas y rescate en edificios.',
      nl: 'Van familie-updates tot 3D-brandfysica, watergolven en reddingstwins.'
    },
    body: {
      en: 'Beyond routing, SENDA provides a unified operational platform: 16,699-element multi-source fusion, 3D building triage with BLE surface bridges, multi-train crash fusion, EMSR773 flood isolation, Dutch RWS water tracking, and open scientific papers.',
      es: 'Más allá del enrutamiento, SENDA ofrece una plataforma operativa integral: fusión de 16.699 fuentes, gemelo 3D de edificios con puente bajo escombros, fusión ferroviaria multi-tren, aislamiento por riada EMSR773, monitor hidrológico NL y 5 papers científicos.',
      nl: 'Naast routering biedt SENDA een compleet operationeel platform: 16.699-bronnenfusie, 3D-gebouwtriage, spoorfusie, overstromingsisolatie, RWS-watermonitoring en 5 wetenschappelijke papers.'
    },
    detail: {
      en: 'Open-source MIT codebase powering both the interactive browser platform and the experimental Android Nearby & ESP32 survey companions.',
      es: 'Código abierto MIT que impulsa la plataforma web interactiva junto a la app experimental Android Nearby y el firmware ESP32.',
      nl: 'Open-source MIT-codebase voor het interactieve webplatform en de Android Nearby- en ESP32-modules.'
    },
    evidenceId: 'EV-CONSOLE-16K'
  }
];

export const PIPELINE_STAGES: Array<{
  code: string;
  desc: LocalizedText;
}> = [
  {
    code: 'MESSAGE',
    desc: {
      en: 'Typed SAFE / SOS / alert payload (<=160 chars) with explicit consent & E2EE envelope.',
      es: 'Mensaje tipado SAFE / SOS / aviso (≤160 car.) con consentimiento explícito y cifrado E2E.',
      nl: 'Getypt SAFE / SOS-bericht (≤160 tekens) met expliciete toestemming en E2EE-envelop.'
    }
  },
  {
    code: 'STORE',
    desc: {
      en: 'Durable local queue (IndexedDB / Android disk) bounded by TTL, priority, and storage quota.',
      es: 'Cola local persistente (IndexedDB / disco Android) acotada por TTL, prioridad y cuota.',
      nl: 'Persistente lokale wachtrij (IndexedDB / Android) begrensd door TTL, prioriteit en quotum.'
    }
  },
  {
    code: 'ROUTE',
    desc: {
      en: 'Contact Graph Routing & attempt ladder pick the earliest feasible chain across channels.',
      es: 'Contact Graph Routing y escalera de canales eligen la llegada más temprana posible.',
      nl: 'Contact Graph Routing kiest de snelst haalbare keten over beschikbare kanalen.'
    }
  },
  {
    code: 'MULTIPATH',
    desc: {
      en: 'Races BLE, Wi-Fi Direct, satellite neighbor, SMS, gateway, or acoustic MFSK-16 in parallel.',
      es: 'Lanza en paralelo BLE, Wi-Fi Direct, vecino satelital, SMS, pasarela o módem acústico.',
      nl: 'Verzendt parallel via BLE, Wi-Fi Direct, satellietbuur, sms, gateway of akoestisch.'
    }
  },
  {
    code: 'DEDUP',
    desc: {
      en: 'Same envelope arriving over multiple paths collapses into one logical message retaining path metadata.',
      es: 'El mismo sobre por varias rutas se unifica en un único mensaje conservando trazabilidad.',
      nl: 'Dezelfde envelop via meerdere routes wordt één logisch bericht met routemetadata.'
    }
  },
  {
    code: 'ACK',
    desc: {
      en: 'Receiver-signed receipt confirms delivery and propagates purge tombstones across blind relays.',
      es: 'Recibo firmado por el receptor confirma la entrega y purga copias en los relés ciegos.',
      nl: 'Ondertekend ontvangstbewijs bevestigt bezorging en wist kopieën bij tussenliggende relays.'
    }
  }
];
