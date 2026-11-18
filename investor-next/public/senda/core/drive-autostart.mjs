/**
 * SENDA Drive · Arranque automático al coger el coche (máquina de estados de REFERENCIA).
 *
 * Objetivo: como en Waze, SENDA debe estar activa al conducir sin que el conductor toque nada, pero
 * SOLO con su consentimiento expreso y revocable. Esta máquina es la referencia común: las apps
 * Android (Java) e iOS (Swift) la reimplementan y deben reproducir EXACTAMENTE los vectores de
 * conformidad generados aquí (`packages/senda/conformance/drive-autostart.vectors.txt`).
 *
 * Señales (las da cada plataforma; esta máquina no accede a sensores ni a la red):
 *  · CAR_LINK_APPEARED / CAR_LINK_GONE — el coche que el usuario vinculó aparece o desaparece
 *    (Android: CompanionDeviceManager con el Bluetooth del coche). Señal FUERTE: es su coche.
 *  · VEHICLE_HINT_ENTER / VEHICLE_HINT_EXIT — el sistema cree que vas en un vehículo (Android «Play»:
 *    Activity Recognition; iOS: CoreMotion «automotive»). Señal DÉBIL: podría ser un autobús o ir de
 *    pasajero, así que exige confirmación por velocidad dentro de una ventana.
 *  · SPEED { ms } — velocidad GNSS en m/s. TICK — paso del tiempo.
 *    El cierre por inactividad (parado `idleStopS`) solo se aplica si NO hay enlace con el coche: con el
 *    coche vinculado presente (atasco largo, GNSS sin velocidad) la sesión termina cuando el coche se va.
 *  · USER_START / USER_STOP — el conductor manda siempre. Tras USER_STOP no se rearranca solo hasta
 *    que el coche desaparezca (no se pelea con el usuario).
 *  · CONSENT { autoStart } — sin consentimiento de arranque automático, el estado es OFF y nada
 *    automático ocurre; retirarlo cierra la sesión en curso.
 *
 * Regla de veracidad (CLAUDE.md): todos los umbrales se DECLARAN (`need`); EXAMPLE_AUTOSTART es un
 * escenario de ejemplo sin fuente verificada. Esta máquina no afirma ninguna eficacia: solo decide
 * cuándo empieza y termina una sesión.
 */
const need = (name, o, keys) => { for (const k of keys) if (!Number.isFinite(o?.[k])) throw new Error(`${name}: «${k}» debe declararse`); };

export const AUTOSTART_STATES = Object.freeze(['OFF', 'IDLE', 'CANDIDATE', 'DRIVING', 'ENDING']);
export const AUTOSTART_EVENTS = Object.freeze(['CONSENT', 'CAR_LINK_APPEARED', 'CAR_LINK_GONE', 'VEHICLE_HINT_ENTER', 'VEHICLE_HINT_EXIT', 'SPEED', 'TICK', 'USER_START', 'USER_STOP']);
const PARAMS = ['confirmSpeedMs', 'confirmWindowS', 'stopSpeedMs', 'idleStopS', 'endGraceS'];

/**
 * EJEMPLO DECLARADO, fuente no verificada: confirmar a ≥ 5 m/s (18 km/h) en 120 s, considerar parado
 * por debajo de 1,5 m/s, cerrar tras 300 s parado y 60 s de gracia. Calibrar con trayectos reales.
 */
export const EXAMPLE_AUTOSTART = Object.freeze({ confirmSpeedMs: 5, confirmWindowS: 120, stopSpeedMs: 1.5, idleStopS: 300, endGraceS: 60, basis: 'EJEMPLO_DECLARADO · fuente no verificada; pendiente de calibrar con trayectos reales' });

/** Crea la máquina. params DECLARADOS: { confirmSpeedMs, confirmWindowS, stopSpeedMs, idleStopS, endGraceS }. */
export function createAutostart(params) {
  need('createAutostart', params, PARAMS);
  const P = Object.freeze(Object.fromEntries(PARAMS.map((k) => [k, params[k]])));
  const s = { state: 'OFF', autoConsent: false, suppressed: false, manual: false, carLinked: false, candidateSince: null, lastMovingT: null, endingSince: null };
  const start = (reason, actions) => actions.push({ type: 'START_SESSION', reason });
  const stop = (reason, actions) => actions.push({ type: 'STOP_SESSION', reason });
  const rest = () => (s.autoConsent ? 'IDLE' : 'OFF');

  function handle(ev) {
    if (!ev || !AUTOSTART_EVENTS.includes(ev.type)) throw new Error(`drive-autostart: evento desconocido «${ev?.type}»`);
    if (!Number.isFinite(ev.t)) throw new Error('drive-autostart: «t» debe declararse');
    const a = [], t = ev.t;
    switch (ev.type) {
      case 'CONSENT':
        if (ev.autoStart === true) { s.autoConsent = true; if (s.state === 'OFF') s.state = 'IDLE'; }
        else {
          s.autoConsent = false;
          if (s.state === 'DRIVING' || s.state === 'ENDING') stop('CONSENT_REVOKED', a);
          Object.assign(s, { state: 'OFF', manual: false, suppressed: false, candidateSince: null, endingSince: null });
        }
        break;
      case 'CAR_LINK_APPEARED':
        s.carLinked = true;
        if ((s.state === 'IDLE' || s.state === 'CANDIDATE') && !s.suppressed) { s.state = 'DRIVING'; s.lastMovingT = t; s.candidateSince = null; start('CAR_LINK', a); }
        else if (s.state === 'ENDING') { s.state = 'DRIVING'; s.lastMovingT = t; s.endingSince = null; }
        break;
      case 'VEHICLE_HINT_ENTER':
        if (s.state === 'IDLE' && !s.suppressed) { s.state = 'CANDIDATE'; s.candidateSince = t; }
        else if (s.state === 'ENDING') { s.state = 'DRIVING'; s.lastMovingT = t; s.endingSince = null; }
        break;
      case 'CAR_LINK_GONE': case 'VEHICLE_HINT_EXIT':
        s.suppressed = false; if (ev.type === 'CAR_LINK_GONE') s.carLinked = false;
        if (s.state === 'DRIVING' && !s.manual) { s.state = 'ENDING'; s.endingSince = t; }
        else if (s.state === 'CANDIDATE') { s.state = 'IDLE'; s.candidateSince = null; }
        break;
      case 'SPEED':
        if (!Number.isFinite(ev.ms)) throw new Error('drive-autostart: «ms» debe declararse');
        if (s.state === 'CANDIDATE') {
          if (t - s.candidateSince > P.confirmWindowS) { s.state = 'IDLE'; s.candidateSince = null; }
          else if (ev.ms >= P.confirmSpeedMs) { s.state = 'DRIVING'; s.lastMovingT = t; s.candidateSince = null; start('VEHICLE_HINT_CONFIRMED_BY_SPEED', a); }
        } else if ((s.state === 'DRIVING' || s.state === 'ENDING') && ev.ms >= P.stopSpeedMs) {
          s.lastMovingT = t;
          if (s.state === 'ENDING') { s.state = 'DRIVING'; s.endingSince = null; }
        }
        break;
      case 'TICK':
        if (s.state === 'CANDIDATE' && t - s.candidateSince > P.confirmWindowS) { s.state = 'IDLE'; s.candidateSince = null; }
        else if (s.state === 'DRIVING' && !s.manual && !s.carLinked && t - s.lastMovingT >= P.idleStopS) { s.state = 'ENDING'; s.endingSince = t; }
        else if (s.state === 'ENDING' && t - s.endingSince >= P.endGraceS) { s.state = rest(); s.endingSince = null; stop('ENDED', a); }
        break;
      case 'USER_START':
        if (s.state !== 'DRIVING') { if (s.state === 'ENDING') { s.state = 'DRIVING'; s.endingSince = null; } else { s.state = 'DRIVING'; start('USER_START', a); } s.manual = true; s.lastMovingT = t; s.candidateSince = null; }
        break;
      case 'USER_STOP':
        if (s.state === 'DRIVING' || s.state === 'ENDING') stop('USER_STOP', a);
        s.state = rest(); s.manual = false; s.candidateSince = null; s.endingSince = null; s.suppressed = s.autoConsent;
        break;
    }
    return { state: s.state, actions: a };
  }
  return { handle, get state() { return s.state; }, params: P };
}

// ------------------------------------------------------------------ Vectores de conformidad
/** Escenarios que TODAS las plataformas deben reproducir. Tiempos en s, velocidades en m/s. */
export const AUTOSTART_SCENARIOS = Object.freeze([
  { name: 'sin_consentimiento_no_arranca', events: [['CAR_LINK_APPEARED', 0], ['VEHICLE_HINT_ENTER', 1], ['SPEED', 2, { ms: 20 }], ['TICK', 500]] },
  { name: 'coche_vinculado_arranca_y_cierra_al_irse', events: [['CONSENT', 0, { autoStart: true }], ['CAR_LINK_APPEARED', 10], ['SPEED', 20, { ms: 15 }], ['CAR_LINK_GONE', 900], ['TICK', 930], ['TICK', 960]] },
  { name: 'pista_debil_confirmada_por_velocidad', events: [['CONSENT', 0, { autoStart: true }], ['VEHICLE_HINT_ENTER', 5], ['SPEED', 30, { ms: 3 }], ['SPEED', 60, { ms: 8 }]] },
  { name: 'pista_debil_caduca_sin_velocidad', events: [['CONSENT', 0, { autoStart: true }], ['VEHICLE_HINT_ENTER', 5], ['SPEED', 60, { ms: 2 }], ['TICK', 126], ['SPEED', 130, { ms: 20 }]] },
  { name: 'pista_debil_parado_mucho_tiempo_cierra', events: [['CONSENT', 0, { autoStart: true }], ['VEHICLE_HINT_ENTER', 0], ['SPEED', 10, { ms: 12 }], ['SPEED', 100, { ms: 0.5 }], ['TICK', 309], ['TICK', 310], ['TICK', 369], ['TICK', 370]] },
  { name: 'atasco_reanuda_antes_de_cerrar', events: [['CONSENT', 0, { autoStart: true }], ['VEHICLE_HINT_ENTER', 0], ['SPEED', 1, { ms: 9 }], ['TICK', 301], ['SPEED', 320, { ms: 6 }], ['TICK', 400]] },
  { name: 'coche_vinculado_parado_no_cierra_mientras_siga_el_enlace', events: [['CONSENT', 0, { autoStart: true }], ['CAR_LINK_APPEARED', 0], ['TICK', 300], ['TICK', 3600], ['CAR_LINK_GONE', 3700], ['TICK', 3760]] },
  { name: 'usuario_para_y_no_se_rearranca_hasta_salir', events: [['CONSENT', 0, { autoStart: true }], ['CAR_LINK_APPEARED', 0], ['USER_STOP', 60], ['VEHICLE_HINT_ENTER', 61], ['CAR_LINK_APPEARED', 62], ['CAR_LINK_GONE', 600], ['CAR_LINK_APPEARED', 700]] },
  { name: 'retirar_consentimiento_cierra_la_sesion', events: [['CONSENT', 0, { autoStart: true }], ['CAR_LINK_APPEARED', 5], ['CONSENT', 50, { autoStart: false }], ['CAR_LINK_APPEARED', 60]] },
  { name: 'arranque_manual_sin_consentimiento_automatico', events: [['USER_START', 0], ['TICK', 1000], ['CAR_LINK_GONE', 1001], ['USER_STOP', 1100], ['CAR_LINK_APPEARED', 1200]] },
]);

const fmt = (x) => String(x);
/** Genera el texto de los vectores (formato de líneas, fácil de leer en Java y Swift sin librerías). */
export function buildAutostartVectors(params) {
  need('buildAutostartVectors', params, PARAMS);
  const L = ['# SENDA Drive · vectores de conformidad del arranque automático. GENERADO por packages/senda/scripts/build-autostart-vectors.mjs: no editar a mano.',
    '# S <escenario> · P <parámetros declarados> · E <EVENTO> t=<s> [ms=<m/s>] [autoStart=0|1] => <ESTADO> [<ACCIÓN>:<MOTIVO> …]'];
  for (const sc of AUTOSTART_SCENARIOS) {
    const m = createAutostart(params);
    L.push(`S ${sc.name}`, `P ${PARAMS.map((k) => `${k}=${fmt(params[k])}`).join(' ')}`);
    for (const [type, t, extra = {}] of sc.events) {
      const r = m.handle({ type, t, ...extra });
      const args = [`t=${fmt(t)}`, ...(extra.ms != null ? [`ms=${fmt(extra.ms)}`] : []), ...(extra.autoStart != null ? [`autoStart=${extra.autoStart ? 1 : 0}`] : [])];
      L.push(`E ${type} ${args.join(' ')} => ${[r.state, ...r.actions.map((x) => `${x.type}:${x.reason}`)].join(' ')}`);
    }
  }
  return L.join('\n') + '\n';
}
