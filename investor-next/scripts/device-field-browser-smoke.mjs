#!/usr/bin/env node
// Real Chromium execution, not a physical Android/BLE/D2D test.
// Tests the device capability survey and locally downloaded evidence.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(appDir, "out");
const evidenceDir = resolve(appDir, "../evidence/device-field");
mkdirSync(evidenceDir, { recursive: true });
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const clean = pathname.replace(/^\\/+|\\/+$/g, "");
    const candidates = pathname === "/es/" ? ["es.html", "es/index.html"] : [clean, clean + ".html", clean + "/index.html"];
    const file = candidates.map(p => resolve(outDir, p)).find(p => p.startsWith(outDir + sep) && existsSync(p) && statSync(p).isFile());
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch { res.writeHead(500); res.end(); }
});
let browser;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const base = "http://127.0.0.1:" + server.address().port;
  const response = await page.goto(base + "/es/", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  const field = page.locator('[data-testid="device-field-audit"]');
  await field.scrollIntoViewIfNeeded();
  assert.match(await page.locator('[data-testid="field-snapshot-status"]').innerText(), /Sin medir/);
  assert.match(await page.locator('[data-testid="field-camera-state"]').innerText(), /Desactivada/);
  await page.locator('[data-testid="field-inspect"]').click();
  const snapshot = page.locator('[data-testid="field-snapshot-status"]');
  await assert.doesNotReject(() => snapshot.getByText(/Medido localmente/).waitFor({ timeout: 15000 }));
  const measurementCount = await page.locator('[data-testid="field-measurements"] div').count();
  assert.ok(measurementCount >= 12, "Expected browser API measurements");
  assert.match(await page.locator('[data-testid="field-camera-state"]').innerText(), /Desactivada/);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-testid="field-export"]').click()
  ]);
  const output = join(evidenceDir, "device-evidence.json");
  await download.saveAs(output);
  const parsed = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(parsed.schema, "oep-device-local-evidence/v1");
  assert.equal(parsed.physicalPeerAckVerified, false);
  assert.equal(parsed.satelliteRfCsiMeasured, false);
  assert.equal(parsed.rawVideoIncluded, false);
  assert.equal(parsed.remoteTransferPerformedByAudit, false);
  assert.equal(typeof parsed.snapshot.webCryptoApi, "boolean");
  assert.equal(parsed.cameraMeasurement, null);
  await field.screenshot({ path: join(evidenceDir, "device-inspect-390px.png") });
  const result = { outcome: "PASS", mode: "REAL_CHROMIUM_BROWSER_APIS_NOT_PHONE_D2D", sha: process.env.GITHUB_SHA ?? "LOCAL", measuredAtUtc: new Date().toISOString(), measurementCount, proof: output };
  writeFileSync(join(evidenceDir, "summary.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await page.close();
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
