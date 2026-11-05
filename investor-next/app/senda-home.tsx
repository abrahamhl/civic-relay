/** Portada SENDA en el índice (/, /es, /nl): app, todas las funciones, la película y la verificación. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import './senda-home.css';

type Locale = 'en' | 'es' | 'nl';
type Proof = { core?: number; e2e?: number; relay?: number; sha?: string; generatedAt?: string };
function readProof(): Proof {
  const p = resolve(process.cwd(), 'public/senda/estado.json');
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}; } catch { return {}; }
}

const C = {
  es: {
    tag: 'SENDA · Sistema de Enrutamiento de Emergencia por canales alternativos',
    h1: 'Cuando cae la red, el mensaje sigue su camino.',
    lead: 'SENDA es la capa que coordina todo lo que puede mover un mensaje de emergencia: teléfonos cercanos, sonido, satélite directo al móvil, LoRa, Iridium, radioaficionados, drones y la red que quede en pie. Cifrado de extremo a extremo, abre en modo avión y no necesita servidores.',
    open: 'Abrir SENDA Campo', easy: 'Modo fácil (3 botones)', red: 'Red y satélites', proof: 'Verificación técnica',
    filmT: 'La película: qué es SENDA y qué ya funciona', filmNote: 'Doblada en español e inglés; subtítulos en español, inglés y neerlandés. Las simulaciones y los renders 3D los calcula el mismo código que lleva la app.',
    gapT: 'El hueco que nadie cubre',
    gap: [['90 % → 40 %', 'usuarios con conexión estable en el apagón ibérico del 28-04-2025: la red cayó al agotarse las baterías de las antenas.', 'https://www.laecuaciondigital.com/actualidad/el-apagon-electrico-colapsa-redes-moviles-en-espana-y-portugal-el-28-de-abril/'], ['20:11', 'hora del ES-Alert en la DANA de Valencia (29-10-2024). La alerta oficial depende de la red celular.', 'https://www.eldebate.com/espana/comunidad-valenciana/20251204/principal-tecnico-emergencia-dana-sostiene-alert-retraso-diferenciar-valenciano-catalan_362211.html'], ['2030–2036', 'despliegue previsto del sistema europeo de comunicación crítica (EUCCS) para los intervinientes, no para la ciudadanía.', 'https://home-affairs.ec.europa.eu/news/enhancing-europes-capacity-react-preparing-european-critical-communication-system-2026-01-30_en']],
    featT: 'Todo lo que hace, ya en la app',
    feats: [
      ['📡', 'Sin Internet', 'Sonido entre móviles, archivo .senda, de mano en mano (DTN) y recibos infalsificables que borran las copias.', '/senda'],
      ['🧩', 'Un mensaje, muchos caminos', 'Fragmentos k-de-n (Reed-Solomon) repartidos entre portadores con probabilidad de entrega exacta.', '/senda/red'],
      ['🛰️', 'Red satelital por nivel de acceso', 'Satélite directo al móvil, Iridium, QO-100, Galileo SAR… con el hardware y la ley de cada uno.', '/senda/red'],
      ['🔋', 'Previsión de apagón', 'Cuándo y dónde se quedará la población sin cobertura y dónde colocar pasarelas antes.', '/senda/red'],
      ['🚆', 'Accidente ferroviario', 'Detección de impacto, aviso automático y separación de dos trenes en segundos (simulación).', '/senda/incidente'],
      ['🏢', 'Gemelo digital de edificios', 'Daños EMS-98, routers por planta, alertas dirigidas y cámara con mapa de calor.', '/senda/edificios'],
      ['🔏', 'Coordinación con firma', 'Organismo → credencial → alerta firmada → respuesta cifrada → cuadro por planta. Solo con tu consentimiento.', '/senda/organismo'],
      ['🛸', 'Drones', 'Misión de fachada para QGroundControl, identificación remota (Open Drone ID) y dron como mula de datos.', '/senda/red'],
      ['🏛️', 'Sala 112', 'Exportación CAP 1.2 y registro de auditoría encadenado que delata cualquier alteración.', '/senda/incidente'],
      ['♿', 'Accesible', 'Modo fácil de tres botones y revisión automática de accesibilidad en cada cambio.', '/senda'],
      ['📱', 'Android y ESP32', 'Baliza Bluetooth, escucha de balizas y barrido Wi-Fi; accesorio para mástil o dron.', 'https://github.com/abrahamhl/civic-relay/tree/master/apps/senda-android'],
      ['🖥️', 'Relé soberano', 'Relé autoalojable en Docker, ciego al contenido, que opera el propio organismo.', 'https://github.com/abrahamhl/civic-relay/tree/master/packages/senda-relay'],
      ['🌍', 'Ojo de SENDA', 'Globo en tiempo real: Iridium, Galileo y QO-100, los casos reales de España y la ruta de cada aviso hasta el 112, con elevación, distancia y latencia.', '/senda/ojo'],
      ['🔥', 'Incendio: avisar antes de que caiga la antena', 'Avance del fuego con viento y pendiente, cruzado con las antenas: hasta cuándo se puede avisar por la red móvil y por qué canal después.', '/senda/incendio'],
      ['🛤️', 'Vigilancia ferroviaria', 'Escalones en circuitos de vía (patrón Adamuz), geometría de vía con móviles, curvas sin supervisión y muros con lluvia.', '/senda/via'],
      ['👁️', 'Ver lo que no se ve', 'Probabilidad calibrada de personas por vivienda fusionando respuestas, teléfonos, wifi y golpes; «≥98 %» solo con dos fuentes.', '/senda/edificios'],
      ['📞', 'Llamadas sin Internet', 'Voz y chat cifrados entre dos teléfonos sin operador ni servidor: el arranque de la llamada (80–110 bytes) viaja por sonido en menos de 10 segundos. Si no os alcanzáis, otro teléfono repite la voz (cadena de voz).', '/senda/llamada'],
      ['📡', 'Censo radio con dron', 'Personas por planta sin entrar: el dron escucha el Bluetooth de los teléfonos y SENDA cuenta dispositivos pese a las direcciones aleatorias, con margen honesto y sin identificar a nadie.', '/senda/dron'],
      ['🧭', 'Arquitectura del sistema', 'Sensores y radios → portadores → núcleo en el teléfono → apps → destinos. Seis escenarios animados y el estado real de cada pieza.', '/senda/arquitectura'],
      ['👂', 'Sentidos ampliados', 'Ver los sonidos (golpes localizados con varios móviles), oír la radio como un detector de avalanchas y ver la respiración por Wi-Fi con placas de pocos euros.', '/senda/sentidos'],
      ['🌧️', 'Riadas y maremotos', 'Aviso por la subida aguas arriba con horas de margen donde no llueve (patrón DANA) y tiempo de llegada de un maremoto con evacuación vertical.', '/senda/agua'],
      ['🩹', 'Triaje para cualquiera', 'START paso a paso, qué hacer mientras llega la ayuda, a qué servicio avisar y un parte que cabe en un SMS.', '/senda/triaje'],
      ['🧭', 'Perdido en el monte', 'Posición sin señal con rumbos a aerogeneradores y antenas, estima por pasos, mapas guardados y SOS por satélite.', '/senda/monte'],
      ['🚁', 'Dron casa por casa', 'Ruta optimizada con cambios de batería y tablero de prioridad: personas probables por daño del edificio.', '/senda/barrido'],
    ],
    ojoT: 'Ojo de SENDA: qué satélite ve cada emergencia y cómo llega el aviso',
    ojoLead: 'Cada punto del globo es un satélite real de su constelación, calculado en tu navegador con el mismo código que usa el enrutador. Los puntos de colores sobre España son casos reales (o, en el incendio, un escenario de demostración). Al elegir uno, SENDA busca el satélite visible con mayor elevación, calcula la distancia y la latencia y traza la ruta del aviso hasta la sala del 112.',
    ojoPts: [['Iridium · órbita baja (cian)', '66 satélites a ~780 km que cubren todo el planeta. SENDA envía por ellos mensajes cifrados de hasta 340 B con un módem RockBLOCK.'], ['Galileo · órbita media (ámbar)', '24 satélites a 23 222 km: posición precisa y búsqueda y salvamento con enlace de retorno para radiobalizas.'], ['QO-100 · geoestacionario (violeta)', 'Fijo a 25,9° E y siempre visible desde España; radioaficionados con licencia, solo estados públicos firmados.'], ['Casos y módulos', 'Cada caso enlaza a su fuente y a los módulos de SENDA que habrían actuado: alertas firmadas, red multiportador, previsión de apagón, vías, edificios o incendio.']],
    ojoOpen: 'Abrir el Ojo de SENDA a pantalla completa',
    whoT: 'Para quién',
    who: [['Ciudadanía y víctimas', 'Un canal que sigue funcionando sin red. Nadie figura como víctima sin confirmación.'], ['Coordinadores', 'Imagen operativa por planta y por tren, y alertas dirigidas firmadas.'], ['Cuerpos y fuerzas de seguridad', 'Credenciales institucionales verificables y canales internos separados por organismo.'], ['Servicios de emergencia', 'Informes estructurados en CAP hacia el 112, con auditoría.'], ['Administraciones', 'Continuidad hasta EUCCS, soberanía del relé y código abierto auditable.'], ['Inversores', 'Núcleo difícil de replicar y retorno por licencias institucionales, integración y kits.']],
    vT: 'Verificado por máquina', vCore: 'pruebas del núcleo', vE2e: 'comprobaciones extremo a extremo con la red cortada', vRelay: 'pruebas del relé',
    next: 'Siguiente fase: pilotos de campo con teléfonos físicos y equipos de rescate, auditoría de seguridad independiente y certificación para compra pública.',
    research: 'Análisis de compras públicas y del hueco (con fuentes)',
  },
  en: {
    tag: 'SENDA · Emergency routing over alternative channels',
    h1: 'When the network falls, the message finds its way.',
    lead: 'SENDA is the layer that coordinates everything that can carry an emergency message: nearby phones, sound, direct-to-phone satellite, LoRa, Iridium, amateur radio, drones and whatever network is still standing. End-to-end encrypted, it opens in airplane mode and needs no servers.',
    open: 'Open SENDA Field', easy: 'Easy mode (3 buttons)', red: 'Network & satellites', proof: 'Technical verification',
    filmT: 'The film: what SENDA is and what already works', filmNote: 'Voiced in Spanish and English; subtitles in Spanish, English and Dutch. The simulations and 3D renders are computed by the same code the app runs.',
    gapT: 'The gap nobody covers',
    gap: [['90% → 40%', 'users with a stable connection during the Iberian blackout of 28-04-2025: the network fell when the masts’ batteries ran out.', 'https://www.laecuaciondigital.com/actualidad/el-apagon-electrico-colapsa-redes-moviles-en-espana-y-portugal-el-28-de-abril/'], ['20:11', 'time of the ES-Alert during the Valencia floods (29-10-2024). Official alerts depend on the cellular network.', 'https://www.eldebate.com/espana/comunidad-valenciana/20251204/principal-tecnico-emergencia-dana-sostiene-alert-retraso-diferenciar-valenciano-catalan_362211.html'], ['2030–2036', 'planned rollout of the EU Critical Communication System (EUCCS), for first responders, not citizens.', 'https://home-affairs.ec.europa.eu/news/enhancing-europes-capacity-react-preparing-european-critical-communication-system-2026-01-30_en']],
    featT: 'Everything it does, already in the app',
    feats: [
      ['📡', 'No Internet needed', 'Sound between phones, .senda files, hand-to-hand delivery (DTN) and unforgeable receipts that erase copies.', '/senda'],
      ['🧩', 'One message, many paths', 'k-of-n fragments (Reed-Solomon) spread across bearers with an exact delivery probability.', '/senda/red'],
      ['🛰️', 'Satellite network by access level', 'Direct-to-phone, Iridium, QO-100, Galileo SAR… with the hardware and legal limits of each.', '/senda/red'],
      ['🔋', 'Blackout forecast', 'When and where people will lose coverage, and where to place gateways beforehand.', '/senda/red'],
      ['🚆', 'Rail accident', 'Impact detection, automatic alert and two trains told apart in seconds (simulation).', '/senda/incidente'],
      ['🏢', 'Building digital twin', 'EMS-98 damage, routers per floor, targeted alerts and a camera heat map.', '/senda/edificios'],
      ['🔏', 'Signed coordination', 'Agency → credential → signed alert → encrypted reply → floor-by-floor board. Only with your consent.', '/senda/organismo'],
      ['🛸', 'Drones', 'Façade missions for QGroundControl, Remote ID (Open Drone ID) and drones as data mules.', '/senda/red'],
      ['🏛️', '112 control room', 'CAP 1.2 export and a hash-chained audit log that exposes any tampering.', '/senda/incidente'],
      ['♿', 'Accessible', 'Three-button easy mode and an automatic accessibility check on every change.', '/senda'],
      ['📱', 'Android & ESP32', 'Bluetooth beacon, beacon listening and Wi-Fi sweeps; an accessory for masts or drones.', 'https://github.com/abrahamhl/civic-relay/tree/master/apps/senda-android'],
      ['🖥️', 'Sovereign relay', 'Self-hosted Docker relay, content-blind, run by the agency itself.', 'https://github.com/abrahamhl/civic-relay/tree/master/packages/senda-relay'],
      ['🌍', 'SENDA Eye', 'Real-time globe: Iridium, Galileo and QO-100, Spain’s real cases and each alert’s route to 112, with elevation, distance and latency.', '/senda/ojo'],
      ['🔥', 'Wildfire: warn before the mast burns', 'Fire spread with wind and slope, crossed with phone masts: until when the mobile network can warn, and which channel to use after.', '/senda/incendio'],
      ['🛤️', 'Rail watch', 'Track-circuit steps (Adamuz pattern), track geometry from phones, unsupervised curves and walls under heavy rain.', '/senda/via'],
      ['👁️', 'Seeing the unseen', 'Calibrated probability of people per flat fusing replies, phones, Wi-Fi and knocks; “≥98 %” only with two sources.', '/senda/edificios'],
      ['📞', 'Calls without Internet', 'Encrypted voice and chat between two phones with no carrier or server: the call setup (80–110 bytes) travels by sound in under 10 seconds. If you can’t reach each other, another phone relays the voice (voice chain).', '/senda/llamada'],
      ['📡', 'Drone radio census', 'People per floor without going inside: the drone listens to phones’ Bluetooth and SENDA counts devices despite random addresses, with an honest margin and no identities.', '/senda/dron'],
      ['🧭', 'System architecture', 'Sensors and radios → bearers → on-phone core → apps → recipients. Six animated scenarios and the real status of every piece.', '/senda/arquitectura'],
      ['👂', 'Extended senses', 'See sounds (knocks located with several phones), hear radio like an avalanche transceiver and see breathing through Wi-Fi with boards costing a few euros.', '/senda/sentidos'],
      ['🌧️', 'Flash floods and tsunamis', 'Warning from the upstream rise, hours ahead where it is not raining (DANA pattern), and tsunami arrival times with vertical evacuation.', '/senda/agua'],
      ['🩹', 'Triage for anyone', 'Step-by-step START, what to do until help arrives, which service to alert and a report that fits in one SMS.', '/senda/triaje'],
      ['🧭', 'Lost in the mountains', 'Position without signal from bearings to wind turbines and masts, step counting, offline maps and satellite SOS.', '/senda/monte'],
      ['🚁', 'House-by-house drone', 'Optimised route with battery swaps and a priority board: likely people times building damage.', '/senda/barrido'],
    ],
    ojoT: 'SENDA Eye: which satellite sees each emergency, and how the alert gets through',
    ojoLead: 'Every dot on the globe is a satellite of its constellation, computed in your browser with the same code the router uses. The coloured markers over Spain are real cases (the wildfire is a demonstration scenario). Pick one and SENDA finds the visible satellite with the highest elevation, computes distance and latency, and traces the alert’s route to the 112 control room.',
    ojoPts: [['Iridium · low orbit (cyan)', '66 satellites at ~780 km covering the whole planet. SENDA sends encrypted messages of up to 340 B through them with a RockBLOCK modem.'], ['Galileo · medium orbit (amber)', '24 satellites at 23,222 km: precise position and search and rescue with a return link for distress beacons.'], ['QO-100 · geostationary (violet)', 'Fixed at 25.9° E and always visible from Spain; licensed radio amateurs, signed public status only.'], ['Cases and modules', 'Each case links to its source and to the SENDA modules that would have acted: signed alerts, multi-bearer network, blackout forecast, rail, buildings or wildfire.']],
    ojoOpen: 'Open the SENDA Eye full screen',
    whoT: 'Who it is for',
    who: [['Citizens & victims', 'A channel that keeps working with no network. Nobody is listed as a victim without confirmation.'], ['Coordinators', 'A floor-by-floor and train-by-train operational picture, plus signed targeted alerts.'], ['Police & security forces', 'Verifiable institutional credentials and internal channels separated by agency.'], ['Emergency services', 'Structured CAP reports to the 112 room, with an audit trail.'], ['Public administrations', 'Continuity until EUCCS, a sovereign relay and auditable open source.'], ['Investors', 'A core that is hard to replicate, with revenue from institutional licences, integration and kits.']],
    vT: 'Machine-verified', vCore: 'core tests', vE2e: 'end-to-end checks with the network cut', vRelay: 'relay tests',
    next: 'Next phase: field pilots with physical phones and rescue teams, an independent security audit and public-procurement certification.',
    research: 'Public-procurement and gap analysis (with sources)',
  },
  nl: {
    tag: 'SENDA · Noodroutering via alternatieve kanalen',
    h1: 'Als het netwerk uitvalt, vindt het bericht zijn weg.',
    lead: 'SENDA is de laag die alles coördineert wat een noodbericht kan vervoeren: telefoons in de buurt, geluid, satelliet rechtstreeks naar de telefoon, LoRa, Iridium, zendamateurs, drones en wat er nog van het netwerk overeind staat. End-to-end versleuteld, opent in vliegtuigmodus en heeft geen servers nodig.',
    open: 'SENDA Field openen', easy: 'Eenvoudige modus (3 knoppen)', red: 'Netwerk & satellieten', proof: 'Technische verificatie',
    filmT: 'De film: wat SENDA is en wat al werkt', filmNote: 'Ingesproken in het Spaans en Engels; ondertiteling in het Spaans, Engels en Nederlands. De simulaties en 3D-renders worden berekend door dezelfde code als de app.',
    gapT: 'Het gat dat niemand dicht',
    gap: [['90% → 40%', 'gebruikers met een stabiele verbinding tijdens de Iberische stroomstoring van 28-04-2025: het netwerk viel uit toen de accu’s van de masten leeg raakten.', 'https://www.laecuaciondigital.com/actualidad/el-apagon-electrico-colapsa-redes-moviles-en-espana-y-portugal-el-28-de-abril/'], ['20:11', 'tijdstip van de ES-Alert bij de overstromingen in Valencia (29-10-2024). Officiële waarschuwingen hangen af van het mobiele netwerk.', 'https://www.eldebate.com/espana/comunidad-valenciana/20251204/principal-tecnico-emergencia-dana-sostiene-alert-retraso-diferenciar-valenciano-catalan_362211.html'], ['2030–2036', 'geplande uitrol van het Europese systeem voor kritieke communicatie (EUCCS), voor hulpverleners, niet voor burgers.', 'https://home-affairs.ec.europa.eu/news/enhancing-europes-capacity-react-preparing-european-critical-communication-system-2026-01-30_en']],
    featT: 'Alles wat het doet, al in de app',
    feats: [
      ['📡', 'Zonder internet', 'Geluid tussen telefoons, .senda-bestanden, van hand tot hand (DTN) en onvervalsbare ontvangstbewijzen die kopieën wissen.', '/senda'],
      ['🧩', 'Eén bericht, vele routes', 'k-van-n-fragmenten (Reed-Solomon) verdeeld over dragers met een exacte afleverkans.', '/senda/red'],
      ['🛰️', 'Satellietnetwerk per toegangsniveau', 'Direct-naar-telefoon, Iridium, QO-100, Galileo SAR… met de hardware en wettelijke grenzen van elk.', '/senda/red'],
      ['🔋', 'Voorspelling van black-outs', 'Wanneer en waar mensen hun dekking verliezen en waar vooraf gateways moeten komen.', '/senda/red'],
      ['🚆', 'Treinongeval', 'Detectie van de klap, automatisch alarm en twee treinen in seconden onderscheiden (simulatie).', '/senda/incidente'],
      ['🏢', 'Digitale tweeling van gebouwen', 'EMS-98-schade, routers per verdieping, gerichte waarschuwingen en een warmtebeeld via de camera.', '/senda/edificios'],
      ['🔏', 'Ondertekende coördinatie', 'Organisatie → bewijs → ondertekende waarschuwing → versleuteld antwoord → overzicht per verdieping. Alleen met jouw toestemming.', '/senda/organismo'],
      ['🛸', 'Drones', 'Gevelmissies voor QGroundControl, Remote ID (Open Drone ID) en drones als datakoerier.', '/senda/red'],
      ['🏛️', 'Meldkamer 112', 'CAP 1.2-export en een geketend auditlog dat elke manipulatie verraadt.', '/senda/incidente'],
      ['♿', 'Toegankelijk', 'Eenvoudige modus met drie knoppen en een automatische toegankelijkheidscontrole bij elke wijziging.', '/senda'],
      ['📱', 'Android & ESP32', 'Bluetooth-baken, bakens beluisteren en wifi-scans; een accessoire voor masten of drones.', 'https://github.com/abrahamhl/civic-relay/tree/master/apps/senda-android'],
      ['🖥️', 'Soevereine relay', 'Zelf gehoste Docker-relay, blind voor de inhoud, beheerd door de organisatie zelf.', 'https://github.com/abrahamhl/civic-relay/tree/master/packages/senda-relay'],
      ['🌍', 'SENDA-oog', 'Realtime wereldbol: Iridium, Galileo en QO-100, de echte Spaanse gevallen en de route van elk alarm naar 112, met elevatie, afstand en vertraging.', '/senda/ojo'],
      ['🔥', 'Natuurbrand: waarschuwen voordat de mast brandt', 'Vuurverspreiding met wind en helling, gekruist met gsm-masten: tot wanneer het mobiele netwerk kan waarschuwen en via welk kanaal daarna.', '/senda/incendio'],
      ['🛤️', 'Spoorbewaking', 'Sprongen in spoorstroomcircuits (Adamuz-patroon), spoorgeometrie via telefoons, bochten zonder bewaking en muren bij zware regen.', '/senda/via'],
      ['👁️', 'Zien wat je niet ziet', 'Gekalibreerde kans op mensen per woning uit antwoorden, telefoons, wifi en kloppen; “≥98 %” alleen met twee bronnen.', '/senda/edificios'],
      ['📞', 'Bellen zonder internet', 'Versleutelde spraak en chat tussen twee telefoons zonder provider of server: de gespreksopbouw (80–110 bytes) gaat in minder dan 10 seconden via geluid. Bereiken jullie elkaar niet, dan geeft een andere telefoon de stem door (spraakketen).', '/senda/llamada'],
      ['📡', 'Radiotelling met drone', 'Mensen per verdieping zonder naar binnen te gaan: de drone luistert naar Bluetooth van telefoons en SENDA telt apparaten ondanks willekeurige adressen, met eerlijke marge en zonder identiteiten.', '/senda/dron'],
      ['🧭', 'Systeemarchitectuur', 'Sensoren en radio’s → dragers → kern op de telefoon → apps → ontvangers. Zes geanimeerde scenario’s en de echte status van elk onderdeel.', '/senda/arquitectura'],
      ['👂', 'Uitgebreide zintuigen', 'Geluid zien (klopgeluiden gelokaliseerd met meerdere telefoons), radio horen als een lawinepieper en ademhaling zien via wifi met bordjes van een paar euro.', '/senda/sentidos'],
      ['🌧️', 'Overstromingen en tsunami’s', 'Waarschuwing op basis van de stijging stroomopwaarts, uren vooraf waar het niet regent (DANA-patroon), en aankomsttijden van een tsunami met verticale evacuatie.', '/senda/agua'],
      ['🩹', 'Triage voor iedereen', 'START stap voor stap, wat te doen tot er hulp komt, welke dienst te waarschuwen en een melding die in één sms past.', '/senda/triaje'],
      ['🧭', 'Verdwaald in de bergen', 'Positie zonder signaal via peilingen naar windturbines en masten, stappen tellen, offline kaarten en satelliet-SOS.', '/senda/monte'],
      ['🚁', 'Drone huis voor huis', 'Geoptimaliseerde route met batterijwissels en een prioriteitenbord: waarschijnlijke mensen maal schade aan het gebouw.', '/senda/barrido'],
    ],
    ojoT: 'SENDA-oog: welke satelliet elke noodsituatie ziet en hoe het alarm aankomt',
    ojoLead: 'Elke stip op de wereldbol is een satelliet van zijn constellatie, berekend in je browser met dezelfde code als de router. De gekleurde markeringen boven Spanje zijn echte gevallen (de natuurbrand is een demonstratiescenario). Kies er een en SENDA zoekt de zichtbare satelliet met de hoogste elevatie, berekent afstand en vertraging en tekent de route van het alarm naar de 112-meldkamer.',
    ojoPts: [['Iridium · lage baan (cyaan)', '66 satellieten op ~780 km die de hele planeet dekken. SENDA stuurt er versleutelde berichten tot 340 B via met een RockBLOCK-modem.'], ['Galileo · middelhoge baan (amber)', '24 satellieten op 23.222 km: nauwkeurige positie en opsporing en redding met terugmeldkanaal voor noodbakens.'], ['QO-100 · geostationair (violet)', 'Vast op 25,9° O en altijd zichtbaar vanuit Spanje; zendamateurs met licentie, alleen ondertekende openbare statussen.'], ['Gevallen en modules', 'Elk geval linkt naar zijn bron en naar de SENDA-modules die zouden hebben ingegrepen: ondertekende alarmen, multidragernetwerk, black-outvoorspelling, spoor, gebouwen of natuurbrand.']],
    ojoOpen: 'SENDA-oog volledig scherm openen',
    whoT: 'Voor wie',
    who: [['Burgers & slachtoffers', 'Een kanaal dat zonder netwerk blijft werken. Niemand staat als slachtoffer zonder bevestiging.'], ['Coördinatoren', 'Een operationeel beeld per verdieping en per trein, en ondertekende gerichte waarschuwingen.'], ['Politie & veiligheidsdiensten', 'Verifieerbare institutionele bewijzen en interne kanalen per organisatie.'], ['Hulpdiensten', 'Gestructureerde CAP-meldingen naar de meldkamer, met audittrail.'], ['Overheden', 'Continuïteit tot EUCCS, een soevereine relay en controleerbare open source.'], ['Investeerders', 'Een moeilijk te kopiëren kern, met inkomsten uit institutionele licenties, integratie en kits.']],
    vT: 'Machinaal geverifieerd', vCore: 'kerntests', vE2e: 'end-to-end-controles met het netwerk uitgeschakeld', vRelay: 'relay-tests',
    next: 'Volgende fase: veldproeven met echte telefoons en reddingsteams, een onafhankelijke beveiligingsaudit en certificering voor overheidsaanbestedingen.',
    research: 'Analyse van overheidsaanbestedingen en het gat (met bronnen)',
  },
} as const;

export default function SendaHome({ locale }: { locale: Locale }) {
  const c = C[locale] ?? C.en;
  const p = readProof();
  const film = locale === 'es' ? 'es' : 'en';
  return (
    <section className="senda-home" aria-labelledby="senda-h1" lang={locale}>
      <div className="sh-hero">
        <p className="sh-tag">{c.tag}</p>
        <h1 id="senda-h1">{c.h1}</h1>
        <p className="sh-lead">{c.lead}</p>
        <div className="sh-cta">
          <a className="sh-btn" href="/senda">{c.open}</a>
          <a className="sh-btn ghost" href="/senda">{c.easy}</a>
          <a className="sh-btn ghost" href="/senda/red">{c.red}</a>
          <a className="sh-link" href="/senda/estado">{c.proof} →</a>
        </div>
      </div>

      <div className="sh-film">
        <h2>{c.filmT}</h2>
        <video controls preload="metadata" playsInline poster={`/media/senda-film-poster-${film}.jpg`} aria-label={c.filmT}>
          <source src={`/media/senda-film-${film}.mp4`} type="video/mp4"/>
          <track kind="subtitles" srcLang="es" label="Español" src="/media/senda-film-es.vtt" default={locale === 'es'}/>
          <track kind="subtitles" srcLang="en" label="English" src="/media/senda-film-en.vtt" default={locale === 'en'}/>
          <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/senda-film-nl.vtt" default={locale === 'nl'}/>
        </video>
        <p className="sh-note">{c.filmNote}</p>
      </div>

      <div className="sh-ojo" id="ojo">
        <h2 className="sh-h2">{c.ojoT}</h2>
        <p className="sh-lead">{c.ojoLead}</p>
        <div className="sh-ojo-pts">{c.ojoPts.map(([t, d]) => <div key={t}><b>{t}</b><p>{d}</p></div>)}</div>
        <iframe src={`/senda/ojo?embed=1${locale === 'es' ? '' : '&lang=en'}`} title={c.ojoT} loading="lazy"/>
        <p className="sh-note"><a href={`/senda/ojo${locale === 'es' ? '' : '?lang=en'}`}>{c.ojoOpen} →</a></p>
      </div>

      <h2 className="sh-h2">{c.gapT}</h2>
      <div className="sh-gap">{c.gap.map(([v, t, u]) => <a key={v} className="sh-fact" href={u} rel="noopener" target="_blank"><b>{v}</b><span>{t}</span></a>)}</div>

      <h2 className="sh-h2">{c.featT}</h2>
      <div className="sh-feats">{c.feats.map(([i, t, d, h]) => <a key={t} className="sh-feat" href={h}><span aria-hidden="true">{i}</span><b>{t}</b><p>{d}</p></a>)}</div>

      <h2 className="sh-h2">{c.whoT}</h2>
      <div className="sh-who">{c.who.map(([t, d]) => <div key={t} className="sh-w"><b>{t}</b><p>{d}</p></div>)}</div>

      <h2 className="sh-h2">{c.vT}</h2>
      <div className="sh-proof">
        <div><b>{p.core ?? '–'}/{p.core ?? '–'}</b><span>{c.vCore}</span></div>
        <div><b>{p.e2e ?? '–'}/{p.e2e ?? '–'}</b><span>{c.vE2e}</span></div>
        <div><b>{p.relay ?? '–'}/{p.relay ?? '–'}</b><span>{c.vRelay}</span></div>
      </div>
      <p className="sh-note">{c.next} <a href="https://github.com/abrahamhl/civic-relay/blob/master/docs/research/PROCUREMENT_GAP_2026.md">{c.research}</a>{p.sha ? <> · commit <code>{p.sha}</code></> : null}</p>
    </section>
  );
}
