// Zero-dependency smoke test for server-rendered, statically exported investor translations.
// Run after: npm run build
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const checks=[
  {locale:'en',paths:['out/index.html'],words:['WHEN THE','NETWORK','GOES DARK.','WHY BACK THIS RESEARCH?','BROWSER-SIMULATED','HORIZON-CL3-2026-01-SSRI-04','/mando/']},
  {locale:'es',paths:['out/es.html','out/es/index.html'],words:['CUANDO LA','SE APAGA.','¿POR QUÉ APOYARNOS?','SIMULACIÓN INTERACTIVA','HORIZON-CL3-2026-01-SSRI-04','/es/mando/']},
  {locale:'nl',paths:['out/nl.html','out/nl/index.html'],words:['ALS HET','UITVALT.','WAAROM DIT ONDERZOEK STEUNEN?','INTERACTIEF NOODSCENARIO','HORIZON-CL3-2026-01-SSRI-04','/nl/mando/']}
];
for(const {locale,paths,words} of checks){
  const file=paths.find(existsSync);
  assert.ok(file,`Missing prerendered output for ${locale}: ${paths.join(', ')}`);
  const html=readFileSync(file,'utf8');
  for(const word of words){assert.ok(html.includes(word),`${locale}: missing translated content ${word}`);}
  assert.ok(html.includes('/es/')&&html.includes('/nl/'),`${locale}: missing language links`);
  assert.ok(html.includes('HORIZON-CL3-2026-01-SSRI-04'),`${locale}: missing official funding topic`);
  assert.ok(/SIMULAT|SIMULACI|SIMULATIE/i.test(html),`${locale}: missing simulation disclosure`);
  assert.ok(!/Proyecto de comunicaciones por satélite para emergencias offline/i.test(html),`${locale}: legacy satellite SEO claim still present`);
  assert.ok(html.includes('rel="canonical"'),`${locale}: missing canonical link`);
  assert.match(html, new RegExp('<html[^>]*lang="'+locale+'"','i'),`${locale}: HTML language is incorrect`);
  assert.ok(html.includes(process.env.SITE_URL||'https://civic-relay-investor.vercel.app'),`${locale}: canonical domain missing`);
  assert.ok(html.includes('hrefLang="en"')&&html.includes('hrefLang="es"')&&html.includes('hrefLang="nl"'),`${locale}: missing hreflang alternates`);
  assert.ok(html.includes('EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE'),`${locale}: missing 8-stage architecture flow`);
  console.log(`PASS ${locale.toUpperCase()}: static markup, investor proposition, honest claims, EU link and i18n routes`);
}

const surfaceChecks=[
  {locale:'en',paths:['out/mando.html','out/mando/index.html'],words:['SENDA COMMAND','MULTICHANNEL ACTIVATION PANEL']},
  {locale:'es',paths:['out/es/mando.html','out/es/mando/index.html'],words:['SENDA MANDO','PANEL MULTICANAL']},
  {locale:'nl',paths:['out/nl/mando.html','out/nl/mando/index.html'],words:['SENDA COMMANDO','MULTIKANAAL']}
];
for(const {locale,paths,words} of surfaceChecks){
  const file=paths.find(existsSync);
  assert.ok(file,`Missing prerendered output for ${locale} /mando: ${paths.join(', ')}`);
  const html=readFileSync(file,'utf8');
  for(const word of words){assert.ok(html.includes(word),`${locale} /mando: missing translated content ${word}`);}
  assert.ok(/SIMULATION|SIMULACIÓN|SIMULATIE/i.test(html),`${locale} /mando: missing simulation disclosure`);
  assert.ok(html.includes('/es/mando/')&&html.includes('/nl/mando/'),`${locale} /mando: missing language links`);
  assert.ok(html.includes('rel="canonical"'),`${locale} /mando: missing canonical link`);
  assert.match(html, new RegExp('<html[^>]*lang="'+locale+'"','i'),`${locale} /mando: HTML language is incorrect`);
  assert.ok(html.includes(process.env.SITE_URL||'https://civic-relay-investor.vercel.app'),`${locale} /mando: canonical domain missing`);
  assert.ok(html.includes('hrefLang="en"')&&html.includes('hrefLang="es"')&&html.includes('hrefLang="nl"'),`${locale} /mando: missing hreflang alternates`);
  assert.ok(html.includes('data-testid="cmd-environment"'),`${locale} /mando: missing environment calibration control`);
  assert.ok(html.includes('data-testid="cmd-kpi-routed"')&&html.includes('data-testid="cmd-kpi-delivery"'),`${locale} /mando: missing routed and delivery KPIs`);
  assert.ok(html.includes('mando-2.2.0'),`${locale} /mando: missing model version`);
  console.log(`PASS ${locale.toUpperCase()} /mando: command surface, calibrated model, KPIs, canonical and i18n routes`);
}

// Bóveda de defensa: existe en los 3 idiomas, no se indexa y no aparece en las superficies civiles.
const vault=[
  {locale:'en',paths:['out/defense.html','out/defense/index.html'],words:['DEFENCE VAULT','2021/821']},
  {locale:'es',paths:['out/es/defense.html','out/es/defense/index.html'],words:['BÓVEDA DE DEFENSA','2021/821']},
  {locale:'nl',paths:['out/nl/defense.html','out/nl/defense/index.html'],words:['DEFENSIEKLUIS','2021/821']}
];
for(const {locale,paths,words} of vault){
  const file=paths.find(existsSync);
  assert.ok(file,`Missing prerendered output for ${locale} /defense`);
  const html=readFileSync(file,'utf8');
  for(const word of words){assert.ok(html.includes(word),`${locale} /defense: missing ${word}`);}
  assert.match(html,/<meta[^>]*name="robots"[^>]*noindex/i,`${locale} /defense: must be noindex`);
  assert.ok(html.includes('data-classification="DUAL_USE_DEFENSE"'),`${locale} /defense: missing vault classification`);
  assert.match(html,new RegExp('<html[^>]*lang="'+locale+'"','i'),`${locale} /defense: HTML language is incorrect`);
  console.log(`PASS ${locale.toUpperCase()} /defense: vault isolated, noindex, i18n`);
}
const civil=['out/index.html','out/es.html','out/es/index.html','out/nl.html','out/nl/index.html','out/science.html','out/science/index.html','out/es/science.html','out/es/science/index.html','out/nl/science.html','out/nl/science/index.html'].filter(existsSync);
for(const file of civil){
  const html=readFileSync(file,'utf8');
  for(const marker of ['reel-defense','session-breakthrough','role-investor','reel-drones','reel-sentinel-survival','ASTM F3411 Ghost']){
    assert.ok(!html.includes(marker),`${file}: defence content "${marker}" leaked outside the vault`);
  }
}
console.log(`PASS civil surfaces (${civil.length} files): no defence content outside the vault`);
