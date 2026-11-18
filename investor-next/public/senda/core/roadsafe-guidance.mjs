/**
 * SENDA RoadSafe · Guía de emergencia en carretera: preguntas de seguridad, ¿quedarse o salir?, implicados.
 *
 * Diseño para estrés: una pregunta por pantalla, respuesta de un toque (SÍ / NO / NO SÉ), funciona sin red
 * y sin registro, y el botón 112 está SIEMPRE visible. «No sé» nunca bloquea: se trata con precaución.
 *
 * Base de las recomendaciones (resumen de guías públicas; DEBE validarse con la DGT y un 112 antes del uso real):
 *  - DGT: chaleco antes de bajar, salir por el lado contrario al tráfico, esperar tras la barrera o fuera
 *    de la calzada; no situarse entre vehículos.
 *  - Highway Code del Reino Unido (averías en autopista): si no es seguro salir o no hay lugar seguro,
 *    permanecer dentro con el cinturón puesto y luces de emergencia, y llamar a emergencias.
 *  - Primeros auxilios PAS: no mover a heridos salvo peligro inminente (fuego, riesgo de nuevo impacto).
 * La guía nunca sustituye las instrucciones del operador del 112: si estás en llamada, sigue al operador.
 */

export const GUIDANCE_VERSION = 'roadsafe-guidance/1';

/** Preguntas en orden de prioridad vital. `skipIf` permite saltar lo ya contestado o irrelevante. */
export const SAFETY_QUESTIONS = Object.freeze([
  { id: 'fire', es: '¿Hay humo o fuego?', en: 'Is there smoke or fire?', nl: 'Is er rook of brand?', de: 'Gibt es Rauch oder Feuer?', fr: 'Y a-t-il de la fumée ou du feu ?' },
  { id: 'trapped', es: '¿Alguien está atrapado o no puede salir?', en: 'Is anyone trapped or unable to get out?', nl: 'Zit iemand bekneld of kan iemand er niet uit?', de: 'Ist jemand eingeklemmt oder kann nicht aussteigen?', fr: 'Quelqu’un est-il coincé ou incapable de sortir ?' },
  { id: 'injured', es: '¿Hay alguien herido?', en: 'Is anyone injured?', nl: 'Is er iemand gewond?', de: 'Ist jemand verletzt?', fr: 'Y a-t-il des blessés ?' },
  { id: 'unconscious', es: '¿Alguien no responde o no respira con normalidad?', en: 'Is anyone unresponsive or not breathing normally?', nl: 'Reageert iemand niet of ademt iemand niet normaal?', de: 'Reagiert jemand nicht oder atmet nicht normal?', fr: 'Quelqu’un ne répond-il pas ou ne respire-t-il pas normalement ?' },
  { id: 'inLane', es: '¿Tu vehículo está dentro de un carril de circulación?', en: 'Is your vehicle inside a traffic lane?', nl: 'Staat je voertuig op een rijstrook?', de: 'Steht Ihr Fahrzeug auf einem Fahrstreifen?', fr: 'Votre véhicule est-il sur une voie de circulation ?' },
  { id: 'safeRefuge', es: '¿Hay un lugar seguro (tras la barrera o fuera de la calzada) al que llegar SIN cruzar carriles?', en: 'Is there a safe place (behind the barrier or off the road) you can reach WITHOUT crossing lanes?', nl: 'Is er een veilige plek (achter de vangrail of naast de weg) die je kunt bereiken ZONDER rijstroken over te steken?', de: 'Gibt es einen sicheren Ort (hinter der Schutzplanke oder neben der Fahrbahn), den Sie OHNE Fahrstreifen zu queren erreichen?', fr: 'Existe-t-il un endroit sûr (derrière la glissière ou hors de la chaussée) accessible SANS traverser de voies ?' },
  { id: 'exitAwaySide', es: '¿Podéis salir todos por el lado contrario al tráfico?', en: 'Can everyone get out on the side away from traffic?', nl: 'Kan iedereen uitstappen aan de kant weg van het verkeer?', de: 'Können alle auf der verkehrsabgewandten Seite aussteigen?', fr: 'Tout le monde peut-il sortir du côté opposé à la circulation ?' },
  { id: 'reducedMobility', es: '¿Hay niños pequeños o personas con movilidad reducida?', en: 'Are there small children or people with reduced mobility?', nl: 'Zijn er kleine kinderen of mensen met beperkte mobiliteit?', de: 'Sind kleine Kinder oder Personen mit eingeschränkter Mobilität dabei?', fr: 'Y a-t-il de jeunes enfants ou des personnes à mobilité réduite ?' },
  { id: 'dangerousGoods', es: '¿Hay un vehículo con panel naranja (mercancías peligrosas) implicado?', en: 'Is a vehicle with an orange plate (dangerous goods) involved?', nl: 'Is er een voertuig met oranje bord (gevaarlijke stoffen) betrokken?', de: 'Ist ein Fahrzeug mit orangefarbener Warntafel (Gefahrgut) beteiligt?', fr: 'Un véhicule avec un panneau orange (matières dangereuses) est-il impliqué ?' },
]);
export const COUNT_FIELDS = Object.freeze(['vehicles', 'people', 'injured', 'trapped', 'children', 'pedestriansHit']);

const ans = (a, k) => (a[k] === true ? 'YES' : a[k] === false ? 'NO' : 'UNKNOWN');

/**
 * Decisión ¿quedarse o salir? Devuelve: decision, prioridad, pasos (en el idioma pedido) y por qué.
 * decision: EXIT_NOW_FIRE · EXIT_TO_REFUGE · STAY_BELTED · STAY_WITH_INJURED · CALL_112_AND_STAY_ALERT
 */
export function decideStayOrExit(a = {}, { lang = 'es' } = {}) {
  const T = STEPS[lang] ?? STEPS.es, why = [];
  const fire = ans(a, 'fire'), trapped = ans(a, 'trapped'), inLane = ans(a, 'inLane'), refuge = ans(a, 'safeRefuge'), away = ans(a, 'exitAwaySide');
  let decision;
  if (fire === 'YES') { decision = 'EXIT_NOW_FIRE'; why.push('humo o fuego: el riesgo dentro supera al de fuera'); }
  else if (refuge === 'YES' && away !== 'NO') { decision = 'EXIT_TO_REFUGE'; why.push('hay lugar seguro alcanzable sin cruzar carriles'); }
  else if (refuge === 'NO' || away === 'NO') { decision = 'STAY_BELTED'; why.push(refuge === 'NO' ? 'no hay lugar seguro alcanzable' : 'no se puede salir por el lado sin tráfico'); }
  else { decision = 'CALL_112_AND_STAY_ALERT'; why.push('información insuficiente: llamar al 112 y decidir con el operador'); }
  // Personas que no pueden moverse: quien pueda, a lugar seguro; no mover heridos salvo peligro inminente.
  const someoneStuck = trapped === 'YES' || a.unconscious === true;
  if (someoneStuck && decision === 'EXIT_TO_REFUGE') { decision = 'STAY_WITH_INJURED'; why.push('hay personas que no pueden salir: no moverlas salvo fuego; los demás, a lugar seguro si es posible'); }
  const steps = [T.call112, ...(T[decision] ?? [])];
  if (inLane === 'YES' && decision !== 'EXIT_NOW_FIRE') steps.push(T.inLane);
  if (a.reducedMobility === true) steps.push(T.reducedMobility);
  if (a.dangerousGoods === true) steps.push(T.dangerousGoods);
  const priority = fire === 'YES' || someoneStuck || a.injured === true ? 'LIFE' : inLane === 'YES' ? 'HIGH' : 'STANDARD';
  return { version: GUIDANCE_VERSION, decision, priority, steps, why, call112: { href: 'tel:112', automatic: false }, validation: 'Pendiente de validación por DGT/112; seguir siempre al operador del 112.' };
}

const STEPS = {
  es: {
    call112: 'Llama al 112 (o pulsa el botón). Si ya hablas con el operador, sigue sus instrucciones.',
    EXIT_NOW_FIRE: ['Salid todos ya por el lado contrario al tráfico y alejaos del vehículo.', 'Situaos fuera de la calzada, lejos del humo; no volváis a por objetos.'],
    EXIT_TO_REFUGE: ['Luces de emergencia y V16 encendidas; chaleco puesto antes de bajar.', 'Salid por el lado contrario al tráfico y esperad tras la barrera o fuera de la calzada.', 'Nunca entre vehículos ni detrás del vuestro, fuera de la línea de un posible empuje.'],
    STAY_BELTED: ['Quedaos dentro con el cinturón puesto y las luces de emergencia encendidas.', 'Activa la V16 desde la ventanilla si puedes hacerlo sin salir.'],
    STAY_WITH_INJURED: ['No muevas a quien no puede salir, salvo fuego o peligro inminente.', 'Quien pueda salir con seguridad, que espere tras la barrera.', 'Habla con el herido y dale calor; el 112 te guiará.'],
    CALL_112_AND_STAY_ALERT: ['Mantén el cinturón y las luces de emergencia mientras decides con el operador.'],
    inLane: 'El vehículo está en un carril: díselo al 112 en primer lugar.',
    reducedMobility: 'Indica al 112 que hay niños o personas con movilidad reducida.',
    dangerousGoods: 'Mercancías peligrosas: alejaos y comunica el número del panel naranja si es visible desde lejos.',
  },
  en: {
    call112: 'Call 112 (or press the button). If you are talking to the operator, follow their instructions.',
    EXIT_NOW_FIRE: ['Everyone get out now on the side away from traffic and move away from the vehicle.', 'Stay off the road, away from the smoke; do not go back for belongings.'],
    EXIT_TO_REFUGE: ['Hazard lights and V16 on; put on the vest before getting out.', 'Exit on the side away from traffic and wait behind the barrier or off the road.', 'Never between vehicles or behind yours, out of the line of a possible push.'],
    STAY_BELTED: ['Stay inside with seat belts on and hazard lights on.', 'Switch on the V16 from the window if you can without getting out.'],
    STAY_WITH_INJURED: ['Do not move anyone who cannot get out unless there is fire or immediate danger.', 'Whoever can get out safely should wait behind the barrier.', 'Talk to the injured person and keep them warm; 112 will guide you.'],
    CALL_112_AND_STAY_ALERT: ['Keep seat belts and hazard lights on while you decide with the operator.'],
    inLane: 'The vehicle is in a lane: tell 112 first.', reducedMobility: 'Tell 112 there are children or people with reduced mobility.', dangerousGoods: 'Dangerous goods: move away and report the orange plate number if visible from a distance.',
  },
  nl: {
    call112: 'Bel 112 (of druk op de knop). Spreek je al met de centralist, volg dan diens aanwijzingen.',
    EXIT_NOW_FIRE: ['Stap allemaal nu uit aan de kant weg van het verkeer en loop weg van het voertuig.', 'Blijf van de weg, uit de rook; ga niet terug voor spullen.'],
    EXIT_TO_REFUGE: ['Alarmlichten en V16 aan; hesje aan vóór het uitstappen.', 'Stap uit aan de kant weg van het verkeer en wacht achter de vangrail of naast de weg.', 'Nooit tussen voertuigen of achter het jouwe.'],
    STAY_BELTED: ['Blijf zitten met de gordel om en de alarmlichten aan.', 'Zet het V16-baken vanuit het raam aan als dat lukt zonder uit te stappen.'],
    STAY_WITH_INJURED: ['Verplaats niemand die niet kan uitstappen, behalve bij brand of direct gevaar.', 'Wie veilig kan uitstappen, wacht achter de vangrail.', 'Praat met de gewonde en houd hem warm; 112 begeleidt je.'],
    CALL_112_AND_STAY_ALERT: ['Houd gordel en alarmlichten aan terwijl je met de centralist beslist.'],
    inLane: 'Het voertuig staat op een rijstrook: meld dat eerst aan 112.', reducedMobility: 'Meld aan 112 dat er kinderen of mensen met beperkte mobiliteit zijn.', dangerousGoods: 'Gevaarlijke stoffen: ga op afstand en meld het nummer van het oranje bord als het van ver zichtbaar is.',
  },
};

/** Recuento de implicados validado (para el expediente del 112): coherencia y campos faltantes. */
export function validateCounts(c = {}) {
  const issues = [], out = {};
  for (const k of COUNT_FIELDS) { const v = c[k]; if (v == null || v === '') { out[k] = null; continue; } const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 200) issues.push(`${k} no válido`); else out[k] = n; }
  if (out.people != null && out.injured != null && out.injured > out.people) issues.push('más heridos que personas');
  if (out.injured != null && out.trapped != null && out.trapped > out.people) issues.push('más atrapados que personas');
  if (out.people != null && out.children != null && out.children > out.people) issues.push('más niños que personas');
  return { counts: out, issues, missing: COUNT_FIELDS.filter((k) => out[k] == null) };
}

/** Respuestas → campos del expediente 112 (roadsafe-emergency-gateway.buildEmergencyDossier → scene). */
export function toDossierScene(answers, counts, decision) {
  const v = validateCounts(counts);
  return { vehicles: v.counts.vehicles ?? undefined, people: v.counts.people ?? undefined, injured: v.counts.injured ?? undefined, trapped: answers.trapped === true ? v.counts.trapped ?? 1 : v.counts.trapped ?? undefined, fire: answers.fire === true || undefined, dangerousGoods: answers.dangerousGoods === true || undefined, inLane: answers.inLane, stayOrExit: decision?.decision, unconscious: answers.unconscious === true || undefined, countIssues: v.issues };
}
