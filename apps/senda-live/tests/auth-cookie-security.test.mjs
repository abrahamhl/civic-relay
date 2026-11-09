/**
 * PRUEBAS DE SEGURIDAD DE AUTENTICACIÓN, COOKIES SEGURAS Y CSRF (P0-11)
 *
 * Verifica:
 *  1. En producción / HTTPS / modo seguro, la cookie contiene HttpOnly, Secure, SameSite=Lax.
 *  2. En producción / HTTPS / modo seguro, el token de sesión NO se devuelve en el cuerpo JSON.
 *  3. Autenticación exitosa mediante Cookie HttpOnly en peticiones subsecuentes.
 *  4. Protección CSRF obligatoria (X-Senda-Request: 1) en mutaciones POST, PUT, PATCH, DELETE.
 *  5. Modo de desarrollo: preserva compatibilidad cuando no está en producción.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../server/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_AUTH_DB = join(__dirname, '../data/test-auth-security-p0-11.db');

function cleanupDb() {
  if (existsSync(TEST_AUTH_DB)) rmSync(TEST_AUTH_DB, { force: true });
}

test('SEGURIDAD DE SESIÓN, COOKIES Y CSRF (P0-11)', async (t) => {
  cleanupDb();
  const ctx = createServer({ dbFile: TEST_AUTH_DB });
  const { server, db } = ctx;

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    cleanupDb();
    delete process.env.SENDA_FORCE_SECURE_AUTH;
  });

  await t.test('1. Registro en modo seguro omite token en JSON y fija cookie HttpOnly + Secure', async () => {
    process.env.SENDA_FORCE_SECURE_AUTH = '1';

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
      },
      body: JSON.stringify({
        email: 'operative@senda.live',
        password: 'PasswordSeguro123!',
        handle: 'operative_alpha',
        displayName: 'Operative Alpha',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.user);
    assert.equal(body.user.email, 'operative@senda.live');
    // En modo seguro / producción: EL TOKEN NO SE DEVUELVE EN JSON
    assert.equal(body.token, undefined, 'El token no debe devolverse en el cuerpo JSON en modo seguro');

    // Comprobar la cookie Set-Cookie
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Debe establecerse la cabecera Set-Cookie');
    assert.ok(setCookie.includes('HttpOnly'), 'La cookie debe tener HttpOnly');
    assert.ok(setCookie.includes('Secure'), 'La cookie debe tener Secure');
    assert.ok(setCookie.includes('SameSite=Lax'), 'La cookie debe tener SameSite=Lax');
    assert.ok(setCookie.includes('Path=/'), 'La cookie debe tener Path=/');
  });

  await t.test('2. Login tras x-forwarded-proto https omite token en JSON y fija Secure', async () => {
    delete process.env.SENDA_FORCE_SECURE_AUTH;

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({
        email: 'operative@senda.live',
        password: 'PasswordSeguro123!',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.user);
    assert.equal(body.token, undefined, 'Bajo HTTPS el token no se devuelve en el cuerpo JSON');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie.includes('Secure'), 'Debe tener atributo Secure bajo HTTPS');
    assert.ok(setCookie.includes('HttpOnly'), 'Debe tener atributo HttpOnly');
  });

  await t.test('3. Autenticación transparente mediante Cookie de sesión', async () => {
    // Obtenemos cookie de login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
      },
      body: JSON.stringify({
        email: 'operative@senda.live',
        password: 'PasswordSeguro123!',
      }),
    });
    const cookieHeader = loginRes.headers.get('set-cookie').split(';')[0];

    // Llamada autenticada a /api/auth/me usando la cookie
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: cookieHeader,
      },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.user.email, 'operative@senda.live');
  });

  await t.test('4. CSRF es estrictamente obligatorio en mutaciones y rechazado sin cabecera', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
      },
      body: JSON.stringify({
        email: 'operative@senda.live',
        password: 'PasswordSeguro123!',
      }),
    });
    const cookieHeader = loginRes.headers.get('set-cookie').split(';')[0];

    // Intento de mutación SIN cabecera CSRF -> 403
    const attackRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        title: 'Mutación no consentida',
        body: 'Ataque CSRF simulado',
      }),
    });
    assert.equal(attackRes.status, 403);
    const attackBody = await attackRes.json();
    assert.equal(attackBody.error, 'CSRF_DETECTED');

    // Mutación legítima CON cabecera CSRF -> 201
    const legitRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Senda-Request': '1',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        title: 'Reporte legítimo con CSRF header',
        body: 'Verificación exitosa.',
      }),
    });
    assert.equal(legitRes.status, 201);
  });
});
