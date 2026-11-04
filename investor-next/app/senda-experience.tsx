'use client';
import {useEffect,useRef,useState} from 'react';
import type {Locale} from './copy';
import './senda-experience.css';

type Level='citizen'|'coord'|'eng'|'inv';
type Chapter={id:string;demo:string;kicker:string;title:string;lead:string;lens:Record<Level,string>;proof:string;href?:string};
type Copy={
 nav:string[];levelsLabel:string;levels:Record<Level,string>;h1:[string,string,string];sub:string;ctaFilm:string;ctaApp:string;
 kpis:{v:string;l:string}[];filmTitle:string;filmSub:string;reelsTitle:string;reels:{id:string;title:string}[];
 chapters:Chapter[];flowTitle:string;investTitle:string;investLead:string;cards:{t:string;b:string}[];
 truthTitle:string;truth:string;fundingLine:string;labTitle:string;labLead:string;lab:{href:string;t:string;d:string}[];open:string;footer:string;
};

const FLOW='EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE';
const FUNDING='HORIZON-CL3-2026-01-SSRI-04';

const COPY:Record<Locale,Copy>={
 es:{
  nav:['Red','Cifrado','Personas','Incendio','Vía','Satélite','Inversión'],levelsLabel:'Ver como',
  levels:{citizen:'Ciudadanía',coord:'Coordinación',eng:'Ingeniería',inv:'Inversión'},
  h1:['CUANDO LA','RED','SE APAGA.'],
  sub:'SENDA mueve mensajes de emergencia por cualquier canal que quede —vecinos, LoRa, satélite, drones— y calcula con cifras verificables dónde hay personas, cuándo llega el fuego y qué vía hay que revisar. Cada demo de esta página ejecuta el código probado.',
  ctaFilm:'Ver la película',ctaApp:'Abrir la app de campo',
  kpis:[{v:'108',l:'pruebas del núcleo y el relé en verde'},{v:'25/25',l:'pruebas en navegador real sin red'},{v:'1.149/1.149',l:'aciertos de la insignia «≥98 %» (simulación)'},{v:'53 min',l:'antes hay que avisar si la antena cae primero (demo de incendio)'}],
  filmTitle:'La película',filmSub:'Narrada y renderizada desde las demos reales de esta página.',reelsTitle:'Reels',
  reels:[{id:'fuego',title:'Avisar antes de que caiga la antena'},{id:'via',title:'La señal estaba en los datos'},{id:'rescate',title:'Ver lo que no se ve'}],
  chapters:[
   {id:'red',demo:'net',kicker:'01 · RED SIN COBERTURA',title:'Ningún canal solo. Todos juntos, 99 %.',lead:'Un SOS con posición y 6 s de voz no cabe en un SMS por satélite. SENDA lo trocea en fragmentos k-de-n (Reed-Solomon) y los reparte entre satélite, LoRa e Iridium con la probabilidad de entrega calculada de forma exacta.',
    lens:{citizen:'Tu mensaje sale aunque no haya cobertura: se divide y viaja por varios caminos a la vez. Basta con que llegue la mitad.',coord:'Sabes, antes de enviar, la probabilidad de entrega y el tiempo esperado. Activa o apaga canales y mira cómo cambia.',eng:'Programación dinámica sobre una Poisson-binomial agrupada: P(≥k de n) exacta; asignación voraz por ganancia de probabilidad por euro; MTU y ciclo de trabajo por portador.',inv:'El valor no está en un canal nuevo, sino en orquestar los que ya existen. Funciona con hardware comercial y escala con cada red que se añada.'},proof:'bearers.mjs · erasure.mjs · 11 pruebas',href:'/senda/red'},
   {id:'cifrado',demo:'crypto',kicker:'02 · SEGURIDAD',title:'La mula lleva el mensaje. No puede leerlo.',lead:'Cifrado extremo a extremo real en tu navegador: acuerdo de claves ECDH P-256, AES-256-GCM y firma ECDSA. Manipula un solo byte en la mula y el destinatario lo rechaza.',
    lens:{citizen:'Quien transporta tu mensaje (un vecino, un dron) no puede leerlo ni cambiarlo.',coord:'Las alertas oficiales van firmadas por el organismo: los teléfonos solo obedecen credenciales verificadas.',eng:'Clave efímera por sobre, cabecera autenticada como datos adicionales en GCM y firma sobre cabecera + cifrado. Compromiso de acuse para borrar copias sin revelar el contenido.',inv:'Seguridad por diseño auditable (código abierto): base para ENS y para compras públicas que exigen cifrado verificable.'},proof:'envelope.mjs · roles.mjs · WebCrypto',href:'/senda/organismo'},
   {id:'personas',demo:'fusion',kicker:'03 · VER LO QUE NO SE VE',title:'Rayos X sin rayos X.',lead:'Ninguna cámara ve a través de un muro. SENDA fusiona respuestas, la señal del teléfono, la respiración detectada por Wi-Fi, golpes y búsquedas, y da una probabilidad calibrada por vivienda con su intervalo.',
    lens:{citizen:'Si respondes «atrapado» o tu teléfono emite, los equipos saben en qué piso buscar primero.',coord:'Lista de «dónde buscar primero» ordenada por probabilidad × daño, con el porqué de cada cifra.',eng:'Bayes por persona + OR ruidoso marginal por celda; intervalo por rango de parámetros; «≥98 %» solo con dos familias independientes. Brier 0,107 frente a 0,124 en 200 escenarios.',inv:'Motor genérico de fusión de evidencias: el mismo núcleo sirve a rescate, infraestructuras e industria.'},proof:'occupancy.mjs · calibración en evidence/',href:'/senda/edificios'},
   {id:'incendio',demo:'fire',kicker:'04 · INCENDIO FORESTAL',title:'Avisar antes de que caiga la antena.',lead:'El frente de llama se calcula por tiempo mínimo de llegada con viento y pendiente. Lo nuevo: cruzarlo con las antenas. Si la antena de un pueblo arde antes de la hora límite de aviso, la alerta sale antes o por canales sin red.',
    lens:{citizen:'Recibes el aviso con tiempo, también si la cobertura ya ha caído.',coord:'Toca el mapa para mover el foco y cambia el viento: cada pueblo muestra cuándo llega el fuego, cuándo pierde la antena y por qué canal avisar.',eng:'Dijkstra en malla de 16 vecinos, elipse de viento con el foco trasero, factor de pendiente de forma Rothermel; FIRMS como igniciones. Coeficientes ilustrativos: se acopla a modelos validados.',inv:'Prevención, no solo respuesta: un producto para comunidades autónomas, operadores y aseguradoras sobre datos abiertos (NASA FIRMS, AEMET).'},proof:'wildfire.mjs · 7 pruebas'},
   {id:'via',demo:'rail',kicker:'05 · VÍAS DE TREN',title:'La señal estaba en los datos.',lead:'Según un informe de la Guardia Civil discutido por Adif, en Adamuz el circuito de vía registró una caída de tensión unas 22 h antes, sin alarma por quedar sobre el umbral. SENDA compara cada circuito con su propia historia y detecta el escalón. Datos sintéticos.',
    lens:{citizen:'Los móviles de los viajeros, con permiso, ayudan a detectar tramos de vía que empeoran.',coord:'Propuestas de inspección con evidencia adjunta para el gestor de la infraestructura, no órdenes.',eng:'Mediana y MAD por circuito con vía libre, persistencia y recuperación; geometría colaborativa normalizada por viaje y velocidad con ≥3 dispositivos.',inv:'Software sobre datos que ya existen: coste marginal casi nulo en hardware y un comprador con urgencia.'},proof:'rail-watch.mjs · 8 pruebas',href:'/senda/via'},
   {id:'satelite',demo:'orbit',kicker:'06 · SATÉLITE',title:'Siempre hay un satélite pasando.',lead:'Propagación orbital Kepler + J2 en tu navegador: qué satélites ve El Tiemblo ahora y cuándo será el próximo contacto. El enrutador convierte esos pasos en ventanas de envío.',
    lens:{citizen:'Desde el monte, un satélite puede llevar tu mensaje aunque no haya antenas.',coord:'Sabes cuándo habrá ventana y cuántos bytes caben (Iridium SBD: 340 B por mensaje).',eng:'Elementos orbitales, tiempo sidéreo de Greenwich, elevación sobre el horizonte y pasos con elevación mínima; TLE reales con red.',inv:'Agnóstico de operador: satélite directo al móvil, Iridium o QO-100 entran como un portador más.'},proof:'orbital.mjs · satellites.mjs'},
  ],
  flowTitle:'El algoritmo completo',
  investTitle:'¿POR QUÉ APOYARNOS?',investLead:'Lo que falta no es una idea: es campo. El capital convierte simulación verificada en pilotos medidos.',
  cards:[{t:'Piloto de incendio',b:'Una comarca forestal: FIRMS + AEMET, antenas reales y alertas sin red con protección civil.'},{t:'Piloto ferroviario',b:'12 meses de registros de circuitos de vía de una línea, por convenio, para medir aciertos y falsas alarmas.'},{t:'Certificación',b:'Auditoría de seguridad independiente, ENS y evaluación de impacto (DPIA) para poder contratar con organismos.'},{t:'Calibración y kits',b:'Bomberos o UME en edificio de entrenamiento; kits de pasarela LoRa + Iridium medidos en campo.'}],
  truthTitle:'Lo que es real y lo que es simulación',truth:'El código es real y está probado. Los escenarios marcados como SIMULACIÓN INTERACTIVA son sintéticos: calculan con ese código sobre datos inventados con forma realista. Ninguna cifra de campo se presenta sin piloto. SENDA es un canal secundario: no sustituye al 112 ni a ES-Alert.',
  fundingLine:`Convocatoria objetivo: ${FUNDING} (sin garantía de concesión).`,
  labTitle:'Laboratorio completo',labLead:'Todo lo demás, sin alargar esta página.',
  lab:[{href:'/senda',t:'App de campo',d:'PWA que funciona en modo avión'},{href:'/senda/edificios',t:'Gemelo de edificios',d:'3D, cámara y visión por capas'},{href:'/senda/via',t:'Vigilancia ferroviaria',d:'Circuitos, geometría, velocidad, muros'},{href:'/senda/red',t:'Red multiportador',d:'Satélites, apagón y CAP 1.2'},{href:'/senda/estado',t:'Verificación',d:'Pruebas y evidencias'},{href:'/es/lab/',t:'Laboratorio anterior',d:'Globo, cámaras por sector, radar RF'}],
  open:'Abrir',footer:'SENDA · Sistema de Enrutamiento de Emergencia por canales alternativos · © 2026 Abraham Haddioui · código abierto'
 },
 en:{
  nav:['Network','Encryption','People','Wildfire','Rail','Satellite','Invest'],levelsLabel:'View as',
  levels:{citizen:'Citizen',coord:'Coordinator',eng:'Engineer',inv:'Investor'},
  h1:['WHEN THE','NETWORK','GOES DARK.'],
  sub:'SENDA moves emergency messages over whatever channel is left — neighbours, LoRa, satellite, drones — and computes, with verifiable numbers, where people are, when the fire arrives and which track must be inspected. Every demo on this page runs the tested code.',
  ctaFilm:'Watch the film',ctaApp:'Open the field app',
  kpis:[{v:'108',l:'core and relay tests passing'},{v:'25/25',l:'real-browser tests offline'},{v:'1,149/1,149',l:'“≥98 %” badge hits (simulation)'},{v:'53 min',l:'earlier warning when the mast falls first (wildfire demo)'}],
  filmTitle:'The film',filmSub:'Narrated and rendered from the live demos on this page.',reelsTitle:'Reels',
  reels:[{id:'fuego',title:'Warn before the mast burns'},{id:'via',title:'The signal was in the data'},{id:'rescate',title:'Seeing the unseen'}],
  chapters:[
   {id:'red',demo:'net',kicker:'01 · NO COVERAGE',title:'No single channel. Together, 99 %.',lead:'An SOS with position and 6 s of voice does not fit in one satellite SMS. SENDA splits it into k-of-n shards (Reed-Solomon) across satellite, LoRa and Iridium, with the delivery probability computed exactly.',
    lens:{citizen:'Your message leaves even without coverage: it is split and travels several ways at once. Half is enough.',coord:'Before sending you know the delivery probability and expected time. Toggle channels and watch it change.',eng:'Dynamic programming over a grouped Poisson-binomial: exact P(≥k of n); greedy allocation by probability gain per euro; per-bearer MTU and duty cycle.',inv:'The value is not a new channel but orchestrating existing ones. Commercial hardware; it scales with every network added.'},proof:'bearers.mjs · erasure.mjs · 11 tests',href:'/senda/red'},
   {id:'cifrado',demo:'crypto',kicker:'02 · SECURITY',title:'The mule carries it. It cannot read it.',lead:'Real end-to-end encryption in your browser: ECDH P-256 key agreement, AES-256-GCM and ECDSA signatures. Tamper with a single byte at the mule and the recipient rejects it.',
    lens:{citizen:'Whoever carries your message (a neighbour, a drone) cannot read or change it.',coord:'Official alerts are signed by the agency: phones only obey verified credentials.',eng:'Ephemeral key per envelope, header authenticated as GCM associated data, signature over header + ciphertext; ACK commitment to delete copies without revealing content.',inv:'Auditable security by design (open source): a basis for public procurement that demands verifiable encryption.'},proof:'envelope.mjs · roles.mjs · WebCrypto',href:'/senda/organismo'},
   {id:'personas',demo:'fusion',kicker:'03 · SEEING THE UNSEEN',title:'X-ray vision without X-rays.',lead:'No camera sees through a wall. SENDA fuses replies, the phone’s signal, Wi-Fi breathing detection, knocks and searches into a calibrated probability per flat, with its interval.',
    lens:{citizen:'If you reply “trapped” or your phone beacons, rescuers know which floor to search first.',coord:'A “search here first” list ranked by probability × damage, with the reason behind every number.',eng:'Per-person Bayes + marginal noisy-OR per cell; interval from parameter ranges; “≥98 %” only with two independent families. Brier 0.107 vs 0.124 over 200 scenarios.',inv:'A generic evidence-fusion engine: the same core serves rescue, infrastructure and industry.'},proof:'occupancy.mjs · calibration in evidence/',href:'/senda/edificios'},
   {id:'incendio',demo:'fire',kicker:'04 · WILDFIRE',title:'Warn before the mast burns.',lead:'The fire front is computed as minimum arrival time with wind and slope. What is new: crossing it with the masts. If a town’s mast burns before its warning deadline, the alert goes earlier or over no-network channels.',
    lens:{citizen:'You get the warning in time, even if coverage is already gone.',coord:'Tap the map to move the ignition and change the wind: each town shows fire arrival, mast loss and which channel to use.',eng:'Dijkstra on a 16-neighbour grid, wind ellipse from the rear focus, Rothermel-form slope factor; FIRMS hotspots as ignitions. Illustrative coefficients: couples to validated models.',inv:'Prevention, not just response: a product for regions, operators and insurers on open data (NASA FIRMS, weather services).'},proof:'wildfire.mjs · 7 tests'},
   {id:'via',demo:'rail',kicker:'05 · RAILWAYS',title:'The signal was in the data.',lead:'According to a Guardia Civil report disputed by Adif, at Adamuz the track circuit logged a voltage drop about 22 h before, with no alarm because it stayed above the threshold. SENDA compares each circuit with its own history and catches the step. Synthetic data.',
    lens:{citizen:'With consent, passengers’ phones help detect track sections that are getting worse.',coord:'Inspection proposals with attached evidence for the infrastructure manager, never orders.',eng:'Per-circuit median and MAD on free track, persistence and recovery; crowd geometry normalised per trip and speed with ≥3 devices.',inv:'Software on data that already exists: near-zero hardware cost and a buyer with urgency.'},proof:'rail-watch.mjs · 8 tests',href:'/senda/via'},
   {id:'satelite',demo:'orbit',kicker:'06 · SATELLITE',title:'There is always a satellite passing.',lead:'Kepler + J2 orbital propagation in your browser: which satellites El Tiemblo sees now and when the next contact is. The router turns those passes into sending windows.',
    lens:{citizen:'In the hills, a satellite can carry your message with no masts around.',coord:'You know when the window opens and how many bytes fit (Iridium SBD: 340 B per message).',eng:'Orbital elements, Greenwich sidereal time, elevation above the horizon and passes above a minimum elevation; real TLEs when online.',inv:'Operator-agnostic: direct-to-phone satellite, Iridium or QO-100 are just another bearer.'},proof:'orbital.mjs · satellites.mjs'},
  ],
  flowTitle:'The whole algorithm',
  investTitle:'WHY BACK THIS RESEARCH?',investLead:'What is missing is not an idea: it is the field. Capital turns verified simulation into measured pilots.',
  cards:[{t:'Wildfire pilot',b:'One forest district: FIRMS + weather data, real masts and no-network alerts with civil protection.'},{t:'Rail pilot',b:'12 months of one line’s track-circuit logs, under agreement, to measure hits and false alarms.'},{t:'Certification',b:'Independent security audit, Spanish ENS and a DPIA so public agencies can contract it.'},{t:'Calibration and kits',b:'Firefighters in a training building; LoRa + Iridium gateway kits measured in the field.'}],
  truthTitle:'What is real and what is simulated',truth:'The code is real and tested. Scenarios marked BROWSER-SIMULATED are synthetic: they compute with that code on invented but realistically shaped data. No field figure is shown without a pilot. SENDA is a secondary channel: it does not replace 112 or EU-Alert.',
  fundingLine:`Target call: ${FUNDING} (no award guaranteed).`,
  labTitle:'Full lab',labLead:'Everything else, without making this page longer.',
  lab:[{href:'/senda',t:'Field app',d:'PWA that works in airplane mode'},{href:'/senda/edificios',t:'Building twin',d:'3D, camera and layered vision'},{href:'/senda/via',t:'Rail watch',d:'Circuits, geometry, speed, walls'},{href:'/senda/red',t:'Multi-bearer network',d:'Satellites, blackout and CAP 1.2'},{href:'/senda/estado',t:'Verification',d:'Tests and evidence'},{href:'/lab/',t:'Previous lab',d:'Globe, sector cameras, RF radar'}],
  open:'Open',footer:'SENDA · Emergency routing over alternative channels · © 2026 Abraham Haddioui · open source'
 },
 nl:{
  nav:['Netwerk','Versleuteling','Mensen','Natuurbrand','Spoor','Satelliet','Investeren'],levelsLabel:'Bekijk als',
  levels:{citizen:'Burger',coord:'Coördinator',eng:'Ingenieur',inv:'Investeerder'},
  h1:['ALS HET','NETWERK','UITVALT.'],
  sub:'SENDA verstuurt noodberichten via elk kanaal dat overblijft — buren, LoRa, satelliet, drones — en berekent met controleerbare cijfers waar mensen zijn, wanneer het vuur aankomt en welk spoor gecontroleerd moet worden. Elke demo op deze pagina draait de geteste code.',
  ctaFilm:'Bekijk de film',ctaApp:'Open de veld-app',
  kpis:[{v:'108',l:'kern- en relaytests geslaagd'},{v:'25/25',l:'browsertests zonder netwerk'},{v:'1.149/1.149',l:'treffers van het “≥98 %”-label (simulatie)'},{v:'53 min',l:'eerder waarschuwen als de mast eerst uitvalt (natuurbranddemo)'}],
  filmTitle:'De film',filmSub:'Ingesproken en gerenderd vanuit de live demo’s op deze pagina.',reelsTitle:'Reels',
  reels:[{id:'fuego',title:'Waarschuw voordat de mast brandt'},{id:'via',title:'Het signaal zat in de data'},{id:'rescate',title:'Zien wat je niet ziet'}],
  chapters:[
   {id:'red',demo:'net',kicker:'01 · GEEN DEKKING',title:'Geen enkel kanaal alleen. Samen 99 %.',lead:'Een SOS met positie en 6 s spraak past niet in één satelliet-SMS. SENDA splitst het in k-van-n-fragmenten (Reed-Solomon) over satelliet, LoRa en Iridium, met een exact berekende afleverkans.',
    lens:{citizen:'Je bericht gaat ook zonder dekking: het wordt gesplitst en reist via meerdere wegen tegelijk. De helft is genoeg.',coord:'Vóór verzending weet je de afleverkans en verwachte tijd. Zet kanalen aan of uit en zie het veranderen.',eng:'Dynamisch programmeren over een gegroepeerde Poisson-binomiaal: exacte P(≥k van n); gulzige toewijzing op kanswinst per euro; MTU en duty cycle per drager.',inv:'De waarde zit niet in een nieuw kanaal maar in het orkestreren van bestaande. Standaardhardware; schaalt met elk netwerk.'},proof:'bearers.mjs · erasure.mjs · 11 tests',href:'/senda/red'},
   {id:'cifrado',demo:'crypto',kicker:'02 · VEILIGHEID',title:'De koerier draagt het. Lezen kan hij niet.',lead:'Echte end-to-end-versleuteling in je browser: ECDH P-256, AES-256-GCM en ECDSA-handtekeningen. Wijzig één byte bij de koerier en de ontvanger weigert het.',
    lens:{citizen:'Wie je bericht vervoert (een buur, een drone) kan het niet lezen of wijzigen.',coord:'Officiële alarmen zijn ondertekend door de instantie: telefoons volgen alleen geverifieerde credentials.',eng:'Efemere sleutel per envelop, header als geauthenticeerde data in GCM, handtekening over header + versleuteling; ACK-commitment om kopieën te wissen.',inv:'Controleerbare veiligheid (open source): basis voor overheidsaanbestedingen die verifieerbare versleuteling eisen.'},proof:'envelope.mjs · roles.mjs · WebCrypto',href:'/senda/organismo'},
   {id:'personas',demo:'fusion',kicker:'03 · ZIEN WAT JE NIET ZIET',title:'Röntgenblik zonder röntgen.',lead:'Geen camera kijkt door een muur. SENDA combineert antwoorden, het telefoonsignaal, ademhaling via wifi, kloppen en zoekacties tot een gekalibreerde kans per woning, met interval.',
    lens:{citizen:'Als je “ingesloten” antwoordt of je telefoon zendt, weten redders welke verdieping eerst.',coord:'Een lijst “hier eerst zoeken”, gerangschikt op kans × schade, met de reden achter elk cijfer.',eng:'Bayes per persoon + marginale noisy-OR per cel; interval uit parameterbereiken; “≥98 %” alleen met twee onafhankelijke families. Brier 0,107 tegen 0,124 in 200 scenario’s.',inv:'Een generieke engine voor bewijsfusie: dezelfde kern dient redding, infrastructuur en industrie.'},proof:'occupancy.mjs · kalibratie in evidence/',href:'/senda/edificios'},
   {id:'incendio',demo:'fire',kicker:'04 · NATUURBRAND',title:'Waarschuw voordat de mast brandt.',lead:'Het vuurfront wordt berekend als minimale aankomsttijd met wind en helling. Nieuw: dat kruisen met de masten. Brandt de mast van een dorp vóór de waarschuwingsdeadline, dan gaat het alarm eerder of via kanalen zonder netwerk.',
    lens:{citizen:'Je krijgt de waarschuwing op tijd, ook als de dekking al weg is.',coord:'Tik op de kaart om de brandhaard te verplaatsen en verander de wind: elk dorp toont aankomst, mastuitval en kanaal.',eng:'Dijkstra op een raster met 16 buren, windellips vanuit het achterste brandpunt, hellingsfactor in Rothermel-vorm; FIRMS als ontstekingen. Illustratieve coëfficiënten.',inv:'Preventie, niet alleen respons: een product voor regio’s, operators en verzekeraars op open data.'},proof:'wildfire.mjs · 7 tests'},
   {id:'via',demo:'rail',kicker:'05 · SPOORWEGEN',title:'Het signaal zat in de data.',lead:'Volgens een door Adif betwist rapport van de Guardia Civil registreerde het spoorstroomcircuit in Adamuz ~22 uur vooraf een spanningsdaling, zonder alarm omdat die boven de drempel bleef. SENDA vergelijkt elk circuit met zijn eigen geschiedenis. Synthetische data.',
    lens:{citizen:'Met toestemming helpen telefoons van reizigers verslechterende spoorvakken te vinden.',coord:'Inspectievoorstellen met bewijs voor de infrabeheerder, nooit bevelen.',eng:'Mediaan en MAD per circuit bij vrij spoor, persistentie en herstel; crowd-geometrie genormaliseerd per rit en snelheid met ≥3 toestellen.',inv:'Software op data die al bestaat: vrijwel geen hardwarekosten en een koper met urgentie.'},proof:'rail-watch.mjs · 8 tests',href:'/senda/via'},
   {id:'satelite',demo:'orbit',kicker:'06 · SATELLIET',title:'Er komt altijd een satelliet voorbij.',lead:'Kepler + J2-baanpropagatie in je browser: welke satellieten El Tiemblo nu ziet en wanneer het volgende contact is. De router maakt van die passages verzendvensters.',
    lens:{citizen:'In de bergen kan een satelliet je bericht dragen, ook zonder masten.',coord:'Je weet wanneer het venster opent en hoeveel bytes passen (Iridium SBD: 340 B).',eng:'Baanelementen, sterrentijd van Greenwich, elevatie boven de horizon en passages boven minimale elevatie; echte TLE’s online.',inv:'Operator-onafhankelijk: satelliet-naar-telefoon, Iridium of QO-100 zijn gewoon een drager.'},proof:'orbital.mjs · satellites.mjs'},
  ],
  flowTitle:'Het volledige algoritme',
  investTitle:'WAAROM DIT ONDERZOEK STEUNEN?',investLead:'Wat ontbreekt is geen idee maar het veld. Kapitaal maakt van geverifieerde simulatie gemeten pilots.',
  cards:[{t:'Natuurbrandpilot',b:'Eén bosgebied: FIRMS + weerdata, echte masten en alarmen zonder netwerk met de crisisdienst.'},{t:'Spoorpilot',b:'12 maanden spoorstroomcircuit-logs van één lijn, onder overeenkomst, om treffers en vals alarm te meten.'},{t:'Certificering',b:'Onafhankelijke security-audit, ENS en DPIA zodat overheden kunnen contracteren.'},{t:'Kalibratie en kits',b:'Brandweer in een oefengebouw; LoRa + Iridium-gatewaykits gemeten in het veld.'}],
  truthTitle:'Wat echt is en wat gesimuleerd',truth:'De code is echt en getest. Scenario’s gemarkeerd als INTERACTIEF NOODSCENARIO (SIMULATIE) zijn synthetisch: ze rekenen met die code op verzonnen maar realistisch gevormde data. Geen veldcijfer zonder pilot. SENDA is een secundair kanaal: het vervangt 112 en NL-Alert niet.',
  fundingLine:`Doeloproep: ${FUNDING} (geen garantie op toekenning).`,
  labTitle:'Volledig lab',labLead:'De rest, zonder deze pagina langer te maken.',
  lab:[{href:'/senda',t:'Veld-app',d:'PWA die in vliegtuigmodus werkt'},{href:'/senda/edificios',t:'Gebouwtweeling',d:'3D, camera en gelaagd zicht'},{href:'/senda/via',t:'Spoorbewaking',d:'Circuits, geometrie, snelheid, muren'},{href:'/senda/red',t:'Multidragernetwerk',d:'Satellieten, black-out en CAP 1.2'},{href:'/senda/estado',t:'Verificatie',d:'Tests en bewijs'},{href:'/nl/lab/',t:'Vorig lab',d:'Globe, sectorcamera’s, RF-radar'}],
  open:'Open',footer:'SENDA · Noodroutering via alternatieve kanalen · © 2026 Abraham Haddioui · open source'
 }
};

const LEVELS:Level[]=['citizen','coord','eng','inv'];
const filmLang=(l:Locale)=>(l==='es'?'es':'en');

export default function SendaExperience({locale}:{locale:Locale}){
 const t=COPY[locale];
 const [level,setLevel]=useState<Level>('citizen');
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  document.documentElement.lang=locale;
  const url='/senda/home/demos.mjs';
  let cancelled=false;
  import(/* webpackIgnore: true */ url).then((m)=>{if(!cancelled&&root.current)m.mountAll(root.current,locale);}).catch(()=>{});
  const io=new IntersectionObserver((es)=>es.forEach((e)=>{if(e.isIntersecting)e.target.classList.add('is-in');}),{rootMargin:'-8% 0px'});
  root.current?.querySelectorAll('.sx-reveal').forEach((n)=>io.observe(n));
  return()=>{cancelled=true;io.disconnect();};
 },[locale]);
 const fl=filmLang(locale), base=locale==='en'?'/':`/${locale}/`;
 return <div className="sx" ref={root} data-level={level}>
  <header className="sx-top">
   <a className="sx-brand" href={base}>SENDA<span>offline first, for sure</span></a>
   <nav className="sx-nav" aria-label={t.levelsLabel}>{t.chapters.map((c,i)=><a key={c.id} href={`#${c.id}`}>{t.nav[i]}</a>)}<a href="#invertir">{t.nav[6]}</a></nav>
   <nav className="sx-langs" aria-label="Language"><a href="/" hrefLang="en" aria-current={locale==='en'?'page':undefined}>EN</a><a href="/es/" hrefLang="es" aria-current={locale==='es'?'page':undefined}>ES</a><a href="/nl/" hrefLang="nl" aria-current={locale==='nl'?'page':undefined}>NL</a></nav>
  </header>

  <section className="sx-hero" aria-labelledby="sx-h1">
   <div className="sx-hero-bg" data-demo="hero" aria-hidden="true"/>
   <div className="sx-hero-copy">
    <h1 id="sx-h1"><span>{t.h1[0]}</span> <span className="sx-ice">{t.h1[1]}</span><br/><span className="sx-coral">{t.h1[2]}</span></h1>
    <p className="sx-sub">{t.sub}</p>
    <div className="sx-levels" role="radiogroup" aria-label={t.levelsLabel}>
     <span>{t.levelsLabel}</span>
     {LEVELS.map((l)=><button key={l} type="button" role="radio" aria-checked={level===l} className={level===l?'on':''} onClick={()=>setLevel(l)}>{t.levels[l]}</button>)}
    </div>
    <div className="sx-cta"><a className="sx-btn is-primary" href="#pelicula">{t.ctaFilm} ▶</a><a className="sx-btn" href="/senda">{t.ctaApp} ↗</a></div>
   </div>
   <dl className="sx-kpis">{t.kpis.map((k)=><div key={k.l}><dt>{k.v}</dt><dd>{k.l}</dd></div>)}</dl>
  </section>

  <section id="pelicula" className="sx-film sx-reveal" aria-labelledby="sx-film-h">
   <div className="sx-film-main">
    <h2 id="sx-film-h">{t.filmTitle}</h2><p className="sx-muted">{t.filmSub}</p>
    <video controls preload="metadata" playsInline poster={`/media/promo/senda-investor-${fl}.jpg`}>
     <source src={`/media/promo/senda-investor-${fl}.mp4`} type="video/mp4"/>
     <track kind="subtitles" srcLang={fl} label={fl.toUpperCase()} src={`/media/promo/senda-investor-${fl}.vtt`} default/>
    </video>
   </div>
   <div className="sx-reels"><h3>{t.reelsTitle}</h3>
    <div className="sx-reels-row">{t.reels.map((r)=><figure key={r.id}><video controls preload="none" playsInline muted poster={`/media/promo/reel-${r.id}-${fl}.jpg`}><source src={`/media/promo/reel-${r.id}-${fl}.mp4`} type="video/mp4"/></video><figcaption>{r.title}</figcaption></figure>)}</div>
   </div>
  </section>

  {t.chapters.map((c,i)=><section key={c.id} id={c.id} className={`sx-chapter sx-reveal${i%2?' is-flip':''}`} aria-labelledby={`h-${c.id}`}>
   <div className="sx-chapter-copy">
    <p className="sx-kicker">{c.kicker}</p>
    <h2 id={`h-${c.id}`}>{c.title}</h2>
    <p className="sx-lead">{c.lead}</p>
    {LEVELS.map((l)=><p key={l} className="sx-lens" data-l={l}><b>{t.levels[l]} ·</b> {c.lens[l]}</p>)}
    <p className="sx-proof"><span>{c.proof}</span>{c.href&&<a href={c.href}>{t.open} ↗</a>}</p>
   </div>
   <div className="sx-demo" data-demo={c.demo}/>
  </section>)}

  <section className="sx-flow sx-reveal" aria-label={t.flowTitle}><p className="sx-kicker">{t.flowTitle}</p><p className="sx-flow-line">{FLOW}</p></section>

  <section id="invertir" className="sx-invest sx-reveal" aria-labelledby="sx-inv-h">
   <h2 id="sx-inv-h">{t.investTitle}</h2><p className="sx-lead">{t.investLead}</p>
   <div className="sx-cards">{t.cards.map((c,i)=><article key={c.t}><span>0{i+1}</span><h3>{c.t}</h3><p>{c.b}</p></article>)}</div>
   <aside className="sx-truth" role="note"><h3>{t.truthTitle}</h3><p>{t.truth}</p><p className="sx-muted">{t.fundingLine}</p></aside>
  </section>

  <section className="sx-lab sx-reveal" aria-labelledby="sx-lab-h">
   <h2 id="sx-lab-h">{t.labTitle}</h2><p className="sx-muted">{t.labLead}</p>
   <div className="sx-lab-grid">{t.lab.map((x)=><a key={x.href} href={x.href}><b>{x.t}</b><span>{x.d}</span></a>)}</div>
  </section>
  <footer className="sx-footer"><span>{t.footer}</span><a href="https://github.com/abrahamhl/civic-relay" target="_blank" rel="noopener noreferrer">GitHub ↗</a></footer>
 </div>;
}
