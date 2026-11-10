#!/usr/bin/env node
// Construye m96-promo.json: película promocional completa de SENDA (ES/EN, subtítulos ES/EN/NL).
// Recicla escenas verificadas de m95-film.json y m95-ruta.json, añade el origen del proyecto,
// los accidentes en España que lo motivan, el hueco que resuelve y la física con cotas honestas.
// Las cifras de pruebas salen de investor-next/public/senda/estado.json (generado ejecutando las
// pruebas) y las de física se calculan aquí mismo con el núcleo. Nada se escribe a mano.
// Uso: node build-m96-promo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRainAttenuation, computeDtnEpidemicSpreading } from '../../packages/senda/src/telecom-mathematical-physics.mjs';
import { computeDeygoutMultiObstacleDiffraction, computeAcousticNearUltrasoundBudget } from '../../packages/senda/src/scientific-theorems-physics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, f), 'utf8'));
const film = read('m95-film.json');
const ruta = read('m95-ruta.json');
const estado = JSON.parse(fs.readFileSync(path.join(here, '../../investor-next/public/senda/estado.json'), 'utf8'));
const pick = (doc, id) => {
  const sc = doc.scenes.find((s) => s.id === id);
  if (!sc) throw new Error(`escena ${id} no encontrada`);
  return structuredClone(sc);
};

// ---------------------------------------------------------------- números verificados
const CORE = estado.core;
if (!(CORE > 0 && estado.coreTotal === CORE)) throw new Error('estado.json: el núcleo no está en verde');
const E2E = estado.e2e;
const numEs = { 350: 'trescientas cincuenta' };
const numEn = { 350: 'three hundred and fifty' };
const numNl = { 350: 'driehonderdvijftig' };
if (!numEs[CORE]) throw new Error(`añade la forma hablada de ${CORE} pruebas en es/en/nl`);

const rain868 = computeRainAttenuation(0.868, 50, 'V').specificAttenuationDbPerKm;
const rain28 = computeRainAttenuation(28, 50, 'V').specificAttenuationDbPerKm;
const dif = computeDeygoutMultiObstacleDiffraction([{ distanceM: 1200, elevationM: 95 }, { distanceM: 2500, elevationM: 145 }, { distanceM: 3800, elevationM: 120 }], 100, 100, 5000, 868e6);
const ac3 = computeAcousticNearUltrasoundBudget(3, 85, 80);
const ac10 = computeAcousticNearUltrasoundBudget(10, 85, 80);
const dtn = computeDtnEpidemicSpreading(200, 0.5, 12, 0.01);
const fmt = (x, d, lang) => x.toFixed(d).replace('.', lang === 'en' ? '.' : ',');
if (!(rain868 < 0.001 && rain28 > 5)) throw new Error('lluvia: el guion asume <0,001 dB/km a 868 MHz y >5 dB/km a 28 GHz');
if (!(ac3.packetErrorRate < 1e-6 && ac10.packetErrorRate > 0.5)) throw new Error('acústica: el guion asume enlace fiable a 3 m y caído a 10 m');

// ---------------------------------------------------------------- escenas nuevas
const origin = {
  id: 'p0', claim: 'OBSERVED',
  source: ['docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md', 'docs/research/PROCUREMENT_GAP_2026.md'],
  visual: { kind: 'kpis', kpis: [
    { v: { es: 'Incendio', en: 'Wildfire', nl: 'Bosbrand' }, l: { es: 'sin poder hablar con la familia', en: 'no way to reach the family', nl: 'geen contact met de familie' } },
    { v: { es: 'Apagón', en: 'Blackout', nl: 'Stroomstoring' }, l: { es: 'la red móvil cae con las baterías de las antenas', en: 'the mobile network dies with the mast batteries', nl: 'het mobiele netwerk valt uit met de mastaccu’s' } },
    { v: { es: '1 pregunta', en: '1 question', nl: '1 vraag' }, l: { es: '¿cómo pide ayuda quien está atrapado?', en: 'how does someone trapped ask for help?', nl: 'hoe vraagt iemand die vastzit om hulp?' } },
  ] },
  title: { es: 'Por qué existe SENDA', en: 'Why SENDA exists', nl: 'Waarom SENDA bestaat' },
  es: [
    'SENDA nació de una experiencia muy concreta.',
    'Durante un incendio, y después durante el apagón, su creador, Abraham, intentó comunicarse con su familia. Era imposible.',
    'Si eso nos pasa a cualquiera, también le pasa a quien está atrapado esperando ayuda. Esta película explica cómo lo resolvemos.',
  ],
  en: [
    'SENDA was born from a very concrete experience.',
    'During a wildfire, and later during the blackout, its creator, Abraham, tried to reach his family. It was impossible.',
    'If that happens to any of us, it also happens to someone trapped and waiting for help. This film explains how we solve it.',
  ],
  nl: [
    'SENDA ontstond uit een heel concrete ervaring.',
    'Tijdens een bosbrand, en later tijdens de stroomstoring, probeerde de maker, Abraham, zijn familie te bereiken. Het was onmogelijk.',
    'Als dat ieder van ons overkomt, overkomt het ook iemand die vastzit en op hulp wacht. Deze film legt uit hoe we dat oplossen.',
  ],
};

const spain = {
  id: 'p1', claim: 'OBSERVED',
  source: ['docs/research/PROCUREMENT_GAP_2026.md', 'packages/senda/src/rail-watch.mjs', 'packages/senda/src/rail-incident.mjs', 'docs/video/M95_VIDEO_SOURCES.md'],
  visual: {
    kind: 'spainmap',
    kick: { es: 'España · lecciones aprendidas', en: 'Spain · lessons learned', nl: 'Spanje · geleerde lessen' },
    tag: { es: 'observado · fuentes públicas', en: 'observed · public sources', nl: 'waargenomen · openbare bronnen' },
    foot: { es: 'Causas de Adamuz y Gelida pendientes de la investigación oficial (CIAF). SENDA no atribuye culpas.', en: 'Adamuz and Gelida causes pending the official investigation (CIAF). SENDA assigns no blame.', nl: 'Oorzaken van Adamuz en Gelida in afwachting van het officiële onderzoek (CIAF). SENDA wijst geen schuld toe.' },
    events: [
      { lon: -8.53, lat: 42.87, place: { es: 'Angrois · Santiago', en: 'Angrois · Santiago', nl: 'Angrois · Santiago' }, date: { es: '2013', en: '2013', nl: '2013' }, lesson: { es: 'curva sin supervisión continua de la velocidad', en: 'bend without continuous speed supervision', nl: 'bocht zonder continue snelheidsbewaking' } },
      { lon: -4.5, lat: 40.4, labelLeft: true, place: { es: 'Sierra oeste · El Tiemblo', en: 'Western sierra · El Tiemblo', nl: 'Westelijke sierra · El Tiemblo' }, date: { es: 'incendios', en: 'wildfires', nl: 'bosbranden' }, lesson: { es: 'comunicaciones dependientes de Internet', en: 'communications depending on the Internet', nl: 'communicatie afhankelijk van internet' } },
      { lon: -0.42, lat: 39.43, labelLeft: true, place: { es: 'DANA · Valencia', en: 'DANA floods · Valencia', nl: 'DANA · Valencia' }, date: { es: '29-10-2024', en: '29-10-2024', nl: '29-10-2024' }, lesson: { es: 'ES-Alert a las 20:11 · 224 fallecidos (recuento publicado)', en: 'ES-Alert at 20:11 · 224 deaths (published count)', nl: 'ES-Alert om 20:11 · 224 doden (gepubliceerde telling)' } },
      { lon: -3.4, lat: 39.9, wide: true, place: { es: 'Apagón ibérico', en: 'Iberian blackout', nl: 'Iberische stroomstoring' }, date: { es: '28-04-2025', en: '28-04-2025', nl: '28-04-2025' }, lesson: { es: 'conexión estable del 90 % al 40 % en horas', en: 'stable connection from 90 % to 40 % in hours', nl: 'stabiele verbinding van 90 % naar 40 % in uren' } },
      { lon: -4.52, lat: 38.03, labelLeft: true, place: { es: 'Adamuz · Córdoba', en: 'Adamuz · Córdoba', nl: 'Adamuz · Córdoba' }, date: { es: '18-01-2026', en: '18-01-2026', nl: '18-01-2026' }, lesson: { es: '≈45 min para saber que había un segundo tren', en: '≈45 min to learn there was a second train', nl: '≈45 min om te weten dat er een tweede trein was' } },
      { lon: 1.86, lat: 41.44, labelLeft: true, place: { es: 'Gelida · Barcelona', en: 'Gelida · Barcelona', nl: 'Gelida · Barcelona' }, date: { es: '20-01-2026', en: '20-01-2026', nl: '20-01-2026' }, lesson: { es: 'muro y temporal; los maquinistas habían avisado', en: 'wall and storm; train drivers had warned', nl: 'muur en storm; machinisten hadden gewaarschuwd' } },
    ],
  },
  title: { es: 'Lo que nos enseñaron estos accidentes', en: 'What these accidents taught us', nl: 'Wat deze ongevallen ons leerden' },
  es: [
    'España ha aprendido estas lecciones de la peor manera.',
    'En Angrois, en dos mil trece, una curva sin supervisión continua de la velocidad. En los incendios de la sierra oeste, las comunicaciones dependían de Internet.',
    'En la dana de Valencia, el aviso masivo a los móviles llegó a las ocho y once de la tarde. En el apagón de abril de dos mil veinticinco, la red móvil cayó al agotarse las baterías de las antenas.',
    'Y en enero de dos mil veintiséis, en Adamuz, los servicios de emergencia tardaron unos cuarenta y cinco minutos en saber que había un segundo tren.',
    'Dos días después, en Gelida, el temporal afectó a un muro junto a la vía, y los maquinistas habían avisado. Las causas siguen bajo investigación oficial.',
  ],
  en: [
    'Spain has learned these lessons the hard way.',
    'At Angrois, in two thousand thirteen, a bend without continuous speed supervision. In the wildfires of the western sierra, communications depended on the Internet.',
    'In the Valencia floods, the mass alert to phones arrived at eleven minutes past eight in the evening. In the April two thousand twenty-five blackout, the mobile network went down when the mast batteries ran out.',
    'And in January two thousand twenty-six, at Adamuz, emergency services took around forty-five minutes to learn there was a second train.',
    'Two days later, at Gelida, the storm affected a wall next to the track, and train drivers had warned about it. The causes remain under official investigation.',
  ],
  nl: [
    'Spanje heeft deze lessen op de harde manier geleerd.',
    'In Angrois, in tweeduizenddertien, een bocht zonder continue snelheidsbewaking. Bij de bosbranden in de westelijke sierra hing de communicatie af van internet.',
    'Bij de overstromingen in Valencia kwam de massale waarschuwing op telefoons pas om elf over acht ’s avonds. Bij de stroomstoring van april tweeduizendvijfentwintig viel het mobiele netwerk uit toen de mastaccu’s leeg raakten.',
    'En in januari tweeduizendzesentwintig, in Adamuz, duurde het ongeveer vijfenveertig minuten voordat de hulpdiensten wisten dat er een tweede trein was.',
    'Twee dagen later, in Gelida, trof de storm een muur naast het spoor, en machinisten hadden gewaarschuwd. De oorzaken worden nog officieel onderzocht.',
  ],
};

const gap = {
  id: 'p2', claim: 'OBSERVED',
  source: ['docs/research/PROCUREMENT_GAP_2026.md'],
  visual: { kind: 'kpis', kpis: [
    { v: 'ES-Alert · EU-Alert', l: { es: 'dependen de la red celular', en: 'depend on the cellular network', nl: 'zijn afhankelijk van het mobiele netwerk' } },
    { v: 'TETRA · MCX', l: { es: 'conectan a los equipos, no a la ciudadanía', en: 'connect responders, not citizens', nl: 'verbinden hulpverleners, niet burgers' } },
    { v: '2030–2036', l: { es: 'despliegue del sistema europeo de comunicación crítica', en: 'roll-out of the European critical communication system', nl: 'uitrol van het Europese kritieke communicatiesysteem' } },
  ] },
  title: { es: 'El hueco que nadie cubre', en: 'The gap nobody covers', nl: 'Het gat dat niemand dekt' },
  es: [
    'El problema no es la falta de tecnología. Es que no está coordinada.',
    'Toda la cadena oficial de alerta depende de la red móvil, justo la que cae a las pocas horas de un apagón. Y los sistemas de mando conectan a los equipos entre sí, no a la persona atrapada.',
    'Mientras tanto, cada teléfono lleva Bluetooth, wifi, altavoz, micrófono y, cada vez más, satélite. SENDA los pone a trabajar juntos.',
  ],
  es_say: [
    'El problema no es la falta de tecnología. Es que no está coordinada.',
    'Toda la cadena oficial de alerta depende de la red móvil, justo la que cae a las pocas horas de un apagón. Y los sistemas de mando conectan a los equipos entre sí, no a la persona atrapada.',
    'Mientras tanto, cada teléfono lleva blutuz, wifi, altavoz, micrófono y, cada vez más, satélite. SENDA los pone a trabajar juntos.',
  ],
  en: [
    'The problem is not a lack of technology. It is that nothing is coordinated.',
    'The whole official alert chain depends on the mobile network, exactly the one that fails within hours of a blackout. And command systems connect responders to each other, not to the person who is trapped.',
    'Meanwhile, every phone carries Bluetooth, Wi-Fi, a speaker, a microphone and, increasingly, satellite. SENDA makes them work together.',
  ],
  nl: [
    'Het probleem is geen gebrek aan technologie. Het is dat niets gecoördineerd is.',
    'De hele officiële alarmketen hangt af van het mobiele netwerk, precies het netwerk dat binnen enkele uren na een stroomstoring uitvalt. En commandosystemen verbinden hulpverleners met elkaar, niet met de persoon die vastzit.',
    'Intussen heeft elke telefoon bluetooth, wifi, een luidspreker, een microfoon en steeds vaker satelliet. SENDA laat ze samenwerken.',
  ],
};

const science = {
  id: 'p3', claim: 'CALCULATED',
  source: ['packages/senda/src/telecom-mathematical-physics.mjs', 'packages/senda/src/scientific-theorems-physics.mjs', 'packages/senda/tests/telecom-mathematical-physics.test.mjs', 'packages/senda/tests/scientific-theorems-physics.test.mjs'],
  visual: { kind: 'kpis', kpis: [
    { v: { es: `${fmt(rain868, 4, 'es')} vs ${fmt(rain28, 1, 'es')} dB/km`, en: `${fmt(rain868, 4, 'en')} vs ${fmt(rain28, 1, 'en')} dB/km`, nl: `${fmt(rain868, 4, 'nl')} vs ${fmt(rain28, 1, 'nl')} dB/km` },
      l: { es: 'lluvia de 50 mm/h · 868 MHz frente a 28 GHz (ITU-R P.838-3)', en: '50 mm/h rain · 868 MHz vs 28 GHz (ITU-R P.838-3)', nl: '50 mm/u regen · 868 MHz tegenover 28 GHz (ITU-R P.838-3)' } },
    { v: { es: `${fmt(dif.lossEpsteinPetersonDb, 1, 'es')}–${fmt(dif.lossDeygoutDb, 1, 'es')} dB`, en: `${fmt(dif.lossEpsteinPetersonDb, 1, 'en')}–${fmt(dif.lossDeygoutDb, 1, 'en')} dB`, nl: `${fmt(dif.lossEpsteinPetersonDb, 1, 'nl')}–${fmt(dif.lossDeygoutDb, 1, 'nl')} dB` },
      l: { es: 'difracción sobre crestas, acotada entre dos métodos clásicos', en: 'diffraction over ridges, bracketed by two classic methods', nl: 'diffractie over bergkammen, begrensd door twee klassieke methoden' } },
    { v: { es: '3 m ✓ · 10 m ✗', en: '3 m ✓ · 10 m ✗', nl: '3 m ✓ · 10 m ✗' },
      l: { es: 'enlace por sonido a 85 dBA, con su tasa de error real', en: 'sound link at 85 dBA, with its real error rate', nl: 'geluidsverbinding bij 85 dBA, met de echte foutkans' } },
    { v: { es: `${fmt(dtn.t50Hours, 1, 'es')} h`, en: `${fmt(dtn.t50Hours, 1, 'en')} h`, nl: `${fmt(dtn.t50Hours, 1, 'nl')} h` },
      l: { es: 'hasta que la mitad de 200 nodos lleva el SOS (modelo epidémico)', en: 'until half of 200 nodes carry the SOS (epidemic model)', nl: 'tot de helft van 200 knooppunten de SOS draagt (epidemisch model)' } },
  ] },
  title: { es: 'Debajo hay física, no promesas', en: 'Physics underneath, not promises', nl: 'Natuurkunde eronder, geen beloften' },
  es: [
    'Debajo de todo esto hay física, no promesas.',
    'Con una lluvia torrencial de cincuenta milímetros por hora, la banda de ochocientos sesenta y ocho megahercios apenas pierde nada; la de veintiocho gigahercios pierde unos siete decibelios por kilómetro.',
    'La difracción sobre las montañas se acota entre dos métodos clásicos, y el enlace por sonido se calcula con su tasa de error real: funciona a pocos metros, y lo decimos.',
    'Cada cifra sale de modelos publicados y se comprueba contra soluciones analíticas en las pruebas automáticas.',
  ],
  en: [
    'Underneath all of this there is physics, not promises.',
    'In torrential rain of fifty millimetres per hour, the eight hundred and sixty-eight megahertz band barely loses anything; the twenty-eight gigahertz band loses around seven decibels per kilometre.',
    'Diffraction over mountains is bracketed by two classic methods, and the sound link is computed with its real error rate: it works over a few metres, and we say so.',
    'Every figure comes from published models and is checked against analytical solutions in the automated tests.',
  ],
  nl: [
    'Onder dit alles zit natuurkunde, geen beloften.',
    'Bij een stortbui van vijftig millimeter per uur verliest de band van achthonderdachtenzestig megahertz bijna niets; de band van achtentwintig gigahertz verliest ongeveer zeven decibel per kilometer.',
    'Diffractie over bergen wordt begrensd door twee klassieke methoden, en de geluidsverbinding wordt berekend met de echte foutkans: ze werkt over enkele meters, en dat zeggen we.',
    'Elk getal komt uit gepubliceerde modellen en wordt in de automatische tests getoetst aan analytische oplossingen.',
  ],
};
if (Math.round(rain28) !== 7) throw new Error(`el guion dice «unos siete decibelios» pero el núcleo da ${rain28} dB/km`);

// ---------------------------------------------------------------- escenas recicladas (actualizadas)
const s12 = pick(film, 's12');
const s12b = pick(film, 's12b');
const swap = (arr, from, to) => arr.map((l) => { if (!l.includes(from)) return l; return l.replace(from, to); });
for (const [k, from, to] of [['es', 'doscientas sesenta y seis', numEs[CORE]], ['es_say', 'doscientas sesenta y seis', numEs[CORE]], ['en', 'two hundred and sixty-six', numEn[CORE]], ['en_say', 'two hundred and sixty-six', numEn[CORE]], ['nl', 'tweehonderdzesenzestig', numNl[CORE]]]) {
  const before = JSON.stringify(s12[k]); s12[k] = swap(s12[k], from, to);
  if (before === JSON.stringify(s12[k])) throw new Error(`s12.${k}: no se encontró «${from}»`);
}
for (const [k, from, to] of [['es', 'más de doscientas sesenta', numEs[CORE]], ['es_say', 'más de doscientas sesenta', numEs[CORE]], ['en', 'more than two hundred and sixty', numEn[CORE]], ['en_say', 'more than two hundred and sixty', numEn[CORE]], ['nl', 'meer dan tweehonderdzestig', numNl[CORE]]]) {
  const before = JSON.stringify(s12b[k]); s12b[k] = swap(s12b[k], from, to);
  if (before === JSON.stringify(s12b[k])) throw new Error(`s12b.${k}: no se encontró «${from}»`);
}
s12b.visual.kpis[0].v = String(CORE);
if (E2E !== 49) throw new Error(`s12 dice «cuarenta y nueve» E2E; estado.json da ${E2E}`);

const order = [
  origin, spain, gap,
  pick(film, 's2'), pick(film, 's3'), pick(film, 's3b'), pick(film, 's4'), pick(film, 's5'), pick(film, 's5b'), pick(film, 's6'),
  pick(film, 's7'), pick(film, 's8c'), pick(film, 's8'), pick(film, 's8a'), pick(film, 's8b'), pick(film, 's8d'),
  pick(ruta, 'r1'), pick(ruta, 'r2'), pick(ruta, 'r5'), pick(ruta, 'r7'),
  pick(film, 's9'), pick(film, 's10'), pick(film, 's10b'), science, pick(film, 's10c'), pick(film, 's11'), s12, s12b, pick(film, 's13'),
];
// Las escenas recicladas de la ruta se renombran para no chocar con las de la película.
for (const sc of order) if (/^r\d+$/.test(sc.id)) sc.id = `ruta-${sc.id}`;
for (const sc of order) { sc.en_say ??= sc.en; }

const out = {
  note: 'M96 · Película promocional completa de SENDA. Generada por build-m96-promo.mjs a partir de m95-film.json, m95-ruta.json, estado.json y el núcleo. No editar a mano.',
  voices: film.voices,
  scenes: order,
};
fs.writeFileSync(path.join(here, 'm96-promo.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`m96-promo.json · ${order.length} escenas · núcleo ${CORE}/${CORE} · e2e ${E2E} · lluvia ${rain868}/${rain28} dB/km · Deygout/EP ${dif.lossDeygoutDb}/${dif.lossEpsteinPetersonDb} dB · t50 ${dtn.t50Hours} h`);
