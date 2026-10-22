import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const source = readFileSync(fileURLToPath(new URL("../app/device-field-diagnostics.tsx", import.meta.url)), "utf8");
const parent = readFileSync(fileURLToPath(new URL("../app/live-hardware-console.tsx", import.meta.url)), "utf8");

test("device survey is user-initiated and does not claim real offline relay readiness", () => {
  assert.match(source, /onClick=\{\(\) => void inspectDevice\(\)\}/);
  assert.match(source, /physicalPeerAckVerified: false/);
  assert.match(source, /satelliteRfCsiMeasured: false/);
  assert.match(source, /remoteTransferPerformedByAudit: false/);
  assert.match(source, /No detecta personas a través de paredes/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});

test("camera access is explicit, video stays on-device, raw media is not exported", () => {
  assert.match(source, /getUserMedia\(\{ audio: false, video:/);
  assert.match(source, /track\.stop\(\)/);
  assert.match(source, /rawVideoIncluded: false/);
  assert.match(source, /videoRef\.current\.srcObject = null/);
  assert.match(source, /getImageData\(0, 0, 64, 36\)/);
  assert.match(parent, /<DeviceFieldDiagnostics locale=\{locale\} \/>/);
});

test("browser hardware panel avoids invented battery and fabricated network/ping states", () => {
  assert.doesNotMatch(parent, /OS PROTECTED \(DEFAULT 75%\)/);
  assert.doesNotMatch(parent, /WIFI_OR_ETHERNET/);
  assert.doesNotMatch(parent, /Measured Net RTT/);
  assert.match(parent, /Network API estimated RTT \(not ping\)/);
});
