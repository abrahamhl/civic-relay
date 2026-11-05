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
    { t: 'horas antes', need: ['avisar'], modules: ['wildfire', 'blackout'], do: 'Avisar antes de que caiga la antena del pueblo' },
    { t: 'durante', need: ['comunicar'], modules: ['bearers', 'voice-mesh'], do: 'Seguir comunicados cuando cae la red' },
  ] },
  ferroviario: { name: 'Accidente ferroviario', phases: [
    { t: 'prevención', need: ['detectar'], modules: ['rail-watch'], do: 'Patrones previos en datos que ya existen' },
    { t: '0–5 min', need: ['avisar', 'comunicar'], modules: ['rail-incident', 'triage'], do: 'Impacto detectado por los móviles y aviso automático' },
  ] },
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
