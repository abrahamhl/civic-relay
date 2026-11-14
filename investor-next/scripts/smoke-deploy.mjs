#!/usr/bin/env node
/**
 * Deployment smoke verification for OEP / Civic Relay (investor-next).
 * Verifies live HTTP 200 responses, localized headings, simulation disclaimers,
 * canonical/hreflang links, and absence of legacy satellite-operational SEO strings
 * across /, /es/, and /nl/.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://civic-relay-investor.vercel.app').replace(/\/$/, '');
const EXPECTED_SOURCE_SHA = process.env.EXPECTED_SOURCE_SHA || '';
const CANONICAL = 'https://civic-relay-investor.vercel.app';
if (EXPECTED_SOURCE_SHA && !/^[a-f0-9]{40}$/i.test(EXPECTED_SOURCE_SHA)) {
  throw new Error('EXPECTED_SOURCE_SHA must be a 40-character Git commit SHA');
}


const RESEARCH_DIGEST = '4c0f0e3498feac618c2fa2502a59a8545adbc98f75e0bf5f1f1916aa8f839f66';

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

const RESEARCH_ROUTES = [
  {
    locale: 'en',
    path: '/research/',
    expectedTitle: 'Technical reports, with receipts.',
    expectedStatus: 'Technical report · not peer reviewed'
  },
  {
    locale: 'es',
    path: '/es/research/',
    expectedTitle: 'Informes técnicos, con recibos.',
    expectedStatus: 'Informe técnico · sin revisión por pares'
  },
  {
    locale: 'nl',
    path: '/nl/research/',
    expectedTitle: 'Technische rapporten, met bewijs.',
    expectedStatus: 'Technisch rapport · niet peer-reviewed'
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

  const researchResults = [];
  for (const route of RESEARCH_ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    assert.equal(res.status, 200, `${url} returned HTTP ${res.status}`);
    const html = await res.text();
    assert.match(html, new RegExp('<html[^>]*lang="' + route.locale + '"', 'i'), `${url} wrong document language`);
    assert.ok(html.includes(route.expectedTitle), `${url} missing title: ${route.expectedTitle}`);
    assert.ok(html.includes(route.expectedStatus), `${url} missing localized status: ${route.expectedStatus}`);
    assert.ok(html.includes(RESEARCH_DIGEST), `${url} missing research bundle digest`);
    assert.ok(html.includes(`rel="canonical" href="${CANONICAL}${route.path}"`), `${url} missing research canonical URL`);
    for (const lang of ['en', 'es', 'nl']) {
      assert.ok(html.includes('hrefLang="' + lang + '"'), `${url} missing hreflang ${lang}`);
    }
    assert.equal((html.match(/class="research-card"/g) || []).length, 3, `${url} does not list 3 report cards`);
    const pdfHrefs = [...new Set([...html.matchAll(/href="([^"]+\.pdf)"/g)].map(match => match[1]))];
    assert.equal(pdfHrefs.length, 3, `${url} does not link 3 report PDFs`);
    assert.ok(html.includes('/research/manifest.json'), `${url} missing manifest link`);
    researchResults.push({ locale: route.locale, url, status: res.status, bytes: html.length, reportCards: 3, pdfLinks: 3 });
    console.log(`PASS [RESEARCH ${route.locale.toUpperCase()}] ${url} -> HTTP ${res.status} (${html.length} bytes, 3 reports, 3 PDFs)`);
  }

  const manifestRes = await fetch(`${BASE_URL}/research/manifest.json`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(manifestRes.status, 200, `Research manifest returned HTTP ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  assert.equal(manifest.schema, 'senda-research-manifest/1', 'Research manifest schema mismatch');
  assert.equal(manifest.bundleDigest, RESEARCH_DIGEST, 'Research manifest digest mismatch');
  assert.equal(manifest.papers.length, 3, 'Research manifest does not list 3 papers');
  assert.equal(manifest.data.length, 2, 'Research manifest does not list 2 data files');

  let artifactBytes = 0;
  let artifactFiles = 0;
  const artifactPaths = new Set();
  const verifyArtifact = async (filePath, expectedBytes, expectedSha) => {
    if (artifactPaths.has(filePath)) return;
    const url = new URL(filePath, BASE_URL);
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    assert.equal(res.status, 200, `${url} returned HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.length, expectedBytes, `${url} byte size mismatch`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha, `${url} SHA-256 mismatch`);
    if (filePath.endsWith('.pdf')) {
      assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', `${url} is not a PDF`);
    }
    artifactPaths.add(filePath);
    artifactBytes += bytes.length;
    artifactFiles += 1;
  };

  for (const paper of manifest.papers) {
    const htmlUrl = new URL(paper.html, BASE_URL);
    const htmlRes = await fetch(htmlUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    assert.equal(htmlRes.status, 200, `${htmlUrl} returned HTTP ${htmlRes.status}`);
    assert.match(htmlRes.headers.get('content-type') || '', /text\/html/i, `${htmlUrl} is not served as HTML`);
    const reportHtml = await htmlRes.text();
    assert.ok(reportHtml.includes('not peer reviewed'), `${htmlUrl} missing peer-review status`);
    assert.ok(reportHtml.includes('/research/manifest.json'), `${htmlUrl} missing manifest link`);
    assert.ok(reportHtml.includes('rel="canonical"'), `${htmlUrl} missing canonical link`);
    for (const file of paper.files) {
      await verifyArtifact(file.path, file.bytes, file.sha256);
    }
  }
  for (const file of manifest.data) {
    await verifyArtifact(file.path, file.bytes, file.sha256);
  }
  const manifestBibRes = await fetch(new URL(manifest.bibtex, BASE_URL), {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(manifestBibRes.status, 200, `${manifest.bibtex} returned HTTP ${manifestBibRes.status}`);
  console.log(`PASS [RESEARCH ARTIFACTS] manifest + ${manifest.papers.length} report pages + ${artifactFiles} unique artifacts (${artifactBytes} bytes) + aggregate BibTeX verified`);

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
    routes: results, researchRoutes: researchResults, researchDigest: RESEARCH_DIGEST,
    researchArtifacts: { files: artifactFiles, bytes: artifactBytes },
    sourceParity: EXPECTED_SOURCE_SHA ? 'MATCHED':'NOT_CHECKED',
    expectedSha: EXPECTED_SOURCE_SHA || null,observedSha }, null, 2));
}

run().catch((err) => {
  console.error('SMOKE DEPLOY FAILED:', err);
  process.exit(1);
});
