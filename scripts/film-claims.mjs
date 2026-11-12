// Afirmaciones numéricas de la película de inversores, recalculadas con el núcleo real (packages/senda/src).
// Lo usan scripts/prove.mjs (prueba pública de un comando) y packages/senda/tests/film-claims.test.mjs.
// Cada afirmación: { id, scene, claim (lo que dice la película), measure() → { value, ok, detail } }.
// Nada se copia de documentos: todo se ejecuta. Las semillas son fijas para que cualquiera obtenga lo mismo.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = (m) => import(pathToFileURL(path.join(ROOT, 'packages', 'senda', 'src', m)).href);
const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r1 = (x) => Math.round(x * 10) / 10;

export const CLAIMS = [
  { id: 'rain-p838', scene: 'v12', claim: '868 MHz casi no pierde; 28 GHz ≈ 7 dB/km a 50 mm/h', async measure() {
    const p = await core('telecom-mathematical-physics.mjs'), a = p.computeRainAttenuation(0.868, 50).specificAttenuationDbPerKm, b = p.computeRainAttenuation(28, 50).specificAttenuationDbPerKm;
    // comprobación independiente: interpolación propia de la tabla P.838-3 (k log-log, α lineal en log f) entre 25 y 30 GHz, polarización vertical, y γ = k·R^α
    const row = (f) => p.P838_TABLE.find((r) => r[0] === f), [, , , k25, a25] = row(25), [, , , k30, a30] = row(30), u = Math.log(28 / 25) / Math.log(30 / 25);
    const indep = Math.exp(Math.log(k25) + u * (Math.log(k30) - Math.log(k25))) * 50 ** (a25 + u * (a30 - a25));
    return { value: `868 MHz ${a} dB/km · 28 GHz ${r1(b)} dB/km (fórmula directa ${r1(indep)})`, ok: a < 0.01 && Math.round(b) === 7 && Math.abs(b - indep) / indep < 0.1 };
  } },
  { id: 'knife-edge', scene: 'v13', claim: 'cresta de 60 m a mitad de 10 km cuesta ≈ 22 dB a 868 MHz', async measure() {
    const p = await core('telecom-mathematical-physics.mjs'), lam = 299792458 / 868e6, v = p.computeFresnelV(60, 5000, 5000, lam), L = p.computeKnifeEdgeLossDb(v);
    // ITU-R P.526 (aprox. de J(v)): 6,9 + 20·log10(√((v−0,1)²+1) + v − 0,1)
    const indep = 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
    return { value: `${r1(L)} dB (v = ${v.toFixed(2)}; P.526 directa ${r1(indep)} dB)`, ok: Math.round(L) === 22 && Math.abs(L - indep) < 0.5 };
  } },
  { id: 'reed-solomon', scene: 'v08', claim: 'envías diez fragmentos y seis cualesquiera lo reconstruyen; con cinco no', async measure() {
    const e = await core('erasure.mjs'), msg = new TextEncoder().encode('SOS · planta 3 · dos personas atrapadas'), enc = e.encodeShards(msg, 6, 10), all = enc.shards.map((data, index) => ({ index, data }));
    const R = mulberry(7); let ok = 0; const N = 200;
    for (let t = 0; t < N; t++) { const pick = [...all].sort(() => R() - 0.5).slice(0, 6); if (Buffer.from(e.decodeShards(pick, { k: 6, len: enc.len })).equals(Buffer.from(msg))) ok++; }
    let five = false; try { e.decodeShards(all.slice(0, 5), { k: 6, len: enc.len }); five = true; } catch {}
    return { value: `${ok}/${N} subconjuntos aleatorios de 6 reconstruyen; con 5: ${five ? 'reconstruye (ERROR)' : 'rechaza'}`, ok: ok === N && !five };
  } },
  { id: 'multibearer-run', scene: 'v08', claim: 'ejecución de 200 mensajes con portadores perdidos al azar (semilla fija)', async measure() {
    const B = await core('bearers.mjs'), E = await core('erasure.mjs');
    const plan = B.planMultiBearer(380, ['SAT_D2C_SMS', 'MESHTASTIC', 'SMS', 'PHONE_MESH'].map((id) => ({ id })), { target: 0.99 });
    const R = mulberry(2026); let ok = 0; const N = 200;
    for (let t = 0; t < N; t++) {
      const msg = Uint8Array.from({ length: 380 }, () => Math.floor(R() * 256)), frames = B.shardForPlan(msg, plan, Uint8Array.from({ length: 8 }, () => Math.floor(R() * 256))), ra = E.createReassembler(); let out = null;
      for (const f of frames) { if (R() > B.BEARERS[f.bearer].p) continue; for (const s of B.splitShards(B.fromBearerFrame(f.frame))) out = ra.add(s, f.bearer) ?? out; }
      if (out && Buffer.from(out.data).equals(Buffer.from(msg))) ok++;
    }
    return { value: `${ok}/${N} reconstruidos byte a byte (teoría ${(100 * plan.pDelivery).toFixed(1)} %; ${plan.k} de ${plan.n})`, ok: ok / N >= 0.95, measured: ok };
  } },
  { id: 'envelope-size', scene: 'v06', claim: 'mensaje cifrado de extremo a extremo en ≈ 300 bytes; un relé no puede leerlo', async measure() {
    const E = await core('envelope.mjs'), a = await E.generateIdentity(), b = await E.generateIdentity(), c = await E.generateIdentity(), now = 1_800_000_000_000;
    const env = await E.sealMessage({ sender: a, recipient: b.publicIdentity, body: 'Estoy bien', priority: 0, ttlS: 3600, now, kind: 'HUMAN_STATUS' }), bytes = E.packEnvelope(env).length;
    const view = JSON.stringify(E.relayView(env, now)); let thirdOpens = true; try { await E.openMessage({ recipient: c, envelope: env, now }); } catch { thirdOpens = false; }
    const mine = await E.openMessage({ recipient: b, envelope: env, now });
    return { value: `${bytes} B; el relé no ve el texto: ${!view.includes('Estoy bien')}; un tercero no lo abre: ${!thirdOpens}; el destinatario sí: ${JSON.stringify(mine).includes('Estoy bien')}`, ok: bytes >= 250 && bytes <= 400 && !view.includes('Estoy bien') && !thirdOpens && JSON.stringify(mine).includes('Estoy bien') };
  } },
  { id: 'sound-airtime', scene: 'v10', claim: 'por sonido: un mensaje corto ≈ 30 s; el arranque de una llamada < 11 s', async measure() {
    const A = await core('acoustic-modem.mjs'), E = await core('envelope.mjs'), a = await E.generateIdentity(), b = await E.generateIdentity();
    const n = E.packEnvelope(await E.sealMessage({ sender: a, recipient: b.publicIdentity, body: 'Estoy bien', priority: 0, ttlS: 3600, now: 1_800_000_000_000, kind: 'HUMAN_STATUS' })).length;
    const msg = A.airtimeSeconds(n), call = A.airtimeSeconds(110);
    // comprobación de extremo a extremo: modular y demodular de verdad un arranque de llamada de 90 bytes
    const payload = Uint8Array.from({ length: 90 }, (_, i) => (i * 37) & 255), back = A.demodulate(A.modulate(payload));
    const roundTrip = back && Buffer.from(back.payload ?? back).equals(Buffer.from(payload));
    return { value: `mensaje ${n} B → ${r1(msg)} s; llamada 110 B → ${r1(call)} s; ida y vuelta modem: ${roundTrip}`, ok: msg > 20 && msg < 40 && call < 11 && roundTrip };
  } },
  { id: 'arnhem-san-martin', scene: 'v09', claim: 'SENDA ≈ 4 min frente a WhatsApp 8 h (simulación); sin puentes no finge', async measure() {
    const S = await core('scenarios.mjs'), on = S.scenarioArnhemSanMartin(), off = S.scenarioArnhemSanMartin({ neighbours: false, d2d: false });
    const eOn = on.plan.etaMinutes, w = on.plan.whatsappBaselineMinutes, eOff = off.plan?.etaMinutes ?? null;
    return { value: `con puentes ${eOn} min · WhatsApp ${w} min · sin puentes ${eOff} min (${off.plan?.status})`, ok: Math.round(eOn) === 4 && w === 480 && (eOff === null || eOff >= w - 1) };
  } },
  { id: 'blackout-gateways', scene: 'v15', claim: 'cinco pasarelas llegan al 72 % de los aislados (ciudad de prueba)', async measure() {
    const b = await core('blackout.mjs'), c = b.syntheticCity(), g = b.placeGateways({ ...c, k: 5, tH: 4 });
    return { value: `${g.reachedPct} %`, ok: Math.round(g.reachedPct) === 72 };
  } },
  { id: 'brake-chain', scene: 'v16', claim: 'niebla, 120 km/h, 1,2 s: chocan 5; con aviso simultáneo solo el que va pegado', async measure() {
    const r = await core('road-guard.mjs'), no = r.brakeChain({ gapS: 1.2 }), si = r.brakeChain({ gapS: 1.2, senda: Array(6).fill(true) });
    const a = no.cars.filter((c) => c.collided).length, b = si.cars.filter((c) => c.collided).map((c) => c.i);
    return { value: `sin aviso ${a} choques · con aviso ${b.length} (coche ${b.join(',')})`, ok: a === 5 && b.length === 1 && b[0] === 1 };
  } },
  { id: 'sos-rides-cars', scene: 'v16', claim: 'sin cobertura el SOS sale en ≈ 7 min con 1 de cada 10 coches', async measure() {
    const r = await core('road-guard.mjs'), s = r.roadScenario();
    return { value: `${s.sosDeliveredMin} min (cuota ${s.params.share}, ${s.params.flowVehH} veh/h)`, ok: Math.round(s.sosDeliveredMin) === 7 && s.params.share === 0.1 };
  } },
  { id: 'rail-second-train', scene: 'v18', claim: 'segundo tren en 30–41 s con el 25 % de pasajeros; < 1 min con el 5 %', async measure() {
    const r = await core('rail-scenario.mjs'), q = [], f = [];
    for (let s = 1; s <= 8; s++) q.push(r.simulateTwoTrainIncident({ seed: s, adoption: 0.25 }).secondTrainKnownS);
    for (let s = 1; s <= 16; s++) f.push(r.simulateTwoTrainIncident({ seed: s, adoption: 0.05 }).secondTrainKnownS);
    return { value: `25 %: ${Math.min(...q)}–${Math.max(...q)} s (8 semillas) · 5 %: ${Math.min(...f)}–${Math.max(...f)} s (16 semillas)`, ok: Math.min(...q) >= 30 && Math.max(...q) <= 41 && Math.max(...f) < 60 };
  } },
  { id: 'quake-locate', scene: 'v19', claim: '14 móviles sitúan el epicentro a ≈ 0,5 km; sin catálogo público no se activa', async measure() {
    const S = await core('scenarios.mjs'), q = S.scenarioQuake();
    return { value: `${q.location.stations} estaciones · error ${q.location.errorKm} km · solo red: ${q.activation.networkOnly} · con catálogo: ${q.activation.withPublicFeed}`, ok: q.location.stations === 14 && q.location.errorKm <= 0.5 && q.activation.networkOnly !== 'RELAY_ACTIVE' && q.activation.withPublicFeed === 'RELAY_ACTIVE' };
  } },
  { id: 'flood-lead', scene: 'v20', claim: 'aviso 2 h 30 antes de que se desborde el primer pueblo, con 3 l/m² de lluvia local', async measure() {
    const f = await core('flood-watch.mjs'), s = f.floodScenario(), a = s.result[0];
    return { value: `${a.name}: ${a.leadMin} min de aviso · lluvia local ${a.localRainMm} mm · umbral local: ${a.localThresholdLeadMin} min`, ok: a.leadMin === 150 && a.localRainMm === 3 };
  } },
  { id: 'wildfire-mast', scene: 'v21', claim: 'la antena del pueblo arde 107 min antes del límite para avisarlo', async measure() {
    const w = await core('wildfire.mjs'), L = w.syntheticLandscape(), T = w.arrivalTimes(L.grid, [{ x: 30, y: 20 }], { windKmh: 30, windToDeg: 15 }, { maxMin: 720 }), a = w.assessAssets(L.grid, T, L.towns, L.towers).find((x) => x.antennaFirst);
    const lost = a.deadlineMin - a.commsLossMin;
    return { value: `${a.name}: antena cae a ${r1(a.commsLossMin)} min, límite de aviso ${r1(a.deadlineMin)} min → ${r1(lost)} min perdidos`, ok: Math.round(lost) === 107 };
  } },
  { id: 'ble-floors', scene: 'v22', claim: 'en 720 plantas simuladas el margen contiene la cifra real el 95 % de las veces', async measure() {
    const c = await core('rf-census.mjs'); let hit = 0, n = 0;
    for (let seed = 1; seed <= 120; seed++) { const sc = c.rfCensusScenario({ seed }), r = c.rfCensus(sc.obs, sc.building); r.floors.forEach((f) => { n++; if (f.people.lo <= sc.truth[f.floor] && sc.truth[f.floor] <= f.people.hi) hit++; }); }
    return { value: `${hit}/${n} = ${(100 * hit / n).toFixed(1)} %`, ok: n === 720 && hit / n >= 0.945 };
  } },
  { id: 'knock-10cm', scene: 'v22', claim: 'cinco móviles sitúan un golpe a ≈ 10 cm (simulación)', async measure() {
    const s = await core('senses.mjs'), c = s.chorusScenario(), e = Math.hypot(c.fix.x - c.knock.x, c.fix.y - c.knock.y);
    return { value: `${c.phones.length} móviles · error ${(e * 100).toFixed(1)} cm`, ok: c.phones.length === 5 && e < 0.15 };
  } },
  { id: 'delivery-assurance', scene: 'v12', claim: 'plan ingenuo promete 99,49 % y entrega 96,09 %; el motor entrega ≈ 99 % a 0 €', async measure() {
    // evidencia guardada por packages/senda/scripts/delivery-assurance-benchmark.mjs (ejecutarlo la regenera; el test delivery-assurance.test.mjs fija el método)
    const d = (await import(pathToFileURL(path.join(ROOT, 'evidence', 'senda', 'delivery-assurance.json')).href, { with: { type: 'json' } })).default;
    const a = d.independentPlanner, b = d.assuredPlanner.find((x) => x.costEUR === 0);
    return { value: `ingenuo promete ${a.claimed} y entrega ${a.actual} · motor a 0 € entrega ${b.pDelivery} (${b.k} de ${b.fragments}; ${d.claim})`, ok: a.claimed === 0.9949 && a.actual === 0.9609 && b.pDelivery > 0.985 };
  } },
  { id: 'reserve-1gb', scene: 'v11', claim: 'reserva de 1 GB elegida con mochila 0/1 exacta y frescura', async measure() {
    const r = await core('net-reserve.mjs'), items = r.reserveCatalog({ hazards: ['flood', 'wildfire'] }), plan = r.planReserve(items, 1024);
    // exactitud: comparar con fuerza bruta sobre los 14 primeros elementos con presupuesto 300 MB
    const sub = items.slice(0, 14), best = (() => { let b = 0; for (let m = 0; m < 1 << sub.length; m++) { let mb = 0, u = 0; sub.forEach((it, i) => { if (m >> i & 1) { mb += it.mb; u += it.u * r.freshness(it.ageH ?? 0, it.hl); } }); if (mb <= 300 && u > b) b = u; } return b; })();
    const dp = r.planReserve(sub, 300), dpU = (dp.chosen ?? dp.items ?? []).reduce((s, it) => s + it.u * r.freshness(it.ageH ?? 0, it.hl), 0);
    return { value: `${(plan.chosen ?? plan.items ?? []).length} contenidos en ${r1(plan.usedMB ?? plan.mb ?? 0)} MB · DP ${r1(dpU)} = fuerza bruta ${r1(best)}`, ok: Math.abs(dpU - best) < 1e-6 * Math.max(1, best) };
  } },
];

export async function runClaims() {
  const out = [];
  for (const c of CLAIMS) {
    const t0 = Date.now();
    try { const m = await c.measure(); out.push({ id: c.id, scene: c.scene, claim: c.claim, value: m.value, ok: !!m.ok, ms: Date.now() - t0 }); }
    catch (e) { out.push({ id: c.id, scene: c.scene, claim: c.claim, value: `ERROR: ${e.message}`, ok: false, ms: Date.now() - t0 }); }
  }
  return out;
}
