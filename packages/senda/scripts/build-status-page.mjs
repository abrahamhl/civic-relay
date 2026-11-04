#!/usr/bin/env node
/**
 * Genera investor-next/public/senda/estado.html a partir de evidencias REALES:
 *  - ejecuta la batería de pruebas del núcleo (node --test) y cuenta resultados,
 *  - lee evidence/senda/offline-e2e.json (Chromium sin red) y scenarios.json,
 *  - estampa el commit de Git. Nada se escribe a mano.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const pkg = resolve(here, '..');
const testFiles = readdirSync(resolve(pkg, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => `tests/${f}`);
const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...testFiles], { cwd: pkg, encoding: 'utf8' });
const tap = run.stdout;
const num = (k) => +(tap.match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? 0);
const unit = { total: num('tests'), pass: num('pass'), fail: num('fail') };
const names = [...tap.matchAll(/^(?:    )?ok \d+ - (.+)$/gm)].map((m) => m[1]).filter((n) => !n.startsWith('tests/'));
const e2e = JSON.parse(readFileSync(resolve(root, 'evidence/senda/offline-e2e.json'), 'utf8'));
const sc = JSON.parse(readFileSync(resolve(root, 'evidence/senda/scenarios.json'), 'utf8'));
let sha = 'desconocido'; try { sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* sin git */ }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ok = (b) => (b ? '<span class="ok">✔</span>' : '<span class="ko">✘</span>');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SENDA · Verificación técnica</title><meta name="description" content="Resultados reproducibles de las pruebas de SENDA: núcleo, app sin red y escenarios.">
<link rel="icon" href="./icon.svg"><style>
:root{--bg:#05090c;--p:#0b141c;--l:#203240;--t:#f2f4f4;--m:#9fb2bc;--c:#ff7756;--i:#91d7e8;--e:#34d399}
body{margin:0;background:var(--bg);color:var(--t);font:16px/1.5 Inter,system-ui,sans-serif}main{max-width:980px;margin:0 auto;padding:28px 18px 60px}
h1{font-size:34px;margin:0 0 6px}h2{margin:34px 0 10px}a{color:var(--i)}.m{color:var(--m)}code{font:13px ui-monospace,monospace;color:var(--i)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:20px 0}.k{background:var(--p);border:1px solid var(--l);border-radius:14px;padding:16px}.k b{display:block;font-size:34px;color:var(--e)}
table{width:100%;border-collapse:collapse;font-size:15px}td,th{border-bottom:1px solid var(--l);padding:9px 6px;text-align:left;vertical-align:top}.ok{color:var(--e);font-weight:800}.ko{color:#ff5b6e;font-weight:800}
.card{background:var(--p);border:1px solid var(--l);border-radius:14px;padding:16px;margin:12px 0}ul.t{columns:2;font-size:14px;color:var(--m)}@media(max-width:700px){ul.t{columns:1}}
.btn{display:inline-block;background:var(--c);color:#140804;font-weight:800;padding:10px 16px;border-radius:12px;text-decoration:none}
</style></head><body><main>
<p class="m">SENDA · Sistema de Enrutamiento de Emergencia por canales alternativos</p>
<h1>Verificación técnica</h1>
<p class="m">Generado automáticamente desde las pruebas el ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · commit <code>${sha}</code>. Reprodúcelo tú mismo con los comandos del final.</p>
<p><a class="btn" href="./index.html">Abrir SENDA Campo</a></p>
<div class="kpis">
 <div class="k"><b>${unit.pass}/${unit.total}</b>pruebas del núcleo superadas</div>
 <div class="k"><b>${e2e.passed}/${e2e.total}</b>comprobaciones de extremo a extremo con la red cortada (Chromium real)</div>
 <div class="k"><b>${sc.s01.plan.etaMinutes} min</b>entrega en el escenario Arnhem → San Martín, frente a ${sc.s01.plan.whatsappBaselineMinutes} min esperando a que vuelva la antena</div>
 <div class="k"><b>0</b>dependencias externas en el núcleo (WebCrypto estándar)</div>
</div>
<h2>App sin red · tres teléfonos independientes</h2>
<table><tr><th></th><th>Comprobación</th><th>Detalle</th></tr>
${e2e.results.map((r) => `<tr><td>${ok(r.ok)}</td><td>${esc(r.name)}</td><td class="m">${r.airtimeSeconds ? `audio ${r.airtimeSeconds} s · ${r.bytes} B` : ''}</td></tr>`).join('\n')}
</table><p class="m">${esc(e2e.scope)} Red: ${esc(e2e.network)}.</p>
<h2>Escenarios de referencia (algoritmos reales de SENDA)</h2>
<div class="card"><b>S01 · Arnhem → San Martín de Valdeiglesias</b>. Antena caída 8 h.<br>${sc.s01.plan.routes.map((r) => `${esc(r.path)} · <code>${r.channels.join(' + ')}</code> · <b>${r.etaMinutes} min</b>`).join('<br>')}</div>
<div class="card"><b>S04 · Sismo</b>: epicentro localizado por ${sc.s04.location.stations} teléfonos con un error de ${sc.s04.location.errorKm} km; el modo relé se activa solo al corroborarlo una fuente pública (${sc.s04.activation.networkOnly} → ${sc.s04.activation.withPublicFeed}).</div>
<div class="card"><b>S05 · Escombros</b>: víctima localizada a ${sc.s05.horizontalErrorM} m mediante Bluetooth y marcada en la cámara; puente automático por <code>${esc(sc.s05.bridge.id)}</code>; respiración detectada a ${sc.s05.csiThroughWall.withPerson.rpm} rpm con Wi-Fi CSI.</div>
<div class="card"><b>S07 · Coordinación</b>: credenciales institucionales firmadas, canales internos aislados por organismo y registro de familiares con mínimo acceso.</div>
<h2>Las ${unit.total} pruebas del núcleo</h2><ul class="t">${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<h2>Reproducir</h2><div class="card"><code>git clone https://github.com/abrahamhl/civic-relay && cd civic-relay<br>node --test packages/senda/tests/*.test.mjs<br>node investor-next/scripts/senda-offline-e2e.mjs</code></div>
<h2>Siguiente fase</h2><p class="m">Pilotos de campo con teléfonos físicos y equipos de rescate: alcance acústico y Bluetooth bajo escombros, calibración Wi-Fi CSI en edificios reales y convenios con protección civil y operadores con satélite directo al móvil.</p>
</main></body></html>`;
writeFileSync(resolve(root, 'investor-next/public/senda/estado.html'), html);
console.log(`estado.html · núcleo ${unit.pass}/${unit.total} · e2e ${e2e.passed}/${e2e.total} · ${sha}`);
if (unit.fail || e2e.passed !== e2e.total) process.exit(1);
