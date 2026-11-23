import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createAdmin, issueCredential, encodeQr, decodeQr, QR_PREFIX } from '../src/app-roles.mjs';

const require = createRequire(import.meta.url);
const vendor = new URL('../../../investor-next/public/senda/vendor/', import.meta.url);
const qrcode = require(new URL('qrcode-generator-1.4.4.js', vendor).pathname);
const jsQR = require(new URL('jsqr-1.4.0.js', vendor).pathname);

test('las bibliotecas incluidas declaran su licencia', () => {
  assert.match(readFileSync(new URL('qrcode-generator-1.4.4.js', vendor), 'utf8').slice(0, 600), /MIT license/);
  assert.match(readFileSync(new URL('jsqr-1.4.0.LICENSE.txt', vendor), 'utf8'), /Apache License/);
});

test('un código de acceso real cabe en un QR y se vuelve a leer igual', async () => {
  const admin = await createAdmin();
  const cred = await issueCredential(admin, { subject: 'Hermano', validFrom: 0, validUntil: 1e13 });
  const code = encodeQr(QR_PREFIX.CREDENTIAL, { anchor: admin.anchor, credential: cred });
  const qr = qrcode(0, 'L'); qr.addData(code); qr.make();
  const n = qr.getModuleCount(), cell = 4, margin = 4, size = (n + 2 * margin) * cell;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c))
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const i = (((r + margin) * cell + y) * size + (c + margin) * cell + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  const out = jsQR(px, size, size);
  assert.ok(out, 'jsQR lo lee');
  assert.equal(out.data, code);
  assert.equal(decodeQr(QR_PREFIX.CREDENTIAL, out.data).credential.id, cred.id);
  assert.ok(n <= 101, `versión de QR razonable (${n} módulos por lado)`);
});
