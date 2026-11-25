import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readWeb = (name) => readFileSync(new URL(`../../../investor-next/public/senda/${name}`, import.meta.url), 'utf8');

test('reportar.html cumple accesibilidad, idioma español, CSP local (sin CDN) y aviso 112', () => {
  const html = readWeb('reportar.html');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /href="tel:112"/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /\/senda\/fonts\/fonts\.css/);
  assert.doesNotMatch(html, /https:\/\/cdn|fonts\.googleapis\.com/i);
  assert.match(html, /reportar\.mjs/);
  const js = readWeb('reportar.mjs');
  assert.match(js, /\/senda\/core\/citizen-report\.mjs/);
  assert.match(js, /stripJpegExif/);
  assert.match(js, /redactRgbaRegions/);
  assert.match(js, /computeDHash64/);
});

test('comite.html cumple diseño operador SENDA, niveles N0–N5, verificación y puerta N5 bloqueada', () => {
  const html = readWeb('comite.html');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-lvl="N4"/);
  assert.match(html, /data-lvl="N5"/);
  assert.match(html, /btn-ask-verify/);
  assert.match(html, /btn-emit-n5" disabled/);
  assert.doesNotMatch(html, /https:\/\/cdn|fonts\.googleapis\.com/i);
  const js = readWeb('comite.mjs');
  assert.match(js, /\/senda\/core\/report-protocol\.mjs/);
  assert.match(js, /authorizePublicWarningN5/);
  assert.match(js, /createAuditLog/);
});
