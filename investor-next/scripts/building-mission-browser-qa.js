// Run against the local static export using playwright-cli --raw run-code --filename.
// All entities and links are fictional. The WebGL failure below is deliberately injected.
async(page)=>{
 const base='http://127.0.0.1:8766',dir='docs/engineering/evidence/2026-10-24-building';
 const report={kind:'LOCAL_BUILDING_MISSION_BROWSER_QA',physicalTrials:0,checks:[],layouts:[],accessibility:[],errors:[]};
 const check=(passed,name)=>{report.checks.push({name,passed:Boolean(passed)});};
 const state=()=>page.getByTestId('mission-status').getAttribute('data-state');
 const waitState=expected=>page.waitForFunction(s=>document.querySelector('[data-testid=mission-status]')?.dataset.state===s,expected,{timeout:10000});
 const stop=()=>page.getByTestId('mission-stop').click();
 const details=page.locator('.bml-evidence');
 const getId=async()=>{if(await details.getAttribute('open')===null)await details.locator('summary').click();return (await details.locator('code').innerText()).split(' · ')[0];};
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${base}/es/?mission-qa=${Date.now()}#routing-lab`);
 await page.getByTestId('building-mission').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-testid=mission-scene] canvas')||document.querySelector('[data-testid=mission-scene]')?.dataset.fallback==='true');
 check(await page.getByTestId('mission-send').isDisabled(),'Silence cannot create or send a help request');
 check(await state()==='IDLE','Initial mission is idle');
 await page.getByTestId('mission-tour').click();await waitState('IN_TRANSIT');await page.getByTestId('mission-pause').click();
 check(await page.locator('.bml-route li').count()>3,'Guided journey uses a computed multi-hop path');
 await page.getByTestId('mission-next-hop').click();
 check(await state()==='IN_TRANSIT'&&(await page.getByTestId('mission-receipt').innerText())==='Pendiente','One hop does not create a receipt');
 await page.locator('.bml-workspace').screenshot({path:`${dir}/desktop-route.png`});
 for(let i=0;i<8&&await state()==='IN_TRANSIT';i++)await page.getByTestId('mission-next-hop').click();
 await waitState('RECEIVED');
 check((await page.getByTestId('mission-receipt').innerText())==='Simulado','Only final hop yields a simulated receipt');
 check((await page.locator('.bml-counters>div').first().innerText()).includes('0'),'Receipt clears the local payload');
 check((await page.locator('.bml-route li').last().innerText()).includes('Simulado'),'Destination label reflects the received state');
 await stop();
 await page.getByTestId('mission-preset-1').click();await page.getByTestId('mission-response-SOS_EXPLICIT').click();await page.getByTestId('mission-send').click();await waitState('QUEUED');
 const firstId=await getId();
 check((await page.getByTestId('mission-receipt').innerText())==='Pendiente','Disconnected receiver queues without a receipt');
 await page.getByTestId('mission-gateway').check();await page.getByTestId('mission-send').click();await waitState('IN_TRANSIT');await page.getByTestId('mission-pause').click();
 check(await getId()===firstId,'Restoring the receiver retries the same message ID');
 await page.getByTestId('mission-gateway').uncheck();await waitState('QUEUED');
 check((await page.getByTestId('mission-status').innerText()).includes('Ha cambiado'),'Mid-route link loss explains interruption');
 check(await getId()===firstId&&(await page.getByTestId('mission-receipt').innerText())==='Pendiente','Interrupted flight retains the queued ID without ACK');
 await stop();check(await state()==='IDLE'&&await details.locator('code').count()===0,'STOP purges message ID and event display');
 await page.getByTestId('mission-preset-2').click();await page.getByTestId('mission-response-SAFE').click();await page.getByTestId('mission-send').click();await waitState('QUEUED');
 check((await page.getByTestId('mission-status').innerText()).includes('permiso'),'No relay permission explains why the message waits');
 await stop();await page.getByTestId('mission-preset-3').click();await page.getByTestId('mission-response-SAFE').click();await page.getByTestId('mission-send').click();await waitState('QUEUED');
 check((await page.getByTestId('mission-status').innerText()).includes('batería crítica'),'Critical battery blocks relay without inventing delivery');
 await stop();await page.getByTestId('mission-preset-0').click();
 await page.getByTestId('mission-source').selectOption('NODE-010');
 check(await page.getByTestId('mission-send').isDisabled(),'Changing terminal requires a new explicit response');
 await page.locator('.bml-floors').getByRole('button',{name:'Planta 5',exact:true}).click();
 check(await page.getByTestId('mission-source').locator('option').count()===8,'Floor focus filters the keyboard terminal picker');
 await page.locator('.bml-floors').getByRole('button',{name:'Todas',exact:true}).click();
 const canvas=page.getByTestId('mission-scene').locator('canvas');
 if(await canvas.count()){
   const before=await canvas.screenshot();await page.getByRole('button',{name:'Acercar',exact:true}).click();const zoomed=await canvas.screenshot();
   check(!before.equals(zoomed),'Zoom visibly changes the 3D camera');
   const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.53,{steps:8});await page.mouse.up();
   const rotated=await canvas.screenshot();check(!rotated.equals(zoomed),'Dragging visibly rotates the 3D building');
   await page.getByRole('button',{name:'Centrar vista',exact:true}).click();
 }
 await page.getByTestId('mission-tour').click();await waitState('IN_TRANSIT');await page.getByTestId('mission-pause').click();await stop();
 await page.waitForTimeout(1100);check(await state()==='IDLE','No late animation callback resurrects STOP');
 await page.setViewportSize({width:375,height:900});
 await page.getByTestId('mission-tour').click();await waitState('RECEIVED');
 const mobileScene=await page.getByTestId('mission-scene').boundingBox();
 check(mobileScene.y>=0&&mobileScene.y<150,'Mobile send returns focus of view to the building');
 await page.locator('.bml-scene').screenshot({path:`${dir}/mobile-received.png`});
 await page.getByTestId('mission-send').click();await page.getByTestId('mission-response-SAFE').click();
 if(await details.getAttribute('open')===null)await details.locator('summary').click();
 const downloadPromise=page.waitForEvent('download');await details.getByRole('button').click();const download=await downloadPromise;
 check(download.suggestedFilename()==='oep-building-mission-simulated.json','Trial exports as a clearly named simulated JSON');
 await download.saveAs(`${dir}/downloaded-trial.json`);
 await stop();
 for(const locale of ['es','en','nl']){
   await page.goto(base+(locale==='en'?'/':`/${locale}/`));await page.getByTestId('building-mission').waitFor();await page.evaluate(()=>document.fonts.ready);
   for(const width of [320,375,768,1440]){
     await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const layout=await page.locator('#routing-lab').evaluate((section,{locale,width})=>({locale,width,scroll:document.documentElement.scrollWidth,clipped:[...section.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left< -2||r.right>innerWidth+2);}).slice(0,10).map(e=>e.className)}),{locale,width});
     report.layouts.push(layout);check(layout.scroll===width&&layout.clipped.length===0,`${locale}: no overflow or clipping at ${width}px`);
     if(width===375||width===1440){
       await page.addScriptTag({path:'C:/dev/_tools/oep-browser-audit/node_modules/axe-core/axe.min.js'});
       const axe=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('#routing-lab'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,count:v.nodes.length}))};});
       report.accessibility.push({locale,width,...axe});check(axe.violations.length===0,`${locale}: scoped axe audit at ${width}px`);
     }
   }
 }
 await page.goto(`${base}/es/?mission-qa=${Date.now()}#routing-lab`);await page.setViewportSize({width:375,height:900});
 await page.getByTestId('mission-scene').locator('canvas').waitFor();
 await page.getByTestId('mission-scene').locator('canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await page.waitForFunction(()=>document.querySelector('[data-testid=mission-scene]')?.dataset.fallback==='true');
 check(await page.locator('.bml-flat-view svg').isVisible(),'Injected WebGL loss shows an explicit 2D fallback');
 await page.getByTestId('mission-tour').click();await waitState('RECEIVED');
 check(await state()==='RECEIVED','The full journey remains usable without WebGL');
 await page.locator('.bml-scene').screenshot({path:`${dir}/mobile-fallback.png`});
 check(report.errors.length===0,'No uncaught browser errors');
 report.passed=report.checks.filter(c=>c.passed).length;report.failed=report.checks.filter(c=>!c.passed);
 return report;
}
