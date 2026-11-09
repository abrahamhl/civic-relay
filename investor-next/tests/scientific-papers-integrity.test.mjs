import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const REQUIRED_PAPERS = [
  'public/senda/papers/index.html',
  'public/senda/papers/paper-theorems.html',
  'public/senda/papers/paper-paer-dtn.html',
  'public/senda/papers/paper-calibration-lofo.html',
  'public/senda/papers/paper-v16-c-its.html',
  'public/senda/paper.html'
];

const REQUIRED_RENDERS = [
  'public/media/renders/render-paer-mesh-topology.svg',
  'public/media/renders/render-itu-p838-rain-curve.svg',
  'public/media/renders/render-merkle-rfc6962-proof.svg',
  'public/media/renders/render-v16-reflex-latency.svg',
  'public/media/renders/render-cots-gateway-hardware.svg',
  'public/media/renders/render-senda-4d-globe.svg'
];

test('Scientific Papers Suite: All 5 research papers and index portal exist and are well-formed', () => {
  for (const relPath of REQUIRED_PAPERS) {
    const fullPath = path.join(projectRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `Missing research paper file: ${relPath}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 2000, `Paper file ${relPath} is unexpectedly small (${stat.size} bytes)`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.includes('<!doctype html>') || content.includes('<!DOCTYPE html>'), `${relPath} missing doctype`);
    assert.ok(content.includes('<title>'), `${relPath} missing <title> tag`);
    assert.ok(content.toLowerCase().includes('resumen') || content.toLowerCase().includes('abstract'), `${relPath} missing Resumen/Abstract section`);
  }
});

test('Scientific Papers Index Portal links to all individual papers and all vector renders', () => {
  const indexPath = path.join(projectRoot, 'public/senda/papers/index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  // Verify all papers are referenced
  assert.ok(indexHtml.includes('paper-theorems.html'), 'Index does not link to paper-theorems.html');
  assert.ok(indexHtml.includes('paper-paer-dtn.html'), 'Index does not link to paper-paer-dtn.html');
  assert.ok(indexHtml.includes('paper-calibration-lofo.html'), 'Index does not link to paper-calibration-lofo.html');
  assert.ok(indexHtml.includes('paper-v16-c-its.html'), 'Index does not link to paper-v16-c-its.html');
  assert.ok(indexHtml.includes('/senda/paper.html'), 'Index does not link to /senda/paper.html');

  // Verify all 6 vector renders are referenced
  assert.ok(indexHtml.includes('render-paer-mesh-topology.svg'), 'Index missing render-paer-mesh-topology.svg');
  assert.ok(indexHtml.includes('render-itu-p838-rain-curve.svg'), 'Index missing render-itu-p838-rain-curve.svg');
  assert.ok(indexHtml.includes('render-merkle-rfc6962-proof.svg'), 'Index missing render-merkle-rfc6962-proof.svg');
  assert.ok(indexHtml.includes('render-v16-reflex-latency.svg'), 'Index missing render-v16-reflex-latency.svg');
  assert.ok(indexHtml.includes('render-cots-gateway-hardware.svg'), 'Index missing render-cots-gateway-hardware.svg');
  assert.ok(indexHtml.includes('render-senda-4d-globe.svg'), 'Index missing render-senda-4d-globe.svg');
});

test('Architectural Vector Renders: All 6 SVG renders are valid and non-empty', () => {
  for (const relPath of REQUIRED_RENDERS) {
    const fullPath = path.join(projectRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `Missing render file: ${relPath}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 1000, `Render file ${relPath} is unexpectedly small (${stat.size} bytes)`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.includes('<svg') && content.includes('</svg>'), `${relPath} is not a valid SVG file`);
    assert.ok(content.includes('viewBox='), `${relPath} missing viewBox attribute`);
  }
});

test('Static Export Directory (out/): Papers and renders are mirrored correctly after build', () => {
  const outDir = path.join(projectRoot, 'out');
  if (fs.existsSync(outDir)) {
    for (const relPath of REQUIRED_PAPERS) {
      const outPath = path.join(outDir, relPath.replace(/^public[\\/]/, ''));
      assert.ok(fs.existsSync(outPath), `Exported file missing in out: ${outPath}`);
    }
    for (const relPath of REQUIRED_RENDERS) {
      const outPath = path.join(outDir, relPath.replace(/^public[\\/]/, ''));
      assert.ok(fs.existsSync(outPath), `Exported render missing in out: ${outPath}`);
    }
  }
});
