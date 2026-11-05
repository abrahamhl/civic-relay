/**
 * SENDA · Arquitectura multiplataforma: dónde corre SENDA, con qué permiso y qué hace en cada catástrofe.
 *
 * Principio de despliegue: el MISMO núcleo (JavaScript estándar, sin dependencias) corre en el navegador
 * del móvil, en un ordenador de coordinación, en un servidor (relé), en el ordenador de a bordo de un dron
 * o de un vehículo; los formatos de trama se replican en Java (Android) y C++ (ESP32) con vectores de
 * prueba comunes. Cada integración externa declara su MODO DE ACCESO:
 *   PASIVO   → legal hoy sin pedir permiso: datos abiertos, recepción de emisiones públicas, marcas
 *              visibles (aerogeneradores, antenas), sensores propios del usuario.
 *   CONVENIO → preparado, pero se activa solo con acuerdo, licencia o clave del titular.
 *   NUNCA    → fuera de alcance por diseño: controlar sistemas ajenos, interrogar activamente
 *              infraestructura ajena, interceptar comunicaciones o emitir sin licencia.
 * Así SENDA usa todo lo disponible desde el primer día y queda listo para ampliar cuando haya acceso.
 */

export const ACCESS = Object.freeze({ PASIVO: 'Legal hoy, sin permiso', CONVENIO: 'Preparado; requiere acuerdo, licencia o clave', NUNCA: 'Fuera de alcance por diseño' });
export const ROLES = Object.freeze({ comunicar: 'Mover mensajes y voz', localizar: 'Saber dónde está cada persona', detectar: 'Detectar personas o peligros', coordinar: 'Ver el conjunto y decidir', avisar: 'Avisar a tiempo a quien está en riesgo', energia: 'Seguir funcionando sin red eléctrica' });

/** Plataformas donde corre SENDA (estado honesto). */
export const PLATFORMS = Object.freeze([
  { id: 'movil-web', name: 'Cualquier móvil (app web)', runtime: 'Navegador, sin instalar; funciona sin red tras la primera visita', roles: ['comunicar', 'localizar', 'avisar'], sensors: ['micrófono', 'cámara', 'GNSS', 'acelerómetro', 'barómetro*'], status: 'HECHO' },
  { id: 'android', name: 'Móvil Android (app nativa)', runtime: 'Java/Kotlin con los mismos formatos de trama', roles: ['comunicar', 'localizar', 'detectar'], sensors: ['Bluetooth LE', 'Wi-Fi', 'Wi-Fi Aware/Direct', 'UWB*'], status: 'PARCIAL', note: 'Baliza y barrido hechos; Wi-Fi Aware/Direct pendiente' },
  { id: 'iphone', name: 'iPhone', runtime: 'App web; app nativa pendiente', roles: ['comunicar', 'localizar'], sensors: ['micrófono', 'GNSS', 'barómetro'], status: 'PARCIAL', note: 'iOS limita la emisión Bluetooth en segundo plano' },
  { id: 'pc', name: 'Ordenador de coordinación', runtime: 'Navegador (paneles de incidente, edificios, Ojo)', roles: ['coordinar'], sensors: [], status: 'HECHO' },
  { id: 'rele', name: 'Relé del organismo', runtime: 'Servidor Docker ciego al contenido', roles: ['comunicar', 'coordinar'], sensors: [], status: 'HECHO' },
  { id: 'dron', name: 'Dron con ordenador de a bordo', runtime: 'Núcleo en Node sobre ordenador de a bordo; MAVLink (ArduPilot/PX4); Remote ID', roles: ['detectar', 'comunicar', 'localizar'], sensors: ['escáner BLE/Wi-Fi', 'cámara', 'térmica*', 'punto de acceso Wi-Fi'], status: 'SIMULADO', note: 'Planificación y censo hechos; integración MAVLink pendiente' },
  { id: 'esp32', name: 'Accesorio ESP32 (sensor y pasarela)', runtime: 'C++ con la misma trama', roles: ['detectar', 'comunicar'], sensors: ['Wi-Fi CSI (respiración)', 'BLE', 'LoRa*'], status: 'PARCIAL', note: 'Barrido hecho; CSI y LoRa por montar' },
  { id: 'vehiculo', name: 'Vehículo de emergencias como pasarela', runtime: 'Ordenador de a bordo con el relé y enlace satelital', roles: ['comunicar', 'coordinar', 'energia'], sensors: ['satélite', 'LoRa', 'Wi-Fi'], status: 'HOJA_DE_RUTA' },
  { id: 'sdr', name: 'Receptor de radio definida por software', runtime: 'Ordenador con receptor USB (~30 €)', roles: ['detectar', 'avisar'], sensors: ['ADS-B', 'AIS', 'satélites meteorológicos'], status: 'HOJA_DE_RUTA', note: 'Solo recepción' },
  { id: 'coche', name: 'Coche particular (móvil en el soporte)', runtime: 'App con servicio en primer plano durante el viaje; pantalla del coche (Android Auto / CarPlay) pendiente', roles: ['avisar', 'comunicar', 'localizar'], sensors: ['GNSS', 'acelerómetro', 'Bluetooth LE'], status: 'PARCIAL', note: 'Detección y avisos hechos en el núcleo; la difusión Bluetooth entre coches necesita la app nativa (la web no puede anunciar)' },
  { id: 'via', name: 'Ferrocarril (datos del gestor)', runtime: 'Lectura de datos que ya existen', roles: ['detectar', 'avisar'], sensors: ['circuitos de vía', 'detectores en vía'], status: 'CONVENIO', note: 'Solo lectura: nunca control de la señalización' },
]);

/** Integraciones con su modo de acceso. */
export const INTEGRATIONS = Object.freeze([
  { id: 'aemet', what: 'Observación y avisos meteorológicos (AEMET OpenData)', access: 'PASIVO', note: 'Clave API gratuita; límite de peticiones por minuto' },
  { id: 'saih', what: 'Lluvia, caudales y embalses en tiempo real (SAIH de las confederaciones)', access: 'CONVENIO', note: 'Acceso por portal o convenio: pendiente de verificar en cada cuenca' },
  { id: 'cap', what: 'Avisos oficiales en formato CAP', access: 'PASIVO', note: 'Lectura; la emisión es de la autoridad' },
  { id: 'sismos', what: 'Terremotos (IGN, EMSC, USGS)', access: 'PASIVO' },
  { id: 'firms', what: 'Focos de incendio por satélite (NASA FIRMS)', access: 'PASIVO', note: 'Clave gratuita' },
  { id: 'adsb', what: 'Aeronaves (ADS-B, 1090 MHz)', access: 'PASIVO', note: 'Recepción de una emisión pública; uso y difusión pendiente de revisión jurídica' },
  { id: 'ais', what: 'Barcos (AIS)', access: 'PASIVO', note: 'Recepción; útil en maremotos y rescate marítimo' },
  { id: 'meteosat-lrpt', what: 'Imágenes de satélites meteorológicos con antena casera', access: 'PASIVO', note: 'NOAA APT terminó en 2025; Meteor-M LRPT irregular: pendiente de verificar' },
  { id: 'eolicos', what: 'Aerogeneradores, antenas y campanarios como marcas de posición conocidas', access: 'PASIVO', note: 'Triangulación visual con brújula; sin emitir nada' },
  { id: 'eolicos-scada', what: 'Telemetría de parques eólicos (viento, estado)', access: 'CONVENIO' },
  { id: 'opencellid', what: 'Mapa abierto de antenas de telefonía (OpenCellID) para la memoria de cobertura', access: 'PASIVO', note: 'Licencia CC BY-SA 4.0; clave gratuita para descargar' },
  { id: 'kiwix', what: 'Contenidos libres sin conexión para la reserva (Wikipedia temática, guías)', access: 'PASIVO', note: 'Licencias libres; tamaños por verificar en el catálogo' },
  { id: 'huellas', what: 'Huellas de cobertura de los propios usuarios (dónde hubo señal)', access: 'PASIVO', note: 'Solo con consentimiento y compartidas con los vecinos; nunca a terceros' },
  { id: 'datacast', what: 'Recarga de la reserva por difusión (canal de datos por satélite de TV o radio digital)', access: 'CONVENIO', note: 'Una vía, sin saturarse; requiere un emisor' },
  { id: 'mavlink', what: 'Drones abiertos (ArduPilot/PX4) por MAVLink', access: 'CONVENIO', note: 'Con el operador autorizado del dron' },
  { id: 'remote-id', what: 'Identificación remota de drones (Open Drone ID)', access: 'PASIVO' },
  { id: 'adif', what: 'Datos de circulación y de vía del gestor ferroviario', access: 'CONVENIO' },
  { id: 'nav-enlaces', what: 'Abrir la ruta en Waze o Google Maps con sus enlaces públicos', access: 'PASIVO', note: 'Solo abre la ruta: no lee nada de vuelta' },
  { id: 'dgt-nap', what: 'Incidencias de tráfico de la DGT en DATEX II (Punto de Acceso Nacional)', access: 'PASIVO', note: 'Datos abiertos; se guardan en la reserva antes de salir' },
  { id: 'dgt30', what: 'Enviar y recibir avisos verificados por la plataforma DGT 3.0 (la que ya lleva las balizas V16 a los navegadores)', access: 'CONVENIO', note: 'Un solo convenio llegaría a todos los navegadores que conecta la DGT' },
  { id: 'waze-cifs', what: 'Alimentar Waze con avisos confirmados (formato CIFS de Waze for Cities)', access: 'CONVENIO', note: 'El programa es para organismos públicos: a través de un socio público' },
  { id: 'waze-feed', what: 'Recibir alertas y atascos de Waze (intercambio bidireccional de Waze for Cities)', access: 'CONVENIO', note: 'Solo a través de un organismo público socio y para su territorio' },
  { id: 'ndw', what: 'Países Bajos: incidencias, obras, señales de carril y puentes de NDW en DATEX II', access: 'PASIVO', note: 'Datos abiertos; condiciones de uso exactas pendientes de verificar' },
  { id: 'camaras-abiertas', what: 'Cámaras de tráfico publicadas para reutilización (DGT, Euskadi, Cataluña)', access: 'PASIVO', note: 'Solo visibilidad y estado de la vía: nunca personas ni matrículas' },
  { id: 'camaras-sin-permiso', what: 'Cámaras privadas sin protección, agregadores tipo «Ojo de Dios», reconocimiento facial o de matrículas', access: 'NUNCA' },
  { id: 'v16-sim', what: 'Usar la tarjeta SIM o la radio de la baliza V16', access: 'NUNCA', note: 'Dispositivo homologado y cerrado: SENDA la complementa, no la toca' },
  { id: 'radares-dgt', what: 'Ubicaciones de radares fijos y de tramo que publica la DGT (vía, PK, sentido): recordar el límite y marcar puntos de riesgo', access: 'PASIVO', note: 'Avisar de su ubicación publicada es lícito' },
  { id: 'aforos-paneles-dgt', what: 'Estaciones de aforo (caudal y velocidad) y texto de los paneles de mensaje variable en DATEX II', access: 'PASIVO', note: 'Paneles publicados en el NAP; aforos en tiempo real pendientes de verificar' },
  { id: 'detectar-radar', what: 'Detectar o inhibir las emisiones de un radar, o publicar controles móviles de la policía', access: 'NUNCA', note: 'Detectores prohibidos desde 2014; inhibidores hasta 6.000 € y 6 puntos; los controles móviles, por decisión de diseño' },
  { id: 'data-act', what: 'Datos del coche por orden de su titular (Ley de Datos de la UE, art. 5)', access: 'CONVENIO', note: 'Integración con cada fabricante o plataforma multimarca; compensación razonable' },
  { id: 'dfrs', what: 'Avisos de seguridad generados por coches (DFRS / SRTI) publicados en los NAP', access: 'PASIVO', note: 'Aportar los de SENDA requiere adhesión a DFRS (reciprocidad)' },
  { id: 'reidentificar', what: 'Seguir un vehículo concreto entre cámaras o leer matrículas', access: 'NUNCA' },
  { id: 'torres-infoma', what: 'Rumbo a la columna de humo desde las torres y cámaras de vigilancia forestal (plan INFOMA)', access: 'CONVENIO', note: 'Sus imágenes van a los operadores; SENDA solo recibe el rumbo y la hora' },
  { id: 'brujula-movil', what: 'Rumbo a la columna con la brújula y el GPS del móvil de quien la ve', access: 'PASIVO', note: 'Con su toque; la foto no sale del teléfono' },
  { id: 'avisos-asem112', what: 'Estado oficial de un incendio, cortes y confinamientos publicados por el 112', access: 'PASIVO', note: 'Información pública oficial; SENDA la cita, no la reescribe' },
  { id: 'escucha-radio-emergencias', what: 'Escuchar o difundir las radios de policía, bomberos o protección civil', access: 'NUNCA', note: 'Van cifradas (TETRA); vulneraría el secreto de las comunicaciones' },
  { id: 'obd2-meteo', what: 'Presión barométrica y temperatura exterior del coche por OBD-II (PID 0x33 y 0x46) con el permiso de su conductor', access: 'PASIVO', note: 'Lectura local del adaptador del propio usuario; solo salen valores anónimos (k ≥ 5)' },
  { id: 'anemometria-flota', what: 'Viento a lo largo de la vía estimado con la deceleración en rueda libre de muchos coches', access: 'PASIVO', note: 'Necesita CdA y rodadura calibrados por modelo de coche; por Ley de Datos, más preciso' },
  { id: 'dashcam-propia', what: 'Cámara del salpicadero del propio usuario (Wi-Fi local): humo, visibilidad y llama analizados en el teléfono', access: 'PASIVO', note: 'La imagen no sale del teléfono; nunca matrículas ni caras' },
  { id: 'camaras-privadas-cedidas', what: 'Cámaras de seguridad privadas que su titular cede expresamente para emergencias (rumbo y parpadeo de llama, nunca la imagen)', access: 'CONVENIO', note: 'Alta voluntaria y revocable del titular; distinto de las cámaras abiertas sin permiso, que son NUNCA' },
  { id: 'modelos-meteo-abiertos', what: 'Modelos y observaciones abiertos: NOAA GFS, Copernicus (DEM, Sentinel-2, EFFIS), AEMET OpenData y KNMI Data Platform (CC BY 4.0)', access: 'PASIVO', note: 'Se descargan en el relé y se guardan por zona para trabajar sin red' },
  { id: 'adsb-recepcion', what: 'Posición de aviones y helicópteros de extinción por sus emisiones ADS-B (solo recepción) para modelar estelas y descargas', access: 'PASIVO', note: 'Solo agregados para el modelo; no se publican trayectorias. Marco legal pendiente de verificar por país' },
  { id: 'c-its-denm', what: 'Avisos de vehículos C-ITS (DENM de la ETSI): obras, peligros y meteorología adversa', access: 'CONVENIO', note: 'Requiere la infraestructura de certificados de la UE (CCMS) y un receptor ITS-G5 o C-V2X' },
  { id: 'linea-017', what: 'Derivar incidentes de ciberseguridad (estafas y suplantaciones de alertas) a la línea 017 de INCIBE', access: 'PASIVO', note: 'Solo informa y enlaza; SENDA no atiende el incidente' },
  { id: 'burgernet', what: 'Burgernet (Países Bajos): ciudadanos que ayudan a la policía en búsquedas locales', access: 'CONVENIO', note: 'Programa de la policía neerlandesa; integración solo por acuerdo' },
  { id: 'natuurbrandrisico', what: 'Fases de riesgo de incendio forestal publicadas en Países Bajos (natuurbrandrisico.nl)', access: 'PASIVO', note: 'Información pública de las regiones de seguridad' },
  { id: 'drones-sobre-incendio', what: 'Volar drones propios sobre un incendio activo', access: 'NUNCA', note: 'Sin autorización de la dirección de extinción pone en peligro a los medios aéreos' },
  { id: 'leer-navegadores', what: 'Leer la ruta o las alertas de Waze o Google Maps fuera de sus programas oficiales', access: 'NUNCA' },
  { id: 'iridium', what: 'Mensajes por satélite Iridium (módulo SBD)', access: 'CONVENIO', note: 'Contrato de servicio' },
  { id: 'scada-ajeno', what: 'Interrogar o controlar sistemas industriales ajenos', access: 'NUNCA' },
  { id: 'interceptar', what: 'Interceptar comunicaciones de terceros', access: 'NUNCA' },
  { id: 'emitir-sin-licencia', what: 'Emitir en bandas sin licencia o con potencia no permitida', access: 'NUNCA' },
]);

/**
 * Hechos reales que guían el diseño (con fuente). Números solo cuando la fuente es firme.
 */
export const EVENTS = Object.freeze([
  { id: 'dana-2024', where: 'Valencia (España)', when: '29-10-2024', what: 'Riada por DANA: lluvia extrema aguas arriba y poca lluvia en los pueblos inundados', toll: '224 fallecidos según el último recuento oficial publicado (CID)', lesson: 'El agua llega desde donde llueve: avisar por la subida aguas arriba, no por la lluvia local', modules: ['flood-watch'], source: 'Centro de Integración de Datos (CID), recogido por la prensa' },
  { id: 'apagon-2025', where: 'Península Ibérica', when: '28-04-2025', what: 'Apagón eléctrico: la red móvil cayó al agotarse las baterías de las antenas', lesson: 'Prever cuándo cae cada antena y colocar pasarelas antes', modules: ['blackout', 'bearers'] },
  { id: 'adamuz-2026', where: 'Adamuz, Córdoba (España)', when: '2026', what: 'Accidente con dos trenes', lesson: 'Reconocer rápido el segundo tren y vigilar la vía con datos que ya existen', modules: ['rail-incident', 'rail-watch'] },
  { id: 'tempi-2023', where: 'Tempi (Grecia)', when: '28-02-2023', what: 'Choque frontal de dos trenes en la misma vía', toll: '57 fallecidos', lesson: 'Detectar dos trenes en sentidos opuestos sobre la misma vía con fuentes independientes (incluidos los móviles de los viajeros), como aviso complementario al gestor', modules: ['rail-watch'], source: 'Wikipedia (Tempi train crash)' },
  { id: 'ahr-2021', where: 'Valle del Ahr (Alemania)', when: '14/15-07-2021', what: 'Riada nocturna', toll: '190 fallecidos en Alemania, 134 en el valle del Ahr', lesson: 'De noche el aviso tiene que despertar a la gente y llegar sin red', modules: ['flood-watch', 'bearers'], source: 'Natural Hazards and Earth System Sciences, 2025' },
  { id: 'turquia-2023', where: 'Turquía y Siria', when: '06-02-2023', what: 'Terremotos de magnitud 7,8 y 7,5', toll: 'más de 50 000 fallecidos', lesson: 'Comunicaciones caídas y miles de edificios: priorizar por evidencia y buscar con todos los sentidos', modules: ['seismic', 'rf-census', 'senses', 'occupancy'] },
  { id: 'carreteras-2025', where: 'España (vías interurbanas)', when: '2025', what: 'Siniestralidad en carretera', toll: '1.119 fallecidos a 24 horas (DGT, balance 2025); en 2024, el 72 % en vías convencionales', lesson: 'En la carretera de un carril por sentido hay menos tráfico que vea el accidente y peor cobertura: el aviso tiene que salir solo y viajar con los coches que pasan', modules: ['road-guard', 'rail-incident', 'triage'], source: 'DGT, notas de prensa de 08-01-2026 y de cierre de 2024' },
  { id: 'valdeiglesias-2026', where: 'San Martín de Valdeiglesias (Madrid) y Almorox (Toledo)', when: '23-07-2026', what: 'Incendio forestal iniciado por un coche en llamas en la calzada de la M-501 (km 57), que acabó uniéndose al de Almorox', toll: 'Almorox, a 24-07: 890 ha, 700 personas evacuadas y 26 viviendas destruidas (cifras parciales; balance oficial pendiente)', lesson: 'El primer aviso puede salir de la carretera: un coche ardiendo junto al monte con calor, sequedad y viento es un inicio de incendio, y los conductores que lo ven pueden situar la columna con la brújula antes de que llegue el satélite', modules: ['fire-watch', 'road-guard', 'wildfire', 'bearers'], source: 'Guardia Civil vía hibridosyelectricos.com; moncloa.com 24-07-2026; ASEM 112 (comunidad.madrid)' },
  { id: 'lorca-2011', where: 'Lorca, Murcia (España)', when: '11-05-2011', what: 'Terremoto moderado con caída de elementos de fachada', toll: '9 fallecidos', lesson: 'Un sismo moderado basta: avisar de los segundos que quedan y alejarse de fachadas', modules: ['seismic'] },
  { id: 'lisboa-1755', where: 'Golfo de Cádiz y Lisboa', when: '01-11-1755', what: 'Terremoto y maremoto que alcanzó la costa atlántica andaluza', lesson: 'El tiempo de llegada del maremoto se calcula con la profundidad del mar: evacuar en vertical si no da tiempo', modules: ['flood-watch'] },
]);

/** Planes por escenario: fases, papeles necesarios y módulos de SENDA. */
export const PLAYBOOKS = Object.freeze({
  terremoto: { name: 'Terremoto', phases: [
    { t: '0–60 s', need: ['avisar'], modules: ['seismic'], do: 'Detectar la onda P con muchos móviles y avisar de los segundos que quedan' },
    { t: '1–30 min', need: ['comunicar', 'localizar'], modules: ['bearers', 'voice-mesh', 'triage'], do: 'SOS y triaje sin red; cadenas de voz en edificios' },
    { t: '30 min–6 h', need: ['detectar', 'coordinar'], modules: ['rf-census', 'house-sweep', 'senses', 'occupancy'], do: 'Dron casa por casa, escucha de golpes y prioridad por vivienda' },
  ] },
  maremoto: { name: 'Maremoto', phases: [
    { t: '0–5 min', need: ['avisar'], modules: ['seismic', 'flood-watch'], do: 'Estimar el tiempo de llegada a cada costa con la profundidad del mar' },
    { t: '5–40 min', need: ['avisar', 'localizar'], modules: ['flood-watch', 'geo-offline'], do: 'Evacuar a lo alto: ruta al punto seguro más cercano sin red' },
    { t: 'después', need: ['comunicar', 'detectar'], modules: ['bearers', 'senses'], do: 'Buscar personas y reconectar la costa' },
  ] },
  riada: { name: 'Riada', phases: [
    { t: 'horas antes', need: ['avisar'], modules: ['flood-watch'], do: 'Vigilar la subida aguas arriba y avisar a quien está aguas abajo aunque allí no llueva' },
    { t: 'durante', need: ['comunicar', 'localizar'], modules: ['bearers', 'triage', 'geo-offline'], do: 'Subir a lo alto; SOS con planta y posición' },
    { t: 'después', need: ['detectar', 'coordinar'], modules: ['house-sweep', 'occupancy'], do: 'Barrido casa por casa y desaparecidos sin confirmar' },
  ] },
  incendio: { name: 'Incendio forestal', phases: [
    { t: 'primeros minutos', need: ['detectar', 'localizar'], modules: ['fire-watch'], do: 'Torres, cámaras y la brújula de los móviles que ven la columna la sitúan en el mapa; un coche en llamas junto al monte se avisa al 112 al momento' },
    { t: 'horas antes', need: ['avisar'], modules: ['wildfire', 'fire-watch', 'blackout'], do: 'Perímetro y avance por satélite, meteorología del incendio y aviso antes de que caiga la antena del pueblo' },
    { t: 'en la carretera', need: ['avisar'], modules: ['fire-watch', 'road-guard'], do: 'Tramos que el fuego alcanzará: corte propuesto, aviso a los coches que se acercan y velocidad segura con humo' },
    { t: 'durante', need: ['comunicar'], modules: ['bearers', 'voice-mesh'], do: 'Seguir comunicados cuando cae la red' },
  ], guard: 'SENDA no dirige la extinción ni declara la situación operativa: propone datos y avisos al centro de mando. Nunca escucha las radios de emergencia ni vuela drones sobre el incendio' },
  ferroviario: { name: 'Accidente ferroviario', phases: [
    { t: 'prevención', need: ['detectar'], modules: ['rail-watch'], do: 'Patrones previos en datos que ya existen' },
    { t: '0–5 min', need: ['avisar', 'comunicar'], modules: ['rail-incident', 'triage'], do: 'Impacto detectado por los móviles y aviso automático' },
  ] },
  carretera: { name: 'Accidente de carretera', phases: [
    { t: 'antes de salir', need: ['localizar'], modules: ['road-guard', 'net-reserve'], do: 'Pasillo de mapas de la ruta, PK, incidencias de la DGT y referencias visibles guardados' },
    { t: 'en ruta', need: ['avisar'], modules: ['road-guard'], do: 'Frenada brusca delante: aviso por voz a los de detrás que no la ven' },
    { t: '0–2 min', need: ['avisar', 'comunicar'], modules: ['road-guard', 'rail-incident', 'bearers'], do: 'Choque detectado, cuenta atrás y SOS con PK; sin cobertura, lo llevan los coches que pasan' },
    { t: 'hasta que llegan', need: ['coordinar'], modules: ['road-guard', 'triage'], do: 'Una persona coordina la conducta PAS y el triaje; traspaso al servicio verificado' },
  ], guard: 'No sustituye la atención del conductor, la distancia de seguridad, el eCall ni el 112. Con el coche en marcha, solo avisos por voz: no se toca el móvil' },
  monte: { name: 'Perdido en el monte', phases: [
    { t: 'antes de salir', need: ['localizar'], modules: ['geo-offline'], do: 'Mapas y ventanas de satélite descargados' },
    { t: 'perdido', need: ['localizar', 'comunicar'], modules: ['geo-offline', 'orbital', 'bearers'], do: 'Posición por marcas conocidas y pasos; SOS por satélite cuando pase' },
  ] },
  victimas: { name: 'Múltiples víctimas o evacuación de heridos', phases: [
    { t: '0–10 min', need: ['localizar', 'comunicar'], modules: ['triage'], do: 'Triaje por cualquier persona y recuento por colores' },
    { t: '10–60 min', need: ['coordinar'], modules: ['triage', 'occupancy'], do: 'Qué servicio necesita cada caso y a dónde se evacua' },
  ] },
  sinred: { name: 'Días sin red (apagón prolongado)', phases: [
    { t: 'antes', need: ['comunicar', 'localizar'], modules: ['net-reserve', 'swarm-cache', 'coverage-memory'], do: 'Llenar la reserva con Wi-Fi y cargando; repartir el paquete común entre vecinos; recordar dónde hay señal' },
    { t: 'sin red', need: ['comunicar', 'localizar'], modules: ['net-reserve', 'swarm-cache', 'bundle', 'voice-mesh'], do: 'Responder desde la reserva y la biblioteca de vecinos; encolar intenciones; hablar por la malla local' },
    { t: 'ventana', need: ['comunicar'], modules: ['coverage-memory', 'net-reserve', 'orbital'], do: 'Ir al punto de rebote o esperar al satélite; vaciar la cola (SOS primero) y refrescar lo urgente' },
  ] },
  conflicto: { name: 'Zona de conflicto o evacuación de civiles', phases: [
    { t: 'siempre', need: ['comunicar'], modules: ['bearers', 'voice-mesh'], do: 'Comunicación sin infraestructura y con mínima emisión de radio' },
    { t: 'evacuación', need: ['localizar', 'coordinar'], modules: ['geo-offline', 'triage'], do: 'Rutas y puntos de reunión sin red' },
  ], guard: 'Protección de civiles únicamente: el censo radio y la localización no se activan en zonas de conflicto para no exponer a nadie' },
});

/**
 * Qué plataforma cubre cada papel en cada fase con lo que hay disponible; dice también qué falta.
 */
export function planDeployment(playbookId, availableIds) {
  const pb = PLAYBOOKS[playbookId]; if (!pb) throw new Error(`plan desconocido: ${playbookId}`);
  const avail = PLATFORMS.filter((p) => availableIds.includes(p.id));
  const phases = pb.phases.map((ph) => {
    const cover = Object.fromEntries(ph.need.map((r) => [r, avail.filter((p) => p.roles.includes(r)).map((p) => p.id)]));
    return { ...ph, cover, gaps: ph.need.filter((r) => cover[r].length === 0) };
  });
  return { id: playbookId, name: pb.name, guard: pb.guard ?? null, phases, gaps: [...new Set(phases.flatMap((p) => p.gaps))] };
}

/**
 * Perfiles de país para exportar SENDA. Lo común en la UE: el 112 y la información de tráfico en
 * DATEX II en un Punto de Acceso Nacional (Reglamento Delegado (UE) 2022/670). Lo que cambia: el canal
 * oficial de alertas, las señales de carril, la baliza V16 y la política de cámaras.
 */
export const COUNTRIES = Object.freeze({
  ES: { name: 'España', lang: 'es', emergency: '112', officialAlert: 'ES-Alert (difusión celular)', nap: 'DGT · nap.dgt.es (DATEX II v3.6/v3.7: incidencias, paneles, ubicaciones de cámaras)', laneSignals: 'Paneles de mensaje variable de la DGT (DATEX II)', beacon: 'Baliza V16 conectada obligatoria desde el 1-1-2026 (posición a DGT 3.0)', cameras: 'DGT, Open Data Euskadi y Generalitat publican cámaras o sus ubicaciones', extra: [] },
  NL: { name: 'Países Bajos', lang: 'nl', emergency: '112', officialAlert: 'NL-Alert (difusión celular)', nap: 'NDW · Nationaal Dataportaal Wegverkeer (DATEX II: incidencias cada minuto, obras de Melvin, velocidades)', laneSignals: 'Matrixsignaalgevers: ~17.000 señales; rood kruis = carril cerrado (multa ≥ 260 €)', beacon: 'Sin baliza conectada obligatoria', cameras: 'Rijkswaterstaat no publica sus cámaras (RGPD): solo convenio', extra: ['Aperturas de más de 300 puentes móviles en tiempo real (NDW)', 'Estado de carriles de hora punta y carriles reversibles (NDW)'] },
});
/** Qué fuentes enchufar en cada país para cada pieza de SENDA, y con qué permiso. */
export function countryPlan(code) {
  const c = COUNTRIES[code]; if (!c) throw new Error(`país desconocido: ${code}`);
  const rows = [
    { piece: 'Llamar y avisar', source: `${c.emergency} y ${c.officialAlert}`, access: 'PASIVO', note: 'SENDA es un canal secundario: nunca sustituye al oficial' },
    { piece: 'Incidencias y obras en la ruta', source: c.nap, access: 'PASIVO', module: 'datex2' },
    { piece: 'Carriles cerrados', source: c.laneSignals, access: code === 'NL' ? 'PASIVO' : 'PASIVO', module: 'datex2' },
    { piece: 'Vehículo detenido', source: c.beacon, access: code === 'ES' ? 'CONVENIO' : '—', module: 'drive-cases' },
    { piece: 'Cámaras', source: c.cameras, access: code === 'NL' ? 'CONVENIO' : 'PASIVO', module: 'cameras' },
    ...c.extra.map((x) => ({ piece: 'Propio del país', source: x, access: 'PASIVO', module: 'datex2' })),
  ];
  return { code, name: c.name, lang: c.lang, rows, needsConvenio: rows.filter((r) => r.access === 'CONVENIO').map((r) => r.piece) };
}
