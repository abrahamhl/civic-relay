/**
 * SENDA · F6 Pruebas de endurecimiento de seguridad y privacidad:
 *  - Cabeceras de seguridad y CSP estricta en investor-next/vercel.json (0 unsafe-eval, 0 CDNs,
 *    COOP/CORP, object-src 'none', y script-src sin 'unsafe-inline' en las 9 páginas operativas).
 *  - Escaneo determinista de patrones de secretos reales en el código fuente civil.
 *  - Integridad del workflow de seguridad (gitleaks + osv-scanner + pnpm audit con timeout-minutes).
 *  - Aislamiento de la bóveda de defensa (`packages/senda/src/defense`) fuera de `investor-next/public/senda/*.html`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('F6 Seguridad: vercel.json endurece CSP (0 unsafe-eval, 0 CDNs, COOP/CORP y script-src estricto en 9 superficies operativas)', () => {
  const cfg = JSON.parse(readFileSync(resolve(ROOT, 'investor-next/vercel.json'), 'utf8'));
  const globalBlock = cfg.headers.find((h) => h.source === '/(.*)');
  assert.ok(globalBlock, 'debe existir bloque de cabeceras globales /(.*)');
  const byKey = Object.fromEntries(globalBlock.headers.map((h) => [h.key.toLowerCase(), h.value]));

  assert.equal(byKey['x-content-type-options'], 'nosniff');
  assert.equal(byKey['x-frame-options'], 'DENY');
  assert.equal(byKey['cross-origin-opener-policy'], 'same-origin');
  assert.equal(byKey['cross-origin-resource-policy'], 'same-origin');
  assert.match(byKey['strict-transport-security'], /max-age=31536000/);

  const globalCsp = byKey['content-security-policy'];
  assert.ok(globalCsp, 'debe declarar Content-Security-Policy global');
  assert.doesNotMatch(globalCsp, /'unsafe-eval'/, 'prohibido unsafe-eval');
  assert.doesNotMatch(globalCsp, /unpkg\.com|fonts\.gstatic\.com|\*\.vercel\.app/, 'prohibidos CDNs externos o comodines vercel');
  assert.match(globalCsp, /object-src 'none'/);
  assert.match(globalCsp, /frame-ancestors 'none'/);

  const strictBlock = cfg.headers.find((h) => h.source.includes('copiloto') && h.source.includes('reportar') && h.source.includes('personas'));
  assert.ok(strictBlock, 'debe existir bloque de CSP estricta para las superficies operativas modernas');
  const strictCsp = strictBlock.headers.find((h) => h.key.toLowerCase() === 'content-security-policy')?.value ?? '';
  assert.match(strictCsp, /script-src 'self' 'wasm-unsafe-eval';/, 'script-src operativo no debe incluir unsafe-inline ni unsafe-eval');
  assert.doesNotMatch(strictCsp, /script-src[^;]*'unsafe-inline'/);
});

test('F6 Seguridad: cero secretos hardcodeados en packages/senda/src y investor-next/public/senda', () => {
  const SECRET_PATTERNS = [
    { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: 'GitHub PAT', re: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
    { name: 'Private Key PEM', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'Slack Token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
    { name: 'Google API Key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  ];

  const dirs = [
    resolve(ROOT, 'packages/senda/src'),
    resolve(ROOT, 'packages/senda/server'),
    resolve(ROOT, 'investor-next/public/senda'),
  ];
  const findings = [];
  for (const dir of dirs) {
    for (const f of readdirSync(dir)) {
      if (!/\.(mjs|js|html|json)$/.test(f)) continue;
      const full = resolve(dir, f);
      const txt = readFileSync(full, 'utf8');
      for (const pat of SECRET_PATTERNS) {
        if (pat.re.test(txt)) findings.push(`${pat.name} en ${f}`);
      }
    }
  }
  assert.deepEqual(findings, [], `posibles secretos detectados: ${findings.join(', ')}`);
});

test('F6 Seguridad: workflow senda-security-ci.yml declara gitleaks, osv-scanner, pnpm audit y timeout-minutes', () => {
  const wf = readFileSync(resolve(ROOT, '.github/workflows/senda-security-ci.yml'), 'utf8');
  assert.match(wf, /gitleaks/);
  assert.match(wf, /osv-scanner/);
  assert.match(wf, /pnpm audit --prod --audit-level=critical/);
  assert.match(wf, /timeout-minutes:\s*10/);
});

test('F6 Seguridad: la bóveda de defensa sigue aislada de las superficies HTML civiles', () => {
  const sendaDir = resolve(ROOT, 'investor-next/public/senda');
  const leaks = [];
  for (const f of readdirSync(sendaDir)) {
    if (!f.endsWith('.html')) continue;
    const txt = readFileSync(resolve(sendaDir, f), 'utf8');
    if (/\/core\/defense\/|src\/defense\//.test(txt)) leaks.push(f);
  }
  assert.deepEqual(leaks, [], `superficies civiles importando bóveda de defensa: ${leaks.join(', ')}`);
});
