#!/usr/bin/env node
/**
 * Actual Chromium browser smoke of the locally built Next static export.
 * Not a human test and not evidence of device-to-device or emergency delivery.
 * Requires a separately installed Playwright dependency and Chromium.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,existsSync,mkdirSync,writeFileSync } from 'node:fs';
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
    const paths=pathname==='/'?['index.html']:pathname==='/es'||pathname==='/es/'?['es.html','es/index.html']:pathname==='/nl'||pathname==='/nl/'?['nl.html','nl/index.html']:[pathname.replace(/^\/+/,'')];
    const file=paths.map(p=>resolve(out,p)).find(p=>(p===out||p.startsWith(out+sep))&&existsSync(p));
    if(!file){res.writeHead(404);res.end('Not found');return;}
    res.setHeader('content-type',mimetypes[extname(file)]||'application/octet-stream');
    res.writeHead(200);res.end(readFileSync(file));
  }catch(e){res.writeHead(500);res.end('Static preview error');}
});
const cases=[
  {id:'P01',locale:'es',url:'/es/',text:'CUANDO LA',viewport:{width:390,height:844}},
  {id:'P03',locale:'en',url:'/',text:'WHEN THE',viewport:{width:1280,height:800}},
  {id:'P08',locale:'nl',url:'/nl/',text:'ALS HET',viewport:{width:820,height:1180}}
];
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
  await page.waitForTimeout(600);
  const obs=await page.evaluate(()=>({
   lang:document.documentElement.lang,
   title:document.title,
   headings:[...document.querySelectorAll('h1')].map(x=>x.textContent.trim()),
   canonical:document.querySelector('link[rel=canonical]')?.href||null,
   disclaimers:document.body.innerText.match(/SIMULAT|SIMULACI|SIMULATIE|RESEARCH PROTOTYPE|PROTOTIPO DE INVESTIGACIÓN|ONDERZOEKSPROTOTYPE/gi)?.length||0,
   eightStage:document.body.innerText.includes('EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE'),
   obsoleteLinks:[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/^https?:\/\/(?:civic-relay\.vercel\.app|civic-relay-pi\.vercel\.app|abrahamhl\.github\.io\/civic-relay)/i.test(h))
  }));
  const pass=Boolean(response?.status()===200&&obs.lang===trial.locale&&obs.headings.some(x=>x.includes(trial.text))&&obs.canonical?.startsWith('https://civic-relay-investor.vercel.app')&&obs.disclaimers>0&&obs.eightStage&&obs.obsoleteLinks.length===0&&pageErrors.length===0);
  const record={id:trial.id,kind:'REAL_CHROMIUM_AUTOMATED_SMOKE_NOT_HUMAN_USER',sha:process.env.GITHUB_SHA||'LOCAL',timestamp_utc:new Date().toISOString(),locale:trial.locale,viewport:trial.viewport,steps:['Open static release in Chromium','Verify DOM language and localized heading','Inspect canonical and simulation disclaimer','Check architecture and stale external links','Inspect pageerror events'],expected:{http:200,htmlLang:trial.locale,canonicalHost:'civic-relay-investor.vercel.app',noPageErrors:true},observed:{http:response?.status(),...obs,pageErrors,consoleErrors},verdict:pass?'PASS':'FAIL'};
  await page.screenshot({path:join(evidenceDir,trial.id+'-'+trial.locale+'.png'),fullPage:false});
  writeFileSync(join(evidenceDir,trial.id+'-'+trial.locale+'.json'),JSON.stringify(record,null,2));
  log.push(record);
  console.log(record.verdict,trial.id,trial.locale,JSON.stringify({lang:obs.lang,errors:pageErrors.length,canonical:obs.canonical}));
  await page.close();
 }
 const result={sha:process.env.GITHUB_SHA||'LOCAL',completed_at_utc:new Date().toISOString(),scope:'Browser + static site only. Never a real person, responder, radio, satellite or field test.',runs:log};
 writeFileSync(join(evidenceDir,'summary.json'),JSON.stringify(result,null,2));
 assert.ok(log.every(x=>x.verdict==='PASS'),'Browser release regression failed; inspect evidence/browser-release');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
