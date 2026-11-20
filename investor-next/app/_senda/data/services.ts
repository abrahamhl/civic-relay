import type { LocalizedText } from './types';

export interface ServiceCatalogItem {
  id: string;
  category: 'comms' | 'command' | 'hazard' | 'rescue';
  title: LocalizedText;
  desc: LocalizedText;
  href: string;
  evidenceId: string;
}

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  {
    id: 'svc-pwa',
    category: 'comms',
    title: { en: 'SENDA Field Offline PWA', es: 'SENDA Campo (PWA sin red)', nl: 'SENDA Veld Offline PWA' },
    desc: {
      en: 'Installable Service Worker + IndexedDB app that opens and queues encrypted messages completely offline.',
      es: 'App instalable con Service Worker e IndexedDB que abre, cifra y encola mensajes sin conexión.',
      nl: 'Installeerbare offline webapp met Service Worker en IndexedDB voor versleutelde wachtrijen.'
    },
    href: '/senda/',
    evidenceId: 'EV-OFFLINE-49'
  },
  {
    id: 'svc-multicarrier',
    category: 'comms',
    title: { en: 'Multi-Carrier Mesh & Shards', es: 'Red multiportador y fragmentos k-de-n', nl: 'Multikanaal-netwerk & k-van-n fragmenten' },
    desc: {
      en: 'Contact Graph Routing racing BLE, Wi-Fi Direct, neighbor satellite, SMS, LoRa, gateways, and acoustic audio.',
      es: 'Contact Graph Routing en carrera paralela por BLE, Wi-Fi Direct, satélite vecino, SMS, LoRa y sonido.',
      nl: 'Contact Graph Routing over BLE, Wi-Fi Direct, satelliet, sms, LoRa en akoestische overdracht.'
    },
    href: '/senda/red.html',
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    id: 'svc-acoustic',
    category: 'comms',
    title: { en: 'Acoustic MFSK-16 & LAN Voice', es: 'Módem acústico MFSK-16 y voz local', nl: 'Akoestische MFSK-16 & LAN-spraak' },
    desc: {
      en: 'Transfers ~300 B encrypted envelopes by sound with Hamming(7,4) FEC + CRC-32 plus local-network voice calls.',
      es: 'Envía sobres cifrados de ~300 B por sonido con corrección Hamming(7,4) y CRC-32 más llamadas en red local.',
      nl: 'Verzendt ~300 B versleutelde enveloppen via geluid met Hamming(7,4) FEC + CRC-32.'
    },
    href: '/senda/llamada.html',
    evidenceId: 'EV-ACOUSTIC'
  },
  {
    id: 'svc-radio',
    category: 'comms',
    title: { en: 'DEM Terrain Radio Planner', es: 'Planificador de radio sobre relieve DEM', nl: 'DEM-terrein radioplanner' },
    desc: {
      en: 'Computes ITU-R P.526 diffraction and optimal repeater placement over real Copernicus DEM GLO-30 topography.',
      es: 'Calcula difracción ITU-R P.526 y ubicación óptima de repetidores sobre relieve real Copernicus DEM GLO-30.',
      nl: 'Berekent ITU-R P.526-diffractie en optimale repeaterposities op Copernicus DEM GLO-30.'
    },
    href: '/senda/radio.html',
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'svc-console',
    category: 'command',
    title: { en: '16,699-Source Situation Console', es: 'Consola de situación (16.699 fuentes)', nl: 'Situatieconsole (16.699 bronnen)' },
    desc: {
      en: 'Fuses GDACS, DGT, NDW, ADS-B, GOES-16, TfL, and Caltrans across 5 globe/heatmap/3D-column views.',
      es: 'Fusiona GDACS, DGT, NDW, ADS-B, GOES-16, TfL y Caltrans en 5 vistas (globo, nocturno, calor, columnas y plano).',
      nl: 'Fuseert GDACS, DGT, NDW, ADS-B, GOES-16, TfL en Caltrans in 5 interactieve kaartweergaven.'
    },
    href: '/senda/consola.html',
    evidenceId: 'EV-CONSOLE-16K'
  },
  {
    id: 'svc-visor4d',
    category: 'command',
    title: { en: '4D Scientific Viewer', es: 'Visor 4D científico', nl: '4D Wetenschappelijke Viewer' },
    desc: {
      en: 'Spatial-temporal 4D inspection combining causal DAG fusion, terrain models, and atmospheric fields.',
      es: 'Inspección espacio-temporal 4D que integra fusión causal DAG, relieve y campos atmosféricos.',
      nl: 'Ruimtelijk-temporele 4D-inspectie met causale DAG-fusie, terrein en atmosfeermodellen.'
    },
    href: '/senda/visor.html',
    evidenceId: 'EV-FIRE-SMV'
  },
  {
    id: 'svc-mando',
    category: 'command',
    title: { en: 'SENDA Command & 3D Mission Control', es: 'SENDA Mando y Mission Control 3D', nl: 'SENDA Commando & 3D Mission Control' },
    desc: {
      en: 'Dedicated multichannel activation surface, RF link budgets, and raycast 3D globe with sector cameras.',
      es: 'Superficie multicanal de activaciones, balances de enlace RF y globo 3D raycast con cámaras por sector.',
      nl: 'Multikanaal-activatiepaneel, RF-linkbudgetten en 3D-globe met sectorcamera’s.'
    },
    href: '/mando/',
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'svc-fire3d',
    category: 'hazard',
    title: { en: 'SENDA-3D Wildfire Engine', es: 'Motor de incendios SENDA-3D', nl: 'SENDA-3D Natuurbrand-engine' },
    desc: {
      en: 'Mass-consistent 3D wind over Copernicus DEM, Briggs plume, Sentinel-2 burn scars, and fleet weather sensing.',
      es: 'Viento 3D con conservación de masa sobre DEM, pluma de Briggs, cicatrices Sentinel-2 y meteorología con flota.',
      nl: 'Massaconsistente 3D-wind op Copernicus DEM, Briggs-pluim, Sentinel-2 en voertuigsensoren.'
    },
    href: '/senda/fuego3d.html',
    evidenceId: 'EV-FIRE-SMV'
  },
  {
    id: 'svc-flood',
    category: 'hazard',
    title: { en: 'Flood Isolation & NL Water Waves', es: 'Aislamiento por riada y agua en Países Bajos', nl: 'Overstromingsisolatie & RWS Watergolven' },
    desc: {
      en: 'EMSR773 Valencia road-graph reachability + 25 Rijkswaterstaat stations measuring Dutch flood-wave travel times.',
      es: 'Alcanzabilidad vial EMSR773 (l’Horta Sud) y monitor de 25 estaciones Rijkswaterstaat en Países Bajos.',
      nl: 'EMSR773-wegenbereikbaarheid en 25 Rijkswaterstaat-meetstations voor watergolfanalyse in NL.'
    },
    href: '/senda/aislamiento.html',
    evidenceId: 'EV-FLOOD-DANA'
  },
  {
    id: 'svc-nepal',
    category: 'hazard',
    title: { en: 'Langtang 3D Satellite Flyover', es: 'Sobrevuelo 3D satelital (Langtang, Nepal)', nl: 'Langtang 3D Satellietvlucht' },
    desc: {
      en: 'Combines USGS M 5.2 landslide catalog, pre/post Sentinel-2 NDVI change, and Copernicus DEM GLO-30.',
      es: 'Combina catálogo USGS M 5,2, cambio NDVI Sentinel-2 pre/post y relieve Copernicus DEM GLO-30.',
      nl: 'Combineert USGS M 5,2-data, voor/na Sentinel-2 NDVI en Copernicus DEM GLO-30.'
    },
    href: '/senda/vuelo.html',
    evidenceId: 'EV-NEPAL-3D'
  },
  {
    id: 'svc-rail',
    category: 'rescue',
    title: { en: 'Multi-Train Rail & Traffic Vision', es: 'Fusión ferroviaria y visión vial YOLOX', nl: 'Spoorincidentfusie & YOLOX verkeersvisie' },
    desc: {
      en: 'Passenger crash fusion identifying multi-train incidents plus privacy-first YOLOX-s + ByteTrack road flow counts.',
      es: 'Fusión de impactos en trenes para localizar múltiples convoyes y conteo vial YOLOX-s + ByteTrack sin matrículas.',
      nl: 'Passagiersfusie bij treinincidenten en privacyvriendelijke YOLOX-s + ByteTrack verkeerstelling.'
    },
    href: '/senda/incidente.html',
    evidenceId: 'EV-RAIL-ADAMUZ'
  },
  {
    id: 'svc-buildings',
    category: 'rescue',
    title: { en: '3D Building Digital Twin & Agency Anchors', es: 'Gemelo 3D de edificios y anclas de organismo', nl: '3D Gebouw-twin & Organisatieankers' },
    desc: {
      en: 'EMS-98 floor-by-floor triage, BLE surface bridge, AR signal heatmap, and signed coordinator credentials.',
      es: 'Triaje planta por planta (EMS-98), puente BLE bajo escombros, mapa de calor AR y credenciales firmadas.',
      nl: 'EMS-98 verdiepingstriage, BLE-puinbrug, AR-signaalkaart en ondertekende coördinatorcertificaten.'
    },
    href: '/senda/edificios.html',
    evidenceId: 'EV-CORE-506'
  }
];
