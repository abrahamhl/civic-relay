#!/usr/bin/env node
// Genera drive-film.json: película «SENDA Drive · el motor que le faltaba a la V16» (motor 3D cinema.html).
// Regla CLAUDE.md §1: cada afirmación sale de una fuente citada o se CALCULA aquí con el código del repo.
// Si una frase de la narración no coincide con lo que hace el código, el generador falla cerrado.
// Fuentes por escena: docs/video/DRIVE_FILM.md
// Uso: node build-drive-film.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const die = (m) => { console.error(`[FATAL] ${m}`); process.exit(1); };
const check = (cond, msg) => { if (!cond) die(`la narración no coincide con el código: ${msg}`); };
const core = (p) => import(pathToFileURL(path.join(repoRoot, 'packages', 'senda', 'src', p)).href);

// ── 1. Recuentos medidos AHORA (nunca copiados de una página)
const tap = execSync('node --test --test-reporter=tap packages/senda/tests/*.test.mjs', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 << 20, shell: '/bin/bash' });
const corePass = +(/^# pass (\d+)/m.exec(tap)?.[1] ?? NaN), coreFail = +(/^# fail (\d+)/m.exec(tap)?.[1] ?? NaN);
if (!(corePass > 0) || coreFail !== 0) die(`suite del núcleo: ${corePass} pasan, ${coreFail} fallan`);
const e2e = JSON.parse(fs.readFileSync(path.join(repoRoot, 'evidence', 'roadsafe', 'roadsafe-e2e.json'), 'utf8'));
if (e2e.failed !== 0 || !(e2e.passed > 0) || e2e.results.length !== e2e.passed) die(`evidencia E2E RoadSafe incoherente: ${e2e.passed}/${e2e.failed}`);
const vec = fs.readFileSync(path.join(repoRoot, 'packages', 'senda', 'conformance', 'drive-autostart.vectors.txt'), 'utf8').split('\n');
const vScen = vec.filter((l) => l.startsWith('S ')).length, vSteps = vec.filter((l) => l.startsWith('E ')).length;
if (!(vScen > 0 && vSteps > vScen)) die('vectores de conformidad vacíos');
const licence = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');
check(/^MIT License/.test(licence), 'la licencia del repositorio no es MIT');

// ── 2. Comportamientos que la película AFIRMA, ejecutados con el núcleo
const RG = await core('road-guard.mjs');
const REL = RG.EXAMPLE_RELEVANCE;
const at = (dn, de) => ({ lat: 40 + dn / 111320, lon: -3 + de / (111320 * Math.cos((40 * Math.PI) / 180)) });
const approaching = { lat: 40, lon: -3, headingDeg: 0 };
const oncoming = { ...at(800, -20), headingDeg: 180 };
for (const facing of [0, 90, 180, 270]) {
  const r = RG.hazardRelevance(approaching, { ...at(400, -7), type: RG.HAZARD.CRASH, t: 100, headingDeg: facing, speedMs: 0 }, { ...REL, now: 101 });
  check(r.relevant && r.carriagewayUncertain, `coche girado ${facing}°: «avisa y marca la calzada incierta» (${r.why})`);
}
{
  const gps = [...Array.from({ length: 10 }, (_, t) => ({ t, speed: 30, headingDeg: t % 2 ? 359 : 1 })), { t: 11, speed: 9, headingDeg: 300 }, { t: 12, speed: 3, headingDeg: 230 }, { t: 14, speed: 0, headingDeg: 180 }];
  const pre = RG.travelHeadingBefore(gps, 10, { minSpeedMs: 5, windowS: 8 });
  check(pre != null, 'rumbo de marcha anterior al golpe');
  const frame = RG.decodeHazard(RG.encodeHazard({ type: RG.HAZARD.CRASH, t: 100, ...at(400, -7), headingDeg: pre.headingDeg, speedMs: 0, flags: RG.HAZARD_FLAGS.TRAVEL_HEADING }));
  check(RG.hazardRelevance(approaching, frame, { ...REL, now: 101 }).relevant === true, 'con rumbo de marcha: misma calzada avisada');
  check(RG.hazardRelevance(oncoming, frame, { ...REL, now: 101 }).relevant === false, 'con rumbo de marcha: calzada contraria sin falsa alarma');
}
const GD = await core('roadsafe-guidance.mjs');
check(GD.decideStayOrExit({ inLane: true, fire: false, trapped: false }).call112.automatic === false, 'SENDA no llama sola al 112');
const s112 = RG.call112Script({ where: 'autopista', vehicles: 2, lane: 'LEFT_LANE', againstTraffic: true });
check(/carril izquierdo/.test(s112) && /contra la circulación/.test(s112) && !/carril|orientado/.test(RG.call112Script({ where: 'A-3' })), 'guion del 112: carril y orientación solo si se declaran');
const CAM = await core('vehicle-camera-link.mjs');
const evBase = { schema: CAM.CAMERA_EVENT_SCHEMA, eventId: 'film-1', source: CAM.CAMERA_ACCESS.find((s) => s.status === 'OWNER_FILES' && s.kind === 'VEHICLE')?.id, deviceId: 'seudonimo-1', at: 1, lat: 40, lon: -3, anomaly: Object.keys(CAM.ANOMALY_CLASSES)[0], detector: { model: 'yolox', version: 'film', score: null }, consent: { share: true } };
check(CAM.validateCameraEvent(evBase).ok === true, `evento de cámara válido aceptado (${CAM.validateCameraEvent(evBase).errors})`);
for (const k of ['image', 'plate', 'face']) check(CAM.validateCameraEvent({ ...evBase, [k]: 'x' }).privacyReject === true, `evento con «${k}» rechazado por privacidad`);
check(CAM.validateCameraEvent({ ...evBase, consent: undefined }).ok === false, 'evento de vehículo sin consentimiento rechazado');
const notAvail = CAM.CAMERA_ACCESS.filter((s) => s.status === 'NOT_AVAILABLE').map((s) => s.id);
check(notAvail.some((id) => /TESLA|OEM|VISION/i.test(id)), `la visión de a bordo del fabricante figura como NO disponible (${notAvail})`);
const CORR = await core('roadsafe-correlation.mjs');
const srcLR = (k) => CORR.ROAD_SOURCES[k]?.lrPresent;
check(srcLR('VEHICLE_CAMERA_AI') === null && srcLR('PUBLIC_CAMERA_AI') === null, 'cámaras sin calibrar: lrPresent null');
const CD = await core('roadsafe-crash-detect.mjs');
check(CD.EXAMPLE_DETECTION_CONFIG.lr.spinAfter === null, 'el peso del giro está vacío hasta calibrarlo');
// Forma de la curva del acelerómetro en pantalla: traza SINTÉTICA del propio núcleo (no es una medida)
const accel = (() => {
  const tr = CD.syntheticTrace('CRASH_REAR_END'), mag = tr.imu.map((s) => Math.hypot(s.x, s.y, s.z));
  const peak = mag.indexOf(Math.max(...mag)), from = Math.max(0, peak - 150), win = mag.slice(from, from + 400), mx = Math.max(...win);
  return Array.from({ length: 120 }, (_, i) => +(win[Math.floor((i / 119) * (win.length - 1))] / mx).toFixed(3));
})();
check(accel.length === 120 && Math.max(...accel) === 1, 'traza sintética del acelerómetro');
check(Object.entries(CD.EXAMPLE_DETECTION_CONFIG.lr).filter(([k]) => k !== 'spinAfter').every(([, v]) => Number.isFinite(v)) && /EJEMPLO|EXAMPLE/i.test(JSON.stringify(CD.EXAMPLE_DETECTION_CONFIG)), 'los demás pesos son de ejemplo declarado');
const AS = await core('drive-autostart.mjs');
check(AS.AUTOSTART_STATES.join() === 'OFF,IDLE,CANDIDATE,DRIVING,ENDING' && typeof AS.createAutostart === 'function', 'estados de la máquina de arranque');
check(vec.some((l) => /^S sin_consentimiento_no_arranca/.test(l)), 'escenario «sin consentimiento no arranca»');
// Afirmaciones de la frenada en cadena y del SOS (mismas que scripts/prove.mjs)
const { runClaims } = await import(pathToFileURL(path.join(repoRoot, 'scripts', 'film-claims.mjs')).href);
const claims = await runClaims();
for (const id of ['brake-chain', 'sos-rides-cars']) { const c = claims.find((x) => x.id === id); check(c?.ok, `${id}: ${c?.value}`); }
for (const c of claims) if (!c.ok) die(`afirmación no verificada (${c.id}): ${c.value}`);
// CI: la base Android no lleva Internet ni Google; iOS se compila y prueba en macOS
const ciA = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'senda-android-ci.yml'), 'utf8'), ciI = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'senda-ios-ci.yml'), 'utf8');
check(/INTERNET/.test(ciA) && /gms|play-services|GoogleApi/i.test(ciA), 'la CI comprueba que la versión base no lleva Internet ni Google');
check(/macos/.test(ciI) && /test/i.test(ciI), 'la CI compila y prueba la app de iPhone');
const manifestPlay = fs.readdirSync(path.join(repoRoot, 'apps', 'senda-android', 'app', 'src'), { recursive: true }).filter((f) => /CarAppService|DriveCarScreen/.test(String(f)));
check(manifestPlay.length >= 2, 'la versión play lleva pantalla para Android Auto');

// ── 3. Guion: [es, en] por frase; say* = lo que lee la voz si difiere
const L = (es, en, sayEs, sayEn) => ({ es, en, sayEs, sayEn });
const T = (es, en) => ({ es, en });
const S = (id, kind, claim, title, lines, extra = {}) => ({ id, kind, claim, title, lines, extra });
const scenes = [
  S('d01', 'beacon', 'OBSERVED', T('Enero de 2026 · la V16 conectada', 'January 2026 · the connected V16'), [
    L('Desde enero de 2026, la baliza V16 conectada es obligatoria en España.', 'Since January 2026, the connected V16 beacon is mandatory in Spain.'),
    L('La enciendes y envía tu posición a la plataforma DGT 3.0.', 'Switch it on and it sends your position to the DGT 3.0 platform.'),
    L('Tráfico la reenvía a los navegadores conectados.', 'Traffic forwards it to connected navigation apps.'),
    L('Es un gran paso. Pero una luz no sabe lo que ha pasado.', 'It is a big step. But a light does not know what happened.'),
    L('No sabe si fue un choque, en qué carril estás ni hacia dónde miras.', "It doesn't know if it was a crash, your lane, or which way you face."),
    L('Y si nadie puede encenderla, no avisa a nadie.', 'And if nobody can switch it on, it warns no one.'),
  ], { engine: 'aerialBeacon',  stat: 'DGT 3.0', statCue: 1, statLabel: T('posición de la baliza · fuente: DGT', 'beacon position · source: DGT') }),
  S('d02', 'title', 'CALCULATED', T('SENDA Drive · el motor que le faltaba a la V16', 'SENDA Drive · the engine the V16 was missing'), [
    L('Esto es SENDA Drive.', 'This is SENDA Drive.'),
    L('El motor que convierte la baliza en información para quien viene detrás.', 'The engine that turns the beacon into information for whoever comes behind.'),
    L('Va en tu móvil, entiende la carretera y no inventa nada.', 'It lives in your phone, understands the road and invents nothing.'),
  ], { engine: 'backdrop', plate: 'dash', from: 0, dim: 0.5 }),
  S('d03', 'autostart', 'CALCULATED', T('Arranca solo, como un navegador', 'It starts by itself, like a navigator'), [
    L('Lo autorizas una vez y vinculas tu coche.', 'You authorise it once and pair your car.'),
    L('Al subir, el Bluetooth del coche lo arranca; al bajar, se cierra solo.', "Get in, and the car's Bluetooth starts it; get out, and it closes."),
    L('Si solo hay una pista débil, espera a que la velocidad la confirme.', 'If there is only a weak hint, it waits for speed to confirm it.'),
    L('Sin tu permiso, no arranca nunca.', 'Without your permission, it never starts.'),
    L('Android, con o sin Google, e iPhone usan la misma lógica,', 'Android, with or without Google, and iPhone share the same logic,'),
    L(`comprobada con ${vScen} escenarios y ${vSteps} pasos comunes.`, `checked against ${vScen} shared scenarios and ${vSteps} steps.`),
  ], { engine: 'autostartHud',  scen: vScen, steps: vSteps }),
  S('d04', 'road', 'SIMULATED', T('La frenada que no ves', 'The braking you cannot see'), [
    L('Niebla, 120 km/h, 1,2 segundos entre coches.', 'Fog, 120 km/h, 1.2 seconds between cars.', 'Niebla, ciento veinte por hora, uno coma dos segundos entre coches.', 'Fog, a hundred and twenty an hour, one point two seconds between cars.'),
    L('Cada conductor reacciona a las luces del de delante.', 'Each driver reacts to the brake lights ahead.'),
    L('Los retrasos se suman: en el modelo, chocan cinco coches.', 'The delays add up: in the model, five cars crash.'),
    L('Con SENDA, el primer móvil detecta la frenada y avisa a todos a la vez.', 'With SENDA, the first phone detects the braking and warns everyone at once.'),
    L('En el modelo solo choca el que iba pegado. Eso solo lo arregla la distancia.', 'In the model only the tailgater crashes. Only distance fixes that.'),
    L('Sin cobertura, el SOS viaja con los coches que pasan:', 'With no coverage, the SOS rides with passing cars:'),
    L('sale en unos siete minutos con uno de cada diez coches. Es una simulación.', 'out in about seven minutes with one car in ten. It is a simulation.'),
  ], { engine: 'aerialChain',  stat: '5 → 1', statCue: 4, statLabel: T('coches que chocan · resultado del modelo', 'cars crashing · model result') }),
  S('d05', 'sideswipe', 'SIMULATED', T('Un caso real · camión contra turismo', 'A real case · truck against car'), [
    L('Un caso real, contado por uno de los conductores. Anónimo y sin verificar.', 'A real case, told by one of the drivers. Anonymous and unverified.'),
    L('Autopista en Bélgica. La cabina de un camión golpea el lateral de un turismo.', "A Belgian motorway. A truck's cab strikes the side of a car."),
    L('Lo arrastra atravesado, lo suelta, y el coche gira media vuelta.', 'It drags it sideways, lets go, and the car spins half a turn.'),
    L('Queda parado en el carril rápido, mirando contra el tráfico.', 'It stops in the fast lane, facing the traffic.'),
    L('El camión, en el arcén. El peligro real llega ahora: los que vienen detrás.', 'The truck, on the shoulder. The real danger comes now: those behind.'),
  ], { engine: 'aerialSide' }),
  S('d06', 'relevance', 'CALCULATED', T('Lo que este caso destapó en nuestro código', 'What this case exposed in our code'), [
    L('Con este caso encontramos un fallo en nuestro propio código.', 'This case exposed a bug in our own code.'),
    L('Como el coche miraba al revés, se descartaba el aviso: «va en otro sentido».', "Because the car faced backwards, the warning was dropped: 'other direction'."),
    L('Todos los que llegaban por detrás lo habrían ignorado. Ya está corregido.', 'Everyone arriving behind would have ignored it. It is fixed.'),
    L('Ahora, si el rumbo no es fiable, avisa y marca la calzada como incierta.', 'Now, with no reliable heading, it warns and flags the road side as uncertain.'),
    L('Si el móvil envía el rumbo que llevaba antes del golpe,', 'If the phone sends the heading it had before the impact,'),
    L('la calzada contraria ya no recibe una falsa alarma.', 'the opposite carriageway no longer gets a false alarm.'),
  ], { engine: 'aerialRel' }),
  S('d07', 'screens', 'OBSERVED', T('Qué ves en la pantalla', 'What you see on screen'), [
    L('En la app, sin registrarte: qué hacer ahora, paso a paso.', 'In the app, with no sign-up: what to do now, step by step.'),
    L('Un botón para llamar al 112, que siempre es tuyo: SENDA no llama sola.', 'A button to call 112, always yours: SENDA never calls on its own.', 'Un botón para llamar al uno uno dos, que siempre es tuyo: Senda no llama sola.', 'A button to call one one two, always yours: Senda never calls on its own.'),
    L('Un guion para la llamada, con carril y orientación solo si los declaras.', 'A script for the call, with lane and direction only if you declare them.'),
    L('Y avisos fusionados de varias fuentes, cada uno con su procedencia.', 'And warnings fused from several sources, each with its provenance.'),
  ], { engine: 'phoneShot', plate: 'dash',  screens: ['drive-roadsafe-ciudadano.png', 'drive-roadsafe-ciudadano.png', 'drive-roadsafe-ciudadano.png', 'drive-roadsafe-carretera.png'] }),
  S('d08', 'impact', 'CALCULATED', T('Sentir el golpe con el móvil', 'Feeling the impact with the phone'), [
    L('El móvil también siente el golpe: el acelerómetro mide el impulso,', 'The phone feels the impact too: the accelerometer measures the jolt,'),
    L('y el giroscopio, cuánto gira el coche después. Ese trompo fue la pista.', 'and the gyroscope, how far the car turns afterwards. That spin was the clue.'),
    L('Cada señal suma o resta evidencia; ninguna decide sola.', 'Each signal adds or removes evidence; none decides alone.'),
    L('Hoy los pesos son de ejemplo, y el del giro está vacío hasta calibrarlo.', "Today's weights are examples, and the spin weight stays empty until calibrated."),
    L('El arnés de calibración ya existe: entrena y prueba por separado.', 'The calibration harness is ready: it trains and tests separately.'),
  ], { engine: 'sensors',  accel, accelSource: "syntheticTrace('CRASH_REAR_END') · roadsafe-crash-detect.mjs · SINTÉTICA" }),
  S('d09', 'cameras', 'CALCULATED', T('Las cámaras del coche, como sensores', "The car's cameras, as sensors"), [
    L('Muchos coches llevan cámaras. Su dueño puede pasar los clips por SENDA.', 'Many cars carry cameras. Their owner can run the clips through SENDA.'),
    L('Detecta un coche atravesado, otro parado delante o una persona en la vía.', 'It spots a car sideways, one stopped ahead, or a person on the road.'),
    L('Y solo comparte el evento: qué, dónde y cuándo. Nunca la imagen.', 'And it only shares the event: what, where and when. Never the image.'),
    L('Si un evento trae imagen, matrícula o cara, se rechaza.', 'If an event carries an image, a plate or a face, it is rejected.'),
    L('Lo que ve el ordenador de un Tesla no está abierto a terceros. No lo fingimos.', "What a Tesla's computer sees is not open to third parties. We don't pretend."),
    L('Hasta calibrarlas, las cámaras no suben la confianza: solo se anotan.', 'Until calibrated, cameras do not raise confidence: they are only logged.'),
  ], { engine: 'detect' }),
  S('d10', 'screens', 'OBSERVED', T('Para quien coordina', 'For those who coordinate'), [
    L('Para el centro de tráfico, un esquema del incidente con su procedencia.', 'For the traffic centre, a map of the incident with its provenance.'),
    L('Las fuentes que se copian entre sí cuentan una sola vez.', 'Sources that copy each other count only once.'),
    L('Y un laboratorio para reproducir cada caso, marcado como ejercicio.', 'And a lab to replay every case, marked as an exercise.'),
  ], { engine: 'phoneShot', plate: 'harder',  screens: ['drive-roadsafe-operador.png', 'drive-roadsafe-operador.png', 'drive-roadsafe-lab.png'] }),
  S('d11', 'platforms', 'OBSERVED', T('En el móvil y en el coche', 'On the phone and in the car'), [
    L('Android en dos versiones: una sin servicios de Google ni Internet,', 'Android in two versions: one with no Google services and no Internet,'),
    L('y otra con Google y pantalla para Android Auto.', 'and one with Google and an Android Auto screen.'),
    L('Android Auto solo admite ciertas categorías: la nuestra aún es provisional.', 'Android Auto only allows certain categories: ours is still provisional.'),
    L('Y una app nueva para iPhone, compilada y probada en cada cambio.', 'And a new iPhone app, built and tested on every change.'),
  ], { engine: 'devices' }),
  S('d12', 'proof', 'OBSERVED', T('Verificado por máquina · honesto con lo que falta', 'Verified by machine · honest about what is missing'), [
    L(`Cada cambio se comprueba: ${corePass} pruebas del núcleo,`, `Every change is checked: ${corePass} core tests,`),
    L(`${e2e.passed} comprobaciones de la app de carretera en un navegador real,`, `${e2e.passed} checks of the road app in a real browser,`),
    L(`y ${vSteps} pasos del arranque automático, iguales en todas las plataformas.`, `and ${vSteps} automatic-start steps, identical on every platform.`),
    L('Lo que falta, lo decimos: todavía no hay pruebas de campo,', 'What is missing, we say: there are no field trials yet,'),
    L('el arranque automático no se ha probado en móviles reales,', 'automatic start has not been tested on real phones,'),
    L('y los detectores no están calibrados con datos reales.', 'and the detectors are not calibrated with real data.'),
    L('Siguiente paso: un piloto con conductores reales.', 'Next step: a pilot with real drivers.'),
  ], { engine: 'backdrop', plate: 'harder', from: 300, dim: 0.32,  core: corePass, e2e: e2e.passed, agents: vSteps, labels: { es: ['pruebas del núcleo', 'E2E carretera · Chromium', 'pasos de arranque · web, Android, iOS'], en: ['core tests passing', 'road E2E · Chromium', 'autostart steps · web, Android, iOS'] } }),
  S('d13', 'cta', 'OBSERVED', T('Para que quien viene detrás lo sepa a tiempo', 'So that whoever comes behind knows in time'), [
    L('SENDA Drive. Para que quien viene detrás lo sepa a tiempo.', 'SENDA Drive. So that whoever comes behind knows in time.'),
    L('Código abierto, en la dirección que ves en pantalla.', 'Open source, at the address on screen.'),
  ], { url: 'github.com/abrahamhl/civic-relay', repo: 'SENDA Drive' }),
];

// ── 4. Voz: cifras y siglas como se pronuncian
const W1 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const W10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const numEn = (n) => (n < 20 ? W1[n] : n < 100 ? W10[Math.floor(n / 10)] + (n % 10 ? `-${W1[n % 10]}` : '') : n < 1000 ? `${W1[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numEn(n % 100)}` : ''}` : n < 10000 ? `${numEn(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${n % 1000 < 100 ? 'and ' : ''}${numEn(n % 1000)}` : ''}` : die(`número sin locución: ${n}`));
const E1 = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const E10 = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const E100 = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const numEs = (n) => (n < 30 ? E1[n] : n < 100 ? E10[Math.floor(n / 10)] + (n % 10 ? ` y ${E1[n % 10]}` : '') : n === 100 ? 'cien' : n < 1000 ? `${E100[Math.floor(n / 100)]}${n % 100 ? ` ${numEs(n % 100)}` : ''}` : n < 10000 ? `${n < 2000 ? 'mil' : `${numEs(Math.floor(n / 1000))} mil`}${n % 1000 ? ` ${numEs(n % 1000)}` : ''}` : die(`número sin locución: ${n}`));
const SAY_EN = [[/\bDGT 3\.0\b/g, 'D G T three point oh'], [/\bV16\b/g, 'V sixteen'], [/\b(\d{1,4})\b(?![.,]\d)/g, (_, d) => numEn(+d)], [/\bSENDA\b/g, 'Senda'], [/\bDGT\b/g, 'D G T'], [/\bSOS\b/g, 'S O S'], [/\bE2E\b/g, 'end to end'], [/\biPhone\b/g, 'iPhone']];
const SAY_ES = [[/\bV16\b/g, 'uve dieciséis'], [/\bDGT 3\.0\b/g, 'de ge te tres punto cero'], [/\b(\d{1,4})\b(?![.,]\d)/g, (_, d) => numEs(+d)], [/\bSENDA\b/g, 'Senda'], [/\bSOS\b/g, 'ese o ese'], [/\bTesla\b/g, 'Tesla'], [/\biPhone\b/g, 'aifon'], [/\bAndroid Auto\b/g, 'Android Auto'], [/\bBluetooth\b/g, 'blutuz']];
const say = (txt, rules) => rules.reduce((s, [a, b]) => s.replace(a, b), txt);
const fits = (s) => s.length <= 42 || s.split(' ').some((_, i, w) => i && w.slice(0, i).join(' ').length <= 42 && w.slice(i).join(' ').length <= 42);
const bad = scenes.flatMap((sc) => sc.lines.flatMap((l) => ['en', 'es'].filter((lang) => !fits(l[lang])).map((lang) => `${sc.id} ${lang} (${l[lang].length}): «${l[lang]}»`)));
if (bad.length) die(`no caben en 2×42:\n  ${bad.join('\n  ')}`);
const out = scenes.map((sc) => ({
  id: sc.id, claim: sc.claim, title: sc.title, visual: { kind: sc.kind, ...sc.extra },
  es: sc.lines.map((l) => l.es), en: sc.lines.map((l) => l.en),
  es_say: sc.lines.map((l) => l.sayEs ?? say(l.es, SAY_ES)), en_say: sc.lines.map((l) => l.sayEn ?? say(l.en, SAY_EN)),
}));
for (const sc of out) for (const k of ['es_say', 'en_say']) for (const s of sc[k]) if (/[%→²≤≥≈]|\d/.test(s)) die(`${sc.id} ${k}: la voz contiene símbolos o cifras: «${s}»`);
const doc = {
  note: 'SENDA Drive · película (motor 3D cinema.html). Generado por build-drive-film.mjs; no editar a mano. Fuentes: docs/video/DRIVE_FILM.md',
  counts: { core: corePass, roadE2E: e2e.passed, roadE2EAt: e2e.at, autostartScenarios: vScen, autostartSteps: vSteps },
  tagline: { es: 'DRIVE · EL MOTOR DE LA V16', en: 'DRIVE · THE ENGINE FOR THE V16' },
  voices: { es: { voice: 'ef_dora', lang: 'es', speed: 1.0 }, en: { voice: 'bf_emma', lang: 'en-gb', speed: 0.95 } },
  scenes: out,
};
fs.writeFileSync(path.join(__dirname, 'drive-film.json'), JSON.stringify(doc, null, 1) + '\n', 'utf8');
const words = out.reduce((n, s) => n + s.es_say.join(' ').split(/\s+/).length, 0);
console.log(`=> drive-film.json · ${out.length} escenas · ${out.reduce((n, s) => n + s.es.length, 0)} frases · ${words} palabras ES · núcleo ${corePass} · E2E ${e2e.passed} · vectores ${vScen}/${vSteps}`);
