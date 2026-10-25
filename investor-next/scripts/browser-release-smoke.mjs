#!/usr/bin/env node
/**
 * Actual Chromium browser smoke of the locally built Next static export.
 * Not a human test and not evidence of device-to-device or emergency delivery.
 * Requires a separately installed Playwright dependency and Chromium.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,existsSync,mkdirSync,writeFileSync,statSync } from 'node:fs';
import { resolve,extname,join,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(app,'out');
const evidenceDir=resolve(app,'../evidence/browser-release');
mkdirSync(evidenceDir,{recursive:true});
const mimetypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const clean=pathname.replace(/^\/+|\/+$/g,'');
    const paths=pathname==='/'?['index.html']:pathname==='/es'||pathname==='/es/'?['es.html','es/index.html']:pathname==='/nl'||pathname==='/nl/'?['nl.html','nl/index.html']:[clean,clean+'.html',clean+'/index.html'];
    const file=paths.map(p=>resolve(out,p)).find(p=>(p===out||p.startsWith(out+sep))&&existsSync(p)&&statSync(p).isFile());
    if(!file){res.writeHead(404);res.end('Not found');return;}
    res.setHeader('content-type',mimetypes[extname(file)]||'application/octet-stream');
    res.writeHead(200);res.end(readFileSync(file));
  }catch(e){res.writeHead(500);res.end('Static preview error');}
});
const cases=[
  {id:'P01',role:'Citizen mobile / consent and revocation',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:390,height:844}},
  {id:'P02',role:'First responder / scenario switching',locale:'en',url:'/',text:'WHEN THE',viewport:{width:1024,height:768}},
  {id:'P03',role:'Investor / evidence and grant eligibility',locale:'en',url:'/',text:'WHEN THE',viewport:{width:1280,height:800}},
  {id:'P04',role:'Engineer / export real synthetic report',locale:'en',url:'/',text:'WHEN THE',viewport:{width:1440,height:900}},
  {id:'P05',role:'NL privacy reviewer / radio claim boundary',locale:'nl',url:'/nl/',text:'ALS HET',viewport:{width:1024,height:768}},
  {id:'P06',role:'Volunteer / deny implicit SOS',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:412,height:915}},
  {id:'P07',role:'Keyboard and reduced-motion accessibility',locale:'en',url:'/',text:'WHEN THE',viewport:{width:390,height:844}},
  {id:'P08',role:'Institutional partner / roadmap and limitations',locale:'nl',url:'/nl/',text:'ALS HET',viewport:{width:820,height:1180}},
  {id:'P09',role:'3D Globe object selection, scenario sync and Mars educational mode',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:1440,height:900}},
  {id:'P10',role:'Sector Intelligence El Tiemblo CCTV, Anti-SSRF and Unified Pipeline',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:1440,height:900}},
  {id:'P11',role:'Narrow mobile responsive menu and touch targets',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:320,height:720}},
  {id:'P12',role:'Wide desktop navigation density and no overlap',locale:'en',url:'/',text:'WHEN THE',viewport:{width:1536,height:864}},
  {id:'P13',role:'Master vision, custody and complete catalogue ES mobile',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:320,height:720}},
  {id:'P14',role:'Master vision, custody and complete catalogue EN desktop',locale:'en',url:'/',text:'WHEN THE',viewport:{width:1440,height:900}},
  {id:'P15',role:'Master vision, custody and complete catalogue NL mobile',locale:'nl',url:'/nl/',text:'ALS HET',viewport:{width:390,height:844}}
];
async function runRoleTask(page,trial,evidenceDir){
 const observations={role:trial.role,actions:[],verified:false};
 const note=(action,value)=>observations.actions.push({action,result:value});
 switch(trial.id){
  case 'P13': case 'P14': case 'P15': {
   await page.emulateMedia({reducedMotion:'reduce'});
   const section=page.getByTestId('master-vision');
   await section.scrollIntoViewIfNeeded();
   const state=page.getByTestId('vision-delivery');
   assert.ok((await state.innerText()).includes('NO_ROUTE'));
   for(const [stage,status] of [['GATEWAY_ACK','PENDING'],['DESTINATION_ACK','DESTINATION_ACK'],['READ','READ'],['EXPIRED','EXPIRED'],['NO_ROUTE','NO_ROUTE']]){
    await page.getByTestId('vision-stage-'+stage).click();
    assert.ok((await state.innerText()).startsWith(status));
   }
   await page.getByTestId('vision-audience').selectOption('ALL');
   await section.locator('.cr-catalog summary').click();
   assert.equal(await page.locator('[data-testid^="vision-module-M"]').count(),20);
   await page.getByTestId('vision-audience').selectOption('regulated');
   await page.getByTestId('vision-scenario').selectOption('S06');
   assert.deepEqual(await page.locator('[data-testid^="vision-module-M"]').evaluateAll(els=>els.map(el=>el.getAttribute('data-testid'))),['vision-module-M15','vision-module-M16','vision-module-M19']);
   await page.getByTestId('vision-scenario').selectOption('S04');
   assert.equal(await page.locator('[data-testid^="vision-module-M"]').count(),1);
   assert.equal(await page.getByTestId('vision-module-M19').count(),1,'scientific evidence applies to every scenario');
   assert.ok((await page.getByTestId('vision-module-list').innerText()).length>20);
   await page.getByTestId('vision-audience').selectOption('family');
   await page.getByTestId('vision-scenario').selectOption('ALL');
   const overflow=await section.evaluate(el=>el.scrollWidth>el.clientWidth+1);
   assert.equal(overflow,false);
   const file=await page.request.get(new URL('/vision-master.md',page.url()).href);
   assert.equal(file.status(),200);assert.ok((await file.text()).includes('CR-VM-2026-10-25'));
   await page.getByTestId('vision-stage-NO_ROUTE').focus();
   await page.keyboard.press('Tab');
   assert.equal(await page.getByTestId('vision-stage-GATEWAY_ACK').evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Enter');assert.ok((await state.innerText()).startsWith('PENDING'));
   await section.locator('.cr-catalog summary').click();
   await section.screenshot({path:join(evidenceDir,trial.id+'-master-vision.png')});
   note('Five custody states, 20 modules, audience/scenario filtering, cross-cutting evidence, keyboard and download',true);
   observations.verified=true;
   break;
  }
  case 'P01': {
   const group=page.locator('.mer-human');
   const safe=group.locator('button').first();
   const denied=await safe.isDisabled();note('SAFE disabled before consent',denied);
   await group.locator('input[type=checkbox]').check();
   await safe.click();
   const saved=await group.locator('.mer-safety-record').innerText();
   note('Explicit SAFE saved locally',saved.includes('SAFE'));
   await group.locator('.mer-safety-record button').click();
   const erased=await group.locator('.mer-safety-record').count()===0;
   note('Revoke removed response',erased);
   observations.verified=denied&&saved.includes('SAFE')&&erased;
   break;
  }
  case 'P02': {
   const tab=page.locator('[data-testid="case-tab-3"]');
   await tab.click();
   const selected=await tab.getAttribute('aria-selected');
   const scenarioVisible=await page.locator('#today-vs-oep').isVisible();
   note('Switch fourth simulation scenario',selected);
   observations.verified=selected==='true'&&scenarioVisible;
   break;
  }
  case 'P03': {
   const cards=await page.locator('[data-testid^="funding-card-"]').count();
   const disclaimers=await page.locator('#evidence').count();
   const nlnet=await page.locator('[data-testid="funding-card-F01-NLNET"]').innerText();
   note('Funding programmes surfaced',cards);
   note('NLnet AI policy disclosure visible',/20 October 2026|20 Oktober 2026|20 octubre 2026/.test(nlnet));
   observations.verified=cards===8&&disclaimers===1&&/generative AI/i.test(nlnet);
   break;
  }
  case 'P04': {
   const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:12000}),
    page.locator('[data-testid="export-synthetic-evidence"]').click()
   ]);
   const destination=join(evidenceDir,'P04-synthetic-route-export.json');
   await download.saveAs(destination);
   const parsed=JSON.parse(readFileSync(destination,'utf8'));
   note('Generated browser evidence payload',parsed.kind);
   observations.verified=parsed.kind==='OEP_SYNTHETIC_EVIDENCE_EXPORT' &&
      parsed.warning==='SIMULATION_ONLY_NOT_PHYSICALLY_TESTED_NOT_AN_EMERGENCY_SERVICE' &&
      parsed.result?.kind==='RESEARCH_SIMULATION_NOT_OPERATIONAL';
   break;
  }
  case 'P05': {
   const banner=await page.locator('.oep-ts-auth-banner').innerText();
   const targets=await page.locator('[data-testid="rf-radar-target-list"]').count();
   note('RF simulator authorization warning',banner.slice(0,200));
   observations.verified=targets===1&&/simulat|simulati|geen echte|research/i.test(banner);
   break;
  }
  case 'P06': {
   const group=page.locator('.mer-human');
   const emergency=group.locator('button').nth(1);
   const initiallyDisabled=await emergency.isDisabled();
   await group.locator('input[type=checkbox]').check();
   await emergency.click();
   const explicit=await group.locator('.mer-safety-record').innerText();
   await group.locator('input[type=checkbox]').uncheck();
   const cleared=await group.locator('.mer-safety-record').count()===0;
   note('SOS only after voluntary consent; unchecked removes it',{initiallyDisabled,explicit,cleared});
   observations.verified=initiallyDisabled&&explicit.includes('SOS_EXPLICIT')&&cleared;
   break;
  }
  case 'P07': {
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.keyboard.press('Tab');
   const keyboard=await page.evaluate(()=>document.activeElement?.matches('a,button,input,select'));
   const landmarks=await page.locator('main').count();
   const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
   note('Tab reaches interactive control, main landmark, prefers-reduced-motion',{keyboard,landmarks,reduced});
   observations.verified=Boolean(keyboard)&&landmarks>=1&&reduced;
   break;
  }
  case 'P08': {
   const roadmap=await page.locator('#roadmap').count();
   const partner=await page.locator('#partner').count();
   const warnings=await page.locator('#evidence').innerText();
   note('Roadmap and partner section with risk disclosure',{roadmap,partner});
   observations.verified=roadmap===1&&partner===1&&/FYSIEK|PHYSICAL|SIMULAT/i.test(warnings);
   break;
  }
  case 'P09': {
   const thesis=await page.locator('[data-testid="thirty-second-thesis-card"]').innerText();
   const outageCounters=await page.locator('[data-testid="globe-route-counters"]').innerText();
   await page.locator('[data-testid="mission-scenario-intermittent"]').click();
   const intermittentCounters=await page.locator('[data-testid="globe-route-counters"]').innerText();
   await page.locator('[data-testid="globe-object-CAM-DGT-N403-PK82"]').click();
   const inspector=await page.locator('[data-testid="globe-selected-inspector"]').innerText();
   await page.locator('[data-testid="globe-mode-space"]').click();
   await page.locator('[data-testid="celestial-body-mars"]').click();
   const marsBanner=await page.locator('[data-testid="non-earth-educational-banner"]').innerText();
   await page.locator('[data-testid="hf-act-3"]').click();
   const hfBanner=await page.locator('[data-testid="hf-active-act-banner"]').innerText();
   const livingNavVisible=await page.locator('[data-testid="apple-living-nav"]').isVisible();
   note('30s thesis, scenario counter transition, camera selection, Mars disclaimer, HyperFrames Act 3 & Apple Living Nav',{outageCounters,intermittentCounters,marsBanner:marsBanner.slice(0,120),hfBanner,livingNavVisible});
   observations.verified=
     thesis.includes('Civic Relay investiga') &&
     outageCounters.includes('0') &&
     !intermittentCounters.includes('ACK sintéticos: 0') &&
     inspector.includes('N-403') &&
     marsBanner.includes('NO opera en Marte') &&
     hfBanner.includes('ACT 03') &&
     livingNavVisible;
   break;
  }
  case 'P11': {
   const header=page.locator('[data-testid="responsive-header"]');
   const menu=page.locator('[data-testid="header-menu-toggle"]');
   const panel=page.locator('[data-testid="header-menu-panel"]');
   const bounds=await header.evaluate((el)=>{
     const rect=el.getBoundingClientRect();
     const actions=el.querySelector('.oep-header-actions')?.getBoundingClientRect();
     return {left:rect.left,right:rect.right,viewport:window.innerWidth,actionsRight:actions?.right};
   });
   const menuHeight=await menu.evaluate(el=>el.getBoundingClientRect().height);
   const initiallyClosed=await menu.getAttribute('aria-expanded')==='false';
   await menu.click();
   const open=await menu.getAttribute('aria-expanded')==='true'&&await panel.isVisible();
   const evidenceLink=panel.locator('a[href="#evidence"]');
   const reachable=await evidenceLink.isVisible();
   await evidenceLink.click();
   const closed=await menu.getAttribute('aria-expanded')==='false';
   note('320px header width, menu open/close, evidence anchor, touch size',{bounds,menuHeight,initiallyClosed,open,reachable,closed});
   observations.verified=bounds.left>=-1&&bounds.right<=bounds.viewport+1&&
      (bounds.actionsRight??Infinity)<=bounds.viewport+1&&menuHeight>=44&&
      initiallyClosed&&open&&reachable&&closed;
   break;
  }
  case 'P12': {
   const header=page.locator('[data-testid="responsive-header"]');
   const brand=header.locator('.oep-brand');
   const nav=header.locator('.oep-header-desktop');
   const actions=header.locator('.oep-header-actions');
   const [brandBox,navBox,actionsBox]=await Promise.all([brand.boundingBox(),nav.boundingBox(),actions.boundingBox()]);
   const primaryCount=await nav.locator('a').count();
   const menu=page.locator('[data-testid="header-menu-toggle"]');
   await menu.click();
   const opened=await page.locator('[data-testid="header-menu-panel"]').isVisible();
   await page.keyboard.press('Escape');
   const closed=await menu.getAttribute('aria-expanded')==='false';
   note('1536px navigation columns, primary links and Escape close',{brandBox,navBox,actionsBox,primaryCount,opened,closed});
   observations.verified=Boolean(brandBox&&navBox&&actionsBox)&&primaryCount===4&&opened&&closed&&
     brandBox.x+brandBox.width<=navBox.x+2&&navBox.x+navBox.width<=actionsBox.x+2&&
     actionsBox.x+actionsBox.width<=1536;
   break;
  }
  case 'P10': {
   const secSection=page.locator('[data-testid="sector-intelligence-section"]');
   await secSection.scrollIntoViewIfNeeded();
   await page.locator('[data-testid="sector-btn-SECTOR-AVILA-TIEMBLO"]').click();
   const camGrid=await page.locator('[data-testid="sector-camera-grid"]').innerText();
   await page.locator('[data-testid="ssrf-test-loopback"]').click();
   const ssrfBlocked=await page.locator('[data-testid="ssrf-validator-verdict"]').innerText();
   await page.locator('[data-testid="ssrf-test-dgt"]').click();
   const ssrfAllowed=await page.locator('[data-testid="ssrf-validator-verdict"]').innerText();
   await page.locator('[data-testid="pipeline-node-5"]').click();
   const pipeDetail=await page.locator('[data-testid="pipeline-active-detail"]').innerText();
   note('El Tiemblo cameras, Anti-SSRF block/allow, and Unified Pipeline step 6',{ssrfBlocked,ssrfAllowed});
   observations.verified=
     camGrid.includes('PUBLIC_CATALOG_VERIFIED') &&
     camGrid.includes('SYNTHETIC') &&
     camGrid.includes('STALE') &&
     ssrfBlocked.startsWith('BLOCK:') &&
     ssrfAllowed.startsWith('ALLOW:') &&
     pipeDetail.includes('emergency-routing.mjs');
   break;
  }
 }
 return observations;
}

let browser;
const log=[];
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=swiftshader']});
 for(const trial of cases){
  const page=await browser.newPage({viewport:trial.viewport,deviceScaleFactor:1});
  const pageErrors=[], consoleErrors=[];
  page.on('pageerror', e=>pageErrors.push(String(e)));
  page.on('console', msg=>{if(msg.type()==='error')consoleErrors.push(msg.text().slice(0,450));});
  const response=await page.goto(base+trial.url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('h1').first().waitFor({timeout:15000});
  await page.waitForTimeout(400);
  let task;
  try{task=await runRoleTask(page,trial,evidenceDir);}
  catch(error){task={role:trial.role,actions:[],verified:false,error:String(error)};}
  const obs=await page.evaluate(()=>({
   lang:document.documentElement.lang,
   title:document.title,
   headings:[...document.querySelectorAll('h1')].map(x=>x.textContent.trim()),
   canonical:document.querySelector('link[rel=canonical]')?.href||null,
   disclaimers:document.body.innerText.match(/SIMULAT|SIMULACI|SIMULATIE|RESEARCH PROTOTYPE|PROTOTIPO DE INVESTIGACIÓN|ONDERZOEKSPROTOTYPE/gi)?.length||0,
   eightStage:document.body.innerText.includes('EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE'),
   obsoleteLinks:[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/^https?:\/\/(?:civic-relay\.vercel\.app|civic-relay-pi\.vercel\.app|abrahamhl\.github\.io\/civic-relay)/i.test(h))
  }));
  const pass=Boolean(response?.status()===200&&obs.lang===trial.locale&&obs.headings.some(x=>x.includes(trial.text))&&obs.canonical?.startsWith('https://civic-relay-investor.vercel.app')&&obs.disclaimers>0&&obs.eightStage&&obs.obsoleteLinks.length===0&&pageErrors.length===0&&task.verified);
  const record={id:trial.id,kind:'REAL_CHROMIUM_AUTOMATED_SMOKE_NOT_HUMAN_USER',sha:process.env.GITHUB_SHA||'LOCAL',timestamp_utc:new Date().toISOString(),locale:trial.locale,viewport:trial.viewport,role:trial.role,roleTask:task,steps:['Open static release in Chromium','Verify DOM language and localized heading','Inspect canonical and simulation disclaimer','Check architecture and stale external links','Inspect pageerror events'],expected:{http:200,htmlLang:trial.locale,canonicalHost:'civic-relay-investor.vercel.app',noPageErrors:true},observed:{http:response?.status(),...obs,pageErrors,consoleErrors},verdict:pass?'PASS':'FAIL'};
  await page.screenshot({path:join(evidenceDir,trial.id+'-'+trial.locale+'.png'),fullPage:false});
  writeFileSync(join(evidenceDir,trial.id+'-'+trial.locale+'.json'),JSON.stringify(record,null,2));
  log.push(record);
  console.log(record.verdict,trial.id,trial.locale,JSON.stringify({lang:obs.lang,errors:pageErrors.length,canonical:obs.canonical}));
  await page.close();
 }
 const result={sha:process.env.GITHUB_SHA||'LOCAL',completed_at_utc:new Date().toISOString(),scope:'FIFTEEN automated Chromium task roles (P01-P15) on synthetic local website including master vision, typed custody, 20-module catalogue, keyboard, mobile and trilingual checks.',runs:log};
 writeFileSync(join(evidenceDir,'summary.json'),JSON.stringify(result,null,2));
 assert.ok(log.every(x=>x.verdict==='PASS'),'Browser release regression failed; inspect evidence/browser-release');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
