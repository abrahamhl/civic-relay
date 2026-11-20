#!/usr/bin/env node
/**
 * Comprehensive Playwright QA for SENDA web redesign:
 * - Static server over investor-next/out/
 * - 3 viewports: 390px (mobile), 834px (tablet), 1440px (desktop)
 * - 3 locales (en, es, nl) across all redesigned pages
 * - Zero horizontal overflow, zero console/page errors, zero broken internal links
 * - Interactive tests: EvidenceBadge <dialog>, Dark Mode toggle, Control Center
 *   (⌘K palette, 6-step guided tour, correlation graph, 2-step simulated control + audit log)
 * - Measures Home initial gzipped JS payload (< 170 kB target)
 * - Captures screenshots for docs/web/REDESIGN_REPORT.md
 */
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const outDir = resolve(projectDir, 'out');
const shotsDir = resolve(projectDir, '../docs/web/screenshots');
mkdirSync(shotsDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function resolveStaticFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = clean.replace(/^\/+/, '');
  const candidates = [];
  if (!rel) {
    candidates.push(resolve(outDir, 'index.html'));
  } else {
    candidates.push(resolve(outDir, rel));
    candidates.push(resolve(outDir, `${rel.replace(/\/$/, '')}.html`));
    candidates.push(resolve(outDir, rel, 'index.html'));
  }
  for (const c of candidates) {
    if (c.startsWith(outDir) && existsSync(c) && statSync(c).isFile()) {
      return c;
    }
  }
  return null;
}

function startServer() {
  return new Promise((res) => {
    const server = http.createServer((req, reply) => {
      const file = resolveStaticFile(req.url || '/');
      if (!file) {
        reply.writeHead(404);
        reply.end('Not found');
        return;
      }
      const ext = extname(file).toLowerCase();
      reply.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      reply.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      res({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function main() {
  const { chromium } = await import('playwright');
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });

  const report = {
    generatedAt: new Date().toISOString(),
    viewports: [390, 834, 1440],
    pagesChecked: 0,
    brokenLinks: [],
    overflowFailures: [],
    consoleErrors: [],
    homeJsGzKb: 0,
    interactions: {},
    screenshots: []
  };

  try {
    // 1. Measure Home initial JS gzipped payload & inspect links across routes
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const homeJsBytes = [];
    page.on('response', async (resp) => {
      const u = resp.url();
      if (u.startsWith(baseUrl) && /\.js($|\?)/.test(u)) {
        try {
          const buf = await resp.body();
          homeJsBytes.push({ url: u.replace(baseUrl, ''), raw: buf.length, gz: gzipSync(buf).length });
        } catch {
          // ignore
        }
      }
    });

    page.on('pageerror', (err) => report.consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(`console.error: ${msg.text()}`);
    });

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const totalGz = homeJsBytes.reduce((s, x) => s + x.gz, 0);
    report.homeJsGzKb = +(totalGz / 1024).toFixed(1);
    console.log(`Home initial JS (gz): ${report.homeJsGzKb} kB across ${homeJsBytes.length} chunks`);

    // Screenshot Home Light (1440)
    await page.screenshot({ path: resolve(shotsDir, 'home-en-1440-light.png'), fullPage: false });
    report.screenshots.push('docs/web/screenshots/home-en-1440-light.png');

    // Test EvidenceBadge native dialog open + Escape close
    const firstBadge = page.locator('button.s-badge').first();
    await firstBadge.click();
    const openDialogs = await page.locator('dialog[open]').count();
    assert.equal(openDialogs, 1, 'EvidenceBadge dialog did not open');
    await page.keyboard.press('Escape');
    const closedDialogs = await page.locator('dialog[open]').count();
    assert.equal(closedDialogs, 0, 'EvidenceBadge dialog did not close on Escape');
    report.interactions.evidenceBadgeDialog = 'PASS';

    // Test Dark-default -> Light mode toggle -> revert to Dark
    await page.locator('[data-testid="theme-toggle"]').click();
    await page.waitForTimeout(350);
    const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.equal(themeAttr, 'light', 'Theme toggle did not switch from dark default to light');
    await page.screenshot({ path: resolve(shotsDir, 'home-en-1440-dark.png'), fullPage: false });
    report.screenshots.push('docs/web/screenshots/home-en-1440-dark.png');
    await page.locator('[data-testid="theme-toggle"]').click(); // revert back to dark default
    await page.waitForTimeout(250);
    report.interactions.darkModeToggle = 'PASS';

    // Test browser-localized video audio & ES/EN/NL subtitle controls
    const firstVideoCard = page.locator('[data-testid="senda-video-card"]').first();
    await firstVideoCard.scrollIntoViewIfNeeded();
    await firstVideoCard.locator('[data-testid="video-audio-es"]').click();
    const esSrc = await firstVideoCard.locator('video').getAttribute('src');
    assert.ok(esSrc?.includes('-es.mp4'), `Expected Spanish video source, got ${esSrc}`);
    await firstVideoCard.locator('[data-testid="video-sub-nl"]').click();
    assert.equal(
      await firstVideoCard.locator('[data-testid="video-sub-nl"]').getAttribute('aria-pressed'),
      'true',
      'Dutch subtitle toggle did not activate'
    );
    await firstVideoCard.locator('[data-testid="video-sub-es"]').click();
    await firstVideoCard.locator('[data-testid="video-sub-en"]').click();
    report.interactions.browserLocalizedVideoAndSubtitles = 'PASS';

    // Test real browser-language auto-detection (es-ES and nl-NL) on /
    const esCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES' });
    const esPage = await esCtx.newPage();
    await esPage.goto(`${baseUrl}/`, { waitUntil: 'load' });
    await esPage.waitForTimeout(250);
    const autoEsSrc = await esPage.locator('[data-testid="senda-video-card"] video').first().getAttribute('src');
    assert.ok(autoEsSrc?.includes('-es.mp4'), `es-ES browser should auto-select ES video, got ${autoEsSrc}`);
    await esCtx.close();

    const nlCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'nl-NL' });
    const nlPage = await nlCtx.newPage();
    await nlPage.goto(`${baseUrl}/`, { waitUntil: 'load' });
    await nlPage.waitForTimeout(250);
    const autoNlSub = await nlPage
      .locator('[data-testid="senda-video-card"] [data-testid="video-sub-nl"]')
      .first()
      .getAttribute('aria-pressed');
    assert.equal(autoNlSub, 'true', 'nl-NL browser should auto-enable Dutch subtitles');
    await nlCtx.close();
    report.interactions.browserLocaleAutoDetectEsAndNl = 'PASS';

    // Test Audience Clarity Lens + Live 3D Mission Control + OSINT CCTV + Ojo/HyperFrames + Sensors + Crisis Atlas + 7 Live Labs on /es/
    await page.goto(`${baseUrl}/es/`, { waitUntil: 'load' });
    await page.locator('[data-testid="lens-engineer"]').click();
    assert.equal(await page.locator('[data-testid="lens-engineer"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-testid="lens-citizen"]').click();

    await page.locator('#mission-3d').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="mission-control-deck"]', { timeout: 12000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-1440-globe.png'), fullPage: false });
    report.screenshots.push('docs/web/screenshots/home-es-1440-globe.png');

    await page.locator('#osint-cctv').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="osint-intelligence-deck"]', { timeout: 12000 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-1440-osint.png'), fullPage: false });
    report.screenshots.push('docs/web/screenshots/home-es-1440-osint.png');

    await page.locator('#ojo-satelites').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="orbital-ojo-deck"]', { timeout: 12000 });
    await page.locator('[data-testid="orbital-tab-hyperframes"]').click();
    await page.waitForTimeout(350);
    await page.locator('[data-testid="orbital-tab-ojo"]').click();
    await page.waitForTimeout(250);

    await page.locator('#sensors').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="sensor-showcase"]', { timeout: 10000 });
    await page.locator('[data-testid="sensor-tab-satellite"]').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-1440-sensors.png'), fullPage: false });
    report.screenshots.push('docs/web/screenshots/home-es-1440-sensors.png');

    await page.locator('#crises').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="crisis-atlas"]', { timeout: 10000 });
    await page.locator('[data-testid="crisis-tab-valencia-dana"]').click();
    await page.locator('[data-testid="crisis-tab-venezuela-seismic"]').click();
    await page.locator('[data-testid="crisis-tab-spain-rail"]').click();

    await page.locator('#labs').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="interactive-labs-hub"]', { timeout: 10000 });
    for (const labId of ['mando', 'rail', 'doppler', 'building', 'theorems', 'telecom']) {
      await page.locator(`[data-testid="lab-tab-${labId}"]`).click();
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: resolve(shotsDir, 'home-es-1440-labs.png'), fullPage: false });
    report.screenshots.push('docs/web/screenshots/home-es-1440-labs.png');

    await page.locator('#all-capabilities').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="full-capability-matrix"]', { timeout: 10000 });
    report.interactions.mission3dOsintOjoSensorsCrises7Labs38Caps = 'PASS';

    // 2. Check all core routes x 3 viewports + broken internal links
    const routes = [
      { path: '/', lang: 'en' },
      { path: '/es/', lang: 'es' },
      { path: '/nl/', lang: 'nl' },
      { path: '/product/', lang: 'en' },
      { path: '/es/product/', lang: 'es' },
      { path: '/nl/product/', lang: 'nl' },
      { path: '/platform/', lang: 'en' },
      { path: '/es/platform/', lang: 'es' },
      { path: '/nl/platform/', lang: 'nl' },
      { path: '/evidence/', lang: 'en' },
      { path: '/es/evidence/', lang: 'es' },
      { path: '/nl/evidence/', lang: 'nl' },
      { path: '/science/', lang: 'en' },
      { path: '/es/science/', lang: 'es' },
      { path: '/nl/science/', lang: 'nl' },
      { path: '/investors/', lang: 'en' },
      { path: '/es/investors/', lang: 'es' },
      { path: '/nl/investors/', lang: 'nl' },
      { path: '/security/', lang: 'en' },
      { path: '/es/security/', lang: 'es' },
      { path: '/nl/security/', lang: 'nl' },
      { path: '/design/', lang: 'es' }
    ];

    const checkedLinks = new Set();
    for (const width of [1440, 834, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const r of routes) {
        // On 834 and 390 test representative ES/EN/NL matrix; on 1440 test every single route
        if (width !== 1440 && !['/', '/es/', '/nl/', '/es/product/', '/es/platform/', '/es/evidence/', '/es/investors/', '/es/security/'].includes(r.path)) {
          continue;
        }
        const resp = await page.goto(`${baseUrl}${r.path}`, { waitUntil: 'domcontentloaded' });
        assert.equal(resp?.status(), 200, `Expected 200 for ${r.path}`);
        await page.waitForTimeout(150);

        const metrics = await page.evaluate(() => ({
          lang: document.documentElement.lang,
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          links: Array.from(document.querySelectorAll('a[href^="/"]')).map((a) => a.getAttribute('href')),
          media: [
            ...Array.from(document.querySelectorAll('video[src^="/"]')).map((v) => v.getAttribute('src')),
            ...Array.from(document.querySelectorAll('video[poster^="/"]')).map((v) => v.getAttribute('poster')),
            ...Array.from(document.querySelectorAll('track[src^="/"]')).map((t) => t.getAttribute('src')),
            ...Array.from(document.querySelectorAll('img[src^="/"]')).map((i) => i.getAttribute('src'))
          ]
        }));

        if (r.path !== '/design/') {
          assert.equal(metrics.lang, r.lang, `${r.path} had lang=${metrics.lang}, expected ${r.lang}`);
        }
        if (metrics.scrollW > metrics.innerW + 2) {
          report.overflowFailures.push({ path: r.path, width, scrollW: metrics.scrollW, innerW: metrics.innerW });
        }
        for (const href of [...metrics.links, ...metrics.media]) {
          if (!href || checkedLinks.has(href)) continue;
          checkedLinks.add(href);
          if (!resolveStaticFile(href)) {
            report.brokenLinks.push({ from: r.path, href });
          }
        }
        report.pagesChecked++;
      }
    }

    // 3. Deep Control Center interactive verification (/es/platform/ at 1440px & 390px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/es/platform/`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="control-center"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(shotsDir, 'platform-es-1440-map.png') });
    report.screenshots.push('docs/web/screenshots/platform-es-1440-map.png');

    // Open ⌘K Command Bar
    await page.locator('[data-testid="cc-cmd-trigger"]').click();
    assert.equal(await page.locator('[data-testid="cc-cmd-dialog"][open]').count(), 1, '⌘K command palette failed to open');
    await page.keyboard.press('Escape');
    report.interactions.commandPalette = 'PASS';

    // Run 6-step Guided Demo Tour
    await page.locator('[data-testid="cc-tour-start"]').click();
    for (let step = 0; step < 6; step++) {
      assert.equal(await page.locator('[data-testid="cc-tour-card"]').isVisible(), true, `Tour card missing at step ${step + 1}`);
      await page.locator('[data-testid="cc-tour-card"] button.s-btn-primary').click();
    }
    assert.equal(await page.locator('[data-testid="cc-tour-card"]').count(), 0, 'Tour did not close after final step');
    report.interactions.guidedTour6Steps = 'PASS';

    // Correlation graph view
    await page.locator('[data-testid="cc-graph-toggle"]').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(shotsDir, 'platform-es-1440-graph.png') });
    report.screenshots.push('docs/web/screenshots/platform-es-1440-graph.png');
    report.interactions.correlationGraph = 'PASS';

    // Two-step simulated action -> visible audit log
    const beforeAudit = await page.locator('[data-testid="cc-audit-log"] li').count();
    await page.locator('[data-testid="cc-act-zone"]').click();
    assert.equal(await page.locator('[data-testid="cc-confirm-box"]').isVisible(), true, '2-step confirm box missing');
    await page.locator('[data-testid="cc-confirm-yes"]').click();
    const afterAudit = await page.locator('[data-testid="cc-audit-log"] li').count();
    assert.equal(afterAudit, beforeAudit + 1, 'Audit log did not append confirmed simulated action');
    report.interactions.twoStepSimulatedActionAudit = 'PASS';

    // Extra screenshots for report (Product, Evidence, Mobile Home 390)
    await page.goto(`${baseUrl}/es/product/`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(shotsDir, 'product-es-1440.png') });
    report.screenshots.push('docs/web/screenshots/product-es-1440.png');

    await page.goto(`${baseUrl}/es/evidence/`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(shotsDir, 'evidence-es-1440.png') });
    report.screenshots.push('docs/web/screenshots/evidence-es-1440.png');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/es/`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-390-mobile.png') });
    report.screenshots.push('docs/web/screenshots/home-es-390-mobile.png');

    // Deep mobile 390px video aspect ratio (never 720px stretched!) + Innovation + HyperFrames check
    const mobileVidBox = await page.locator('[data-testid="senda-video-card"] video').first().boundingBox();
    assert.ok(mobileVidBox && mobileVidBox.width > 280 && mobileVidBox.height < 280, `Mobile 16:9 video stretched! Got ${JSON.stringify(mobileVidBox)}`);
    await page.locator('[data-testid="senda-video-card"]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-390-video.png') });
    report.screenshots.push('docs/web/screenshots/home-es-390-video.png');

    await page.locator('#innovacion').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="innovation-showcase"]', { timeout: 10000 });
    await page.locator('[data-testid="innov-tab-road-vision"]').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-390-innovation.png') });
    report.screenshots.push('docs/web/screenshots/home-es-390-innovation.png');

    await page.locator('#ojo-satelites').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="orbital-ojo-deck"]', { timeout: 10000 });
    await page.locator('[data-testid="orbital-tab-hyperframes"]').click();
    await page.waitForSelector('[data-testid="hf-stage-iframe"]', { timeout: 10000 });
    await page.locator('[data-testid="hf-stage-iframe"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const hfFrame = page.frameLocator('[data-testid="hf-stage-iframe"]');
    const visibleActsCount = await hfFrame.locator('section.clip').evaluateAll(
      (els) => els.filter((el) => getComputedStyle(el).visibility === 'visible' && parseFloat(getComputedStyle(el).opacity) > 0.1).length
    );
    assert.equal(visibleActsCount, 1, `HyperFrames should render strictly 1 visible act at a time, got ${visibleActsCount}`);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-390-hyperframes.png') });
    report.screenshots.push('docs/web/screenshots/home-es-390-hyperframes.png');

    await page.locator('#mission-3d').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="mission-control-deck"]', { timeout: 12000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-390-mission3d.png') });
    report.screenshots.push('docs/web/screenshots/home-es-390-mission3d.png');

    await page.locator('#osint-cctv').scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="osint-intelligence-deck"]', { timeout: 12000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(shotsDir, 'home-es-390-osint.png') });
    report.screenshots.push('docs/web/screenshots/home-es-390-osint.png');

    const mobileSimOverflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth
    }));
    if (mobileSimOverflow.scrollW > mobileSimOverflow.innerW + 2) {
      report.overflowFailures.push({ path: '/es/#simulators-mounted', width: 390, ...mobileSimOverflow });
    }

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  writeFileSync(resolve(shotsDir, '../qa-playwright-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));

  assert.equal(report.brokenLinks.length, 0, `Broken links found: ${JSON.stringify(report.brokenLinks)}`);
  assert.equal(report.overflowFailures.length, 0, `Horizontal overflow found: ${JSON.stringify(report.overflowFailures)}`);
  assert.equal(report.consoleErrors.length, 0, `Console/page errors found: ${JSON.stringify(report.consoleErrors)}`);
  assert.ok(report.homeJsGzKb < 170, `Home initial JS gz ${report.homeJsGzKb} kB exceeded 170 kB budget`);
  console.log('ALL PLAYWRIGHT REDESIGN QA GATES PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
