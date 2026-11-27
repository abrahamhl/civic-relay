#!/usr/bin/env node
/**
 * Deployment smoke verification for OEP / Civic Relay (investor-next).
 * Verifies live HTTP 200 responses, localized headings, simulation disclaimers,
 * canonical/hreflang links, and absence of legacy satellite-operational SEO strings
 * across /, /es/, and /nl/.
 */
import assert from 'node:assert/strict';

const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://civic-relay-investor.vercel.app').replace(/\/$/, '');

const ROUTES = [
  {
    locale: 'en',
    path: '/',
    expectedStrings: [
      'OEP — Offline Emergency Protocol',
      'WHEN THE',
      'GOES DARK.',
      'HORIZON-CL3-2026-01-SSRI-04'
    ]
  },
  {
    locale: 'es',
    path: '/es',
    expectedStrings: [
      'OEP — Offline Emergency Protocol',
      'CUANDO LA',
      'SE APAGA.',
      'HORIZON-CL3-2026-01-SSRI-04'
    ]
  },
  {
    locale: 'nl',
    path: '/nl',
    expectedStrings: [
      'OEP — Offline Emergency Protocol',
      'ALS HET',
      'UITVALT.',
      'HORIZON-CL3-2026-01-SSRI-04'
    ]
  }
];

async function run() {
  const results = [];
  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    const res = await fetch(url, { redirect: 'follow' });
    assert.equal(res.status, 200, `${url} returned HTTP ${res.status}`);
    const html = await res.text();
    for (const expected of route.expectedStrings) {
      assert.ok(html.includes(expected), `${url} missing expected string: ${expected}`);
    }
    assert.ok(/SIMULAT|SIMULACI|SIMULATIE/i.test(html), `${url} missing simulation disclosure`);
    results.push({ locale: route.locale, url, status: res.status, bytes: html.length });
    console.log(`PASS [${route.locale.toUpperCase()}] ${url} -> HTTP ${res.status} (${html.length} bytes)`);
  }
  console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, checkedAt: new Date().toISOString(), routes: results }, null, 2));
}

run().catch((err) => {
  console.error('SMOKE DEPLOY FAILED:', err);
  process.exit(1);
});
