#!/usr/bin/env node
// Genera los guiones derivados de V3 (90s, 60s, 30s), V4 (vertical-45s) y V5 (6 sims)
// exclusivamente a partir de las escenas y frases aprobadas en m95-film.json y m95-ruta.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const film = JSON.parse(fs.readFileSync(path.join(__dirname, 'm95-film.json'), 'utf8'));
const ruta = JSON.parse(path.join(__dirname, 'm95-ruta.json') ? fs.readFileSync(path.join(__dirname, 'm95-ruta.json'), 'utf8') : '{}');

function pickScene(srcDoc, id, lineIndices = null) {
  const orig = srcDoc.scenes.find((s) => s.id === id);
  if (!orig) throw new Error(`Scene ${id} not found`);
  const sc = JSON.parse(JSON.stringify(orig));
  if (Array.isArray(lineIndices)) {
    for (const k of ['es', 'es_say', 'en', 'en_say', 'nl']) {
      if (Array.isArray(sc[k])) {
        sc[k] = lineIndices.map((idx) => sc[k][idx]).filter((x) => typeof x === 'string');
      }
    }
  }
  return sc;
}

function writeScript(name, note, scenes) {
  const out = {
    note,
    voices: film.voices,
    scenes,
  };
  const outPath = path.join(__dirname, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(`wrote ${name}.json (${scenes.length} scenes)`);
}

// V3 — 90s: s1 (0,1) + s2 (0,1) + s3b (0,1) + s9 (0,1) + s13 (0,1) (~92s)
writeScript('m95-90s', 'SENDA Mission 9.5 · Corte ejecutivo 90s (s1 + s2 + s3b + s9 + s13)', [
  pickScene(film, 's1', [0, 1]),
  pickScene(film, 's2', [0, 1]),
  pickScene(film, 's3b', [0, 1]),
  pickScene(film, 's9', [0, 1]),
  pickScene(film, 's13', [0, 1]),
]);

// V3 — 60s: s1 (0,1) + s4 (0,1) + s9 (0) + s13 (1) (~62s)
writeScript('m95-60s', 'SENDA Mission 9.5 · Corte técnico 60s (s1 + s4 + s9 + s13)', [
  pickScene(film, 's1', [0, 1]),
  pickScene(film, 's4', [0, 1]),
  pickScene(film, 's9', [0]),
  pickScene(film, 's13', [1]),
]);

// V3 — 30s: s1 (0,1) + s13 (0,1) (~33s)
writeScript('m95-30s', 'SENDA Mission 9.5 · Teaser 30s (s1 + s13)', [
  pickScene(film, 's1', [0, 1]),
  pickScene(film, 's13', [0, 1]),
]);

// V4 — Vertical 9:16 45s: s1 (0,1) + s3b (0,1) + s13 (1) (~43s)
writeScript('m95-vertical-45s', 'SENDA Mission 9.5 · Vertical 9:16 45s (s1 + s3b + s13)', [
  pickScene(film, 's1', [0, 1]),
  pickScene(film, 's3b', [0, 1]),
  pickScene(film, 's13', [1]),
]);

// V5 — 6 simulaciones explicadas (15-35s cada una)
writeScript('m95-sim-braking', 'SENDA Mission 9.5 · Simulación explicada: Frenada en cadena en niebla (r1)', [
  pickScene(ruta, 'r1'),
]);

writeScript('m95-sim-sos', 'SENDA Mission 9.5 · Simulación explicada: SOS diferido DTN en 18 km sin red (r2)', [
  pickScene(ruta, 'r2'),
]);

writeScript('m95-sim-wrongway', 'SENDA Mission 9.5 · Simulación explicada: Conductor en sentido contrario (r5)', [
  pickScene(ruta, 'r5'),
]);

writeScript('m95-sim-queue', 'SENDA Mission 9.5 · Simulación explicada: Onda de choque LWR en retención (r6)', [
  pickScene(ruta, 'r6'),
  pickScene(ruta, 'r11'),
]);

writeScript('m95-sim-visibility', 'SENDA Mission 9.5 · Simulación explicada: Visibilidad Koschmieder en cámara pública (r7)', [
  pickScene(ruta, 'r7'),
]);

writeScript('m95-sim-proof', 'SENDA Mission 9.5 · Simulación explicada: La prueba que puedes inspeccionar (s12b)', [
  pickScene(film, 's12b'),
]);
