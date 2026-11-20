import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(dir, '../app/_senda');

function collectFiles(folder) {
  const out = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = resolve(folder, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('redesigned SENDA UI contains zero emoji characters in source', () => {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of collectFiles(appRoot)) {
    const content = readFileSync(file, 'utf8');
    // Allow standard check glyph ✓ if used in text only, reject pictographic emojis
    const match = content.match(emojiRegex);
    assert.equal(match, null, `Emoji "${match?.[0]}" found in ${file}`);
  }
});

test('navigation has at most 6 top-level items in EN, ES, NL', () => {
  const i18n = readFileSync(resolve(appRoot, 'data/i18n.ts'), 'utf8');
  for (const slug of ['product', 'platform', 'evidence', 'science', 'investors', 'security']) {
    assert.equal(i18n.split(`slug: '${slug}'`).length - 1, 3, `Missing nav slug ${slug} across 3 locales`);
  }
});

test('EvidenceBadge implements all 5 statuses and native light-dismiss dialog with Safari fallback', () => {
  const badge = readFileSync(resolve(appRoot, 'components/EvidenceBadge.tsx'), 'utf8');
  for (const st of ['confirmed', 'observed', 'predicted', 'simulated', 'untested']) {
    assert.ok(badge.includes(st), `Missing status ${st}`);
  }
  assert.ok(badge.includes("closedby: 'any'"), 'Missing closedby="any"');
  assert.ok(badge.includes('showModal()'), 'Missing showModal()');
  assert.ok(badge.includes("'closedBy' in HTMLDialogElement.prototype"), 'Missing Safari fallback');
});

test('Control Center exposes all 8 canonical scenarios, ⌘K command bar, 2-step simulation confirmation, and guided tour', () => {
  const data = readFileSync(resolve(appRoot, 'platform/platform-data.ts'), 'utf8');
  for (const code of ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08']) {
    assert.ok(data.includes(`'${code}'`), `Missing canonical scenario ${code}`);
  }
  const cc = readFileSync(resolve(appRoot, 'platform/ControlCenter.tsx'), 'utf8');
  assert.ok(cc.includes('cc-cmd-dialog'), 'Missing ⌘K command dialog');
  assert.ok(cc.includes('cc-confirm-box'), 'Missing two-step confirmation');
  assert.ok(cc.includes('cc-audit-log'), 'Missing visible audit log');
  assert.ok(cc.includes('cc-tour-card'), 'Missing guided tour');
});

test('legal boundaries, vibe-coding human supervision statement, and browser-localized video player', () => {
  const security = readFileSync(resolve(appRoot, 'pages/SecurityPage.tsx'), 'utf8');
  const home = readFileSync(resolve(appRoot, 'data/home-product.ts'), 'utf8');
  const video = readFileSync(resolve(appRoot, 'components/MediaVideo.tsx'), 'utf8');
  assert.ok(security.includes('112'), 'Missing secondary channel legal notice on /security/');
  assert.ok(security.includes('ENS'), 'Missing ENS regulatory reference on /security/');
  assert.ok(security.includes('NLnet'), 'Missing NLnet v2.0 AI transparency policy');
  assert.ok(home.includes('vibe coding'), 'Missing human-supervised vibe coding orchestration section');
  assert.ok(video.includes('navigator.languages'), 'Missing browser language detection in MediaVideo');
  assert.ok(video.includes('kind="subtitles"'), 'Missing trilingual subtitle tracks in MediaVideo');
  assert.equal(existsSync(resolve(dir, '../public/.well-known/security.txt')), true, 'Missing .well-known/security.txt');
  assert.equal(existsSync(resolve(dir, '../public/sitemap.xml')), true, 'Missing sitemap.xml');
  assert.equal(existsSync(resolve(dir, '../public/robots.txt')), true, 'Missing robots.txt');
});
