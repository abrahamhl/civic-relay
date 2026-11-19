#!/usr/bin/env node
/**
 * SENDA · Experimentos reproducibles con DATOS REALES del incendio de San Martín de Valdeiglesias (23-07-2026).
 * Entradas (investor-next/public/senda/data/smv2026): terreno Copernicus GLO-30 a 100 m, combustible por NDVI de
 * Sentinel-2 (16-07), cicatrices dNBR (24-07, 29-07, 08-08) y perfiles GFS 0,25° del 23-07 (12 a 00 UTC).
 * Salidas: fire3d.json y prob_roi.bin / arrival_roi.bin para la web; docs/paper/resultados_v019.json para el paper.
 * Uso: node packages/senda/scripts/fire3d-real.mjs [--rapido]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../src/atmos3d.mjs';
import * as FF from '../src/fire-field.mjs';
import { toUtm, fromUtm } from '../src/utm.mjs';
import { fireBehavior } from '../src/fire-watch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), D = resolve(ROOT, 'investor-next/public/senda/data/smv2026'), FAST = process.argv.includes('--rapido');
const meta = JSON.parse(readFileSync(resolve(D, 'real.json'), 'utf8')), gfs = JSON.parse(readFileSync(resolve(D, 'gfs_20260723_12z.json'), 'utf8'));
const W = meta.dem.w, H = meta.dem.h, DX = 100, X0 = meta.malla.x0, Y1 = meta.malla.y1;
const dem16 = new Int16Array(readFileSync(resolve(D, 'dem_100m.bin')).buffer.slice(0)), elev = Float32Array.from(dem16), fuel = new Uint8Array(readFileSync(resolve(D, 'fuel_100m.bin'))), bits = new Uint8Array(readFileSync(resolve(D, 'burn_100m.bin')));
const F = { w: W, h: H, dx: DX, elev, fuel };
const cellXY = (i, j) => ({ x: X0 + (i + 0.5) * DX, y: Y1 - (j + 0.5) * DX }), xyCell = (x, y) => ({ i: Math.floor((x - X0) / DX), j: Math.floor((Y1 - y) / DX) });
const heightAt = (x, y) => { const fi = (x - X0) / DX - 0.5, fj = (Y1 - y) / DX - 0.5, i = Math.max(0, Math.min(W - 2, Math.floor(fi))), j = Math.max(0, Math.min(H - 2, Math.floor(fj))), a = Math.max(0, Math.min(1, fi - i)), b = Math.max(0, Math.min(1, fj - j)); return (1 - a) * (1 - b) * elev[j * W + i] + a * (1 - b) * elev[j * W + i + 1] + (1 - a) * b * elev[(j + 1) * W + i] + a * b * elev[(j + 1) * W + i + 1]; };
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a);
const r3 = (x, d = 1) => +(+x).toFixed(d);

// ---------------------------------------------------------------- 1) Masa de aire real en el punto de inicio
const IGN = { lat: 40.362, lon: -4.385, label: 'M-501, km 57 (aprox.)' }, ignU = toUtm(IGN.lat, IGN.lon, 30), ignC = xyCell(ignU.x, ignU.y);
const center = fromUtm(X0 + (W * DX) / 2, Y1 - (H * DX) / 2, 30);
const diag = gfs.times.map((t) => A.airMassDiagnosis(A.gfsProfile(t, gfs.grid, IGN.lat, IGN.lon)));
log('masa de aire', diag.map((d) => `${d.validUTC.slice(11, 16)} ${d.t2}°C ${d.rh2}% ${d.wind10Kmh}km/h ${d.dirFrom10}° H${d.haines?.value}`).join(' | '));

// ---------------------------------------------------------------- 2) Viento 3D con conservación de masa en cada hora GFS
const DX3 = FAST ? 800 : 500, NX = Math.floor((W * DX) / DX3), NY = Math.floor((H * DX) / DX3), DZ = 60, Y0 = Y1 - NY * DX3;
const zTop = meta.dem.max + 1400, zBase = Math.floor(meta.dem.min / DZ) * DZ - DZ, NZ = Math.ceil((zTop - zBase) / DZ);
const fields = [], near = [];
for (const [k, t] of gfs.times.entries()) {
  const prof = A.gfsProfile(t, gfs.grid, center.lat, center.lon), dg = A.airMassDiagnosis(prof), stable = (dg.hpblM ?? 1000) < 300;
  const g = A.makeWindGrid({ nx: NX, ny: NY, nz: NZ, dx: DX3, dz: DZ, x0: X0, y0: Y0, heightAt, zBase });
  const f0 = A.initialWind(g, (z) => A.profileAt(prof, z)), f = A.massConsistent(g, f0, { iters: FAST ? 120 : 260, vertWeight: stable ? 0.3 : 1 });
  const u = new Float32Array(W * H), v = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const { x, y } = cellXY(i, j), q = A.sampleWind(g, f, x, y, heightAt(x, y) + 40); u[j * W + i] = q.u; v[j * W + i] = q.v; }
  fields.push({ g, f, prof, stable, divBefore: f.divBefore, divAfter: f.divAfter, iters: f.iters }); near.push({ u, v });
  log(`viento 3D ${t.validUTC}: malla ${NX}×${NY}×${NZ}, divergencia ${f.divBefore.toExponential(2)} → ${f.divAfter.toExponential(2)} (${f.iters} it.)${stable ? ', estable' : ''}`);
}
const windFn = (ignOffsetMin, constant = null) => (i, j, tMin) => {
  const c = j * W + i; if (constant != null) return { u: near[constant].u[c], v: near[constant].v[c] };
  const tt = Math.min(720, ignOffsetMin + tMin) / 180, k = Math.min(3, Math.floor(tt)), a = Math.min(1, tt - k);
  return { u: near[k].u[c] * (1 - a) + near[k + 1].u[c] * a, v: near[k].v[c] * (1 - a) + near[k + 1].v[c] * a };
};

// ---------------------------------------------------------------- 3) Validación contra la cicatriz real (24-07)
const obs24 = Uint8Array.from(bits, (b) => b & 1);
function component(mask, seed) { // componente conexa que contiene (o está más cerca de) la ignición
  let s = seed.j * W + seed.i; if (!mask[s]) { let best = Infinity; for (let k = 0; k < mask.length; k++) if (mask[k]) { const d = Math.hypot((k % W) - seed.i, Math.floor(k / W) - seed.j); if (d < best) { best = d; s = k; } } }
  const out = new Uint8Array(mask.length), st = [s]; out[s] = 1;
  while (st.length) { const c = st.pop(), i = c % W, j = (c - i) / W; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (mask[n] && !out[n]) { out[n] = 1; st.push(n); } } }
  return out;
}
const obs = component(obs24, ignC), obsCells = FF.countOnes(obs), imageMin = 23 * 60 + 20; // 24-07 11:20 UTC desde 23-07 12:00 UTC
const centroid = (m) => { let sx = 0, sy = 0, n = 0; for (let k = 0; k < m.length; k++) if (m[k]) { sx += k % W; sy += Math.floor(k / W); n++; } return { i: sx / n, j: sy / n }; };
const bearingTo = (c) => ((Math.atan2(c.i - ignC.i, -(c.j - ignC.j)) * 180) / Math.PI + 360) % 360;
log(`cicatriz observada del incendio de San Martín (24-07): ${obsCells} ha; rumbo de crecimiento ${bearingTo(centroid(obs)).toFixed(0)}°`);
const J0 = FF.jaccard(FF.circleNull(F, ignC, obsCells), obs), exps = [];
for (const off of [0, 180, 360, 480]) {
  const T = FF.arrivalOnField(F, [{ ...ignC, t: 0 }], windFn(off), { maxMin: 2880 }), tA = FF.timeForArea(T, obsCells), sim = FF.burnedMask(T, tA);
  const elapsed = imageMin - off, areaAtImage = FF.countOnes(FF.burnedMask(T, elapsed));
  const Tc = FF.arrivalOnField(F, [{ ...ignC, t: 0 }], windFn(off, 1), { maxMin: 2880 }), simC = FF.burnedMask(Tc, FF.timeForArea(Tc, obsCells));
  const J = FF.jaccard(sim, obs), Jc = FF.jaccard(simC, obs);
  exps.push({ ignicionUTC: `${String(12 + off / 60).padStart(2, '0')}:00`, jaccard: r3(J, 3), sorensen: r3(FF.sorensen(sim, obs), 3), habilidadVsCirculo: r3(FF.skillVsNull(J, J0), 3), jaccardVientoFijo15Z: r3(Jc, 3), habilidadVientoFijo: r3(FF.skillVsNull(Jc, J0), 3), rumboSimulado: Math.round(bearingTo(centroid(sim))), minutosHastaAreaObservada: Math.round(tA), haSimuladasALaHoraDeLaImagen: areaAtImage, razonArea: r3(areaAtImage / obsCells, 2), T });
  log(`ignición ${12 + off / 60}:00Z → J ${J.toFixed(3)} (viento fijo ${Jc.toFixed(3)}, círculo ${J0.toFixed(3)}), rumbo ${Math.round(bearingTo(centroid(sim)))}°, área a la hora de la imagen ${areaAtImage} ha`);
}
const best = exps.reduce((a, b) => (b.jaccard > a.jaccard ? b : a)), bestOff = (parseInt(best.ignicionUTC, 10) - 12) * 60;
// Calibración por asimilación (DENTRO DE MUESTRA): ¿qué giro del viento, velocidad base y hora de inicio explican la cicatriz?
const calib = [];
for (const off of FAST ? [360] : [180, 360, 480]) for (const rot of FAST ? [0, 45, 60, 75] : [-30, 0, 30, 45, 60, 75, 90]) for (const rm of FAST ? [0.35, 1] : [0.2, 0.35, 0.5, 0.75, 1]) {
  const c = Math.cos((rot * Math.PI) / 180), s = Math.sin((rot * Math.PI) / 180), base = windFn(off);
  const T = FF.arrivalOnField(F, [{ ...ignC, t: 0 }], (i, j, t) => { const q0 = base(i, j, t); return { u: q0.u * c + q0.v * s, v: -q0.u * s + q0.v * c }; }, { rosMult: rm, maxMin: 2880 });
  const sim = FF.burnedMask(T, FF.timeForArea(T, obsCells)), J = FF.jaccard(sim, obs), aImg = FF.countOnes(FF.burnedMask(T, imageMin - off));
  calib.push({ ignicionUTC: `${12 + off / 60}:00`, giroVientoDeg: rot, multVelocidad: rm, jaccard: r3(J, 3), razonAreaImagen: r3(aImg / obsCells, 2), rumbo: Math.round(bearingTo(centroid(sim))) });
}
calib.sort((a, b) => b.jaccard - a.jaccard); const calBest = calib[0];
const calFit = calib.filter((c) => c.razonAreaImagen >= 0.5 && c.razonAreaImagen <= 2).sort((a, b) => b.jaccard - a.jaccard)[0] ?? null;
log('calibración (en muestra): mejor forma', calBest, 'mejor con área ±×2', calFit);

// ---------------------------------------------------------------- 4) Conjunto probabilístico (región del incendio)
const ROI = (() => { const a = toUtm(40.43, -4.47, 30), b = toUtm(40.29, -4.22, 30), p = xyCell(a.x, a.y), q = xyCell(b.x, b.y); return { i0: Math.max(0, p.i), j0: Math.max(0, p.j), i1: Math.min(W, q.i), j1: Math.min(H, q.j) }; })();
ROI.w = ROI.i1 - ROI.i0; ROI.h = ROI.j1 - ROI.j0;
const ens = FF.ensembleArrival(F, [{ ...ignC, t: 0 }], windFn(bestOff), { members: FAST ? 8 : 24, maxMin: 2880 });
const horizons = [180, 360, 720, imageMin - bestOff], probBin = new Uint8Array(2 * horizons.length * ROI.w * ROI.h);
const cal = calFit ?? calBest, calOff = (parseInt(cal.ignicionUTC, 10) - 12) * 60, cc = Math.cos((cal.giroVientoDeg * Math.PI) / 180), cs = Math.sin((cal.giroVientoDeg * Math.PI) / 180), calBase = windFn(calOff);
const ensCal = FF.ensembleArrival(F, [{ ...ignC, t: 0 }], (i, j, t) => { const q0 = calBase(i, j, t); return { u: q0.u * cc + q0.v * cs, v: -q0.u * cs + q0.v * cc }; }, { members: FAST ? 8 : 24, maxMin: 2880, dirSdDeg: 12, speedSd: 0.15, rosSd: 0.2 });
const horizonsCal = [180, 360, 720, imageMin - calOff];
const relOf = (P) => { let hit = 0, inObs = 0, fh = 0, hi = 0; for (let k = 0; k < P.length; k++) { if (obs[k]) { inObs++; if (P[k] >= 50) hit++; } if (P[k] >= 50) { hi++; if (!obs[k]) fh++; } } return { aciertoObservadoConP50: r3(hit / Math.max(1, inObs), 3), falsaAlarmaP50: r3(fh / Math.max(1, hi), 3) }; };
const reliabilityCal = relOf(ensCal.pAt(imageMin - calOff));
horizonsCal.forEach((hz, k) => { const P = ensCal.pAt(hz); const o = (horizons.length + k) * ROI.w * ROI.h; for (let j = 0; j < ROI.h; j++) for (let i = 0; i < ROI.w; i++) probBin[o + j * ROI.w + i] = P[(j + ROI.j0) * W + i + ROI.i0]; });
log('conjunto tras asimilar', reliabilityCal);
horizons.forEach((hz, k) => { const P = ens.pAt(hz); for (let j = 0; j < ROI.h; j++) for (let i = 0; i < ROI.w; i++) probBin[k * ROI.w * ROI.h + j * ROI.w + i] = P[(j + ROI.j0) * W + i + ROI.i0]; });
const Tcal = FF.arrivalOnField(F, [{ ...ignC, t: 0 }], (i, j, t) => { const q0 = calBase(i, j, t); return { u: q0.u * cc + q0.v * cs, v: -q0.u * cs + q0.v * cc }; }, { rosMult: cal.multVelocidad, maxMin: 2880 });
const arrBin = new Uint16Array(ROI.w * ROI.h); for (let j = 0; j < ROI.h; j++) for (let i = 0; i < ROI.w; i++) { const t = Tcal[(j + ROI.j0) * W + i + ROI.i0]; arrBin[j * ROI.w + i] = Number.isFinite(t) ? Math.min(65534, Math.round(t)) : 65535; }
const P90 = ens.pAt(imageMin - bestOff); let hit = 0, inObs = 0, falseHigh = 0, high = 0; for (let k = 0; k < P90.length; k++) { if (obs[k]) { inObs++; if (P90[k] >= 50) hit++; } if (P90[k] >= 50) { high++; if (!obs[k]) falseHigh++; } }
const reliability = { aciertoObservadoConP50: r3(hit / Math.max(1, inObs), 3), falsaAlarmaP50: r3(falseHigh / Math.max(1, high), 3) };
log('conjunto', ens.runs.length, 'miembros', reliability);

// ---------------------------------------------------------------- 5) Pluma, aspiración y pavesas a las 15 UTC
const k15 = 1, dg15 = diag[k15], fld = fields[k15], prof15 = fld.prof;
const mixU = A.profileAt(prof15, 600), U = Math.hypot(mixU.u, mixU.v), dirTo = ((Math.atan2(mixU.u, mixU.v) * 180) / Math.PI + 360) % 360;
let headRos = 0; for (let k = 0; k < best.T.length; k++) { const t = best.T[k]; if (t > 30 && t < 240) { const d = Math.hypot((k % W) - ignC.i, Math.floor(k / W) - ignC.j) * DX; headRos = Math.max(headRos, d / t); } }
const beh = fireBehavior({ rosMMin: headRos, fuel: 'matorral' }), frontM = 2000, qW = beh.intensityKWm * 1000 * frontM;
const plume = A.briggsPlume({ qW, U, N2: dg15.freeTropN2 ?? 5e-5, hpbl: dg15.hpblM ?? 1500, rho: dg15.rhoSfc });
const imp = A.imposePlume(fld.g, A.initialWind(fld.g, (z) => A.profileAt(prof15, z)), { x: ignU.x, y: ignU.y, qW, U, dirToDeg: dirTo, N2: dg15.freeTropN2 ?? 5e-5, hpbl: dg15.hpblM ?? 1500 });
const fp = A.massConsistent(fld.g, imp.field, { iters: FAST ? 120 : 260, fixedW: imp.fixedW });
const inflow = (f) => { let s = 0, n = 0; for (let a = 0; a < 16; a++) { const ang = (a / 16) * 2 * Math.PI, x = ignU.x + Math.sin(ang) * 1500, y = ignU.y + Math.cos(ang) * 1500, q = A.sampleWind(fld.g, f, x, y, heightAt(x, y) + 40); s += -(q.u * Math.sin(ang) + q.v * Math.cos(ang)); n++; } return s / n; };
const indraft = { sinPlumaMs: r3(inflow(fld.f), 2), conPlumaMs: r3(inflow(fp), 2) };
const emb = [], R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
for (let n = 0; n < (FAST ? 60 : 200); n++) { const xd = 200 + R() * 1500, zA = Math.min(plume.rise(xd), 200 + R() * 1200); emb.push({ x: ignU.x + Math.sin((dirTo * Math.PI) / 180) * xd, y: ignU.y + Math.cos((dirTo * Math.PI) / 180) * xd, z: heightAt(ignU.x, ignU.y) + zA }); }
const ember = A.advectParticles(fld.g, fp, emb, { dt: 2, steps: 600, terminalMs: 4, burnoutS: 240, sigmaTurb: 1.2, seed: 5 });
const dists = ember.landed.map((l) => l.distM).sort((a, b) => a - b), q = (p) => (dists.length ? Math.round(dists[Math.min(dists.length - 1, Math.floor(p * dists.length))]) : null);
const spotting = { pavesas: emb.length, caidas: ember.landed.length, vivasAlCaer: ember.landed.filter((l) => l.alive).length, p50M: q(0.5), p90M: q(0.9), supuestos: 'velocidad terminal 4 m/s y 240 s de combustión (supuestos)' };
log('pluma', Math.round(plume.finalRiseM), 'm; aspiración', indraft, 'pavesas', spotting);

// ---------------------------------------------------------------- 6) Aviones sobre el frente real
const air = { 'CL-415': A.wakeVortex({ ...A.AIRCRAFT['CL-415'], rho: dg15.rhoSfc, heightM: 40 }), helicoptero: A.rotorDownwash({ ...A.AIRCRAFT['helicoptero-medio'], rho: dg15.rhoSfc }), descargaCL415: A.dropEffect({ litres: A.AIRCRAFT['CL-415'].litres, intensityKWm: beh.intensityKWm }), descargaAT802: A.dropEffect({ litres: A.AIRCRAFT['AT-802F'].litres, intensityKWm: beh.intensityKWm }) };

// ---------------------------------------------------------------- 7) Flota de coches como estación meteorológica (viento verdadero = campo 3D real)
const roads = [[40.383, -4.250, 40.362, -4.385], [40.30, -4.395, 40.415, -4.500], [40.36, -4.40, 40.30, -4.395]];
const fleetRes = []; const Rn = (() => { let s = 99; const u = () => ((s = (s * 16807) % 2147483647) / 2147483647); return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()); })();
const truthAt = (x, y) => A.sampleWind(fld.g, fld.f, x, y, heightAt(x, y) + 3);
for (const n of [2, 4, 8, 16, 32]) {
  const errs = [];
  for (let rep = 0; rep < 40; rep++) {
    const obsF = []; let tu = 0, tv = 0;
    for (let c = 0; c < n; c++) {
      const [la1, lo1, la2, lo2] = roads[c % roads.length], s = (c * 0.37 + rep * 0.11) % 1, p1 = toUtm(la1, lo1, 30), p2 = toUtm(la2, lo2, 30), x = p1.x + (p2.x - p1.x) * s, y = p1.y + (p2.y - p1.y) * s;
      const hd = ((Math.atan2(p2.x - p1.x, p2.y - p1.y) * 180) / Math.PI + (c % 2 ? 180 : 0) + 360) % 360, tr = truthAt(x, y); tu += tr.u / n; tv += tr.v / n;
      const wPar = tr.u * Math.sin((hd * Math.PI) / 180) + tr.v * Math.cos((hd * Math.PI) / 180), v = 22, rho = dg15.rhoSfc, m = 1500, cdA = 0.7, crr = 0.011;
      const aTrue = -(0.5 * rho * cdA * (v - wPar) * Math.abs(v - wPar) + m * A.G * crr) / m;
      const est = A.coastdownWind({ aMs2: aTrue + 0.03 * Rn(), vMs: v, rho, cdA: cdA * (1 + 0.05 * Rn()) }); obsF.push({ headingDeg: hd, wParMs: est.wParMs, sdMs: est.sdMs });
    }
    const fw = A.fleetWind(obsF); if (fw.ok) errs.push(Math.hypot(fw.u - tu, fw.v - tv));
  }
  errs.sort((a, b) => a - b); fleetRes.push({ coches: n, errorMedianoMs: r3(errs[Math.floor(errs.length / 2)] ?? NaN, 2), errorP90Ms: r3(errs[Math.floor(errs.length * 0.9)] ?? NaN, 2) });
}
log('flota', fleetRes);
// Presión: anomalía mesoescalar SINTÉTICA de −1 hPa (radio 3 km) sobre el fondo del modelo; barómetros con sesgo por aparato
const presRes = []; for (const n of [10, 40, 120]) {
  const truth = (x, y) => -1 * Math.exp(-((x - ignU.x) ** 2 + (y - ignU.y) ** 2) / (2 * 3000 ** 2)), o = [];
  for (let c = 0; c < n; c++) { const ang = c * 2.399, rr = 1500 + 9000 * ((c * 0.618) % 1), x = ignU.x + Math.sin(ang) * rr, y = ignU.y + Math.cos(ang) * rr, bias = 1.5 * Rn(); let st = { b: 0, P: 4 }; for (let d = 0; d < 20; d++) st = A.biasKalman(st, bias + 0.3 * Rn()); o.push({ x, y, val: truth(x, y) + bias - st.b + 0.3 * Rn(), sd: Math.sqrt(st.P + 0.09) }); }
  const pts = []; for (let a = -6000; a <= 6000; a += 1500) for (let b = -6000; b <= 6000; b += 1500) pts.push({ x: ignU.x + a, y: ignU.y + b });
  const an = A.optimalInterpolation(pts, o, () => 0, { L: 3000, sdB: 1 }); let e0 = 0, e1 = 0; pts.forEach((p, k) => { const t = truth(p.x, p.y); e0 += t * t; e1 += (an.val[k] - t) ** 2; });
  presRes.push({ sensores: n, rmseFondoHpa: r3(Math.sqrt(e0 / pts.length), 3), rmseAnalisisHpa: r3(Math.sqrt(e1 / pts.length), 3) });
}
log('presión', presRes);

// ---------------------------------------------------------------- 8) Cámaras sobre el terreno real: geolocalización y altura de la columna
const peaks = []; for (let j = 5; j < H - 5; j += 3) for (let i = 5; i < W - 5; i += 3) { const c = elev[j * W + i]; let top = true; for (let dj = -5; dj <= 5 && top; dj++) for (let di = -5; di <= 5; di++) if (elev[(j + dj) * W + i + di] > c) { top = false; break; } const d = Math.hypot(i - ignC.i, j - ignC.j) * DX; if (top && d > 5000 && d < 16000) peaks.push({ i, j, z: c, d }); }
peaks.sort((a, b) => b.z - a.z); const sites = []; for (const p of peaks) { if (sites.every((s) => Math.abs(Math.atan2(s.i - ignC.i, s.j - ignC.j) - Math.atan2(p.i - ignC.i, p.j - ignC.j)) > 0.8)) sites.push(p); if (sites.length === 3) break; }
const zIgn = heightAt(ignU.x, ignU.y), topX = ignU.x + Math.sin((dirTo * Math.PI) / 180) * 1500, topY = ignU.y + Math.cos((dirTo * Math.PI) / 180) * 1500, topZ = zIgn + plume.rise(1500), base = [ignU.x, ignU.y, zIgn + 2], top = [topX, topY, topZ];
const cams = sites.map((s) => { const { x, y } = cellXY(s.i, s.j), z = s.z + 12, az = ((Math.atan2(ignU.x - x, ignU.y - y) * 180) / Math.PI + 360) % 360; return FF.makeCamera({ x, y, z, azDeg: az, tiltDeg: (Math.atan2(zIgn + 300 - z, Math.hypot(ignU.x - x, ignU.y - y)) * 180) / Math.PI, hfovDeg: 40 }); });
const hVis = cams.map((c) => { for (let h = 0; h <= 1500; h += 25) if (FF.lineOfSight(c.o, [base[0], base[1], base[2] + h], heightAt)) return h; return Infinity; }), hAll = Math.max(...hVis), colPt = [base[0], base[1], base[2] + hAll];
const camErr = { base1camara: [], base3camaras: [], cima3camaras: [], calor: [] }, vis = cams.map((c) => FF.lineOfSight(c.o, base, heightAt)), visTop = cams.map((c) => FF.lineOfSight(c.o, top, heightAt));
for (let rep = 0; rep < 120; rep++) {
  const raysB = [], raysT = [];
  for (const cam of cams) {
    const jit = (c) => FF.makeCamera({ x: c.o[0], y: c.o[1], z: c.o[2], azDeg: c.azDeg + 0.15 * Rn(), tiltDeg: c.tiltDeg + 0.15 * Rn(), hfovDeg: c.hfovDeg, w: c.w, h: c.h }), cj = jit(cam);
    const pb = FF.projectPoint(cam, colPt), pt = FF.projectPoint(cam, top);
    raysB.push(FF.pixelRay(cj, pb.u + 2 * Rn(), pb.v + 2 * Rn())); raysT.push(FF.pixelRay(cj, pt.u + 2 * Rn(), pt.v + 2 * Rn()));
  }
  const tb = FF.closestPointToRays(raysB), tt = FF.closestPointToRays(raysT);
  cams.forEach((cam, ci) => { if (!vis[ci]) return; const g1 = FF.rayTerrain(raysB[ci], heightAt); if (g1.hit) camErr.base1camara.push(Math.hypot(g1.p[0] - base[0], g1.p[1] - base[1])); });
  if (tb.ok && tt.ok) { const xh = Math.hypot(tt.p[0] - tb.p[0], tt.p[1] - tb.p[1]); camErr.calor.push(FF.plumeHeatFromRise({ riseM: tt.p[2] - (tb.p[2] - hAll), xM: xh, U, rho: dg15.rhoSfc }).qW / 1e9); }
  if (tb.ok) camErr.base3camaras.push(Math.hypot(tb.p[0] - colPt[0], tb.p[1] - colPt[1])); if (tt.ok) camErr.cima3camaras.push(Math.abs(tt.p[2] - top[2]));
}
const med = (a) => (a.length ? Math.round(a.sort((x, y) => x - y)[Math.floor(a.length / 2)]) : null);
const cameraRes = { camaras: sites.map((s) => { const { x, y } = cellXY(s.i, s.j), ll = fromUtm(x, y, 30); return { lat: r3(ll.lat, 4), lon: r3(ll.lon, 4), altitudM: Math.round(s.z), distanciaKm: r3(s.d / 1000, 1) }; }), venLaBase: vis, venLaCima: visTop, alturaVisiblePorCamaraM: hVis, alturaComunTriangulada: hAll, errorMedianoBase1CamaraDEM_M: med(camErr.base1camara), errorMedianoPosicionColumna3Camaras_M: med(camErr.base3camaras), errorMedianoAlturaCima_M: med(camErr.cima3camaras), ruido: '2 px y 0,15° de orientación (supuestos)', calorDesdeColumnaGW_mediana: r3([...camErr.calor].sort((a, b) => a - b)[Math.floor(camErr.calor.length / 2)] ?? NaN, 2), calorDesdeColumnaGW_p10p90: [r3([...camErr.calor].sort((a, b) => a - b)[Math.floor(camErr.calor.length * 0.1)] ?? NaN, 2), r3([...camErr.calor].sort((a, b) => a - b)[Math.floor(camErr.calor.length * 0.9)] ?? NaN, 2)], calorDelFrenteGW: r3(qW / 1e9, 2) };
log('cámaras', cameraRes);

// ---------------------------------------------------------------- 9) Escribir
const roiMeta = { ...ROI, horizontesMin: horizons, ignicionUTC: best.ignicionUTC };
const out = {
  generado: new Date().toISOString().slice(0, 10), fuentes: meta.fuente, rapido: FAST, malla: { w: W, h: H, dx: DX, x0: X0, y1: Y1, crs: 'EPSG:32630' }, ignicion: { ...IGN, i: ignC.i, j: ignC.j },
  masaDeAire: diag.map((d) => ({ validUTC: d.validUTC, t2: d.t2, rh2: d.rh2, td2: d.td2, viento10Kmh: d.wind10Kmh, dirDesde: d.dirFrom10, rachaKmh: d.gustKmh, capaMezclaM: d.hpblM, vientoMaxMezclaKmh: d.mixMaxWindKmh, densidad: d.rhoSfc, haines: d.haines?.value ?? null, cape: d.capeJkg, regla30: (d.t2 > 30) + (d.rh2 < 30) + (d.wind10Kmh > 30) + 0, regla30ConRacha: (d.t2 > 30) + (d.rh2 < 30) + ((d.gustKmh ?? 0) > 30) + 0 })),
  viento3D: { malla: `${NX}×${NY}×${NZ} celdas de ${DX3}×${DX3}×${DZ} m`, divergencia: fields.map((f) => ({ antes: +f.divBefore.toExponential(2), despues: +f.divAfter.toExponential(2), iter: f.iters })) },
  validacion: { cicatrizObservadaHa: obsCells, rumboObservado: Math.round(bearingTo(centroid(obs))), jaccardCirculo: r3(J0, 3), experimentos: exps.map(({ T, ...e }) => e), mejor: best.ignicionUTC, calibracionEnMuestra: { mejorForma: calBest, mejorConAreaCoherente: calFit, top5: calib.slice(0, 5), nota: 'Ajuste dentro de muestra: indica el sesgo que explica la cicatriz; no es una validación independiente' } },
  conjunto: { miembros: ens.runs.length, horizontesMin: horizons, ...reliability, trasAsimilar: { ...reliabilityCal, horizontesMin: horizonsCal, parametros: cal }, roi: roiMeta, llegada: { fichero: 'arrival_roi.bin (Uint16, minutos desde la ignición calibrada; 65535 = no llega)', ignicionUTC: cal.ignicionUTC, giroVientoDeg: cal.giroVientoDeg, multVelocidad: cal.multVelocidad }, capas: 'prob_roi.bin: 8 capas Uint8 (4 horizontes sin asimilar + 4 tras asimilar), cada una roi.w × roi.h' },
  pluma: { calorGW: r3(qW / 1e9, 2), intensidadKWm: beh.intensityKWm, rosCabezaMMin: r3(headRos, 1), frenteM: frontM, alturaFinalM: Math.round(plume.finalRiseM), vientoMezclaMs: r3(U, 1), dirHacia: Math.round(dirTo), flujoFlotabilidad: Math.round(plume.F), aspiracion: indraft, pavesas: spotting },
  aviones: JSON.parse(JSON.stringify(air, (k, v) => (typeof v === 'number' ? r3(v, 2) : v))), flota: fleetRes, presion: presRes, camaras: cameraRes,
};
writeFileSync(resolve(D, 'fire3d.json'), JSON.stringify(out, null, 1)); writeFileSync(resolve(D, 'prob_roi.bin'), probBin); writeFileSync(resolve(D, 'arrival_roi.bin'), Buffer.from(arrBin.buffer));
mkdirSync(resolve(ROOT, 'docs/paper'), { recursive: true }); writeFileSync(resolve(ROOT, 'docs/paper/resultados_v019.json'), JSON.stringify(out, null, 1));
log('escrito fire3d.json, prob_roi.bin, arrival_roi.bin y docs/paper/resultados_v019.json');
