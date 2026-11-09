#!/usr/bin/env node
/**
 * Deployment smoke verification for OEP / Civic Relay (investor-next).
 * Verifies live HTTP 200 responses, localized headings, simulation disclaimers,
 * canonical/hreflang links, and absence of legacy satellite-operational SEO strings
 * across /, /es/, and /nl/.
 */
import assert from 'node:assert/strict';

const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://civic-relay-investor.vercel.app').replace(/\/$/, '');
const EXPECTED_SOURCE_SHA = process.env.EXPECTED_SOURCE_SHA || '';
const CANONICAL = 'https://civic-relay-investor.vercel.app';
if (EXPECTED_SOURCE_SHA && !/^[a-f0-9]{40}$/i.test(EXPECTED_SOURCE_SHA)) {
  throw new Error('EXPECTED_SOURCE_SHA must be a 40-character Git commit SHA');
}


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
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    assert.equal(res.status, 200, `${url} returned HTTP ${res.status}`);
    const html = await res.text();
    for (const expected of route.expectedStrings) {
      assert.ok(html.includes(expected), `${url} missing expected string: ${expected}`);
    }
    assert.ok(/SIMULAT|SIMULACI|SIMULATIE/i.test(html), `${url} missing simulation disclosure`);
    assert.match(html,new RegExp('<html[^>]*lang="'+route.locale+'"','i'),`${url} wrong document language`);
    assert.ok(html.includes('rel="canonical"') && html.includes(CANONICAL),
      `${url} missing the one canonical public origin`);
    for(const lang of ['en','es','nl']){
      assert.ok(html.includes('hrefLang="'+lang+'"'),`${url} missing hreflang ${lang}`);
    }
    const staleHosts = new Set(['civic-relay.vercel.app', 'civic-relay-pi.vercel.app']);
    const obsolete = [...html.matchAll(/href="([^"]+)"/g)]
      .map(match => match[1])
      .filter(href => {
        try {return staleHosts.has(new URL(href, BASE_URL).hostname);}
        catch{return false;}
      });
    assert.equal(obsolete.length,0,`${url} contains links to obsolete official hosts`);
    results.push({ locale: route.locale, url, status: res.status, bytes: html.length });
    console.log(`PASS [${route.locale.toUpperCase()}] ${url} -> HTTP ${res.status} (${html.length} bytes)`);
  }

  const PAPERS_ROUTES = [
    '/senda/papers/',
    '/senda/papers/paper-theorems.html',
    '/senda/papers/paper-paer-dtn.html',
    '/senda/papers/paper-calibration-lofo.html',
    '/senda/papers/paper-v16-c-its.html',
    '/media/renders/render-paer-mesh-topology.svg',
    '/media/renders/render-itu-p838-rain-curve.svg',
    '/media/renders/render-merkle-rfc6962-proof.svg',
    '/media/renders/render-v16-reflex-latency.svg',
    '/media/renders/render-cots-gateway-hardware.svg',
    '/media/renders/render-senda-4d-globe.svg'
  ];

  for (const pRoute of PAPERS_ROUTES) {
    const pUrl = `${BASE_URL}${pRoute}`;
    const pRes = await fetch(pUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    assert.equal(pRes.status, 200, `Scientific asset ${pUrl} returned HTTP ${pRes.status}`);
    const pBody = await pRes.text();
    assert.ok(pBody.length > 500, `Scientific asset ${pUrl} returned unexpectedly small body (${pBody.length} bytes)`);
    console.log(`PASS [ASSET] ${pUrl} -> HTTP ${pRes.status} (${pBody.length} bytes)`);
  }

  let observedSha=null;
  if(EXPECTED_SOURCE_SHA){
    const proof=await fetch(BASE_URL+'/release-provenance.json',{
      redirect:'follow',signal:AbortSignal.timeout(15000)
    });
    assert.equal(proof.status,200,'Public release provenance missing; not deploy-parity verified');
    const payload=await proof.json();
    assert.equal(payload.schema,'oep-public-build-provenance/v1');
    assert.equal(payload.canonical,CANONICAL);
    assert.equal(payload.physicalValidation,'NOT_PERFORMED');
    observedSha=payload.sourceSha;
    assert.equal(observedSha,EXPECTED_SOURCE_SHA.toLowerCase(),
      'Live alias is not serving the expected release commit');
  }
  console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, checkedAt: new Date().toISOString(),
    routes: results, sourceParity: EXPECTED_SOURCE_SHA ? 'MATCHED':'NOT_CHECKED',
    expectedSha: EXPECTED_SOURCE_SHA || null,observedSha }, null, 2));
}

run().catch((err) => {
  console.error('SMOKE DEPLOY FAILED:', err);
  process.exit(1);
});
