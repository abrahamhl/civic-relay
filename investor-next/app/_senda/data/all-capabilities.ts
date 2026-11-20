import type { LocalizedText } from './types';

export type CapCategory = 'offline' | 'sat-osint' | 'mobility' | 'hazard-rescue' | 'drone-science';

export interface CapabilityItem {
  id: string;
  cat: CapCategory;
  title: LocalizedText;
  desc: LocalizedText;
  href: string;
}

export const ALL_CAPABILITIES: CapabilityItem[] = [
  // Offline & Multi-bearer Comms
  {
    id: 'cap-offline',
    cat: 'offline',
    title: { es: 'SENDA Campo (Sin Internet)', en: 'SENDA Field (No Internet)', nl: 'SENDA Veld (Zonder Internet)' },
    desc: {
      es: 'Abre en modo avión: sonido entre móviles, archivo .senda, salto mano a mano (DTN) y recibos infalsificables que purgan copias.',
      en: 'Opens in airplane mode: phone-to-phone sound, .senda files, hand-to-hand DTN relays, and signed receipts purging copies.',
      nl: 'Opent in vliegtuigmodus: geluid tussen telefoons, .senda-bestanden, DTN-relays en ondertekende ontvangstbewijzen.'
    },
    href: '/senda/'
  },
  {
    id: 'cap-shards',
    cat: 'offline',
    title: { es: 'Un mensaje, muchos caminos (k-de-n)', en: 'One message, many paths (k-of-n)', nl: 'Eén bericht, vele paden (k-van-n)' },
    desc: {
      es: 'Fragmentos Reed-Solomon k-de-n repartidos entre múltiples portadores con cálculo exacto de probabilidad de entrega.',
      en: 'Reed-Solomon k-of-n shards split across carriers with exact end-to-end delivery probability modeling.',
      nl: 'Reed-Solomon k-van-n fragmenten verdeeld over dragers met exacte bezorgkansberekening.'
    },
    href: '/senda/red.html'
  },
  {
    id: 'cap-calls',
    cat: 'offline',
    title: { es: 'Llamadas y voz sin Internet', en: 'Calls & voice without Internet', nl: 'Bellen zonder internet' },
    desc: {
      es: 'Voz y chat cifrados sin operador: el arranque (80–110 B) viaja por sonido en < 10 s y otro móvil puede encadenar la voz.',
      en: 'Encrypted voice and chat with no carrier: 80–110 B call setup travels by sound in < 10 s with multi-phone voice chaining.',
      nl: 'Versleutelde spraak zonder provider: 80–110 B opzet via geluid in < 10 s met doorgeefketen.'
    },
    href: '/senda/llamada.html'
  },
  {
    id: 'cap-battery-net',
    cat: 'offline',
    title: { es: 'Batería de Internet local', en: 'Local Internet Battery', nl: 'Lokale Internetbatterij' },
    desc: {
      es: 'Reserva de red en el móvil (hasta ~1 GB por valor y frescura), biblioteca común entre vecinos y guía hacia zonas con salida.',
      en: 'On-phone network cache (~1 GB ranked by value & freshness), neighborhood shared library, and exit-zone guidance.',
      nl: 'Lokale netwerkreserve (~1 GB), gedeelde buurtbibliotheek en gids naar bereikzones.'
    },
    href: '/senda/reserva.html'
  },
  {
    id: 'cap-easy',
    cat: 'offline',
    title: { es: 'Modo Fácil Accesible (3 botones)', en: 'Accessible Easy Mode (3 buttons)', nl: 'Toegankelijke 3-Knoppen Modus' },
    desc: {
      es: 'Interfaz directa de 3 botones grandes pensada para cualquier persona, mayores o momentos de pánico sin cobertura.',
      en: 'Three large high-contrast buttons built for any citizen, elderly users, or high-stress emergencies without coverage.',
      nl: 'Drie grote knoppen met hoog contrast voor iedereen tijdens noodsituaties zonder netwerk.'
    },
    href: '/senda/?facil=1'
  },
  {
    id: 'cap-blackout',
    cat: 'offline',
    title: { es: 'Previsión de Apagón y Pasarelas', en: 'Blackout Forecast & Gateways', nl: 'Stroomuitval-prognose & Gateways' },
    desc: {
      es: 'Calcula cuándo y dónde caerán las baterías de antenas y dónde colocar pasarelas antes de perder la red.',
      en: 'Forecasts when and where cell tower batteries exhaust and optimal pre-positioning for rescue gateways.',
      nl: 'Voorspelt wanneer zendmastaccu’s leegraken en waar gateways vooraf geplaatst moeten worden.'
    },
    href: '/senda/red.html'
  },
  {
    id: 'cap-radio-dem',
    cat: 'offline',
    title: { es: 'Planificador Radio sobre Relieve DEM', en: 'DEM Terrain Radio Planner', nl: 'DEM-terrein Radioplanner' },
    desc: {
      es: 'Difracción ITU-R P.526 (Deygout) sobre Copernicus DEM GLO-30 para colocar repetidores con malla conexa.',
      en: 'ITU-R P.526 Deygout diffraction over Copernicus DEM GLO-30 for connected repeater placement.',
      nl: 'ITU-R P.526 Deygout-diffractie op Copernicus DEM GLO-30 voor optimale repeaterdekking.'
    },
    href: '/senda/radio.html'
  },
  {
    id: 'cap-android-esp32',
    cat: 'offline',
    title: { es: 'Android Nearby y Firmware ESP32', en: 'Android Nearby & ESP32 Firmware', nl: 'Android Nearby & ESP32 Firmware' },
    desc: {
      es: 'Baliza Bluetooth, escucha de balizas, barrido Wi-Fi y accesorio ESP32 de bajo coste para mástil o dron.',
      en: 'Bluetooth beacon, scanner, Wi-Fi sweep, and low-cost ESP32 hardware companion for masts or drones.',
      nl: 'Bluetooth-baken, Wi-Fi-scan en betaalbare ESP32-hardware voor masten of drones.'
    },
    href: 'https://github.com/abrahamhl/civic-relay/tree/master/apps/senda-android'
  },
  {
    id: 'cap-relay-docker',
    cat: 'offline',
    title: { es: 'Relé Soberano Autoalojable (Docker)', en: 'Sovereign Self-Hosted Relay (Docker)', nl: 'Soevereine Docker Relay' },
    desc: {
      es: 'Relé ciego al contenido operado por el propio municipio o gobierno sin dependencia de nubes externas.',
      en: 'Content-blind Docker relay operated directly by municipalities or agencies with zero third-party cloud lock-in.',
      nl: 'Inhoudsblinde Docker-relay beheerd door de overheid zelf zonder cloudafhankelijkheid.'
    },
    href: 'https://github.com/abrahamhl/civic-relay/tree/master/packages/senda-relay'
  },

  // Satellites & OSINT
  {
    id: 'cap-ojo',
    cat: 'sat-osint',
    title: { es: 'Ojo de SENDA (Iridium · Galileo · QO-100)', en: 'SENDA Eye (Iridium · Galileo · QO-100)', nl: 'Oog van SENDA (Satellieten Live)' },
    desc: {
      es: 'Globo orbital en tiempo real: elevación, distancia inclinada, latencia y salto de cada caso real hasta el 112.',
      en: 'Real-time orbital globe computing satellite elevation, slant distance, latency, and alert path to 112.',
      nl: 'Live orbitale globe met satellietelevatie, afstand, latentie en meldingsroute naar 112.'
    },
    href: '/senda/ojo.html'
  },
  {
    id: 'cap-sat-access',
    cat: 'sat-osint',
    title: { es: 'Red Satelital por Nivel de Acceso', en: 'Tiered Satellite Access Network', nl: 'Satellietnetwerk per Toegangsniveau' },
    desc: {
      es: 'Direct-to-Cell 3GPP NTN, Iridium RockBLOCK, Galileo SAR y QO-100 integrados bajo marco regulatorio.',
      en: 'Direct-to-Cell 3GPP NTN, Iridium RockBLOCK, Galileo SAR, and QO-100 unified with regulatory clarity.',
      nl: 'Direct-to-Cell 3GPP NTN, Iridium, Galileo SAR en QO-100 verenigd binnen regelgeving.'
    },
    href: '/senda/red.html'
  },
  {
    id: 'cap-consola',
    cat: 'sat-osint',
    title: { es: 'Consola OSINT de 16.699 Fuentes', en: '16,699-Source OSINT Console', nl: '16.699-Bronnen OSINT Console' },
    desc: {
      es: 'Fusiona GDACS, DGT, NDW, ADS-B, GOES-16, TfL y Caltrans en 5 vistas (globo, nocturno, calor, columnas y plano).',
      en: 'Fuses GDACS, DGT, NDW, ADS-B, GOES-16, TfL, and Caltrans across 5 live interactive globe/heatmap/3D views.',
      nl: 'Fuseert GDACS, DGT, NDW, ADS-B, GOES-16, TfL en Caltrans in 5 kaartweergaven.'
    },
    href: '/senda/consola.html'
  },
  {
    id: 'cap-cameras',
    cat: 'sat-osint',
    title: { es: 'OSINT Cámaras Públicas (Niebla y Nieve)', en: 'Public Camera OSINT (Fog & Snow)', nl: 'Openbare Camera-OSINT (Mist & Sneeuw)' },
    desc: {
      es: 'Mide visibilidad Koschmieder y presencia de nieve en cámaras viales reutilizables — sin personas ni matrículas.',
      en: 'Measures Koschmieder visibility (fog) and snow across public highway cameras — never faces or license plates.',
      nl: 'Meet zichtbaarheid (mist) en sneeuw op openbare wegcamera’s — zonder personen of kentekens.'
    },
    href: '/senda/camaras.html'
  },
  {
    id: 'cap-organismo',
    cat: 'sat-osint',
    title: { es: 'Coordinación con Firma e Integración 112', en: 'Signed Agency Coordination & CAP 1.2', nl: 'Ondertekende Coördinatie & CAP 1.2' },
    desc: {
      es: 'Organismo -> credencial firmada -> alerta dirigida -> respuesta cifrada -> exportación CAP 1.2 y auditoría encadenada.',
      en: 'Agency -> signed credential -> targeted alert -> encrypted reply -> CAP 1.2 export with hash-chained audit trail.',
      nl: 'Organisatie -> certificaat -> gerichte alert -> versleuteld antwoord -> CAP 1.2 export.'
    },
    href: '/senda/organismo.html'
  },
  {
    id: 'cap-centro',
    cat: 'sat-osint',
    title: { es: 'Centro de Coordinación Integrado', en: 'Integrated Coordination Center', nl: 'Geïntegreerd Coördinatiecentrum' },
    desc: {
      es: 'Mapa de situación, cronología, linaje de fuentes, rutas SRLG, colas IndexedDB con revocación y roles fail-closed.',
      en: 'Situation map, timeline, source lineage, SRLG routing, revocable IndexedDB queues, and fail-closed roles.',
      nl: 'Situatiekaart, tijdlijn, bronherkomst, SRLG-routes en fail-closed rollen.'
    },
    href: '/senda/centro.html'
  },
  {
    id: 'cap-arq',
    cat: 'sat-osint',
    title: { es: 'Arquitectura Animada (6 Escenarios)', en: 'Animated System Architecture (6 Scenes)', nl: 'Geanimeerde Systeemarchitectuur' },
    desc: {
      es: 'Sensores y radios -> portadores -> núcleo en el móvil -> apps -> destinos con 6 escenarios interactivos animados.',
      en: 'Sensors & radios -> bearers -> on-phone core -> apps -> destinations across 6 live animated scenarios.',
      nl: 'Sensoren -> dragers -> telefoonkern -> apps -> ontvangers in 6 geanimeerde scenario’s.'
    },
    href: '/senda/arquitectura.html'
  },

  // Mobility, Rail & Roads
  {
    id: 'cap-rail-crash',
    cat: 'mobility',
    title: { es: 'Accidente Ferroviario Multi-Tren', en: 'Multi-Train Rail Crash Fusion', nl: 'Meer-Trein Spoorongevalfusie' },
    desc: {
      es: 'Fusión de acelerómetros de pasajeros que detecta impactos y separa dos trenes implicados en segundos (patrón Adamuz).',
      en: 'Passenger accelerometer fusion detecting impacts and separating multiple involved trains in seconds.',
      nl: 'Passagiers-versnellingsmeterfusie die meerdere betrokken treinen binnen seconden onderscheidt.'
    },
    href: '/senda/incidente.html'
  },
  {
    id: 'cap-rail-watch',
    cat: 'mobility',
    title: { es: 'Vigilancia Ferroviaria (Vía y Muros)', en: 'Rail Track & Embankment Watch', nl: 'Spoor- & Dijkbewaking' },
    desc: {
      es: 'Escalones en circuitos de vía (Adamuz), geometría de carril medida con móviles, curvas críticas y muros bajo lluvia.',
      en: 'Track-circuit anomalies, smartphone rail-geometry sensing, critical curves, and rain-soaked retaining walls.',
      nl: 'Spoorcircuit-afwijkingen, spoorgeometrie via smartphones en keringen onder zware regen.'
    },
    href: '/senda/via.html'
  },
  {
    id: 'cap-carretera',
    cat: 'mobility',
    title: { es: 'Ruta Protectora en Carretera', en: 'Protective Highway Route', nl: 'Beschermende Snelwegroute' },
    desc: {
      es: 'Aviso de frenada brusca a coches sin línea visual, SOS sin cobertura llevado por coches que pasan y PK sin red.',
      en: 'Hard-braking warnings beyond line of sight, zero-coverage SOS carried by passing cars, and offline kilometer markers.',
      nl: 'Noodremwaarschuwingen, offline SOS via passerende auto’s en hectometerpaal-lokalisatie.'
    },
    href: '/senda/carretera.html'
  },
  {
    id: 'cap-dgt',
    cat: 'mobility',
    title: { es: 'Infraestructura DGT 3.0 y Balizas V16', en: 'DGT 3.0 Infrastructure & V16 Beacons', nl: 'DGT 3.0 Infrastructuur & V16 Bakens' },
    desc: {
      es: 'Paneles, cámaras, aforos y balizas V16 integrados bajo estándar abierto europeo DATEX II.',
      en: 'Roadside panels, cameras, flow counters, and V16 connected beacons unified under European DATEX II.',
      nl: 'Matrixborden, camera’s, verkeerstellingen en V16-bakens onder Europese DATEX II-standaard.'
    },
    href: '/senda/dgt.html'
  },
  {
    id: 'cap-paises',
    cat: 'mobility',
    title: { es: 'España -> Países Bajos (DATEX II UE)', en: 'Spain -> Netherlands (EU DATEX II)', nl: 'Spanje -> Nederland (EU DATEX II)' },
    desc: {
      es: 'Mismo núcleo europeo: 112 y DATEX II comunes; en Países Bajos, cruces rojas de carril, puentes móviles y avisos NL.',
      en: 'One European core across Spain & the Netherlands: shared 112/DATEX II, Dutch red lane crosses & movable bridges.',
      nl: 'Eén Europese kern voor Spanje & Nederland: rode kruisen boven rijstroken, beweegbare bruggen en NL-alerts.'
    },
    href: '/senda/paises.html'
  },
  {
    id: 'cap-trafico',
    cat: 'mobility',
    title: { es: 'Visión de Tráfico YOLOX (Vídeo Real)', en: 'YOLOX Real-Video Traffic Vision', nl: 'YOLOX Verkeersvisie (Echte Video)' },
    desc: {
      es: 'Conteo por sentido, distancia, tiempo de alcance y cruces con la calzada contraria. Solo salen números (cero matrículas).',
      en: 'Directional counts, spacing, time-to-catch, and opposing-lane relays on real road video. Outputs numbers only.',
      nl: 'Richtingstellingen, afstand en tijd-tot-contact op echte wegvideo — uitsluitend cijfers.'
    },
    href: '/senda/trafico.html'
  },
  {
    id: 'cap-vehiculos',
    cat: 'mobility',
    title: { es: 'Coches Conectados (Ley de Datos UE)', en: 'Connected Cars (EU Data Act)', nl: 'Verbonden Auto’s (EU Data Act)' },
    desc: {
      es: 'Avisos DFRS de vehículos y precisión de posición mejorada de ~10 m a ~1–2 m cruzando vía, aerogeneradores y Wi-Fi.',
      en: 'Vehicle safety alerts (DFRS) upgrading positioning from ~10 m to ~1–2 m via road, turbine, and Wi-Fi fusion.',
      nl: 'Voertuigveiligheidsmeldingen (DFRS) met 1–2 m nauwkeurigheid door weg- en Wi-Fi-fusie.'
    },
    href: '/senda/vehiculos.html'
  },
  {
    id: 'cap-evacuacion',
    cat: 'mobility',
    title: { es: 'Coches, Cámaras y Evacuación Kalman', en: 'Cars, Cameras & Kalman Evacuation', nl: 'Auto’s, Camera’s & Kalman Evacuatie' },
    desc: {
      es: 'Cámaras Caltrans/TfL + satélite GOES + tráfico por celdas con filtro de Kalman para prever atascos de evacuación.',
      en: 'Caltrans/TfL cameras + GOES satellite + cell-transmission Kalman filter forecasting evacuation gridlock early.',
      nl: 'Caltrans/TfL-camera’s + GOES-satelliet + Kalman-verkeersmodel tegen evacuatiefiles.'
    },
    href: '/senda/evacuacion.html'
  },

  // Hazards, Floods, Fire & Rescue
  {
    id: 'cap-fuego3d',
    cat: 'hazard-rescue',
    title: { es: 'Incendio en 3D con Datos Reales', en: 'SENDA-3D Real-Data Wildfire Engine', nl: 'SENDA-3D Natuurbrand-engine' },
    desc: {
      es: 'Terreno Copernicus, Sentinel-2 y GFS: viento 3D, pluma Briggs, humo, pavesas, oclusión de cámaras y coches meteorológicos.',
      en: 'Copernicus DEM + Sentinel-2 + GFS: 3D mass-consistent wind, Briggs plume, embers, camera occlusion & fleet meteo.',
      nl: 'Copernicus DEM + Sentinel-2 + GFS: 3D-wind, Briggs-pluim, vonkenregen en vloot-meteorologie.'
    },
    href: '/senda/fuego3d.html'
  },
  {
    id: 'cap-fuego-track',
    cat: 'hazard-rescue',
    title: { es: 'Seguimiento de Incendio y Antenas', en: 'Wildfire & Mast Survival Tracking', nl: 'Brand- & Zendmastbewaking' },
    desc: {
      es: 'Cruza avance del frente con torres móviles para saber hasta qué minuto hay cobertura y qué canal alternativo activar.',
      en: 'Crosses wildfire spread with cell tower locations to predict tower outage windows and automatic channel switchover.',
      nl: 'Koppelt brandvoortgang aan zendmasten voor tijdige omschakeling naar alternatieve kanalen.'
    },
    href: '/senda/incendio.html'
  },
  {
    id: 'cap-referencias',
    cat: 'hazard-rescue',
    title: { es: '14 Incendios de Referencia NOAA', en: '14 Reference Wildfires (NOAA)', nl: '14 Referentiebranden (NOAA)' },
    desc: {
      es: '7 incendios reconstruidos con satélite NOAA: velocidad del frente medida, validación fuera de muestra e incertidumbre real.',
      en: '14 documented wildfires (7 reconstructed via NOAA satellite) with out-of-sample spread validation & calibrated uncertainty.',
      nl: '14 gedocumenteerde branden (7 via NOAA-satelliet) met out-of-sample validatie.'
    },
    href: '/senda/referencias.html'
  },
  {
    id: 'cap-aislamiento',
    cat: 'hazard-rescue',
    title: { es: 'Aislamiento por Riada (DANA EMSR773)', en: 'Flood Street Isolation (DANA EMSR773)', nl: 'Overstromingsisolatie (DANA EMSR773)' },
    desc: {
      es: 'Dijkstra multi-origen sobre OpenStreetMap + agua Copernicus EMS: 489,5 km anegados y 1.326 cruces secos aislados.',
      en: 'Multi-origin Dijkstra on OpenStreetMap + Copernicus EMS flood masks: 489.5 km flooded & 1,326 isolated dry junctions.',
      nl: 'Multi-origin Dijkstra op OSM + Copernicus EMS: 489,5 km overstroomd en 1.326 afgesloten kruispunten.'
    },
    href: '/senda/aislamiento.html'
  },
  {
    id: 'cap-agua-nl',
    cat: 'hazard-rescue',
    title: { es: 'Agua Países Bajos (25 Estaciones RWS)', en: 'Netherlands Water (25 RWS Stations)', nl: 'Water Nederland (25 RWS-stations)' },
    desc: {
      es: '28 días reales de Rijkswaterstaat, detección de marea M2 y tiempo de llegada de la onda fluvial (Lobith -> Nimega 5 h).',
      en: '28 days of Rijkswaterstaat data, M2 tidal harmonic detection, and river flood-wave travel time (Lobith -> Nijmegen 5 h).',
      nl: '28 dagen Rijkswaterstaat-data, M2-getijdetectie en watergolf-reistijd (Lobith -> Nijmegen 5 u).'
    },
    href: '/senda/agua-nl.html'
  },
  {
    id: 'cap-agua-tsunami',
    cat: 'hazard-rescue',
    title: { es: 'Riadas Aguas Arriba y Maremotos', en: 'Upstream Flash Floods & Tsunamis', nl: 'Stroomopwaartse Vloed & Tsunami’s' },
    desc: {
      es: 'Aviso temprano por subida aguas arriba donde aún no llueve (patrón DANA) y evacuación vertical ante maremoto.',
      en: 'Early warning from upstream gauge surges before rain hits downstream plus vertical tsunami evacuation timing.',
      nl: 'Vroege waarschuwing bij stroomopwaartse stijging plus verticale tsunami-evacuatie.'
    },
    href: '/senda/agua.html'
  },
  {
    id: 'cap-nepal-vuelo',
    cat: 'hazard-rescue',
    title: { es: 'Sobrevuelo 3D Satelital (Nepal / Asia)', en: 'Langtang 3D Satellite Flyover (Nepal)', nl: 'Langtang 3D Satellietvlucht (Nepal)' },
    desc: {
      es: 'Terremoto/deslizamiento USGS M 5,2 + cambio NDVI Sentinel-2 + relieve Copernicus DEM GLO-30 en 3D interactivo.',
      en: 'USGS M 5.2 landslide + pre/post Sentinel-2 NDVI change + Copernicus DEM GLO-30 3D interactive flyover.',
      nl: 'USGS M 5,2 aardverschuiving + Sentinel-2 NDVI + Copernicus DEM GLO-30 3D-vlucht.'
    },
    href: '/senda/vuelo.html'
  },
  {
    id: 'cap-edificios',
    cat: 'hazard-rescue',
    title: { es: 'Gemelo 3D de Edificios (EMS-98)', en: '3D Building Digital Twin (EMS-98)', nl: '3D Gebouw-twin (EMS-98)' },
    desc: {
      es: 'Triaje estructural planta por planta, routers por piso, puente BLE bajo escombros y probabilidad calibrada de ocupantes.',
      en: 'Floor-by-floor EMS-98 damage twin, BLE rubble surface bridge, and calibrated multi-source occupancy probability.',
      nl: 'EMS-98 verdiepingstriage, BLE-puinbrug en gekalibreerde bezettingskans per etage.'
    },
    href: '/senda/edificios.html'
  },
  {
    id: 'cap-triaje',
    cat: 'hazard-rescue',
    title: { es: 'Triaje START para Cualquiera', en: 'START Triage for Anyone', nl: 'START-triage voor Iedereen' },
    desc: {
      es: 'Guía paso a paso START mientras llega la ayuda y generación de un parte estructurado que cabe en un único SMS.',
      en: 'Step-by-step START medical triage guidance generating a compact structured report that fits in one SMS.',
      nl: 'Stapsgewijze START-triage met een compact rapport dat in één sms past.'
    },
    href: '/senda/triaje.html'
  },
  {
    id: 'cap-monte',
    cat: 'hazard-rescue',
    title: { es: 'Perdido en el Monte sin Señal', en: 'Lost in the Mountains (Zero Signal)', nl: 'Verdwaald in de Bergen (Geen Bereik)' },
    desc: {
      es: 'Posición sin cobertura mediante rumbos a aerogeneradores/antenas, estima por pasos, mapas offline y SOS satelital.',
      en: 'Zero-signal triangulation using turbine/mast bearings, step dead-reckoning, offline maps, and satellite SOS.',
      nl: 'Positiebepaling zonder bereik via peilingen, stappentelling, offline kaarten en satelliet-SOS.'
    },
    href: '/senda/monte.html'
  },

  // Drones, Extended Senses & 4D Science
  {
    id: 'cap-dron-censo',
    cat: 'drone-science',
    title: { es: 'Censo Radio por Dron (Planta a Planta)', en: 'Drone Radio Census (Floor by Floor)', nl: 'Drone Radio-telling (Per Verdieping)' },
    desc: {
      es: 'El dron escucha balizas BLE y estima personas por planta pese a direcciones MAC aleatorias, sin identificar a nadie.',
      en: 'Drone listens for BLE packets to estimate occupants per floor despite MAC randomization — zero personal IDs.',
      nl: 'Drone telt BLE-signalen per verdieping ondanks willekeurige MAC-adressen — volledig anoniem.'
    },
    href: '/senda/dron.html'
  },
  {
    id: 'cap-dron-barrido',
    cat: 'drone-science',
    title: { es: 'Dron Casa por Casa y QGroundControl', en: 'House-by-House Drone Sweep', nl: 'Huis-voor-Huis Drone-sweep' },
    desc: {
      es: 'Misión optimizada de fachada para QGroundControl con cambios de batería, Open Drone ID y prioridad por daño.',
      en: 'Optimized QGroundControl façade survey with battery swap scheduling, Open Drone ID, and damage priority board.',
      nl: 'Geoptimaliseerde QGroundControl-missie met accuwissels, Open Drone ID en schadeprioriteit.'
    },
    href: '/senda/barrido.html'
  },
  {
    id: 'cap-sentidos',
    cat: 'drone-science',
    title: { es: 'Sentidos Ampliados (Golpes y Respiración Wi-Fi)', en: 'Extended Senses (Knocks & Wi-Fi Breathing)', nl: 'Verruimde Zintuigen (Kloppen & Wi-Fi Ademhaling)' },
    desc: {
      es: 'Ver sonidos (golpes localizados entre varios móviles), oír la radio como detector de avalanchas y detectar respiración por Wi-Fi.',
      en: 'Multi-phone acoustic knock localization, avalanche-style RF audio listening, and low-cost Wi-Fi CSI breathing detection.',
      nl: 'Akoestische kloplokalisatie, lawine-stijl RF-detectie en ademhalingsdetectie via Wi-Fi CSI.'
    },
    href: '/senda/sentidos.html'
  },
  {
    id: 'cap-visor4d',
    cat: 'drone-science',
    title: { es: 'Visor Científico Temporal 4D', en: '4D Scientific Temporal Viewer', nl: '4D Wetenschappelijke Viewer' },
    desc: {
      es: 'Perímetros reales observados, planificación ARR vs CGR, cortes SRLG, vista 2D/3D y fusión causal DAG.',
      en: 'Observed perimeter replay, ARR vs CGR routing comparison, SRLG cut analysis, 2D/3D terrain, and causal DAG fusion.',
      nl: 'Geobserveerde omtrekken, ARR vs CGR-planning, SRLG-analyse en 2D/3D-terreinweergave.'
    },
    href: '/senda/visor.html'
  }
];
