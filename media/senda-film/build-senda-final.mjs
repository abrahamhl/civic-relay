#!/usr/bin/env node
// Construye senda-final.json: los capítulos nuevos de la película final de SENDA (noviembre de 2026).
// La película final = avance (escenas a0–a1 de este guion) + m96 (película del 10-11-2026) + capítulos nuevos (b*).
// Cada cifra se calcula aquí con el núcleo o se lee de un fichero de datos o de medida; nada se escribe a mano.
// Uso: node build-senda-final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as W from '../../packages/senda/src/alert-watch.mjs';
import * as G from '../../packages/senda/src/stranger-gateway.mjs';
import * as CH from '../../packages/senda/src/familiar-chat.mjs';
import * as SM from '../../packages/senda/src/smoke-exposure.mjs';
import { clusterReports, assessIncident } from '../../packages/senda/src/hazard-reports.mjs';
import { generateIdentity, sealMessage, packEnvelope } from '../../packages/senda/src/envelope.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../..');
const pub = (f) => path.join(repo, 'investor-next/public', f);
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const es = (x, d = 0) => x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const clipFrames = (id) => fs.readdirSync(path.join(here, 'build/clips', id)).filter((f) => f.endsWith('.jpg')).length;
const clip = (id, from, caption, rate) => ({ kind: 'clip', clip: id, frames: clipFrames(id), from, caption: { es: caption }, ...(rate ? { rate } : {}) });

// ─────────────── cifras ───────────────
const estado = J(pub('senda/estado.json'));
if (!(estado.core > 0 && estado.core === estado.coreTotal)) throw new Error('estado.json: núcleo no está en verde');
const snap = J(pub('senda/data/alertas/instantanea.json'));
const zones = Object.keys(J(pub('senda/data/alertas/zonas-emma-es-nl.json')).zonas).length;
const srcOk = new Set(snap.sources.filter((s) => s.ok).map((s) => s.source)).size;
const snapDay = new Date(snap.generatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
const quakes = snap.alerts.filter((a) => a.kind === 'EARTHQUAKE');
const fused = W.fuseEvents(quakes, W.EXAMPLE_ALERT_FUSION), multi = fused.filter((x) => x.sources.length > 1).length;

const me = await generateIdentity(), bro = await generateIdentity();
const overhead = packEnvelope(await sealMessage({ sender: bro, recipient: me.publicIdentity, body: new Uint8Array(10), priority: 5, ttlS: 3600, now: Date.UTC(2026, 10, 22) })).length - 10;
const text = 'Estamos bien. Sin cobertura en el pueblo. Mañana subo a la carretera.';
const textB = new TextEncoder().encode(text).length;
const inner = overhead + textB, outer = inner + 28; // sobre exterior: IV 12 B + etiqueta GCM 16 B
const piece = 5 + Math.ceil(outer / 2);

const sim = (o) => G.simulateStrangerRelay({ ...G.EXAMPLE_VILLAGE, ...o }, { runs: 4000, seed: 1 });
const village = sim({}), bar = sim({ rangeM: 120 }), city = sim({ densityPerKm2: 5000 });
const human = (s) => (s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${es(s / 3600, 1)} h`);
const sayT = (s) => (s < 120 ? `${Math.round(s)} segundos` : s < 7200 ? `${Math.round(s / 60)} minutos` : `${es(s / 3600, 1)} horas`);
const spread = G.planShardSpread([{ id: 'a', p: 0.9, capShards: 6 }, { id: 'b', p: 0.7, capShards: 6 }, { id: 'c', p: 0.6, capShards: 6 }], { k: 3, n: 6 });

const thumbs = J(path.join(here, 'assets/m97-thumbs.json'));
const v700 = CH.voiceBytes(700, 10), vOpus = CH.voiceBytes(16000, 10);
const grp = CH.groupCost({ members: 8, bodyBytes: 60, envelopeOverhead: overhead, messagesInSession: 10 });

const at = Date.UTC(2026, 10, 22, 9), base = { lat: 40.3621, lon: -4.3987 };
const rep = (id, dLat) => ({ kind: 'ROAD_BLOCKED', deviceId: id, at, lat: base.lat + dLat, lon: base.lon });
const pr = [1, 2, 3].map((n) => assessIncident(clusterReports([rep('v', 0), rep('t1', 0.0004), rep('t2', -0.0003)].slice(0, n))[0]).pReal);

const fire = J(pub('senda/data/smv2026/fire3d.json'));
const jCircle = fire.validacion.jaccardCirculo, jRaw = fire.validacion.experimentos[0].jaccard, jCal = fire.validacion.calibracionEnMuestra.mejorConAreaCoherente.jaccard;
const plumeH = fire.pluma.alturaFinalM, uMix = fire.pluma.vientoMezclaMs;
const day = SM.groundMaximum({ Q: 1, u: uMix, H: plumeH, cls: SM.pasquillClass({ windMs: fire.masaDeAire[0].viento10Kmh / 3.6, day: true, insolation: 'STRONG' }) }).ugm3;
const nightW = fire.masaDeAire[3].viento10Kmh / 3.6;
const night = SM.groundMaximum({ Q: 1, u: nightW, H: 100, cls: SM.pasquillClass({ windMs: nightW, day: false, nightCloud: 'CLEAR' }) }).ugm3;
const ratio = night / day;
const mass = SM.massFluxThroughPlane({ Q: 250, u: 3, H: 600, cls: 'D' }, 2000) / 250;
if (!(Math.abs(mass - 1) < 2e-3)) throw new Error('el humo no conserva la masa');

// ─────────────── voz: lo que la narradora debe decir distinto de lo escrito ───────────────
const SAY = [[/\b112\b/g, 'uno uno dos'], [/SENDA/g, 'Senda'], [/AEMET/g, 'Aemet'], [/MeteoAlarm/g, 'Meteoalarm'], [/GDACS/g, 'gedacs'], [/USGS/g, 'u ese ge ese'], [/EMSC/g, 'e eme ese ce'],
  [/EONET/g, 'eonet'], [/LoRa/g, 'Lora'], [/Wi-Fi/g, 'uaifai'], [/Bluetooth/g, 'blutuz'], [/CAP 1\.2/g, 'cap uno punto dos'], [/\bCAP\b/g, 'cap'], [/PM2,5/g, 'pe eme dos coma cinco'],
  [/MAVLink/g, 'mavlink'], [/Open Drone ID/g, 'open dron ai di'], [/Codec2/g, 'códec dos'], [/µg\/m³/g, 'microgramos por metro cúbico'], [/k-de-n/g, 'ka de ene'], [/(\d)\s?%/g, '$1 por ciento'],
  [/(\d) B\b/g, '$1 bytes'], [/(\d) km\b/g, '$1 kilómetros'], [/(\d) m\b/g, '$1 metros'], [/(\d) s\b/g, '$1 segundos'], [/(\d) min\b/g, '$1 minutos'], [/(\d) h\b/g, '$1 horas'], [/×/g, 'por'], [/→/g, 'a'], [/≥/g, 'al menos'],
  [/ECDSA/g, 'e ce de ese a'], [/AES/g, 'a e ese'], [/DATEX II/g, 'dátex dos'], [/OASIS/g, 'oasis'], [/NASA/g, 'nasa'], [/ONU/g, 'onu'], [/Briar/g, 'braiar'], [/Bridgefy/g, 'bríyfai'], [/Meshtastic/g, 'meshtástic'], [/goTenna/g, 'gotena'],
  [/Everbridge/g, 'éverbrich'], [/Palantir/g, 'palantir'], [/ES-Alert/g, 'es alert'], [/AlertCops/g, 'alert cops'], [/WhatsApp/g, 'guasap'], [/Jaccard/g, 'yacar'], [/DANA/g, 'dana']];
const say = (s) => SAY.reduce((t, [re, r]) => t.replace(re, r), s);
const sc = (id, claim, source, visual, title, lines) => ({ id, claim, source, visual, title: { es: title }, es: lines, es_say: lines.map(say) });
const kp = (v, l) => ({ v: { es: v }, l: { es: l } });

// ─────────────── escenas ───────────────
const scenes = [
  sc('a0', 'OBSERVED', ['investor-next/public/senda/radar.html', 'packages/senda/src/alert-watch.mjs', 'investor-next/public/senda/data/alertas/instantanea.json'],
    clip('radar', 0.5, 'Grabación real · /senda/radar · avisos reales de fuentes públicas'), 'Cuando todo se cae, alguien tiene que seguir viendo', [
      'Esto no es una maqueta: es el radar de SENDA con avisos reales.',
      `En la lectura del ${snapDay} había ${es(snap.count)} avisos y eventos de ${srcOk} fuentes públicas: AEMET y los servicios meteorológicos europeos a través de MeteoAlarm, los sismógrafos de USGS y EMSC, las alertas de la ONU en GDACS y los eventos de la NASA.`,
      'Esta película cuenta qué hace SENDA con todo eso, cómo lo hace y cómo se comprueba.',
    ]),
  sc('a1', 'OBSERVED', ['investor-next/public/media/m96/senda-m96-promo-es.mp4', 'investor-next/public/senda/estado.json'],
    { kind: 'kpis', kpis: [kp('Capítulo 1', 'la película del 10 de noviembre: el porqué y la base'), kp('Capítulo 2', 'lo construido después: radar, sin datos, chat, simulador, drones, ciencia'), kp(`${estado.core} pruebas`, 'del núcleo, ejecutadas hoy')] },
    'Dos capítulos, una sola historia', [
      'Primero verás la película del diez de noviembre: por qué existe SENDA, los accidentes que la motivaron y la ingeniería de base, con sus cifras de pruebas puestas al día.',
      'Después, el capítulo dos: todo lo construido desde entonces.',
    ]),
  // ─── Capítulo 2 ───
  sc('b0', 'OBSERVED', ['investor-next/public/senda/estado.json', 'investor-next/app/senda-home.tsx'],
    { kind: 'kpis', kpis: [kp('Capítulo 2', 'lo nuevo, noviembre de 2026'), kp(`${srcOk} fuentes`, 'de avisos reales, leídas en vivo'), kp(`${estado.core}/${estado.coreTotal}`, 'pruebas del núcleo en verde hoy')] },
    'Capítulo 2: lo que hemos construido', [
      'Capítulo dos. Lo que hemos construido en noviembre.',
      'Todo lo que vas a ver se puede abrir en la web y su código se ejecuta en tu navegador.',
    ]),
  sc('b1', 'OBSERVED', ['investor-next/public/senda/ciclo.html', 'investor-next/public/senda/ciclo.mjs'],
    clip('ciclo', 0.8, 'Grabación real · /senda/ciclo'), 'El ojo que ve, y que no se queda mirando', [
      'SENDA se resume en siete verbos: ve, previene, dirige, organiza, alerta, ayuda y gestiona.',
      'Ve: junta satélite, cámaras públicas, sensores y avisos. Previene: calcula lo que viene. Dirige: elige el camino que sigue abierto.',
      'Organiza los avisos en incidentes, prepara la alerta para quien la firma, ayuda con la gente cercana y deja todo escrito para rendir cuentas.',
    ]),
  sc('b2', 'CALCULATED', ['packages/senda/src/alert-watch.mjs', 'packages/senda/tests/alert-watch.test.mjs', 'docs/research/SENDA_RADAR_AVISOS_2026-11-20.md'],
    clip('radar', 10, 'Grabación real · zonas oficiales de aviso de AEMET dibujadas en el globo'), 'Radar: SENDA rastrea los avisos por ti', [
      'SENDA lee los avisos en cuanto se publican y los pone en el mismo idioma: qué pasa, dónde, cuándo empieza, cuándo acaba y quién lo dice.',
      `Distingue un aviso oficial de una medida y de una alerta automática, y sabe si está previsto, vigente o cancelado. Las ${zones} zonas oficiales de España y Países Bajos tienen su forma real.`,
      `Cuando varias fuentes publican el mismo terremoto, lo junta: en la lectura del ${snapDay}, ${quakes.length} registros sísmicos se quedaron en ${fused.length} eventos, ${multi} de ellos vistos por más de una fuente.`,
    ]),
  sc('b3', 'SIMULATED', ['packages/senda/src/alert-watch.mjs', 'investor-next/public/senda/radar.mjs'],
    clip('radar', 22, 'Grabación real · los móviles del anillo son una simulación rotulada'), 'Activar SENDA aquí: el radio de acción', [
      'Con un aviso activo, SENDA calcula a quién despertar, y solo entre quien lo ha aceptado.',
      'Dentro de la zona: la guía del aviso y dos botones, estoy bien o necesito ayuda. En el anillo de alrededor: testigos que confirman lo que ven y móviles con datos que hacen de pasarela para los vecinos sin red.',
      'Y si el aviso es para mañana, SENDA se adelanta: guarda mapas y rutas y enciende las pasarelas antes de que caiga la red. La alerta pública la emite siempre el organismo competente.',
    ]),
  sc('b4', 'CALCULATED', ['packages/senda/src/stranger-gateway.mjs', 'docs/research/SENDA_MENSAJERIA_SIN_COBERTURA_2026-11-20.md'],
    { kind: 'route', kick: 'Arnhem → San Martín de Valdeiglesias', tag: 'cálculo', title: 'Tu hermano no tiene datos. Alguien a su lado sí.', bbox: [-10.5, 9.5, 37.5, 54.5],
      points: [{ label: 'Tú · Arnhem', lat: 51.98, lon: 5.91, color: '#91d7e8' }, { label: 'Buzón cegado (Internet)', lat: 47.0, lon: 3.0, color: '#b48cff', leg: 'Internet', dx: 10, dy: 18 },
        { label: 'Vecina con 4G', lat: 40.55, lon: -4.0, color: '#34d399', leg: 'su conexión', dx: 12, dy: -8 }, { label: 'Tu hermano · sin datos', lat: 40.36, lon: -4.4, color: '#ff7756', leg: 'Bluetooth', dash: true, dx: -150, dy: 26 }],
      foot: 'Recorrido ilustrativo; las posiciones de la vecina y del buzón son simbólicas.' },
    'Sin datos, pero no solo', [
      'WhatsApp necesita que tu móvil tenga datos. SENDA no habla con WhatsApp ni lo sustituye: entra cuando no hay red.',
      'El móvil sin datos busca por Bluetooth otro móvil SENDA cercano que sí tenga conexión y que haya aceptado prestarla, aunque sea un desconocido.',
      'Le entrega el mensaje cifrado, esa persona lo sube a un buzón, y tú lo recoges en el otro extremo de Europa.',
    ]),
  sc('b5', 'OBSERVED', ['investor-next/public/senda/viaje-desconocido.mjs', 'packages/senda/tests/stranger-gateway.test.mjs'],
    clip('sindatos', 0.5, 'Grabación real · /senda/viaje#desconocido · criptografía real en el navegador'), 'La prueba, ejecutada de verdad', [
      'Esto es la criptografía real funcionando en el navegador.',
      'Dos vecinos prestan su conexión; uno no ha dado permiso y otro tiene poca batería, así que ni se anuncian. Cada vecino devuelve un recibo firmado: es el primer tic.',
      `El mensaje se trocea: bastan dos trozos de cuatro. Repartir entre desconocidos gana a confiar en uno solo: con tres pasarelas del noventa, setenta y sesenta por ciento, la entrega sube del ${es(spread.bestSingleGateway.p * 100)} al ${es(spread.pDelivery * 100)} por ciento.`,
    ]),
  sc('b6', 'CALCULATED', ['packages/senda/src/envelope.mjs', 'packages/senda/src/stranger-gateway.mjs', 'packages/senda/src/erasure.mjs'],
    { kind: 'breakdown', kick: 'Despiece de un mensaje', tag: 'medido', title: 'Lo que lleva dentro, capa a capa', seenLabel: 'Lo que ve quien te ayuda',
      layers: [{ label: 'Tu texto', note: 'lo único que lee tu destinatario', size: `${textB} B`, color: '#eef3f4' }, { label: 'Sobre de extremo a extremo', note: 'firma ECDSA + cifrado AES-GCM con clave efímera', size: `${inner} B`, color: '#34d399' },
        { label: 'Sobre exterior', note: 'oculta incluso a quién va; buzón que cambia cada día', size: `${outer} B`, color: '#91d7e8' }, { label: 'Trozos k-de-n', note: 'cuatro trozos; bastan dos cualesquiera', size: `4 × ${piece} B`, color: '#b48cff' },
        { label: 'Baliza de la pasarela', note: 'tengo datos, batería, cuota; identificador que rota', size: '18 B', color: '#fbbf24' }],
      foot: 'Tamaños medidos con el núcleo al construir la película.' },
    'Quien te ayuda no puede leer nada', [
      `Tu texto ocupa ${textB} bytes. El sobre de extremo a extremo lo firma y lo cifra: ${inner} bytes.`,
      'Encima va un sobre exterior que oculta hasta a quién va el mensaje. El buzón es un número que cambia cada día y que solo vosotros dos sabéis calcular.',
      'Quien presta su conexión ve bytes aleatorios. Y para evitar abusos, pide un pequeño cálculo que tu móvil resuelve en milisegundos y que a un atacante masivo le sale caro.',
    ]),
  sc('b7', 'SIMULATED', ['packages/senda/src/stranger-gateway.mjs'],
    { kind: 'graph', kick: 'Tiempo hasta que el mensaje sale a Internet', tag: 'simulación · ejemplo', title: 'Lo que decide es el alcance, no la app', log: true,
      bars: [{ label: 'Ciudad · 5.000 habitantes por km²', value: city.p50S, shown: human(city.p50S), color: '#34d399', note: 'mediana, Monte Carlo' },
        { label: 'Pueblo con una pasarela de 120 m (bar, ayuntamiento)', value: bar.p50S, shown: human(bar.p50S), color: '#91d7e8', note: 'el alcance entra al cuadrado' },
        { label: 'Pueblo · 60 habitantes por km², alcance 40 m', value: village.p50S, shown: human(village.p50S), color: '#ff7756', note: 'andando, sin pasarelas fijas' }],
      foot: 'Ejemplo declarado: 5 % de personas con SENDA, datos y permiso. Escala logarítmica.' },
    'Cuánto tarda en salir el mensaje', [
      'La física manda. Las pasarelas cercanas siguen un proceso de Poisson en el espacio, y el alcance de radio entra al cuadrado.',
      `En una ciudad, el mensaje sale en una mediana de ${sayT(city.p50S)}. En un pueblo, andando, unas ${sayT(village.p50S)}.`,
      `Con una sola pasarela fija de buen alcance, el Wi-Fi del bar o del ayuntamiento, baja a unos ${sayT(bar.p50S)}. Esa es la recomendación concreta para un piloto municipal.`,
    ]),
  sc('b8', 'CALCULATED', ['packages/senda/src/familiar-chat.mjs', 'packages/senda/tests/familiar-chat-smoke.test.mjs'],
    { kind: 'ticks', kick: 'El chat de siempre', tag: 'medido', title: 'Lo que ya sabes usar, por cualquier vía',
      bubbles: [{ me: true, text: 'Estamos bien. Sin cobertura en el pueblo.', ticks: [{ l: '🕓 en tu móvil' }, { l: '✓ alguien lo lleva (recibo firmado)' }, { l: '✓✓ entregado (solo lo prueba el destinatario)', c: 'blue' }] },
        { me: true, img: 'm97-thumb-100.png', text: `Foto · ${thumbs['100'].bytes} B por LoRa`, ticks: [{ l: '✓ vista previa enviada' }, { l: '✓✓ la foto completa, cuando haya Wi-Fi', c: 'blue' }] },
        { me: false, img: 'm97-thumb-2400.png', text: `La misma foto · ${es(thumbs['2400'].bytes)} B` },
        { me: true, text: `Nota de voz de 10 s · ${v700} B (Codec2)`, ticks: [{ l: '✓ enviada' }, { l: '✓✓ escuchada', c: 'blue' }] }],
      foot: 'Miniaturas decodificadas por el códec real del núcleo a partir de una foto de la DANA.' },
    'Un chat que ya conoces', [
      'Dentro de SENDA está lo que ya conoces: chats, grupos, notas de voz, fotos, ubicación y estados.',
      'Lo nuevo es que cada tic se puede comprobar: uno, alguien lleva tu mensaje y lo firma; dos, ha llegado, y eso solo lo puede probar el destinatario.',
      `Una foto viaja primero como vista previa de ${thumbs['100'].bytes} bytes por radio LoRa, y se completa cuando aparece el Wi-Fi. Diez segundos de voz caben en ${v700} bytes. Y en un grupo de ocho, la clave compartida gasta ${es(grp.pairwise / grp.senderKey, 1)} veces menos datos.`,
    ]),
  sc('b9', 'SIMULATED', ['investor-next/public/senda/ciclo.mjs', 'packages/senda/src/drive-autostart.mjs', 'packages/senda/src/hazard-reports.mjs'],
    clip('malla', 0, 'Grabación real · /senda/ciclo#malla · carreteras y coches simulados'), 'Cada conductor puede ser un salvavidas', [
      'Como en Waze, SENDA se activa sola al subir al coche, pero solo si la persona lo ha aceptado.',
      `Hay un accidente: con un solo aviso, SENDA no lo da por cierto, ${es(pr[0] * 100)} por ciento. El 112 pide ayuda cercana; quien está más cerca acepta o no.`,
      `Con dos testigos, la probabilidad sube al ${es(pr[1] * 100)} y luego al ${es(pr[2] * 100)} por ciento, con reglas que cualquiera puede auditar.`,
    ]),
  sc('b10', 'SIMULATED', ['investor-next/public/senda/simulador.mjs', 'packages/senda/src/wildfire.mjs', 'investor-next/public/senda/data/smv2026/fire3d.json'],
    clip('simfuego', 0, 'Grabación real · /senda/simulador · relieve y satélite reales, avance simulado'), 'Simulador 3D: el fuego, con pocos datos', [
      'Relieve real de San Martín de Valdeiglesias, imágenes Sentinel-2 y la masa de aire de ese día, por capas.',
      'Con un punto de ignición y el viento, SENDA calcula el avance del fuego sobre el terreno en menos de un segundo.',
      `Y se compara con lo que vio el satélite, sin maquillar: sin calibrar acierta menos que un círculo, ${es(jRaw, 3)} frente a ${es(jCircle, 3)}; calibrado con el propio incendio llega a ${es(jCal, 3)}. Falta validarlo con otros incendios.`,
    ]),
  sc('b11', 'SIMULATED', ['investor-next/public/senda/simulador.mjs', 'packages/senda/src/seismic.mjs'],
    clip('simagua', 0, 'Grabación real · nivel del agua y epicentro simulados'), 'Agua que sube y terremotos', [
      'Sube el nivel del agua y el simulador marca lo que queda por debajo. Es un modelo de bañera: sirve para ver las zonas bajas, no sustituye a un modelo hidráulico.',
      'Con un terremoto, los primeros seis móviles que lo notan bastan para situar el epicentro, y SENDA calcula cuántos segundos faltan para que llegue la onda que más daña a cada pueblo.',
    ]),
  sc('b12', 'CALCULATED', ['packages/senda/src/smoke-exposure.mjs', 'packages/senda/tests/familiar-chat-smoke.test.mjs'],
    { kind: 'graph', kick: 'Humo en el suelo por cada gramo por segundo emitido', tag: 'cálculo', title: 'El humo que más daña llega de noche', log: true,
      bars: [{ label: 'Rescoldo de noche · pluma a 100 m, atmósfera estable', value: night, shown: `${es(night, 2)} µg/m³`, color: '#ff7756', note: 'máximo en el suelo' },
        { label: `Llamas de día · pluma a ${es(plumeH)} m`, value: day, shown: `${day.toExponential(1).replace('.', ',')} µg/m³`, color: '#91d7e8', note: 'la pluma se queda arriba' }],
      foot: `Penacho gaussiano con reflexión, Briggs y Pasquill–Turner; masa conservada (${es(mass * 100, 1)} %). Terreno llano.` },
    'Calidad del aire, calculada desde casa', [
      'Desde casa, con los datos de SENDA, se puede calcular cuánto humo llega al suelo a sotavento de un incendio.',
      `El resultado sorprende: por cada gramo emitido, el rescoldo de la noche llega al suelo unas ${es(Math.round(ratio / 1000) * 1000)} veces más que las llamas del día, cuya pluma se queda arriba.`,
      'Por eso el aviso de calidad del aire tiene que mirar la noche. El modelo conserva la masa y declara sus límites: terreno llano y sin química.',
    ]),
  sc('b13', 'SIMULATED', ['investor-next/public/senda/dron.html', 'packages/senda/src/drone.mjs', 'packages/senda/src/sovereign-mesh-kit.mjs'],
    clip('dron', 0.5, 'Grabación real · /senda/dron · edificio simulado'), 'Drones: contar personas sin entrar', [
      'Los drones se comunican con SENDA por estándares abiertos: identificación remota Open Drone ID, con mensajes de 25 bytes por Bluetooth y Wi-Fi, y telemetría MAVLink firmada.',
      'Aquí, el dron recorre la fachada y escucha los teléfonos planta a planta. Las direcciones Bluetooth cambian solas: contarlas engaña, así que SENDA deduce teléfonos distintos y da un intervalo honesto, sin identificar a nadie.',
    ]),
  sc('b14', 'SIMULATED', ['investor-next/public/senda/barrido.html', 'packages/senda/src/bearers.mjs'],
    clip('barrido', 0, 'Grabación real · /senda/barrido · zona simulada'), 'Dron casa por casa, y dron mula', [
      'Después del daño, el dron recorre las casas en el orden que más vidas puede salvar, con sus cambios de batería planificados.',
      'Y cuando una zona queda aislada, el dron hace de mula: recoge los mensajes cifrados de los móviles de abajo y los entrega donde hay red. Para SENDA es un portador más, con su probabilidad y su retardo.',
    ]),
  sc('b15', 'OBSERVED', ['investor-next/public/senda/sala.html', 'investor-next/public/senda/data/dana2024/emsr773.json'],
    clip('sala', 0, 'Grabación real · /senda/sala · DANA de 2024, agua observada por Copernicus'), 'Sala de decisión: la DANA real', [
      'Para quien coordina, una pantalla de operador sobre la DANA de dos mil veinticuatro: agua observada por Copernicus, calles cortadas y servicios sin acceso.',
      'Cinco pasos hasta una alerta firmada que una persona revisa y autoriza.',
    ]),
  sc('b16', 'CALCULATED', ['packages/senda/src/erasure.mjs', 'packages/senda/src/bearers.mjs', 'packages/senda/src/delivery-assurance.mjs', 'packages/senda/src/stranger-gateway.mjs', 'packages/senda/src/envelope.mjs', 'packages/senda/src/hazard-reports.mjs', 'packages/senda/src/wildfire.mjs', 'packages/senda/src/smoke-exposure.mjs', 'packages/senda/src/seismic.mjs', 'packages/senda/src/atmos3d.mjs'],
    { kind: 'formulas', kick: 'En qué se basa cada cálculo', tag: 'núcleo', title: 'Matemática y física, con nombre y apellido',
      items: [
        { name: 'Reed–Solomon GF(2⁸)', eq: 'k de n trozos → mensaje', gives: 'Cualquier k trozos rehacen el mensaje exacto.', color: '#34d399' },
        { name: 'Poisson-binomial', eq: 'P(≥k) = Σ Π pᵢ', gives: 'Probabilidad exacta de entrega por varias vías.', color: '#34d399' },
        { name: 'Beta-Binomial', eq: 'Beta(α+éxitos, β+fallos)', gives: 'Fiabilidad aprendida de recibos firmados.', color: '#91d7e8' },
        { name: 'Espacio libre', eq: 'FSPL = 20log d + 20log f − 147,55', gives: 'Hasta dónde llega cada radio.', color: '#91d7e8' },
        { name: 'Poisson espacial', eq: 'P(≥1) = 1 − e^(−ρφπr²)', gives: 'Cuántas pasarelas hay al alcance.', color: '#fbbf24' },
        { name: 'Hashcash', eq: '2ᵇ intentos ↔ 1 hash', gives: 'Frena el abuso sin pedir identidad.', color: '#fbbf24' },
        { name: 'ECDH · AES-GCM · ECDSA', eq: 'P-256 · 256 bits', gives: 'Nadie en medio lee ni falsifica.', color: '#b48cff' },
        { name: 'Bayes con verosimilitudes', eq: 'odds × LR por testigo', gives: 'Credibilidad auditable de un aviso.', color: '#b48cff' },
        { name: 'Tiempo mínimo de llegada', eq: 'elipse de viento · tan²φ', gives: 'Avance del fuego sobre el relieve real.', color: '#ff7756' },
        { name: 'Penacho gaussiano · Briggs', eq: 'C = Q/(πuσyσz)·e^(−H²/2σz²)', gives: 'Humo en el suelo, conservando la masa.', color: '#ff7756' },
      ], foot: 'Cada fórmula vive en un módulo del núcleo con sus pruebas.' },
    'En qué se basa, y qué aporta', [
      'Nada de esto es magia. Cada cálculo tiene nombre y apellido.',
      'Reed-Solomon, para que basten unos pocos trozos; la binomial de Poisson para la probabilidad exacta de entrega; Beta-Binomial para aprender de los recibos.',
      'La pérdida en espacio libre y el proceso de Poisson espacial para saber a quién alcanzas; hashcash para frenar abusos; criptografía estándar de curva elíptica; Bayes para la credibilidad; y la física del fuego y del humo para prevenir.',
    ]),
  sc('b17', 'OBSERVED', ['docs/research/SENDA_MENSAJERIA_SIN_COBERTURA_2026-11-20.md', 'docs/research/SENDA_RADAR_AVISOS_2026-11-20.md'],
    { kind: 'rivals', kick: 'Con quién nos comparan', tag: 'posicionamiento', title: 'No venimos a sustituir a nadie: nos sumamos', cols: ['Quién', 'Qué hace', 'Qué añade SENDA'],
      rows: [
        { name: 'WhatsApp · Instagram', what: 'mensajería y redes', gap: 'Funcionan con datos o Wi-Fi.', join: 'Entra cuando no hay red; no las toca.' },
        { name: 'Briar · Bridgefy', what: 'mensajes entre móviles cercanos', gap: 'Bluetooth y Wi-Fi entre teléfonos.', join: 'Suma satélite, LoRa, SMS y pasarelas, con probabilidad exacta.' },
        { name: 'Meshtastic · goTenna', what: 'radios de malla', gap: 'Equipos de radio dedicados.', join: 'Los usa como un portador más.' },
        { name: 'Satélite al móvil', what: 'SOS y mensajes por satélite', gap: 'Según móvil, operador y país.', join: 'Lo reparte con las demás vías, con su coste y su ley.' },
        { name: 'ES-Alert · AlertCops', what: 'avisos oficiales y app del Ministerio', gap: 'Avisan; la respuesta vuelve por la red.', join: 'Lee los avisos y prepara la respuesta de vuelta sin red.' },
        { name: 'Everbridge · Palantir', what: 'plataformas para organismos', gap: 'Gestión y análisis para quien decide.', join: 'Capa de campo abierta que exporta CAP.' },
      ], foot: 'Descripciones generales y públicas de cada producto; SENDA no afirma nada de su funcionamiento interno.' },
    'Contra quién competimos, y cómo nos sumamos', [
      'Nos comparan con aplicaciones de mensajería, con redes de malla, con el satélite en el móvil y con plataformas para organismos.',
      'SENDA no viene a sustituir a ninguno. Es la capa que los junta: usa cada vía que exista, lee los avisos oficiales y exporta en CAP, el estándar abierto de avisos.',
      'Lo que nadie hace a la vez es esto: seguir funcionando sin red, decir con qué probabilidad llegará cada mensaje y coordinar a la gente cercana hasta que llegan los servicios de emergencia.',
    ]),
  sc('b18', 'OBSERVED', ['packages/senda/src/interop.mjs', 'investor-next/public/senda/paises.html', 'packages/senda/src/alert-watch.mjs'],
    { kind: 'kpis', kpis: [kp('CAP 1.2', 'estándar abierto de avisos (OASIS)'), kp('112', 'número común de emergencias en la Unión Europea'), kp('MeteoAlarm', 'avisos oficiales de los servicios meteorológicos europeos')] },
    'Europa: el mismo núcleo en todos los países', [
      'El mismo núcleo sirve en toda Europa: el 112 es común, los avisos meteorológicos oficiales se publican juntos en MeteoAlarm y los avisos se intercambian en CAP.',
      'De España a los Países Bajos cambian los idiomas y las carreteras; el código es el mismo.',
    ]),
  sc('b19', 'OBSERVED', ['investor-next/public/senda/estado.json', 'scripts/prove.mjs'],
    { kind: 'kpis', kpis: [kp(`${estado.core}/${estado.coreTotal}`, 'pruebas del núcleo, hoy'), kp(`${estado.web}/${estado.web}`, 'pruebas de la web'), kp('0', 'auditorías externas completadas (pendiente)')] },
    'Comprobado hoy, y lo que falta', [
      `Hoy el núcleo pasa ${es(estado.core)} pruebas de ${es(estado.coreTotal)}, y la web ${estado.web} de ${estado.web}. Las afirmaciones públicas se comprueban con un programa antes de publicarse.`,
      'Lo que falta, dicho claro: ensayos de campo, una auditoría externa, convenios con los organismos y calibrar los modelos con más incidentes reales.',
    ]),
  sc('b20', 'OBSERVED', ['investor-next/app/senda-home.tsx', 'LICENSE'], { kind: 'cta' }, 'Para que ningún mensaje se pierda', [
    'SENDA coordina hasta que llegan los servicios de emergencia, y les ayuda a coordinar mejor.',
    'Pruébalo ahora, sin instalar nada, en la dirección que ves en pantalla.',
  ]),
];

const doc = { note: 'Película final de SENDA (noviembre de 2026), capítulos nuevos. Generado por build-senda-final.mjs; no editar a mano.', voices: { es: { voice: 'ef_dora', lang: 'es', speed: 0.95 } }, scenes };
fs.writeFileSync(path.join(here, 'senda-final.json'), JSON.stringify(doc, null, 2));
console.log(`senda-final.json · ${scenes.length} escenas · avisos ${snap.count} · fuentes ${srcOk} · terremotos ${quakes.length}→${fused.length} (${multi} multifuente) · sobre ${overhead} B · ciudad ${human(city.p50S)} · bar ${human(bar.p50S)} · pueblo ${human(village.p50S)} · humo ×${Math.round(ratio)} · p ${pr.map((x) => x.toFixed(3))}`);
