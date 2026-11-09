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
    broadcastT: 'Especial Informativo: La Red de Emergencia que Defiende Vidas y Soberanía',
    broadcastMeta: '20:11 UTC · Formato Telediario · Locución Femenina (bf_emma / ef_dora) · Subtítulos ES / EN / NL',
    broadcastNote: 'Investigación especial basada en hechos y telemetría de la DANA de Valencia (octubre 2024), el incendio de Bejís y el accidente múltiple de la A-12 en los Países Bajos. Malla cibernética en bandas libres ISM (433/868 MHz y 2,4 GHz), cálculo de propagación 3D de Al-Hourani, autovalor de Fiedler λ₂(L), radar pasivo biestático y sensores COTS por menos de 25 € con decodificación de drones y pilotos ASTM F3411. Cumplimiento pleno de directivas de protección civil y el estándar europeo DATEX II.',
    broadcastVoiceEs: 'Locución en Español (ef_dora)',
    broadcastVoiceEn: 'Locución en Inglés (bf_emma)',
    breakthroughT: 'Gran Telediario de Innovación: Radar Acústico Táctico, Detección de Fibra Óptica y Centinelas COTS',
    breakthroughMeta: '07:30 UTC · Telediario Especial · Locución Femenina (ef_dora) · Subtítulos ES / EN / NL',
    breakthroughNote: 'Investigación técnica sobre la detección pasiva de drones por fibra óptica sin radio (0 dBm RF), triangulación acústica TDoA con teléfonos móviles, microfonía cardioide/shotgun y nodo centinela de 11,70 € en hardware COTS.',
    rolesT: 'Suite de Demostración por Rol',
    rolesLead: 'SENDA conecta la estrategia soberana de los Estados, el rigor matemático de los ingenieros y la sencillez vital que necesita la ciudadanía en una emergencia.',
    roleInvT: 'Modo Inversionista & Defensa (60 s)',
    roleInvDesc: 'Soberanía nacional, contratos de protección civil y defensa, escalabilidad masiva con hardware comercial de 24 € y retorno estratégico sobre algoritmos propietarios.',
    roleDevT: 'Modo Desarrollador & Ingeniería (60 s)',
    roleDevDesc: 'Física matemática 3D Al-Hourani, conectividad algebraica λ₂(L), planes PX4, radar pasivo CAF y paridad en 74 módulos de núcleo de código abierto.',
    roleCitT: 'Modo Ciudadano & Evacuación (60 s)',
    roleCitDesc: 'PWA 100% offline sin red celular ni internet, saltos de coche a coche por sonido y Bluetooth, mapas 3D de terreno y 3 botones claros para salvar vidas.',
    reelsT: 'Reels Verticales 9:16 para Redes Sociales',
    reelsLead: 'Píldoras audiovisuales en alta resolución y formato vertical para divulgación en TikTok, Instagram Reels, YouTube Shorts y X.',
    reel1T: 'Apagón Black-Sky',
    reel1Desc: 'Qué ocurre cuando cae toda la red eléctrica y cómo SENDA mantiene las llamadas vivas por sonido.',
    reel2T: 'Caza de Drones por 25 €',
    reel2Desc: 'Construyendo un sensor táctico con AliExpress y decodificando la posición del piloto con ASTM F3411.',
    reel3T: 'Matemáticas que Salvan Vidas',
    reel3Desc: 'Al-Hourani, autovalor de Fiedler, difracción de Deygout y radar pasivo sobre Valencia y Bejís.',
    reel4T: 'Soberanía y Defensa Nacional',
    reel4Desc: 'Por qué los gobiernos invierten en redes tácticas ad-hoc para proteger sus infraestructuras críticas.',
    reel5T: 'Centinela 11 € y Supervivencia Civil',
    reel5Desc: 'Detección de drones de fibra óptica, vector de evasión silencioso y baliza ultrasónica de socorro.',
    filmT: 'La película: qué es SENDA y qué ya funciona',
    filmNote: 'Locución original en inglés (bf_emma) y en español (ef_dora); subtítulos sincronizados en español, inglés y neerlandés. Todas las simulaciones y los renders 3D los calcula fotograma a fotograma el mismo código que ejecuta la app. Integración complementaria con el 112 bajo estándares abiertos CAP 1.2 y directivas de protección civil.',
    filmAlt: 'Cortes ejecutivos (90 s · 60 s · 30 s · vertical 9:16) y archivo doblado al español',
    rutaT: 'En la carretera: ruta protectora, cámaras, Países Bajos y DGT',
    rutaNote: 'Grabado fotograma a fotograma desde las páginas de la app, con el núcleo real y rótulos en inglés. Demostraciones de ingeniería basadas en modelos físicos de tráfico, visibilidad Koschmieder y coordinación vehicular bajo la directiva DATEX II.',
    rutaAlt: 'Versión doblada al español y 6 simulaciones explicadas individuales',
    rutaAltLang: 'es',
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
      ['🔋', 'Batería de Internet', 'Reserva de red en el teléfono (hasta ~1 GB elegido por valor y frescura), biblioteca común entre vecinos y adónde ir para que salga el mensaje.', '/senda/reserva'],
      ['🚗', 'Ruta protectora', 'En carretera: aviso de frenada brusca a los coches que no la ven, SOS sin cobertura que llevan los coches que pasan, PK sin red y coordinación del accidente con puntos cívicos.', '/senda/carretera'],
      ['📷', 'Cámaras públicas', 'Solo las publicadas para reutilizarse: SENDA mide en ellas cuánto se ve (niebla) y si hay nieve, y avisa a quien se acerca. Nunca personas ni matrículas.', '/senda/camaras'],
      ['🇳🇱', 'España → Países Bajos', 'El mismo núcleo en toda la UE: 112 y DATEX II comunes; en Países Bajos, cruces rojas sobre los carriles, puentes móviles y avisos en neerlandés.', '/senda/paises'],
      ['🛣️', 'Infraestructura de la DGT', 'Paneles, cámaras, aforos y balizas V16: lo que los organismos viales publican se suma a SENDA, y DGT 3.0 por convenio dentro del marco legal DATEX II.', '/senda/dgt'],
      ['🎥', 'Visión de tráfico (vídeo real)', 'Vehículos detectados y seguidos en vídeo real: conteo por sentido, distancia, tiempo hasta alcanzarlos y contactos de la calzada contraria. Solo salen números.', '/senda/trafico'],
      ['🚗', 'Coches, cámaras y fuego', 'Cámaras oficiales de Caltrans y TfL contadas de verdad, satélite GOES y un modelo de tráfico por celdas con filtro de Kalman: cuándo avisar, qué tramo cerrar y cómo ver un atasco minutos antes. En Eaton 2025 habría avisado horas antes.', '/senda/evacuacion'],
      ['📚', 'Incendios de referencia', '14 incendios reales con fuentes, 7 reconstruidos con satélite NOAA: velocidad del frente medida, validación fuera de muestra y la incertidumbre real que usan los avisos.', '/senda/referencias'],
      ['🌪️', 'Incendio en 3D con datos reales', 'Terreno Copernicus, Sentinel-2 y el modelo GFS del día: viento 3D sobre el relieve, pluma que aspira aire, humo y pavesas, cámaras con oclusión y coches como estación meteorológica. Vista cenital, inclinada u horizontal.', '/senda/fuego3d'],
      ['🔥', 'Seguimiento de incendio', 'Torres, cámaras y la brújula del móvil sitúan la columna; el satélite mide el perímetro y el avance; meteorología del incendio, criticidad, carreteras a cortar y avisos a los coches. Caso real: M-501, julio de 2026.', '/senda/fuego'],
      ['🚘', 'Coches conectados', 'Ley de Datos de la UE y avisos de seguridad de los coches (DFRS), con privacidad por diseño. La posición pasa de ~10 m a ~1-2 m sumando vía, aerogeneradores, Wi-Fi y otros coches.', '/senda/vehiculos'],
      ['👂', 'Sentidos ampliados', 'Ver los sonidos (golpes localizados con varios móviles), oír la radio como un detector de avalanchas y ver la respiración por Wi-Fi con placas de pocos euros.', '/senda/sentidos'],
      ['🌧️', 'Riadas y maremotos', 'Aviso por la subida aguas arriba con horas de margen donde no llueve (patrón DANA) y tiempo de llegada de un maremoto con evacuación vertical.', '/senda/agua'],
      ['🩹', 'Triaje para cualquiera', 'START paso a paso, qué hacer mientras llega la ayuda, a qué servicio avisar y un parte que cabe en un SMS.', '/senda/triaje'],
      ['🧭', 'Perdido en el monte', 'Posición sin señal con rumbos a aerogeneradores y antenas, estima por pasos, mapas guardados y SOS por satélite.', '/senda/monte'],
      ['🚁', 'Dron casa por casa', 'Ruta optimizada con cambios de batería y tablero de prioridad: personas probables por daño del edificio.', '/senda/barrido'],
      ['🔬', 'Laboratorio de Teoremas Científicos y Física Matemática', 'Propagación A2G Al-Hourani, conectividad algebraica Fiedler λ₂(L), difracción Deygout ITU-R P.526, radar pasivo biestático y capacidad acústica ISO 9613-1.', '/science/'],
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
    broadcastT: 'Breaking News Special: The Emergency Network Defending Lives and Sovereignty',
    broadcastMeta: '20:11 UTC · Broadcast News Format · Female Narration (bf_emma / ef_dora) · Subtitles ES / EN / NL',
    broadcastNote: 'Special investigation grounded in ground truth and telemetry from the Valencia 2024 DANA floods, the Bejís wildfire, and the Dutch A-12 highway fog collision. Tactical mesh over license-free ISM spectrum (433/868 MHz & 2.4 GHz), 3D Al-Hourani propagation physics, graph Laplacian λ₂(L) Fiedler eigenvalue, passive bistatic radar and COTS hardware under 25 € with ASTM F3411 rogue drone and pilot interception. Fully aligned with EU civil protection directives and DATEX II.',
    broadcastVoiceEs: 'Spanish Narration (ef_dora)',
    broadcastVoiceEn: 'English Narration (bf_emma)',
    breakthroughT: 'Special Innovation Broadcast: Tactical Acoustic Radar, Fiber-Optic Detection & COTS Sentinels',
    breakthroughMeta: '07:30 UTC · Broadcast News Format · Female Narration (ef_dora) · Subtitles ES / EN / NL',
    breakthroughNote: 'Technical investigation on passive detection of radio-silent fiber-optic drones (0 dBm RF), acoustic TDoA smartphone multilateration, cardioid/shotgun beamforming, and 11.70 € COTS sentinel nodes.',
    rolesT: 'Role Demonstration Suite',
    rolesLead: 'SENDA unites sovereign state resilience, rigorous mathematical physics, and direct simplicity for citizens facing a blackout.',
    roleInvT: 'Investor & Sovereign Defence Mode (60 s)',
    roleInvDesc: 'Sovereign resilience, civil protection and defence procurement, mass scalability with accessible 24 € COTS modules and multi-million value on proprietary algorithms.',
    roleDevT: 'Developer & Engineering Mode (60 s)',
    roleDevDesc: '3D Al-Hourani physics, λ₂(L) algebraic connectivity, PX4 flight plans, passive bistatic radar and parity across 74 open-source core modules.',
    roleCitT: 'Citizen & Evacuation Mode (60 s)',
    roleCitDesc: '100% offline PWA requiring zero mobile coverage or internet, car-to-car DTN hops via sound and Bluetooth, 3D terrain maps and 3 life-saving buttons.',
    reelsT: 'Vertical 9:16 Reels for Social Media',
    reelsLead: 'High-resolution vertical media clips optimized for TikTok, Instagram Reels, YouTube Shorts and X.',
    reel1T: 'Black-Sky Grid Failure',
    reel1Desc: 'What happens when the entire electrical and cellular grid fails, and how SENDA preserves direct voice calls over sound.',
    reel2T: 'Hunting Drones for 25 €',
    reel2Desc: 'Building a tactical sensor with AliExpress chips and decoding the remote pilot ground location via ASTM F3411.',
    reel3T: 'Mathematics Saving Lives',
    reel3Desc: 'Al-Hourani, Fiedler eigenvalue, Deygout knife-edge diffraction, and passive bistatic radar over real catastrophe scenes.',
    reel4T: 'Sovereign National Defence',
    reel4Desc: 'Why governments and defence forces invest in sovereign ad-hoc meshes to protect critical territory.',
    reel5T: '11 € Sentinel & Civil Survival',
    reel5Desc: 'Detection of silent fiber-optic drones, silent evasion vector and inaudible ultrasonic rescue beacon.',
    filmT: 'The film: what SENDA is and what already works',
    filmNote: 'Original English narration (bf_emma) and Spanish narration (ef_dora); synchronised subtitles in Spanish, English and Dutch. Every simulation and 3D render is computed frame by frame by the same code the app runs. Complementary integration with emergency services under CAP 1.2 open standards and EU civil protection directives.',
    filmAlt: 'Executive short cuts (90 s · 60 s · 30 s · 9:16 vertical) and Spanish-voiced archive',
    rutaT: 'On the road: protective route, cameras, the Netherlands and the DGT',
    rutaNote: 'Recorded frame by frame from the app’s own pages, with the real core and English on-screen labels. Engineering demonstrations grounded in physical traffic flow models, Koschmieder visual range and vehicular coordination under DATEX II.',
    rutaAlt: 'Spanish-voiced version and 6 individual explained simulations',
    rutaAltLang: 'es',
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
      ['🔋', 'Internet battery', 'A network reserve inside the phone (up to ~1 GB chosen by value and freshness), a shared library between neighbours and where to go so the message gets out.', '/senda/reserva'],
      ['🚗', 'Protective route', 'On the road: hard-braking alerts for the cars that cannot see it, an SOS with no coverage carried by passing cars, kilometre point without network and coordination of the crash scene with civic points.', '/senda/carretera'],
      ['📷', 'Public cameras', 'Only cameras published for reuse: SENDA measures how far you can see (fog) and whether there is snow, and warns whoever is approaching. Never people or number plates.', '/senda/camaras'],
      ['🇳🇱', 'Spain → Netherlands', 'The same core across the EU: 112 and DATEX II are shared; in the Netherlands, red crosses over lanes, movable bridges and alerts in Dutch.', '/senda/paises'],
      ['🛣️', 'DGT roadside infrastructure', 'Message signs, cameras, traffic counters and V16 beacons: what transport agencies publish feeds SENDA, and DGT 3.0 by agreement within the DATEX II legal framework.', '/senda/dgt'],
      ['🎥', 'Traffic vision (real video)', 'Vehicles detected and tracked in real video: counts by direction, distance, time to reach them and contacts from the opposite carriageway. Only numbers leave.', '/senda/trafico'],
      ['🚗', 'Cars, cameras and fire', 'Official Caltrans and TfL cameras actually counted, GOES satellite and a cell transmission traffic model with a Kalman filter: when to warn, which section to close and how to see a jam minutes earlier. In Eaton 2025 it would have warned hours earlier.', '/senda/evacuacion'],
      ['📚', 'Reference wildfires', '14 real fires with sources, 7 reconstructed with NOAA satellites: measured front speed, out-of-sample validation and the real uncertainty used by warnings.', '/senda/referencias'],
      ['🌪️', 'Wildfire in 3D with real data', 'Copernicus terrain, Sentinel-2 and the GFS model of the day: 3D wind over the relief, a plume that draws air in, smoke and embers, cameras with terrain occlusion and cars as a weather station. Top-down, tilted or horizon view.', '/senda/fuego3d'],
      ['🔥', 'Wildfire tracking', 'Lookout towers, cameras and the phone compass locate the smoke column; satellites measure the perimeter and spread; fire weather, criticality, roads to close and warnings to cars. Real case: M-501, July 2026.', '/senda/fuego'],
      ['🚘', 'Connected cars', 'The EU Data Act and vehicle-generated safety warnings (DFRS), with privacy by design. Position goes from ~10 m to ~1-2 m by adding the road, wind turbines, Wi-Fi and other cars.', '/senda/vehiculos'],
      ['👂', 'Extended senses', 'See sounds (knocks located with several phones), hear radio like an avalanche transceiver and see breathing through Wi-Fi with boards costing a few euros.', '/senda/sentidos'],
      ['🌧️', 'Flash floods and tsunamis', 'Warning from the upstream rise, hours ahead where it is not raining (DANA pattern), and tsunami arrival times with vertical evacuation.', '/senda/agua'],
      ['🩹', 'Triage for anyone', 'Step-by-step START, what to do until help arrives, which service to alert and a report that fits in one SMS.', '/senda/triaje'],
      ['🧭', 'Lost in the mountains', 'Position without signal from bearings to wind turbines and masts, step counting, offline maps and satellite SOS.', '/senda/monte'],
      ['🚁', 'House-by-house drone', 'Optimised route with battery swaps and a priority board: likely people times building damage.', '/senda/barrido'],
      ['🔬', 'Scientific Theorems & Mathematical Physics Lab', 'Al-Hourani A2G clutter physics, Fiedler algebraic connectivity λ₂(L), Deygout ITU-R P.526 diffraction, passive bistatic radar CRLB, and ISO 9613-1 acoustic capacity.', '/science/'],
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
    broadcastT: 'Speciale Nieuwsuitzending: Het Noodnetwerk dat Levens en Soevereiniteit Verdedigt',
    broadcastMeta: '20:11 UTC · Journaalformat · Vrouwelijke Voice-over (bf_emma / ef_dora) · Ondertitels ES / EN / NL',
    broadcastNote: 'Speciaal onderzoek gebaseerd op feiten en telemetrie van de DANA-overstromingen in Valencia (oktober 2024), de bosbrand in Bejís en het kettingongeval op de A-12 in Nederland. Cybernetisch meshnetwerk in vergunningsvrije ISM-banden (433/868 MHz en 2,4 GHz), 3D Al-Hourani-voortplantingsfysica, Fiedler-eigenwaarde λ₂(L), passieve bistatische radar en COTS-hardware onder 25 € met ASTM F3411-decodering van drones en piloten. Volledig in overeenstemming met EU-richtlijnen voor civiele bescherming en de Europese DATEX II-standaard.',
    broadcastVoiceEs: 'Spaanse Voice-over (ef_dora)',
    broadcastVoiceEn: 'Engelse Voice-over (bf_emma)',
    breakthroughT: 'Speciaal Innovatiebulletin: Tactische Akoestische Radar, Glasvezeldetectie & COTS Sentinels',
    breakthroughMeta: '07:30 UTC · Nieuwsbulletin-formaat · Vrouwelijke Stem (ef_dora) · Ondertitels ES / EN / NL',
    breakthroughNote: 'Technisch onderzoek naar passieve detectie van radiostille glasvezeldrones (0 dBm RF), TDoA-smartphone multilateratie, directionele microfoons en COTS sentinel-knooppunten van 11,70 €.',
    rolesT: 'Demonstratiesuite per Rol',
    rolesLead: 'SENDA verbindt soevereine overheidsweerbaarheid, strikte mathematische fysica en directe eenvoud voor burgers in nood.',
    roleInvT: 'Investeerders- & Defensiemodus (60 s)',
    roleInvDesc: 'Nationale soevereiniteit, overheidscontracten voor civiele bescherming en defensie, massale schaalbaarheid met COTS-hardware van 24 € en strategisch rendement op gepatenteerde algoritmen.',
    roleDevT: 'Ontwikkelaars- & Ingenieursmodus (60 s)',
    roleDevDesc: '3D Al-Hourani-fysica, algebraïsche connectiviteit λ₂(L), PX4-vluchtplannen, passieve bistatische CAF-radar en pariteit over 74 opensource-kernmodules.',
    roleCitT: 'Burgers- & Evacuatiemodus (60 s)',
    roleCitDesc: '100% offline PWA zonder mobiel netwerk of internet, auto-naar-auto DTN-hops via geluid en Bluetooth, 3D-terreinoverzichten en 3 levensreddende knoppen.',
    reelsT: 'Verticale 9:16 Reels voor Sociale Media',
    reelsLead: 'Audiovisuele snippets in hoge resolutie en verticaal formaat voor verspreiding op TikTok, Instagram Reels, YouTube Shorts en X.',
    reel1T: 'Black-Sky Stroomuitval',
    reel1Desc: 'Wat er gebeurt als het gehele stroom- en mobiele netwerk uitvalt, en hoe SENDA spraakoproepen in stand houdt via geluid.',
    reel2T: 'Dronejacht voor 25 €',
    reel2Desc: 'Een tactische sensor bouwen met AliExpress-chips en de positie van de piloot decoderen via ASTM F3411.',
    reel3T: 'Wiskunde die Levens Redt',
    reel3Desc: 'Al-Hourani, Fiedler-eigenwaarde, Deygout-meskantdiffractie en passieve radar boven Valencia en Bejís.',
    reel4T: 'Soevereine Nationale Defensie',
    reel4Desc: 'Waarom overheden en defensiediensten investeren in soevereine ad-hocnetwerken om kritieke infrastructuur te beschermen.',
    reel5T: '11 € Sentinel & Burgeroverleving',
    reel5Desc: 'Detectie van stille glasvezeldrones, stille uitwijkingsvector en onhoorbaar ultrasoon reddingsbaken.',
    filmT: 'De film: wat SENDA is en wat al werkt',
    filmNote: 'Originele Engelse voice-over (bf_emma) en Spaanse voice-over (ef_dora); gesynchroniseerde ondertiteling in het Spaans, Engels en Nederlands. Elke simulatie en 3D-render wordt beeld voor beeld berekend door dezelfde code die de app draait. Aanvullende integratie met meldkamer 112 onder open CAP 1.2-standaarden en EU-richtlijnen voor civiele bescherming.',
    filmAlt: 'Korte versies (90 s · 60 s · 30 s · 9:16 verticaal) en Spaans ingesproken archief',
    rutaT: 'Op de weg: beschermende route, camera’s, Nederland en de DGT',
    rutaNote: 'Beeld voor beeld opgenomen vanaf de pagina’s van de app, met de echte kern en Engelse labels op het scherm. Technische demonstraties gebaseerd op fysische verkeersmodellen, Koschmieder-zichtbaarheid en voertuigcoördinatie onder DATEX II.',
    rutaAlt: 'Spaans ingesproken versie en 6 afzonderlijke uitgelegde simulaties',
    rutaAltLang: 'es',
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
      ['🔋', 'Internetbatterij', 'Een netwerkreserve in de telefoon (tot ~1 GB gekozen op waarde en actualiteit), een gedeelde bibliotheek tussen buren en waar je heen moet zodat het bericht verstuurd wordt.', '/senda/reserva'],
      ['🚗', 'Beschermende route', 'Op de weg: waarschuwing bij hard remmen voor auto’s die het niet zien, een SOS zonder bereik die passerende auto’s meenemen, kilometerpunt zonder netwerk en coördinatie van het ongeval met burgerpunten.', '/senda/carretera'],
      ['📷', 'Openbare camera’s', 'Alleen camera’s die voor hergebruik zijn gepubliceerd: SENDA meet hoe ver je kunt zien (mist) en of er sneeuw ligt, en waarschuwt wie eraan komt. Nooit personen of kentekens.', '/senda/camaras'],
      ['🇳🇱', 'Spanje → Nederland', 'Dezelfde kern in de hele EU: 112 en DATEX II zijn gedeeld; in Nederland rode kruisen boven rijstroken, beweegbare bruggen en meldingen in het Nederlands.', '/senda/paises'],
      ['🛣️', 'Infrastructuur van de DGT', 'Matrixborden, camera’s, telpunten en V16-bakens: wat verkeersdiensten publiceren voedt SENDA, en DGT 3.0 via een overeenkomst binnen het wettelijk kader van DATEX II.', '/senda/dgt'],
      ['🎥', 'Verkeersbeeld (echte video)', 'Voertuigen gedetecteerd en gevolgd in echte video: tellingen per richting, afstand, tijd tot inhalen en tegenliggers op de andere rijbaan. Alleen getallen gaan eruit.', '/senda/trafico'],
      ['🚗', 'Auto’s, camera’s en vuur', 'Officiële camera’s van Caltrans en TfL echt geteld, GOES-satelliet en een celtransmissiemodel met Kalmanfilter: wanneer waarschuwen, welk wegvak afsluiten en een file minuten eerder zien. Bij Eaton 2025 had het uren eerder gewaarschuwd.', '/senda/evacuacion'],
      ['📚', 'Referentiebranden', '14 echte branden met bronnen, 7 gereconstrueerd met NOAA-satellieten: gemeten frontsnelheid, validatie buiten de steekproef en de echte onzekerheid voor waarschuwingen.', '/senda/referencias'],
      ['🌪️', 'Bosbrand in 3D met echte data', 'Copernicus-terrein, Sentinel-2 en het GFS-model van die dag: 3D-wind over het reliëf, een rookpluim die lucht aanzuigt, rook en vliegvuur, camera’s met afscherming door het terrein en auto’s als weerstation.', '/senda/fuego3d'],
      ['🔥', 'Bosbrand volgen', 'Uitkijktorens, camera’s en het kompas van de telefoon bepalen de rookkolom; satellieten meten de omtrek en de voortgang; brandweer, ernst, af te sluiten wegen en waarschuwingen aan auto’s. Echte casus: M-501, juli 2026.', '/senda/fuego'],
      ['🚘', 'Verbonden auto’s', 'De EU-Dataverordening en veiligheidsmeldingen van auto’s (DFRS), met privacy by design. Positie van ~10 m naar ~1-2 m door weg, windturbines, wifi en andere auto’s te combineren.', '/senda/vehiculos'],
      ['👂', 'Uitgebreide zintuigen', 'Geluid zien (klopgeluiden gelokaliseerd met meerdere telefoons), radio horen als een lawinepieper en ademhaling zien via wifi met bordjes van een paar euro.', '/senda/sentidos'],
      ['🌧️', 'Overstromingen en tsunami’s', 'Waarschuwing op basis van de stijging stroomopwaarts, uren vooraf waar het niet regent (DANA-patroon), en aankomsttijden van een tsunami met verticale evacuatie.', '/senda/agua'],
      ['🩹', 'Triage voor iedereen', 'START stap voor stap, wat te doen tot er hulp komt, welke dienst te waarschuwen en een melding die in één sms past.', '/senda/triaje'],
      ['🧭', 'Verdwaald in de bergen', 'Positie zonder signaal via peilingen naar windturbines en masten, stappen tellen, offline kaarten en satelliet-SOS.', '/senda/monte'],
      ['🚁', 'Drone huis voor huis', 'Geoptimaliseerde route met batterijwissels en een prioriteitenbord: waarschijnlijke mensen maal schade aan het gebouw.', '/senda/barrido'],
      ['🔬', 'Wetenschappelijke Stellingen & Mathematische Fysica Lab', 'Al-Hourani A2G clutter-fysica, Fiedler algebraïsche connectiviteit λ₂(L), Deygout ITU-R P.526 diffractie, passieve bistatische radar CRLB en ISO 9613-1 akoestische capaciteit.', '/science/'],
    ],
    ojoT: 'SENDA-oog: welke satelliet elke noodsituatie ziet en hoe het alarm aankomt',
    ojoLead: 'Elke stip op de wereldbol is een satelliet van zijn constellatie, berekend in je browser met dezelfde code als de router. De gekleurde markeringen boven Spanje zijn echte gevallen (de natuurbrand is een demonstratiescenario). Kies er een en SENDA zoekt de zichtbare satelliet met de hoogste elevatie, berekent afstand en vertraging en tekent de route van het alarm naar de 112-meldkamer.',
    ojoPts: [['Iridium · lage baan (cyaan)', '66 satellieten op ~780 km die de hele planeet dekken. SENDA stuurt er versleutelde berichten tot 340 B via met een RockBLOCK-modem.'], ['Galileo · middelhoge baan (amber)', '24 satellieten op 23.222 km: nauwkeurige positie en opsporing en redding met terugmeldkanaal voor noodbakens.'], ['QO-100 · geostationair (violet)', 'Vast op 25,9° O en altijd zichtbaar vanuit Spanje; zendamateurs met licentie, alleen ondertekende openbare statussen.'], ['Gevallen en modules', 'Elk geval linkt naar zijn bron en naar de SENDA-modules die zouden hebben ingegrepen: ondertekende alarmen, multidragernetwerk, black-outvoorspelling, spoor, gebouwen of natuurbrand.']],
    ojoOpen: 'SENDA-oog volledig scherm openen',
    whoT: 'Voor wie',
    who: [['Burgers & slachtoffers', 'Een kanaal dat zonder netwerk blijft werken. Niemand staat als slachtoffer zonder bevestiging.'], ['Coordinatoren', 'Een operationeel beeld per verdieping en per trein, en ondertekende gerichte waarschuwingen.'], ['Politie & veiligheidsdiensten', 'Verifieerbare institutionele bewijzen en interne kanalen per organisatie.'], ['Hulpdiensten', 'Gestructureerde CAP-meldingen naar de meldkamer, met audittrail.'], ['Overheden', 'Continuïteit tot EUCCS, een soevereine relay en controleerbare open source.'], ['Investeerders', 'Een moeilijk te kopiëren kern, met inkomsten uit institutionele licenties, integratie en kits.']],
    vT: 'Machinaal geverifieerd', vCore: 'kerntests', vE2e: 'end-to-end-controles met het netwerk uitgeschakeld', vRelay: 'relay-tests',
    next: 'Volgende fase: veldproeven met echte telefoons en reddingsteams, een onafhankelijke beveiligingsaudit en certificering voor overheidsaanbestedingen.',
    research: 'Analyse van overheidsaanbestedingen en het gat (met bronnen)',
  },
} as const;

export default function SendaHome({ locale }: { locale: Locale }) {
  const c = C[locale] ?? C.en;
  const p = readProof();
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

      {/* ESPECIAL INFORMATIVO / BREAKING NEWS SPECIAL */}
      <div className="sh-broadcast" id="telediario">
        <div className="sh-broadcast-head">
          <span className="sh-broadcast-badge"><i aria-hidden="true"/> EN DIRECTO · LIVE · 20:11 UTC</span>
          <span className="sh-broadcast-meta">{c.broadcastMeta}</span>
        </div>
        <h2 className="sh-h2" style={{ marginTop: '6px' }}>{c.broadcastT}</h2>
        <video
          id="senda-m95-broadcast-video"
          controls
          preload="metadata"
          playsInline
          poster="/media/m95/senda-m95-broadcast-special-poster.jpg"
          aria-label={c.broadcastT}
        >
          <source src={`/media/m95/senda-m95-broadcast-special-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
          <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-broadcast-special-es.vtt" default={locale === 'es'}/>
          <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-broadcast-special-en.vtt" default={locale === 'en'}/>
          <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-broadcast-special-nl.vtt" default={locale === 'nl'}/>
        </video>
        <p className="sh-note">{c.broadcastNote}</p>
        <p className="sh-note">
          <a href="/media/m95/senda-m95-broadcast-special-es.mp4">{c.broadcastVoiceEs} (MP4)</a> ·{' '}
          <a href="/media/m95/senda-m95-broadcast-special-en.mp4">{c.broadcastVoiceEn} (MP4)</a>
        </p>

        {/* NUEVO GRAN TELEDIARIO DE INNOVACIÓN */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <div className="sh-broadcast-head">
            <span className="sh-broadcast-badge" style={{ background: '#0284c7', borderColor: '#38bdf8' }}><i aria-hidden="true"/> BREAKTHROUGH 2026 · RADAR CIVIL ANTIDRÓN</span>
            <span className="sh-broadcast-meta">{c.breakthroughMeta}</span>
          </div>
          <h2 className="sh-h2" style={{ marginTop: '6px' }}>{c.breakthroughT}</h2>
          <video
            id="senda-m95-session-breakthrough-video"
            controls
            preload="metadata"
            playsInline
            poster="/media/m95/senda-m95-session-breakthrough-poster.jpg"
            aria-label={c.breakthroughT}
          >
            <source src="/media/m95/senda-m95-session-breakthrough-es.mp4" type="video/mp4"/>
            <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-session-breakthrough-es.vtt" default={locale === 'es'}/>
          </video>
          <p className="sh-note">{c.breakthroughNote}</p>
          <p className="sh-note">
            <a href="/media/m95/senda-m95-session-breakthrough-es.mp4" download>Descargar Vídeo Completo Telediario Especial de Innovación (MP4)</a>
          </p>
        </div>
      </div>

      {/* DEMOSTRACIÓN POR ROL / ROLE DEMONSTRATION SUITE */}
      <div className="sh-film" id="roles">
        <h2 className="sh-h2">{c.rolesT}</h2>
        <p className="sh-lead">{c.rolesLead}</p>
        <div className="sh-roles-grid">
          <article className="sh-role-card">
            <h3>{c.roleInvT}</h3>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-role-investor-poster.jpg"
              aria-label={c.roleInvT}
            >
              <source src={`/media/m95/senda-m95-role-investor-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-role-investor-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-role-investor-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-role-investor-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.roleInvDesc}</p>
          </article>
          <article className="sh-role-card">
            <h3>{c.roleDevT}</h3>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-role-developer-poster.jpg"
              aria-label={c.roleDevT}
            >
              <source src={`/media/m95/senda-m95-role-developer-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-role-developer-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-role-developer-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-role-developer-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.roleDevDesc}</p>
          </article>
          <article className="sh-role-card">
            <h3>{c.roleCitT}</h3>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-role-citizen-poster.jpg"
              aria-label={c.roleCitT}
            >
              <source src={`/media/m95/senda-m95-role-citizen-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-role-citizen-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-role-citizen-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-role-citizen-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.roleCitDesc}</p>
          </article>
        </div>
      </div>

      {/* REELS VERTICALES 9:16 PARA REDES SOCIALES */}
      <div className="sh-film" id="reels">
        <h2 className="sh-h2">{c.reelsT}</h2>
        <p className="sh-lead">{c.reelsLead}</p>
        <div className="sh-reels-grid">
          <article className="sh-reel-card">
            <h4>{c.reel1T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-blacksky-poster.jpg"
              aria-label={c.reel1T}
            >
              <source src={`/media/m95/senda-m95-reel-blacksky-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-blacksky-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-reel-blacksky-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-reel-blacksky-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.reel1Desc}</p>
          </article>
          <article className="sh-reel-card">
            <h4>{c.reel2T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-drones-poster.jpg"
              aria-label={c.reel2T}
            >
              <source src={`/media/m95/senda-m95-reel-drones-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-drones-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-reel-drones-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-reel-drones-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.reel2Desc}</p>
          </article>
          <article className="sh-reel-card">
            <h4>{c.reel3T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-math-poster.jpg"
              aria-label={c.reel3T}
            >
              <source src={`/media/m95/senda-m95-reel-math-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-math-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-reel-math-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-reel-math-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.reel3Desc}</p>
          </article>
          <article className="sh-reel-card">
            <h4>{c.reel4T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-defense-poster.jpg"
              aria-label={c.reel4T}
            >
              <source src={`/media/m95/senda-m95-reel-defense-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-defense-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-reel-defense-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-reel-defense-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.reel4Desc}</p>
          </article>
          <article className="sh-reel-card">
            <h4>{c.reel5T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-sentinel-survival-poster.jpg"
              aria-label={c.reel5T}
            >
              <source src="/media/m95/senda-m95-reel-sentinel-survival-es.mp4" type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-sentinel-survival-es.vtt" default={locale === 'es'}/>
            </video>
            <p>{c.reel5Desc}</p>
            <p style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
              <a href="/media/m95/senda-m95-reel-sentinel-survival-es.mp4" download>Descargar Reel 9:16 (MP4)</a>
            </p>
          </article>
        </div>
      </div>

      <div className="sh-film" id="film">
        <h2>{c.filmT}</h2>
        <video
          id="senda-m95-film-video"
          controls
          preload="metadata"
          playsInline
          poster="/media/m95/senda-m95-film-poster.jpg"
          aria-label="SENDA: when the network falls. English narration with Spanish, English and Dutch subtitles."
        >
          <source src="/media/m95/senda-m95-film-en.mp4" type="video/mp4"/>
          <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-film-es.vtt" default={locale === 'es'}/>
          <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-film-en.vtt" default={locale === 'en'}/>
          <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-film-nl.vtt" default={locale === 'nl'}/>
        </video>
        <p className="sh-note">English narration · Subtítulos: Español · English · Nederlands</p>
        <p className="sh-note">{c.filmNote}</p>
        <details className="sh-alt">
          <summary>{c.filmAlt}</summary>
          <p className="sh-note">
            <a href="/media/m95/senda-m95-90s-en.mp4">90 s (MP4)</a> ·{' '}
            <a href="/media/m95/senda-m95-60s-en.mp4">60 s (MP4)</a> ·{' '}
            <a href="/media/m95/senda-m95-30s-en.mp4">30 s (MP4)</a> ·{' '}
            <a href="/media/m95/senda-m95-vertical-45s-en.mp4">9:16 Vertical 45 s (MP4)</a> ·{' '}
            <a href="/media/senda-film-es.mp4">Archivo v5 ES (MP4)</a>
          </p>
        </details>
      </div>

      <div className="sh-film" id="ruta">
        <h2>{c.rutaT}</h2>
        <video
          id="senda-m95-ruta-video"
          controls
          preload="metadata"
          playsInline
          poster="/media/m95/senda-m95-ruta-poster.jpg"
          aria-label="SENDA protective route on the road. English narration with Spanish, English and Dutch subtitles."
        >
          <source src="/media/m95/senda-m95-ruta-en.mp4" type="video/mp4"/>
          <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-ruta-es.vtt" default={locale === 'es'}/>
          <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-ruta-en.vtt" default={locale === 'en'}/>
          <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-ruta-nl.vtt" default={locale === 'nl'}/>
        </video>
        <p className="sh-note">English narration · Subtítulos: Español · English · Nederlands</p>
        <p className="sh-note">{c.rutaNote}</p>
        <details className="sh-alt" lang={c.rutaAltLang}>
          <summary>{c.rutaAlt}</summary>
          <p className="sh-note">
            <a href="/media/m95/senda-m95-sim-braking-en.mp4">Sim 1: Braking</a> ·{' '}
            <a href="/media/m95/senda-m95-sim-sos-en.mp4">Sim 2: SOS DTN</a> ·{' '}
            <a href="/media/m95/senda-m95-sim-wrongway-en.mp4">Sim 3: Wrong-way</a> ·{' '}
            <a href="/media/m95/senda-m95-sim-queue-en.mp4">Sim 4: Queue LWR</a> ·{' '}
            <a href="/media/m95/senda-m95-sim-visibility-en.mp4">Sim 5: Visibility</a> ·{' '}
            <a href="/media/m95/senda-m95-sim-proof-en.mp4">Sim 6: PCI Proof</a> ·{' '}
            <a href="/media/senda-ruta-es.mp4">Archivo v5 ES (MP4)</a>
          </p>
        </details>
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
