#!/usr/bin/env node
// Genera investor-film.json (v2): película de presentación a inversores con explicación completa.
// Cada afirmación procede del repositorio; las fuentes por escena están en docs/video/INVESTOR_FILM.md.
// Las cifras de física se CALCULAN con el núcleo (packages/senda) al construir el guion, las de pruebas
// se leen de estado.json y el recuento de agentes de .opencode/agents. Si algo no coincide, falla cerrado.
// Uso: node build-investor-film.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const die = (m) => { console.error(`[FATAL] ${m}`); process.exit(1); };
const core = (p) => import(pathToFileURL(path.join(repoRoot, 'packages', 'senda', 'src', p)).href);

// ── Cifras leídas o calculadas
const estado = JSON.parse(fs.readFileSync(path.join(repoRoot, 'investor-next', 'public', 'senda', 'estado.json'), 'utf8'));
const tests = { core: estado.core, e2e: estado.e2e };
if (!Number.isInteger(tests.core) || !Number.isInteger(tests.e2e)) die('estado.json sin core/e2e');
if (estado.coreTotal != null && estado.coreTotal !== tests.core) die(`núcleo ${tests.core}/${estado.coreTotal}: hay pruebas en rojo`);
const agents = fs.readdirSync(path.join(repoRoot, '.opencode', 'agents')).filter((f) => f.endsWith('.md')).length;
const phys = await core('telecom-mathematical-physics.mjs');
const rain = (g) => phys.computeRainAttenuation(g, 50).specificAttenuationDbPerKm;
const r868 = rain(0.868), r28 = rain(28);
const knife = phys.computeKnifeEdgeLossDb(phys.computeFresnelV(60, 5000, 5000, 299792458 / 868e6));
const check = (cond, msg) => { if (!cond) die(`la narración no coincide con el núcleo: ${msg}`); };
check(r868 < 0.01, `868 MHz pierde ${r868} dB/km (la voz dice «casi nada»)`);
check(Math.round(r28) === 7, `28 GHz pierde ${r28} dB/km (la voz dice «unos siete»)`);
check(Math.round(knife) === 22, `cresta de 60 m: ${knife} dB (la voz dice «unos veintidós»)`);
const lam868 = 299792458 / 868e6, lam28 = 299792458 / 28e9;
check(Math.round(lam868 * 100) === 35 && Math.round(lam28 * 100) === 1, `longitudes de onda ${lam868} / ${lam28}`);
// Todas las afirmaciones numéricas se comprueban con scripts/film-claims.mjs (las mismas que scripts/prove.mjs)
const { runClaims } = await import(pathToFileURL(path.join(repoRoot, 'scripts', 'film-claims.mjs')).href);
const claimRes = await runClaims();
for (const c of claimRes) if (!c.ok) die(`afirmación no verificada (${c.id}): ${c.value}`);
const MB = claimRes.find((c) => c.id === 'multibearer-run'), MBN = +MB.value.split('/')[0];
const erasure = await core('erasure.mjs');
{ // demostración real del ejemplo «diez fragmentos, seis cualesquiera»
  const msg = new TextEncoder().encode('SOS · planta 3 · dos personas atrapadas');
  const enc = erasure.encodeShards(msg, 6, 10);
  const keep = enc.shards.map((data, index) => ({ index, data })).filter((r) => ![0, 3, 4, 8].includes(r.index));
  const out = erasure.decodeShards(keep, { k: 6, len: enc.len });
  check(Buffer.from(out).equals(Buffer.from(msg)), 'Reed-Solomon 6-de-10 no reconstruye el mensaje');
}

// ── Escenas: [en, es] por frase; `say` opcional = texto que lee la voz
const L = (en, es, say) => ({ en, es, say });
const S = (id, kind, claim, title, lines, extra = {}) => ({ id, kind, claim, title, lines, extra });
const T = (en, es) => ({ en, es });

const scenes = [
  S('v01', 'blackout', 'OBSERVED', T('28 April 2025 · Why the network fell', '28 de abril de 2025 · Por qué cayó la red'), [
    L('April, twenty twenty-five. The Iberian peninsula loses power.', 'Abril de 2025. La península ibérica se queda sin luz.'),
    L('Phones still show coverage, but messages stop leaving.', 'Los móviles siguen mostrando cobertura, pero los mensajes no salen.'),
    L('The mobile network does not fall with the lights.', 'La red móvil no cae al irse la luz.'),
    L('Each mast runs on its own battery, and the batteries run dry one by one.', 'Cada antena tira de su batería, y las baterías se agotan una a una.'),
    L('Within hours, stable connections drop from ninety percent to forty.', 'En pocas horas, las conexiones estables caen del 90 al 40 %.'),
    L('Those hours are a warning window. Today, nobody uses them.', 'Esas horas son una ventana de aviso. Hoy nadie la aprovecha.'),
  ], { stat: '90 % → 40 %', statCue: 4, statLabel: T('users with a stable connection', 'usuarios con conexión estable') }),
  S('v02', 'valley', 'OBSERVED', T('29 October 2024 · Valencia floods', '29 de octubre de 2024 · DANA de Valencia'), [
    L('October, twenty twenty-four. The Valencia floods.', 'Octubre de 2024. La DANA de Valencia.'),
    L('The extreme rain fell upstream, in the hills.', 'La lluvia extrema cayó aguas arriba, en los montes.'),
    L('In many of the towns that flooded, it was barely raining.', 'En muchos de los pueblos que se inundaron apenas llovía.'),
    L('The water came down the ravines, towards people who could not see it coming.', 'El agua bajó por los barrancos hacia quien no la veía venir.'),
    L('The mass alert reached phones at eleven minutes past eight in the evening.', 'La alerta masiva llegó a los móviles a las 20:11.'),
    L('Why so late is still disputed. The lesson: measure upstream, warn downstream.', 'Por qué tan tarde sigue en disputa. La lección: medir arriba, avisar abajo.'),
  ], { stat: '20:11', statCue: 4, statLabel: T('ES-Alert reaches phones', 'llega el ES-Alert') }),
  S('v03', 'rail', 'OBSERVED', T('18 January 2026 · Adamuz', '18 de enero de 2026 · Adamuz'), [
    L('January, twenty twenty-six. Adamuz.', 'Enero de 2026. Adamuz.'),
    L('A train derails and invades the other track. A second train hits it.', 'Un tren descarrila e invade la otra vía. Un segundo tren choca con él.'),
    L('The first calls carried the position of the first train only.', 'Las primeras llamadas solo llevaban la posición del primer tren.'),
    L('It took around forty-five minutes to learn there was a second one.', 'Se tardó unos 45 minutos en saber que había un segundo.'),
    L("Hundreds of passengers' phones felt the impact. That reached nobody.", 'Cientos de móviles de pasajeros sintieron el impacto. No llegó a nadie.'),
    L('The preliminary investigation points to a broken rail weld; it is still open.', 'La investigación preliminar apunta a una soldadura rota; sigue abierta.'),
  ], { stat: '≈ 45 min', statCue: 3, statLabel: T('to recognise the second train', 'en reconocer el segundo tren') }),
  S('v04', 'gap', 'OBSERVED', T('The same pattern, every time', 'El mismo patrón, siempre'), [
    L('Behind every case, the same pattern.', 'Detrás de cada caso, el mismo patrón.'),
    L('The network falls after the event, not during it.', 'La red cae después del suceso, no durante.'),
    L('The official alert depends on the mobile network: exactly what fails.', 'La alerta oficial depende de la red móvil: justo lo que falla.'),
    L('The data that could warn us already exists. Nobody connects it.', 'Los datos que podrían avisarnos ya existen. Nadie los cruza.'),
    L('And silence gets misread: a phone that does not answer is not a victim.', 'Y el silencio se malinterpreta: un móvil que no responde no es una víctima.'),
    L('Yet every phone already carries radios, a speaker, a microphone and sensors.', 'Y cada móvil ya lleva radios, altavoz, micrófono y sensores.'),
  ]),
  S('v05', 'title', 'CALCULATED', T('Emergency routing over every channel still standing', 'Enrutamiento de emergencia por todo canal que siga en pie'), [
    L('This is SENDA.', 'Esto es SENDA.'),
    L('Emergency routing over every channel that is still standing.', 'Enrutamiento de emergencia por todo canal que siga en pie.'),
    L('Not another network. The layer that makes all of them work together.', 'No es otra red. Es la capa que hace que todas trabajen juntas.'),
  ]),
  S('v06', 'phone', 'OBSERVED', T('What you install', 'Qué instalas'), [
    L("You don't need an app store. You open a web address once, with a connection.", 'No hace falta tienda de apps. Abres una dirección web una vez, con conexión.'),
    L('It installs on the phone and from then on works with no network at all.', 'Se instala en el móvil y desde entonces funciona sin ninguna red.'),
    L("In an emergency, three big buttons: I'm safe, I need help, I'm trapped.", 'En una emergencia, tres botones: estoy bien, necesito ayuda, estoy atrapado.'),
    L('Your message is encrypted on your own phone, in about three hundred bytes.', 'Tu mensaje se cifra en tu propio móvil, en unos trescientos bytes.'),
    L('Only the person it is meant for can read it.', 'Solo puede leerlo la persona a quien va dirigido.'),
    L('On Android it is also a real app, with everything inside.', 'En Android es además una app de verdad, con todo dentro.'),
    L('No browser, and no network needed even to start it.', 'Sin navegador y sin red, ni siquiera para arrancarla.'),
  ], { screens: ['e2e-13-modo-facil.png', 'e2e-01-offline-home.png'] }),
  S('v07', 'mesh', 'CALCULATED', T('Phone to phone · store, carry, forward', 'De móvil a móvil · guardar, llevar, reenviar'), [
    L('Without a network, every phone running SENDA becomes a relay.', 'Sin red, cada móvil con SENDA se convierte en un relé.'),
    L("It carries other people's messages, sealed, unable to read them.", 'Lleva mensajes ajenos, sellados, sin poder leerlos.'),
    L('When two phones meet, they swap what they are carrying.', 'Cuando dos móviles se cruzan, intercambian lo que llevan.'),
    L('A car, a bus, a person walking: anything that moves becomes a courier.', 'Un coche, un autobús, alguien andando: todo lo que se mueve hace de mensajero.'),
    L('When the message arrives, a signed receipt travels back', 'Cuando el mensaje llega, vuelve un recibo firmado'),
    L('and erases the copies still circulating. A fake receipt is ignored.', 'que borra las copias que siguen circulando. Un recibo falso se ignora.'),
    L('Tested in the lab: a city of forty phones, delivering only by encounters.', 'Probado en laboratorio: una ciudad de 40 móviles que entregan solo al cruzarse.'),
  ]),
  S('v08', 'bearers', 'CALCULATED', T('One message, many paths · Reed-Solomon', 'Un mensaje, muchos caminos · Reed-Solomon'), [
    L('SENDA never bets on a single channel. It cuts every message into fragments.', 'SENDA no apuesta por un solo canal. Corta cada mensaje en fragmentos.'),
    L('Reed-Solomon coding adds spare ones: send ten, and any six rebuild it exactly.', 'Reed-Solomon añade repuestos: envías diez y seis cualesquiera lo rehacen.'),
    L('They leave at once by satellite, LoRa radio, drones and neighbours.', 'Salen a la vez por satélite, radio LoRa, drones y vecinos.', 'They leave at once by satellite, LOR-ah radio, drones and neighbours.'),
    L('If a path dies, the others are enough.', 'Si un camino muere, los demás bastan.'),
    L(`In 200 sends with bearers dropped at random, ${MBN} were rebuilt.`, `En 200 envíos perdiendo portadores al azar, se rehicieron ${MBN}.`, `In two hundred sends with bearers dropped at random, ${MBN === 199 ? 'one hundred and ninety-nine' : MBN === 198 ? 'one hundred and ninety-eight' : MBN === 200 ? 'all of them' : die('MBN sin locución')} were rebuilt.`),
    L('Which paths to use is decided by Contact Graph Routing, from space networking:', 'Qué caminos usar lo decide Contact Graph Routing, de las redes espaciales:'),
    L('the earliest arrival over every chain of contacts, several routes in parallel.', 'la llegada más temprana por toda cadena de contactos, varias rutas en paralelo.'),
  ], { stat: `${MBN} / 200`, statCue: 4, statLabel: T('messages rebuilt · seeded test run', 'mensajes reconstruidos · ejecución con semilla') }),
  S('v09', 'europe', 'SIMULATED', T('Arnhem → San Martín de Valdeiglesias', 'Arnhem → San Martín de Valdeiglesias'), [
    L('A real question: I live in the Netherlands.', 'Una pregunta real: vivo en Países Bajos.'),
    L('My brother is in Spain, and his mast is down.', 'Mi hermano está en España y su antena ha caído.'),
    L('WhatsApp delivers when his phone gets its own coverage back.', 'WhatsApp entrega cuando su móvil recupera su propia cobertura.'),
    L('SENDA looks for any real bridge: a neighbour with satellite Internet,', 'SENDA busca cualquier puente real: un vecino con Internet por satélite,'),
    L('another operator still running, a nearby phone over Bluetooth.', 'otro operador que siga en pie, un móvil cercano por Bluetooth.'),
    L('In this simulation: SENDA in about four minutes. WhatsApp, in eight hours.', 'En esta simulación: SENDA en unos cuatro minutos. WhatsApp, en ocho horas.'),
    L('With no bridge at all, SENDA does not pretend: it waits for the first window.', 'Sin ningún puente, SENDA no finge: espera a la primera ventana.'),
    L("If only your operator fails, 112 still works through any other operator's mast.", 'Si solo cae tu operador, el 112 funciona por la antena de cualquier otro.', "If only your operator fails, one one two still works through any other operator's mast."),
  ], { stat: '4 min · 8 h', statCue: 4, statLabel: T('SENDA vs WhatsApp · simulation', 'SENDA frente a WhatsApp · simulación') }),
  S('v10', 'twophones', 'OBSERVED', T('Try it today, with someone at home', 'Pruébalo hoy, con alguien en casa'), [
    L('You can test it today with someone at home.', 'Puedes probarlo hoy con alguien en casa.'),
    L('Install it, switch on airplane mode, and send a message by sound:', 'Instálalo, activa el modo avión y envía un mensaje por sonido:'),
    L('one metre apart, a short message takes about thirty seconds.', 'a un metro, un mensaje corto tarda unos treinta segundos.'),
    L('Or open a hotspot with no SIM: chat and voice calls, no Internet, no server.', 'O abre un punto de acceso sin SIM: chat y llamadas, sin Internet ni servidor.'),
    L('With two LoRa nodes of about thirty to forty euros, the range becomes kilometres.', 'Con dos nodos LoRa de 30 a 40 euros, el alcance pasa a ser de kilómetros.', 'With two LOR-ah nodes of about thirty to forty euros, the range becomes kilometres.'),
    L("Across countries, physics needs a bridge somewhere. SENDA's job is to find it.", 'Entre países, la física necesita un puente en algún sitio. SENDA lo encuentra.'),
  ], { screens: ['app-llamada.png', 'e2e-10-signed-alert.png'] }),
  S('v11', 'reserve', 'CALCULATED', T('The network reserve · an Internet battery', 'La reserva de red · una batería de Internet'), [
    L('Your phone also keeps a reserve: one gigabyte by default.', 'Tu móvil guarda además una reserva: un giga por defecto.'),
    L('While there is Wi-Fi, it stores what you will need offline:', 'Mientras hay wifi, guarda lo que necesitarás sin red:'),
    L('maps, shelters, your emergency plan, satellite orbits, your documents.', 'mapas, albergues, tu plan de emergencia, órbitas de satélites, tus documentos.'),
    L('An exact optimisation chooses by value, local risk and how fast it goes stale.', 'Elige con una optimización exacta: valor, riesgo local y cuánto tarda en caducar.'),
    L('What you need to send waits in a queue, and goes first in the next short window.', 'Lo que tengas que enviar espera en cola y sale primero en la próxima ventana.'),
    L('Stored bytes are not coverage. But they keep the app useful with no network.', 'Los bytes guardados no son cobertura. Pero mantienen la app útil sin red.'),
  ], { screens: ['app-reserva.png'] }),
  S('v12', 'rainphys', 'CALCULATED', T('Physics · why rain cuts some radios', 'Física · por qué la lluvia corta unas radios'), [
    L('Now the physics. Why does rain cut some links and not others?', 'Ahora, la física. ¿Por qué la lluvia corta unos enlaces y otros no?'),
    L('It depends on the size of a raindrop compared with the radio wave.', 'Depende del tamaño de la gota comparado con la onda de radio.'),
    L('At 868 megahertz the wave is about thirty-five centimetres long.', 'A 868 megahercios la onda mide unos 35 centímetros.', 'At eight hundred and sixty-eight megahertz the wave is about thirty-five centimetres long.'),
    L('Drops barely touch it: in heavy rain, it loses almost nothing.', 'Las gotas apenas la tocan: con lluvia fuerte, casi no pierde nada.'),
    L('At 28 gigahertz the wave is about one centimetre: the size of a drop.', 'A 28 gigahercios mide un centímetro: el tamaño de una gota.', 'At twenty-eight gigahertz the wave is about one centimetre: the size of a drop.'),
    L('It loses about seven decibels per kilometre.', 'Pierde unos siete decibelios por kilómetro.'),
    L('So in storms, SENDA prefers low bands.', 'Por eso, en tormenta, SENDA prefiere bandas bajas.'),
    L('Model ITU-R P.838, computed by the app itself, at fifty millimetres per hour.', 'Modelo ITU-R P.838, calculado por la propia app, a 50 mm por hora.', 'Model I T U-R P eight thirty-eight, computed by the app itself, at fifty millimetres per hour.'),
  ], { r868, r28 }),
  S('v13', 'ridge', 'CALCULATED', T('Physics · radio over a mountain', 'Física · la radio sobre una montaña'), [
    L('A mountain does not block radio completely. The wave bends over the ridge.', 'Una montaña no bloquea la radio del todo. La onda se curva sobre la cresta.'),
    L('That is diffraction. SENDA computes it on real terrain by two classic methods.', 'Es la difracción, y SENDA la calcula sobre relieve real con dos métodos clásicos.'),
    L('A ridge sixty metres above the line between two points ten kilometres apart', 'Una cresta sesenta metros por encima de la línea entre dos puntos a diez kilómetros'),
    L('costs about twenty-two decibels at 868 megahertz.', 'cuesta unos veintidós decibelios a 868 megahercios.', 'costs about twenty-two decibels at eight hundred and sixty-eight megahertz.'),
    L('Knowing the loss tells us where one relay on a hilltop restores the link.', 'Conocer la pérdida dice dónde un relé en lo alto recupera el enlace.'),
  ], { knife }),
  S('v14', 'orbit', 'CALCULATED', T('Satellites, when they pass', 'Satélites, cuando pasan'), [
    L('Satellites are not always overhead. SENDA computes their orbits on the phone,', 'Los satélites no están siempre encima. SENDA calcula sus órbitas en el móvil,'),
    L('predicts each pass, and treats it as one more contact for the router.', 'predice cada paso y lo trata como un contacto más para el enrutador.'),
    L('Low orbits for short messages; medium orbits for position and rescue beacons.', 'Órbitas bajas para mensajes cortos; medias para posición y balizas de rescate.'),
  ]),
  S('v15', 'forecast', 'SIMULATED', T('Forecasting the blackout', 'Prever el apagón'), [
    L('Back to the blackout. SENDA models how long each mast lasts on battery', 'Volvamos al apagón. SENDA modela cuánto dura cada antena con su batería'),
    L('and maps where and when people will lose coverage, before it happens.', 'y dibuja dónde y cuándo se quedará la gente sin cobertura, antes de que pase.'),
    L('Then it chooses where to place gateways, with a mathematical guarantee.', 'Después elige dónde poner pasarelas, con garantía matemática.'),
    L('In the test city, five gateways reach seventy-two percent of those cut off.', 'En la ciudad de prueba, cinco pasarelas llegan al 72 % de los aislados.'),
  ], { stat: '5 → 72 %', statCue: 3, statLabel: T('gateways → people reached · simulation', 'pasarelas → personas alcanzadas · simulación') }),
  S('v16', 'road', 'SIMULATED', T('Roads · the braking you cannot see', 'Carretera · la frenada que no ves'), [
    L('In Spain, 1,119 people died on interurban roads in 2025.', 'En España, 1.119 personas murieron en vías interurbanas en 2025.', 'In Spain, one thousand one hundred and nineteen people died on interurban roads in twenty twenty-five.'),
    L('Fog, a hundred and twenty kilometres an hour, one point two seconds between cars.', 'Niebla, 120 km/h y 1,2 segundos entre coches.'),
    L('Each driver reacts to the brake lights ahead. The delays add up: five cars crash.', 'Cada uno reacciona a las luces de delante. Los retrasos se suman: chocan cinco.'),
    L('With SENDA, the first phone detects the braking and warns everyone behind at once.', 'Con SENDA, el primer móvil detecta la frenada y avisa a todos los de detrás.'),
    L('In the model, only the tailgater still crashes. Only a safe distance fixes that.', 'En el modelo, solo choca el que iba pegado. Eso solo lo arregla la distancia.'),
    L('With no coverage, the SOS rides with passing cars: out in seven minutes,', 'Sin cobertura, el SOS viaja con los coches que pasan: sale en siete minutos'),
    L('in simulation, with only one car in ten running SENDA.', 'en simulación, con solo uno de cada diez coches con SENDA.'),
  ], { stat: '5 → 1', statCue: 4, statLabel: T('cars crashing · model result', 'coches que chocan · resultado del modelo') }),
  S('v17', 'pas', 'SIMULATED', T('You stop to help · protect, alert, help', 'Paras a ayudar · proteger, avisar, socorrer'), [
    L('If you stop at an accident, SENDA guides you with the DGT routine:', 'Si paras en un accidente, SENDA te guía con la pauta de la DGT:', 'If you stop at an accident, Senda guides you with the D G T routine:'),
    L('protect, alert, help.', 'proteger, avisar, socorrer.'),
    L('It tells 112 where you are in their words: road, kilometre point and direction,', 'Dice al 112 dónde estás en sus palabras: carretera, punto kilométrico y sentido,', 'It tells one one two where you are in their words: road, kilometre point and direction,'),
    L('even inside a tunnel, and using landmarks such as wind turbines.', 'incluso en un túnel, y usando referencias como los aerogeneradores.'),
    L('Each task is confirmed by another person.', 'Cada tarea la confirma otra persona.'),
    L('When the Guardia Civil arrives, it takes command and receives the summary.', 'Cuando llega la Guardia Civil, toma el mando y recibe el resumen.'),
  ]),
  S('v18', 'train', 'SIMULATED', T('Trains · seconds, not minutes', 'Trenes · segundos, no minutos'), [
    L('Back to the train. Every phone on board can feel the impact:', 'Volvamos al tren. Cada móvil a bordo puede sentir el impacto:'),
    L('speed, a violent stop, a phone tipping over. Drops and braking are ruled out.', 'velocidad previa, parada brusca, vuelco. Se descartan caídas y frenadas.'),
    L('It asks: are you all right? If there is no answer in twenty to thirty seconds,', '¿Estás bien? Si no hay respuesta en veinte o treinta segundos,'),
    L('that silence is itself vital information for rescuers.', 'ese silencio ya es un dato vital para el rescate.'),
    L('SENDA fuses hundreds of reports: how many trains, which coaches, how many trapped.', 'SENDA fusiona cientos de avisos: cuántos trenes, qué coches, cuántos atrapados.'),
    L('In simulation, the second train is identified in thirty to forty seconds,', 'En simulación, el segundo tren se identifica en 30 a 40 segundos,'),
    L('with a quarter of passengers; with one in twenty, under a minute.', 'con un cuarto de los pasajeros; con uno de cada veinte, en menos de un minuto.'),
    L('The summary goes out in CAP, the format 112 control rooms already read.', 'El resumen sale en CAP, el formato que ya leen las salas del 112.', 'The summary goes out in C A P, the format one one two control rooms already read.'),
  ], { stat: '30–40 s', statCue: 5, statLabel: T('to identify the second train · simulation', 'en identificar el segundo tren · simulación') }),
  S('v19', 'quake', 'SIMULATED', T('Earthquakes · seconds of warning', 'Terremotos · segundos de aviso'), [
    L('No one can predict an earthquake. But once it starts, it can be detected.', 'Nadie puede predecir un terremoto. Pero cuando empieza, se puede detectar.'),
    L('The first wave, the P wave, is fast and weak. The destructive S wave comes later.', 'La primera onda, la P, es rápida y débil. La destructiva, la S, llega después.'),
    L("Each phone's accelerometer watches for the P wave on its own.", 'El acelerómetro de cada móvil vigila la onda P por su cuenta.'),
    L('With four phones or more, the network locates the epicentre', 'Con cuatro móviles o más, la red localiza el epicentro'),
    L('and counts the seconds before the S wave reaches each town.', 'y cuenta los segundos hasta que la onda S llega a cada pueblo.'),
    L('In synthetic data, fourteen phones locate it within half a kilometre.', 'Con datos sintéticos, catorce móviles lo sitúan con medio kilómetro de error.'),
    L('One unofficial source triggers nothing: a public catalogue must confirm.', 'Una fuente no oficial nunca activa nada: lo debe confirmar un catálogo público.'),
  ]),
  S('v20', 'valley', 'SIMULATED', T('Floods · measure upstream, warn downstream', 'Inundaciones · medir arriba, avisar abajo'), [
    L('For floods, SENDA turns rainfall into river flow with classic hydrology,', 'En inundaciones, SENDA convierte la lluvia en caudal con hidrología clásica,'),
    L('includes the reservoirs, and watches how fast the water rises upstream.', 'tiene en cuenta los embalses y vigila lo rápido que sube el agua aguas arriba.'),
    L('In a synthetic scenario, the warning leaves two and a half hours', 'En un escenario sintético, el aviso sale dos horas y media'),
    L('before the first town floods: a town where only three litres per square metre fell.', 'antes de que se inunde el primer pueblo, donde solo cayeron tres litros por metro.'),
  ], { mode: 'warn', stat: '2 h 30', statCue: 2, statLabel: T('of warning · synthetic scenario', 'de aviso · escenario sintético') }),
  S('v21', 'fire', 'SIMULATED', T('Wildfires · warn before the mast burns', 'Incendios · avisar antes de que arda la antena'), [
    L('In a wildfire, SENDA computes the spread with wind, slope and fuel,', 'En un incendio, SENDA calcula el avance con viento, pendiente y combustible,'),
    L('and crosses its arrival time with every phone mast and every town.', 'y cruza su hora de llegada con cada antena y cada pueblo.'),
    L('Here, the mast serving the town burns one hundred and seven minutes', 'Aquí, la antena que da servicio al pueblo arde ciento siete minutos'),
    L('before the deadline to warn it.', 'antes del límite para avisarlo.'),
    L('So the alert must leave earlier, or travel by mesh, LoRa and satellite.', 'Así que la alerta debe salir antes, o viajar por malla, LoRa y satélite.', 'So the alert must leave earlier, or travel by mesh, LOR-ah and satellite.'),
  ], { stat: '107 min', statCue: 2, statLabel: T('of warning margin lost · simulation', 'de margen de aviso perdido · simulación') }),
  S('v22', 'building', 'SIMULATED', T('Collapsed buildings · from outside', 'Edificios derrumbados · desde fuera'), [
    L('When nobody can enter a building, a drone climbs the façade floor by floor,', 'Cuando nadie puede entrar en un edificio, un dron sube la fachada planta a planta,', 'When nobody can enter a building, a drone climbs the facade floor by floor,'),
    L('listening to the Bluetooth beacons that phones emit, without connecting to them.', 'escuchando las balizas Bluetooth de los móviles, sin conectarse a ellos.'),
    L('Phones change address every few minutes,', 'Los móviles cambian de dirección cada pocos minutos,'),
    L('so SENDA counts how many are active at the same time.', 'así que SENDA cuenta cuántos hay activos a la vez.'),
    L('Across 720 simulated floors, its margin held the real figure 95 % of the time.', 'En 720 plantas simuladas, el margen acertó la cifra real el 95 % de las veces.', 'Across seven hundred and twenty simulated floors, its margin held the real figure ninety-five percent of the time.'),
    L('Under rubble, five phones hear a knock', 'Bajo escombros, cinco móviles oyen un golpe'),
    L('and place it within ten centimetres, in simulation.', 'y lo sitúan a diez centímetros, en simulación.'),
    L('A phone that does not answer is listed as missing, unconfirmed. Never as a victim.', 'Quien no responde figura como desaparecido sin confirmar. Nunca como víctima.'),
  ], { stat: '95 %', statCue: 3, statLabel: T('interval coverage · 720 simulated floors', 'cobertura del intervalo · 720 plantas simuladas') }),
  S('v23', 'zone', 'CALCULATED', T('Coordinators and agencies', 'Coordinadores y organismos'), [
    L('Who can send alerts? Only an agency, with its own trust anchor,', '¿Quién envía alertas? Solo un organismo, con su propia ancla de confianza,'),
    L('signing credentials for its coordinators.', 'que firma las credenciales de sus coordinadores.'),
    L('A coordinator marks a zone and sends a signed order:', 'Un coordinador marca una zona y envía una orden firmada:'),
    L('siren, beacon, sensor report, evacuation.', 'sirena, baliza, informe de sensores, evacuación.'),
    L("Each phone checks the signature, the zone and its owner's consent before acting.", 'Cada móvil comprueba firma, zona y permiso de su dueño antes de actuar.'),
    L('Residents answer with one tap.', 'Los vecinos responden con un toque.'),
    L('The coordinator sees a board, building by building, floor by floor.', 'El coordinador ve un cuadro por edificio y por planta.'),
    L('SENDA never impersonates the official alert.', 'SENDA nunca suplanta la alerta oficial.'),
    L('It carries it where the network no longer reaches.', 'La lleva donde la red ya no llega.'),
  ], { screens: ['e2e-11-coordinator-board.png'] }),
  S('v24', 'network', 'CALCULATED', T('More people, stronger network', 'Más personas, red más fuerte'), [
    L('Like other decentralised networks, SENDA does not depend on a central server.', 'Como otras redes descentralizadas, SENDA no depende de un servidor central.'),
    L('Every phone is a node: the more people use it, the denser the mesh.', 'Cada móvil es un nodo: cuanta más gente lo usa, más densa es la malla.'),
    L('Signed delivery receipts teach the network which channels really work, area by area,', 'Los recibos de entrega firmados enseñan a la red qué canales funcionan en cada zona,'),
    L('and those counts merge between phones without any central server.', 'y esos recuentos se combinan entre móviles sin servidor central.'),
    L('It reads open sources too: USGS and GDACS for disasters, Copernicus imagery,', 'También lee fuentes abiertas: USGS y GDACS para desastres, imágenes de Copernicus,', 'It reads open sources too: U S G S and G D A C S for disasters, Copernicus imagery,'),
    L('MET Norway weather, and traffic from the DGT and the Dutch NDW in DATEX II.', 'meteorología de MET Norway y tráfico de la DGT y el NDW holandés en DATEX II.', 'MET Norway weather, and traffic from the D G T and the Dutch N D W in DATEX two.'),
    L('Sources that copy each other never count as independent confirmation.', 'Las fuentes que se copian entre sí nunca cuentan como confirmación independiente.'),
  ]),
  S('v25', 'integrate', 'CALCULATED', T('Works with what already exists', 'Funciona con lo que ya existe'), [
    L('The same core runs on a phone, a computer, an agency server,', 'El mismo núcleo funciona en un móvil, un ordenador, el servidor de un organismo,'),
    L('a drone or an emergency vehicle.', 'un dron o un vehículo de emergencias.'),
    L('Alerts in CAP. Traffic in DATEX II. Drones over MAVLink.', 'Alertas en CAP. Tráfico en DATEX II. Drones por MAVLink.', 'Alerts in C A P. Traffic in DATEX two. Drones over MAV-link.'),
    L('Car data over OBD-II, with the owner\'s consent.', 'Datos del coche por OBD-II, con permiso del dueño.', 'Car data over O B D two, with the owner\'s consent.'),
    L('Navigation apps, carmakers and wind farms connect through official agreements.', 'Apps de navegación, fabricantes y parques eólicos se conectan por convenio oficial.'),
    L("Never by breaking into anyone's systems.", 'Nunca entrando en sistemas ajenos.'),
  ]),
  S('v26', 'modules', 'SIMULATED', T('Modules from a few euros', 'Módulos de pocos euros'), [
    L('And it grows with cheap hardware. An ESP32 board turns a mast or a drone', 'Y crece con hardware barato. Una placa ESP32 convierte un mástil o un dron', 'And it grows with cheap hardware. An E S P thirty-two board turns a mast or a drone'),
    L('into a Wi-Fi and beacon scanner. Its firmware is already built in CI.', 'en un escáner de wifi y balizas. Su firmware ya se compila en CI.', 'into a Wi-Fi and beacon scanner. Its firmware is already built in C I.'),
    L('We are designing more from off-the-shelf parts: a 24 gigahertz radar', 'Diseñamos más con piezas de catálogo: un radar de 24 gigahercios', 'We are designing more from off-the-shelf parts: a twenty-four gigahertz radar'),
    L('that sees a person moving, even through smoke;', 'que ve moverse a una persona, incluso entre humo;'),
    L('a micro-seismograph for river bridges; a solar LoRa repeater.', 'un microsismógrafo para puentes de río; un repetidor LoRa solar.', 'a micro-seismograph for river bridges; a solar LOR-ah repeater.'),
    L('Estimated parts cost: five to twenty euros each. Designed, not yet field-tested.', 'Coste estimado en piezas: de 5 a 20 euros. Diseñados, aún sin probar en campo.'),
  ]),
  S('v27', 'proof', 'OBSERVED', T('Verified by machine · honest about what is missing', 'Verificado por máquina · honesto con lo que falta'), [
    L(`Every change is checked by machine: ${tests.core} core tests,`, `Cada cambio se comprueba por máquina: ${tests.core} pruebas del núcleo`),
    L(`and ${tests.e2e} end-to-end checks, almost all with the network cut.`, `y ${tests.e2e} comprobaciones de extremo a extremo, casi todas sin red.`),
    L(`Built with an engineering corps of ${agents} specialised AI agents,`, `Construido con un cuerpo de ingeniería de ${agents} agentes de IA especializados`),
    L('independent red teams, and one rule: never invent.', 'equipos rojos independientes y una regla: no inventar.'),
    L('What is missing, we say: field pilots with real phones and rescue teams,', 'Lo que falta, lo decimos: pilotos de campo con móviles reales y equipos de rescate,'),
    L('an independent security audit, and certification for public procurement.', 'una auditoría de seguridad independiente y la certificación para compra pública.'),
    L('Next: a pilot with civil protection, a gateway to 112, and a mobile operator.', 'Siguiente: un piloto con protección civil, una pasarela al 112 y un operador móvil.', 'Next: a pilot with civil protection, a gateway to one one two, and a mobile operator.'),
  ], { core: tests.core, e2e: tests.e2e, agents }),
  S('v28', 'cta', 'OBSERVED', T('So that no message is lost', 'Para que ningún mensaje se pierda'), [
    L('SENDA. So that no message is lost.', 'SENDA. Para que ningún mensaje se pierda.'),
    L('Try it now, with no app store, at the address on screen.', 'Pruébalo ya, sin tienda de apps, en la dirección que ves en pantalla.'),
  ], { url: 'civic-relay-investor.vercel.app/senda', repo: 'github.com/abrahamhl/civic-relay' }),
];

// ── Voz: números y siglas tal y como se pronuncian
const W1 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const W10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const numWords = (n) => (n < 20 ? W1[n] : n < 100 ? W10[Math.floor(n / 10)] + (n % 10 ? `-${W1[n % 10]}` : '') : n < 1000 ? `${W1[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numWords(n % 100)}` : ''}` : die(`número sin locución: ${n}`));
const N2W = [[/\b(\d{1,3})\b(?![.,]\d)/g, (_, d) => numWords(+d)]];
const SAY = [...N2W, [/\bSENDA\b/g, 'Senda'], [/\bLoRa\b/g, 'LOR-ah'], [/\bWi-Fi\b/g, 'why-fye'], [/\bAI\b/g, 'A I'], [/\bSOS\b/g, 'S O S'], [/\bGPS\b/g, 'G P S'], [/\bESP32\b/g, 'E S P thirty-two'], [/\bDGT\b/g, 'D G T'], [/\b112\b/g, 'one one two']];
const fits = (s) => s.length <= 42 || s.split(' ').some((_, i, w) => i && w.slice(0, i).join(' ').length <= 42 && w.slice(i).join(' ').length <= 42);
const bad = scenes.flatMap((sc) => sc.lines.flatMap((l) => ['en', 'es'].filter((lang) => !fits(l[lang])).map((lang) => `${sc.id} ${lang} (${l[lang].length}): «${l[lang]}»`)));
if (bad.length) die(`no caben en 2×42:\n  ${bad.join('\n  ')}`);
const out = scenes.map((sc) => {
  return {
    id: sc.id, claim: sc.claim, title: sc.title, visual: { kind: sc.kind, ...sc.extra },
    en: sc.lines.map((l) => l.en), es: sc.lines.map((l) => l.es),
    en_say: sc.lines.map((l) => (l.say ?? SAY.reduce((s, [a, b]) => s.replace(a, b), l.en))),
  };
});
for (const sc of out) for (const s of sc.en_say) if (/[%→²≤≥≈]|\d/.test(s)) die(`${sc.id}: la voz contiene símbolos o cifras: «${s}»`);
const doc = {
  note: 'SENDA · película de presentación a inversores v2 (motor 3D cinema.html). Generado por build-investor-film.mjs; no editar a mano.',
  counts: { ...tests, agents, estadoSha: estado.sha },
  physics: { rain868DbKm: r868, rain28DbKm: r28, knifeEdge60mDb: knife },
  voices: { en: { voice: 'bf_emma', lang: 'en-gb', speed: 0.95 } },
  scenes: out,
};
fs.writeFileSync(path.join(__dirname, 'investor-film.json'), JSON.stringify(doc, null, 1) + '\n', 'utf8');
const words = out.reduce((n, s) => n + s.en_say.join(' ').split(/\s+/).length, 0);
console.log(`=> investor-film.json · ${out.length} escenas · ${out.reduce((n, s) => n + s.en.length, 0)} frases · ${words} palabras (~${(words / 150).toFixed(1)} min)`);
