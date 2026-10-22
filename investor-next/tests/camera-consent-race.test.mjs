import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../app/device-field-diagnostics.tsx", import.meta.url)), "utf8");

// Regression: never keep a camera stream after permission is revoked.
test("late camera permission resolution is invalidated after cancellation or unmount", () => {
  assert.match(source, /cameraEpochRef/);
  assert.match(source, /requestEpoch !== cameraEpochRef\.current/);
  assert.match(source, /stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
  assert.match(source, /mountedRef\.current = false/);
});
