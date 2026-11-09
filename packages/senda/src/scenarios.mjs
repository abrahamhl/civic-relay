/**
 * Escenarios de referencia ejecutables (deterministas). Son SIMULACIONES con los
 * algoritmos reales de SENDA; no sustituyen ensayos de campo.
 */
import { routeMessage } from './router.mjs';
import { predictPasses, passesToContacts } from './orbital.mjs';
import { relayActivation, createConsentProfile, zoneFromQuake, ingestOfficialAlert } from './zones.mjs';
import { locateEvent, sWaveLeadTimes } from './seismic.mjs';
import { haversineKm } from './zones.mjs';
import { rssiToDistanceM, locateBeacon, projectToCamera, chooseBridge } from './rubble.mjs';
import { createOrganization, issueCredential, resolveActor, authorize, createFamilyRegistry, canJoinChannel } from './roles.mjs';
import { analyzeCsi, synthesizeCsi } from './through-wall.mjs';

const H = 3600;
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

/** Constelación LEO de DEMOSTRACIÓN (elementos sintéticos, no un satélite real). */
export const DEMO_D2D_SHELL = Array.from({ length: 6 }, (_, k) => ({
  name: `DEMO-D2D-${k + 1}`, norad: 90000 + k, epoch: Date.UTC(2026, 10, 4), inc: 53 * Math.PI / 180,
  raan: (k * 60) * Math.PI / 180, ecc: 0.0001, argp: 0, M: (k * 47) * Math.PI / 180, nRevDay: 15.06,
}));

const SAN_MARTIN = { lat: 40.36, lon: -4.40 };

/**
 * S01 · Abraham (Arnhem, con Internet) escribe a Ismael (San Martín de Valdeiglesias).
 * Un incendio ha tumbado la antena de Ismael durante 8 h. Hay zona oficial activa.
 * @param {{neighbours?:boolean, d2d?:boolean}} opts quitar vecinos / satélite para ver el caso negativo
 */
export function scenarioArnhemSanMartin({ neighbours = true, d2d = true, t0Ms = Date.UTC(2026, 10, 4, 10, 0) } = {}) {
  const t0 = t0Ms / 1000, far = t0 + 48 * H;
  const contacts = [
    { from: 'abraham', to: 'INTERNET', channel: 'CELL_DATA', start: t0, end: far, measured: true },
    // La antena de Ismael vuelve a las 8 h → es lo que espera WhatsApp.
    { from: 'INTERNET', to: 'ismael', channel: 'CELL_DATA', start: t0 + 8 * H, end: far },
    { from: 'INTERNET', to: 'ismael', channel: 'SMS', start: t0 + 8 * H, end: far },
  ];
  const nodes = {};
  if (neighbours) {
    // María (250 m) tiene Internet por satélite en casa; Pedro (vecino) está entre ambos.
    contacts.push(
      { from: 'INTERNET', to: 'maria', channel: 'SAT_BROADBAND', start: t0, end: far, confidence: 0.95 },
      { from: 'maria', to: 'pedro', channel: 'WIFI_DIRECT', start: t0, end: far, confidence: 0.85 },
      // Pedro y el teléfono de Ismael se ven por Bluetooth a partir de los 4 minutos (Pedro se acerca al albergue).
      { from: 'pedro', to: 'ismael', channel: 'BLE', start: t0 + 240, end: t0 + 3 * H, confidence: 0.8 },
    );
    nodes.maria = { relay: 'RELAY_ACTIVE (alerta oficial, preautorizado en la instalación)' };
    nodes.pedro = { relay: 'RELAY_ACTIVE' };
  }
  let passes = [];
  if (d2d) {
    for (const sat of DEMO_D2D_SHELL) passes.push(...predictPasses(sat, SAN_MARTIN, { from: t0Ms, to: t0Ms + 6 * H * 1000, stepS: 15, minElevationDeg: 25 }));
    passes.sort((a, b) => a.start - b.start);
    contacts.push({ from: 'INTERNET', to: 'SAT_NETWORK', channel: 'INTERNET', start: t0, end: far });
    contacts.push(...passesToContacts(passes, { node: 'ismael', serviceCheck: () => true, confidence: 0.6 }));
  }
  const plan = routeMessage({ contacts, source: 'abraham', dest: 'ismael', t0, sizeBytes: 140 });
  return {
    id: 'S01_ARNHEM_SAN_MARTIN', options: { neighbours, d2d },
    plan: summarizePlan(plan, t0),
    satellitePasses: passes.slice(0, 5).map((p) => ({ satellite: p.satellite, startMinute: +((p.start / 1000 - t0) / 60).toFixed(1), durationS: Math.round((p.end - p.start) / 1000), maxElevationDeg: +p.maxElevationDeg.toFixed(1) })),
    nodes,
    disclaimer: 'Simulación con algoritmos reales de SENDA. Vecinos, tiempos y constelación D2D son ilustrativos.',
  };
}

function summarizePlan(plan, t0) {
  return {
    status: plan.status,
    etaMinutes: plan.eta === null ? null : +((plan.eta - t0) / 60).toFixed(2),
    whatsappBaselineMinutes: plan.baselineEta === null ? null : +((plan.baselineEta - t0) / 60).toFixed(1),
    advantageMinutes: plan.advantageS === null ? null : Number.isFinite(plan.advantageS) ? +(plan.advantageS / 60).toFixed(1) : 'INFINITE',
    deliveryProbability: plan.deliveryProbability === undefined ? null : +plan.deliveryProbability.toFixed(3),
    probabilityBeforeWhatsapp: plan.probabilityBeforeBaseline === undefined ? null : +plan.probabilityBeforeBaseline.toFixed(3),
    routes: plan.routes.map((r) => ({ path: r.path.join(' → '), channels: r.channels, etaMinutes: +((r.eta - t0) / 60).toFixed(2), confidence: +r.confidence.toFixed(2) })),
    explanation: plan.explanation,
  };
}

/** S05 · Persona atrapada bajo escombros; alguien encima tiene 4G. */
export function scenarioRubble({ seed = 5 } = {}) {
  const R = rng(seed), noise = () => (R() - 0.5) * 3; // ±1,5 dB
  const victim = { x: 6.0, y: 3.5, z: -2.5 };
  const model = { txPower1m: -59, n: 3.2 };
  const walk = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 1 }, { x: 10, y: 5 }, { x: 6, y: 8 }, { x: 2, y: 6 }];
  const reads = walk.map((p) => {
    const d = Math.hypot(p.x - victim.x, p.y - victim.y, 0 - victim.z);
    return { ...p, z: 0, rssi: model.txPower1m - 10 * model.n * Math.log10(d) + noise() };
  });
  const est = locateBeacon(reads, model);
  const camera = { pos: { x: 2, y: 0, z: 1.5 }, yaw: Math.atan2(est.y - 0, est.x - 2), pitch: -0.35, hfovRad: 1.2, width: 1080, height: 1920 };
  const ar = projectToCamera(est, camera);
  const surface = [
    { id: 'lucia', relayActive: true, uplinks: ['CELL_DATA'], battery: 70 },
    { id: 'bombero-7', relayActive: true, uplinks: ['CELL_DATA', 'SAT_BROADBAND'], battery: 90 },
    { id: 'curioso', relayActive: false, uplinks: ['CELL_DATA'], battery: 99 },
  ];
  const bridge = chooseBridge({ lucia: -78, 'bombero-7': -71, curioso: -60 }, surface);
  const t0 = 0;
  const plan = routeMessage({ t0, source: 'atrapado', dest: 'familia', sizeBytes: 300, contacts: [
    { from: 'atrapado', to: bridge.id, channel: 'BLE', start: 0, end: 7200, confidence: 0.7 },
    { from: bridge.id, to: 'INTERNET', channel: 'CELL_DATA', start: 0, end: 7200 },
    { from: 'INTERNET', to: 'familia', channel: 'CELL_DATA', start: 0, end: 7200 },
  ] });
  const csiPerson = analyzeCsi(synthesizeCsi({ person: true, rpm: 14, seed: 3 }), { sr: 20 });
  const csiEmpty = analyzeCsi(synthesizeCsi({ person: false, seed: 4 }), { sr: 20 });
  return {
    id: 'S05_RUBBLE',
    victimTruth: victim, estimate: { x: +est.x.toFixed(2), y: +est.y.toFixed(2), z: +est.z.toFixed(2), errorM: +est.errorM.toFixed(2) },
    horizontalErrorM: +Math.hypot(est.x - victim.x, est.y - victim.y).toFixed(2),
    arOverlay: ar.visible ? { u: Math.round(ar.u), v: Math.round(ar.v), radiusPx: Math.round(ar.radiusPx), label: ar.label } : ar,
    bridge: bridge && { id: bridge.id, rssi: bridge.rssi, uplinks: bridge.uplinks, why: 'Mejor señal hacia la víctima entre los teléfonos con relé activo y salida a Internet' },
    messageToFamily: summarizePlan(plan, t0),
    csiThroughWall: { withPerson: csiPerson.breathing, emptyRoom: csiEmpty.breathing, note: 'Señal CSI sintética; requiere accesorio ESP32 y calibración en campo' },
    disclaimer: 'Lecturas RSSI y CSI sintéticas con ruido; en escombros reales el error es mayor y debe calibrarse.',
  };
}

/** S04 · Sismo detectado por la red de teléfonos, corroborado por un catálogo público. */
export function scenarioQuake({ seed = 11 } = {}) {
  const R = rng(seed);
  const truth = { lat: 37.68, lon: -1.70, originTime: Date.UTC(2026, 10, 4, 3, 12, 0) / 1000 };
  const phones = Array.from({ length: 14 }, () => ({ lat: truth.lat + (R() - 0.5) * 1.2, lon: truth.lon + (R() - 0.5) * 1.5 }));
  const picks = phones.map((p) => ({ ...p, t: truth.originTime + haversineKm(truth, p) / 6.0 + (R() - 0.5) * 0.3 }));
  const ev = locateEvent(picks);
  const detectedAt = Math.max(...picks.slice(0, 6).map((p) => p.t)) + 2; // agregación + red
  const network = { id: 'net-1', source: 'SENDA_NETWORK', circle: { center: { lat: ev.lat, lon: ev.lon }, radiusKm: 80 }, expiresAt: (detectedAt + 6 * H) * 1000 };
  const feed = zoneFromQuake({ id: 'demo', provider: 'EMSC', mag: 5.8, lat: 37.7, lon: -1.68, time: detectedAt * 1000 });
  const consent = createConsentProfile({ termsVersion: 'senda-tos-1', relayInDeclaredZones: true, acceptedAt: '2026-11-01' });
  const murcia = { lat: 37.99, lon: -1.13 };
  const onlyNetwork = relayActivation({ zones: [network], position: murcia, consent, now: detectedAt * 1000 });
  const corroborated = relayActivation({ zones: [network, feed], position: murcia, consent, now: detectedAt * 1000 });
  const cities = [{ name: 'Lorca', lat: 37.68, lon: -1.70 }, { name: 'Murcia', ...murcia }, { name: 'Alicante', lat: 38.35, lon: -0.48 }, { name: 'Granada', lat: 37.18, lon: -3.60 }, { name: 'Madrid', lat: 40.42, lon: -3.70 }];
  return {
    id: 'S04_QUAKE',
    location: { lat: +ev.lat.toFixed(3), lon: +ev.lon.toFixed(3), errorKm: +haversineKm(ev, truth).toFixed(2), rmsS: +ev.rmsS.toFixed(3), stations: ev.stations, confidence: ev.confidence },
    activation: { networkOnly: onlyNetwork.mode, withPublicFeed: corroborated.mode, reason: corroborated.reason },
    sWaveLeadSeconds: sWaveLeadTimes(ev, cities, detectedAt).map((c) => ({ city: c.name, leadS: +c.leadS.toFixed(1) })),
    disclaimer: 'Llegadas P sintéticas. La alerta solo puede adelantarse a las ondas dañinas en lugares alejados del epicentro.',
  };
}

/** S07 · Coordinación: policía, bomberos, voluntario y familia. */
export async function scenarioCoordination({ now = Date.UTC(2026, 10, 4, 12) } = {}) {
  const police = await createOrganization({ id: 'es-policia-local-smv', name: 'Policía Local (demo)', kind: 'POLICE' });
  const fire = await createOrganization({ id: 'es-bomberos-cam', name: 'Bomberos (demo)', kind: 'FIRE' });
  const anchors = [police.anchor, fire.anchor];
  const day = 86400_000;
  const jefe = await resolveActor({ userId: 'u-jefe', anchors, now, credential: await issueCredential(fire, { subject: 'u-jefe', role: 'JEFE_INCIDENTE', unit: 'Parque 3', validFrom: now - day, validUntil: now + day }) });
  const agente = await resolveActor({ userId: 'u-agente', anchors, now, credential: await issueCredential(police, { subject: 'u-agente', role: 'AGENTE', unit: 'Patrulla 12', validFrom: now - day, validUntil: now + day }) });
  const voluntario = await resolveActor({ userId: 'u-vol', anchors, now, declaredCoordinator: true });
  const familia = await resolveActor({ userId: 'u-hermana', anchors, now });
  const reg = createFamilyRegistry();
  const pid = reg.registerSought(familia, { name: 'Ismael', lastSeen: 'Calle Real 4', contactFingerprint: 'fp-hermana' });
  let volunteerBlocked = false; try { reg.updateStatus(voluntario, pid, 'LOCATED_SAFE'); } catch { volunteerBlocked = true; }
  const notice = reg.updateStatus(jefe, pid, 'LOCATED_SAFE', { at: now, note: 'En albergue municipal' });
  return {
    id: 'S07_COORDINATION',
    actors: [jefe, agente, voluntario, familia].map((a) => ({ user: a.userId, trust: a.trust, orgKind: a.orgKind ?? null, coordinator: a.coordinator })),
    familyView: reg.viewFor(familia, pid), familyNotifiedVia: notice.notify,
    volunteerCannotSetVictimStatus: volunteerBlocked,
    channels: {
      policeInternal: { agente: canJoinChannel(agente, { type: 'INTERNAL', orgKind: 'POLICE' }), bombero: canJoinChannel(jefe, { type: 'INTERNAL', orgKind: 'POLICE' }) },
      interagency: { jefeBomberos: canJoinChannel(jefe, { type: 'INTERAGENCY' }), voluntario: canJoinChannel(voluntario, { type: 'INTERAGENCY' }) },
    },
    secureDocuments: { jefe: authorize('SEND_SECURE_DOCUMENT', jefe).allowed, voluntario: authorize('SEND_SECURE_DOCUMENT', voluntario).allowed },
    disclaimer: 'Organizaciones y credenciales de demostración; la integración real exige convenio y gestión de claves por cada organismo.',
  };
}

export async function runAllScenarios() {
  return {
    generatedAt: new Date().toISOString(),
    s01: scenarioArnhemSanMartin(),
    s01_onlySatellite: scenarioArnhemSanMartin({ neighbours: false }),
    s01_noAlternatives: scenarioArnhemSanMartin({ neighbours: false, d2d: false }),
    s04: scenarioQuake(), s05: scenarioRubble(), s07: await scenarioCoordination(),
  };
}
