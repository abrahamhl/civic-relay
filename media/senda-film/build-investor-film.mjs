#!/usr/bin/env node
// Genera investor-film.json: película de presentación a inversores (motor 3D cinema.html).
// Todas las afirmaciones proceden de guiones ya verificados (m95-film.json, m96-promo.json,
// docs/video/M96_PROMO_SOURCES.md) o de docs/science/DELIVERY_ASSURANCE.md. Las cifras de pruebas
// se leen de investor-next/public/senda/estado.json y el recuento de agentes de .opencode/agents:
// si la narración no coincide con el repositorio, falla cerrado.
// Uso: node build-investor-film.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const die = (m) => { console.error(`[FATAL] ${m}`); process.exit(1); };

const estado = JSON.parse(fs.readFileSync(path.join(repoRoot, 'investor-next', 'public', 'senda', 'estado.json'), 'utf8'));
const core = estado.core ?? estado.tests?.core?.passed;
const e2e = estado.e2e ?? estado.tests?.e2e?.passed;
if (!Number.isInteger(core) || !Number.isInteger(e2e)) die('estado.json sin core/e2e');
if (estado.coreTotal != null && estado.coreTotal !== core) die(`núcleo ${core}/${estado.coreTotal}: hay pruebas en rojo`);
const agents = fs.readdirSync(path.join(repoRoot, '.opencode', 'agents')).filter((f) => f.endsWith('.md')).length;
const skills = fs.readdirSync(path.join(repoRoot, '.opencode', 'skills')).length;

// Números en palabras (en-GB / es-ES)
const EN1 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const en = (n) => (n < 20 ? EN1[n] : n < 100 ? EN10[Math.floor(n / 10)] + (n % 10 ? `-${EN1[n % 10]}` : '') : n < 1000 ? `${EN1[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${en(n % 100)}` : ''}` : die(`número sin locución: ${n}`));
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const S = (id, kind, claim, title, lines, extra = {}) => ({
  id, claim, visual: { kind, ...extra }, title: { en: title[0], es: title[1] },
  en: lines.map((l) => l[0]), es: lines.map((l) => l[1]),
});

const scenes = [
  S('f01', 'blackout', 'OBSERVED', ['28 April 2025 · Iberian blackout', '28 de abril de 2025 · Apagón ibérico'], [
    ['April, twenty twenty-five. The Iberian peninsula loses power.', 'Abril de 2025. La península ibérica se queda sin luz.'],
    ['The mobile network does not fall with the lights.', 'La red móvil no cae al irse la luz.'],
    ['It falls hours later, when the batteries in the masts run dry.', 'Cae horas después, cuando se agotan las baterías de las antenas.'],
    ['Stable connections drop from ninety percent to forty.', 'Las conexiones estables bajan del noventa al cuarenta por ciento.'],
  ], { stat: '90 % → 40 %', statLabel: { en: 'users with a stable connection', es: 'usuarios con conexión estable' } }),
  S('f02', 'flood', 'OBSERVED', ['29 October 2024 · Valencia floods', '29 de octubre de 2024 · DANA de Valencia'], [
    ['October, twenty twenty-four. The Valencia floods.', 'Octubre de 2024. La DANA de Valencia.'],
    ['The mass alert reaches phones', 'La alerta masiva llega a los móviles'],
    ['at eleven minutes past eight in the evening.', 'a las ocho y once de la tarde.'],
  ], { stat: '20:11', statLabel: { en: 'ES-Alert reaches phones', es: 'llega el ES-Alert a los móviles' } }),
  S('f03', 'rail', 'OBSERVED', ['January 2026 · Adamuz', 'Enero de 2026 · Adamuz'], [
    ['January, twenty twenty-six. Adamuz.', 'Enero de 2026. Adamuz.'],
    ['Emergency services take around forty-five minutes', 'Los servicios de emergencia tardan unos cuarenta y cinco minutos'],
    ['to learn there is a second train.', 'en saber que hay un segundo tren.'],
    ['The causes remain under official investigation.', 'Las causas siguen bajo investigación oficial.'],
  ], { stat: '≈ 45 min', statLabel: { en: 'to recognise the second train · published timeline', es: 'para reconocer el segundo tren · cronología publicada' } }),
  S('f04', 'gap', 'OBSERVED', ['The gap nobody covers', 'El hueco que nadie cubre'], [
    ['The problem is not a lack of technology.', 'El problema no es la falta de tecnología.'],
    ['It is that nothing is coordinated.', 'Es que nada está coordinado.'],
    ['The whole official alert chain depends on the mobile network:', 'Toda la cadena oficial de alerta depende de la red móvil:'],
    ['exactly the one that fails.', 'justo la que falla.'],
    ['Yet every phone carries Bluetooth, Wi-Fi, a speaker, a microphone', 'Y cada móvil lleva Bluetooth, wifi, altavoz, micrófono'],
    ['and, increasingly, satellite.', 'y, cada vez más, satélite.'],
  ]),
  S('f05', 'title', 'CALCULATED', ['Emergency routing over every channel left standing', 'Enrutamiento de emergencia por todo canal que siga en pie'], [
    ['This is SENDA.', 'Esto es SENDA.'],
    ['The layer that coordinates everything that can still carry a message.', 'La capa que coordina todo lo que aún puede llevar un mensaje.'],
  ]),
  S('f06', 'mesh', 'CALCULATED', ['No Internet needed, from second one', 'Sin Internet, desde el primer segundo'], [
    ['It works without Internet, from the very first second.', 'Funciona sin Internet, desde el primer segundo.'],
    ['Messages are encrypted end to end, and travel from phone to phone.', 'Los mensajes van cifrados de extremo a extremo, de móvil a móvil.'],
    ['Every phone carries messages it cannot read.', 'Cada móvil transporta mensajes que no puede leer.'],
    ['And a signed receipt erases the copies still travelling.', 'Y un recibo firmado borra las copias que siguen viajando.'],
  ]),
  S('f07', 'bearers', 'CALCULATED', ['One message, many paths at once', 'Un mensaje, muchos caminos a la vez'], [
    ['SENDA splits every message with Reed-Solomon coding,', 'SENDA divide cada mensaje con codificación Reed-Solomon'],
    ['and spreads the fragments across different bearers:', 'y reparte los fragmentos por portadores distintos:'],
    ['satellite, LoRa, drones and neighbours.', 'satélite, LoRa, drones y vecinos.'],
    ['Any few of them arriving is enough to rebuild it.', 'Basta con que lleguen unos pocos para reconstruirlo.'],
    ['In the live trial, one hundred and ninety-seven of two hundred messages', 'En la prueba en vivo, ciento noventa y siete de doscientos mensajes'],
    ['were rebuilt, byte for byte, while bearers were dropped at random.', 'se reconstruyeron byte a byte mientras caían portadores al azar.'],
  ], { stat: '197 / 200', statLabel: { en: 'messages rebuilt byte for byte · live trial', es: 'mensajes reconstruidos byte a byte · prueba en vivo' } }),
  S('f08', 'orbit', 'OBSERVED', ['Every satellite network, by access level', 'Toda la red satelital, por nivel de acceso'], [
    ['Every satellite network is classed by access level:', 'Cada red de satélites se clasifica por nivel de acceso:'],
    ['what your phone already has, what needs a module,', 'lo que tu móvil ya tiene, lo que necesita un módulo'],
    ['and what requires an agreement.', 'y lo que exige un acuerdo.'],
    ['Anything still under development is labelled as such.', 'Lo que sigue en desarrollo se etiqueta como tal.'],
  ]),
  S('f09', 'road', 'SIMULATED', ['Roads · the braking you cannot see', 'Carretera · la frenada que no ves'], [
    ['On the road: fog, one hundred and twenty kilometres an hour,', 'En carretera: niebla, ciento veinte kilómetros por hora'],
    ['and one point two seconds between cars.', 'y uno coma dos segundos entre coches.'],
    ['The delays add up, and five cars crash in a chain.', 'Los retrasos se suman y cinco coches chocan en cadena.'],
    ['With SENDA, the first phone detects the braking', 'Con SENDA, el primer móvil detecta la frenada'],
    ['and warns everyone at once.', 'y avisa a todos a la vez.'],
    ['Only a safe distance fixes the rest.', 'El resto solo lo arregla la distancia de seguridad.'],
    ['This is a model, not a field test.', 'Es un modelo, no una prueba de campo.'],
  ]),
  S('f10', 'fire', 'SIMULATED', ['Wildfires · warn before the mast burns', 'Incendios · avisar antes de que arda la antena'], [
    ['In a wildfire, SENDA computes how the fire spreads with wind and slope,', 'En un incendio, SENDA calcula cómo avanza el fuego con viento y pendiente'],
    ['and crosses it with the phone masts.', 'y lo cruza con las antenas de telefonía.'],
    ["In this scenario, a town's mast burns", 'En este escenario, la antena de un pueblo arde'],
    ['one hundred and seven minutes before its warning deadline.', 'ciento siete minutos antes de su límite de aviso.'],
    ['So the alert must leave earlier, or travel by other paths.', 'Así que la alerta debe salir antes, o viajar por otros caminos.'],
  ], { stat: '107 min', statLabel: { en: 'of warning margin lost · simulated scenario', es: 'de margen de aviso perdido · escenario simulado' } }),
  S('f11', 'building', 'SIMULATED', ['Buildings · counting people per floor, from outside', 'Edificios · contar personas por planta, desde fuera'], [
    ['When nobody can enter a building, a drone climbs the façade, floor by floor,', 'Cuando nadie puede entrar en un edificio, un dron sube la fachada, planta a planta,'],
    ['listening to the Bluetooth signals that phones emit, without connecting to them.', 'escuchando las señales Bluetooth de los móviles, sin conectarse a ellos.'],
    ['Only numbers come out. Never identities.', 'Solo salen números. Nunca identidades.'],
    ['Across seven hundred and twenty simulated floors,', 'En setecientas veinte plantas simuladas,'],
    ['the margin held the real figure ninety-five percent of the time.', 'el margen contuvo la cifra real el noventa y cinco por ciento de las veces.'],
  ], { stat: '95 %', statLabel: { en: 'interval coverage · 720 simulated floors', es: 'cobertura del intervalo · 720 plantas simuladas' } }),
  S('f12', 'science', 'SIMULATED', ['Physics underneath, not promises', 'Debajo hay física, no promesas'], [
    ['Underneath all of this there is physics, not promises.', 'Debajo de todo esto hay física, no promesas.'],
    ['Rain attenuation, mountain diffraction, the error rate of the sound link:', 'Atenuación por lluvia, difracción en montaña, tasa de error del enlace sonoro:'],
    ['every figure comes from published models, checked against analytical solutions.', 'cada cifra sale de modelos publicados y se comprueba con soluciones analíticas.'],
    ['And our delivery engine models the failures that happen together.', 'Y nuestro motor de entrega modela los fallos que ocurren a la vez.'],
    ['Where a naive plan promises 99.5 %, and delivers 96 %,', 'Donde un plan ingenuo promete un 99,5 % y entrega un 96 %,'],
    ['ours delivers 99 %, in simulation, at no extra cost.', 'el nuestro entrega un 99 %, en simulación, sin coste añadido.'],
  ], { bars: [{ v: 99.49, l: { en: 'naive plan · promised', es: 'plan ingenuo · prometido' } }, { v: 96.09, l: { en: 'naive plan · delivered', es: 'plan ingenuo · entregado' } }, { v: 98.98, l: { en: 'SENDA engine · delivered, €0', es: 'motor SENDA · entregado, 0 €' } }] }),
  S('f13', 'fields', 'CALCULATED', ['One core, many fields', 'Un núcleo, muchos campos'], [
    ['One core, many fields:', 'Un núcleo, muchos campos:'],
    ['roads, railways, wildfires, floods, buildings and blackouts.', 'carreteras, ferrocarril, incendios, inundaciones, edificios y apagones.'],
    ['For citizens, coordinators, emergency services and public administrations.', 'Para la ciudadanía, los coordinadores, las emergencias y las administraciones.'],
    ['And it never replaces one one two.', 'Y nunca sustituye al 112.'],
  ], { fields: [['Roads', 'Carreteras'], ['Railways', 'Ferrocarril'], ['Wildfires', 'Incendios'], ['Floods', 'Inundaciones'], ['Buildings', 'Edificios'], ['Blackouts', 'Apagones']].map(([a, b]) => ({ en: a, es: b })) }),
  S('f14', 'proof', 'OBSERVED', ['Machine-verified. Honest about what is missing.', 'Verificado por máquina. Honesto con lo que falta.'], [
    ['Everything is machine-verified on every change:', 'Todo se verifica por máquina en cada cambio:'],
    [`${en(core)} core tests,`, `${core} pruebas del núcleo`],
    [`and ${en(e2e)} end-to-end checks, almost all with the network cut.`, `y ${e2e} comprobaciones de extremo a extremo, casi todas sin red.`],
    [`Behind it, an engineering corps of ${en(agents)} specialised A I agents,`, `Detrás, un cuerpo de ingeniería de ${agents} agentes de IA especializados`],
    ['with one rule: never invent.', 'con una regla: no inventar.'],
    ['What is missing, we say:', 'Lo que falta, lo decimos:'],
    ['field pilots with physical phones, an independent security audit,', 'pilotos de campo con móviles físicos, una auditoría de seguridad independiente'],
    ['and certification for public procurement.', 'y la certificación para compra pública.'],
  ], { core, e2e, agents, skills, missing: [['Field pilots with physical phones and rescue teams', 'Pilotos de campo con móviles físicos y equipos de rescate'], ['Independent security audit', 'Auditoría de seguridad independiente'], ['Certification for public procurement', 'Certificación para compra pública']].map(([a, b]) => ({ en: a, es: b })) }),
  S('f15', 'cta', 'OBSERVED', ['So that no message is lost', 'Para que ningún mensaje se pierda'], [
    ['SENDA.', 'SENDA.'],
    ['For anyone who wants to invest in making sure no message is lost.', 'Para quien quiera invertir en que ningún mensaje se pierda.'],
    ['Try it now, with nothing to install, at the address on screen.', 'Pruébalo ahora, sin instalar nada, en la dirección que ves en pantalla.'],
  ], { url: 'civic-relay-investor.vercel.app/senda', repo: 'github.com/abrahamhl/civic-relay' }),
];

const SAY = [[/99\.5 %/g, 'ninety-nine point five percent'], [/96 %/g, 'ninety-six percent'], [/99 %/g, 'ninety-nine percent'], [/\bSENDA\b/g, 'Senda'], [/\bLoRa\b/g, 'LOR-ah'], [/\bWi-Fi\b/g, 'why-fye'], [/façade/g, 'facade']];
for (const sc of scenes) {
  sc.source = ['media/senda-film/m96-promo.json', 'media/senda-film/m95-film.json', 'docs/video/M96_PROMO_SOURCES.md', 'docs/science/DELIVERY_ASSURANCE.md', 'investor-next/public/senda/estado.json'];
  sc.en_say = sc.en.map((t) => SAY.reduce((s, [a, b]) => s.replace(a, b), t));
  for (const l of ['en', 'es']) for (const line of sc[l]) if (line.length > 84) die(`${sc.id}: línea ${l} > 84 caracteres (${line.length}): "${line}"`);
  for (const l of ['en', 'es']) for (const line of sc[l]) { if (line.length <= 42) continue; const w = line.split(' '); if (!w.some((_, i) => i && w.slice(0, i).join(' ').length <= 42 && w.slice(i).join(' ').length <= 42)) die(`${sc.id}: línea ${l} no cabe en 2×42: "${line}"`); }
}
// El título de f14 en es dice "112" y la voz inglesa lo deletrea: el subtítulo inglés lleva la cifra.
const f13 = scenes.find((s) => s.id === 'f13'); f13.en[3] = 'And it never replaces 112.';
const f14 = scenes.find((s) => s.id === 'f14');
f14.en[1] = `${core} core tests,`; f14.en[2] = `and ${e2e} end-to-end checks, almost all with the network cut.`;
f14.en[3] = `Behind it, an engineering corps of ${agents} specialised AI agents,`;

const doc = {
  note: 'SENDA · película de presentación a inversores (motor 3D cinema.html). Generado por build-investor-film.mjs; no editar a mano.',
  counts: { core, e2e, agents, skills, estadoSha: estado.sha },
  voices: { en: { voice: 'bf_emma', lang: 'en-gb', speed: 0.93 } },
  scenes,
};
fs.writeFileSync(path.join(__dirname, 'investor-film.json'), JSON.stringify(doc, null, 1) + '\n', 'utf8');
console.log(`=> investor-film.json · ${scenes.length} escenas · núcleo ${core} · e2e ${e2e} · ${agents} agentes · ${skills} skills`);
