// Execute from repository root with playwright-cli run-code --filename <this file>.
// All hardware errors below are explicitly injected fixtures. No real media capture.
async (page) => {
  const base='http://127.0.0.1:8766';
  const report={kind:'LOCAL_BROWSER_SOFTWARE_TEST',physicalTrials:0,checks:[],layouts:[],errors:[]};
  const check=(condition,name)=>report.checks.push({name,passed:Boolean(condition)});
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const locale of ['en','es','nl']){
    const url=base+(locale==='en'?'/':`/${locale}/`);
    const response=await page.goto(url);
    check(response.status()===200,`${locale}: HTTP 200`);
    const html=await response.text();
    check(new RegExp(`<html[^>]*lang="${locale}"`).test(html),`${locale}: initial HTML language`);
    await page.waitForFunction(l=>document.documentElement.lang===l,locale);
    await page.getByTestId('sensor-camera-status').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    check(await page.locator('.oep-chapter-nav a').count()===6,`${locale}: six chapter anchors`);
    for(const width of [320,375,390,768,1440]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const layout=await page.evaluate(({locale,width})=>({locale,width,scroll:document.documentElement.scrollWidth,
        // The six-anchor rail intentionally scrolls horizontally within its own container.
        clipped:[...document.querySelectorAll('main *')].filter(element=>{
          const rect=element.getBoundingClientRect();
          return rect.width>0&&rect.right>innerWidth+2&&!element.closest('.oep-chapter-nav');
        }).slice(0,5).map(element=>element.className)}),{locale,width});
      report.layouts.push(layout);
      check(layout.scroll===width&&layout.clipped.length===0,`${locale}: no clipped content at ${width}px`);
    }
  }
  await page.goto(`${base}/es/`);
  await page.setViewportSize({width:375,height:900});
  await page.getByTestId('sensor-camera-status').waitFor();
  await page.locator('#rf-explorer').scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/engineering/evidence/2026-10-24/rf-after-375.png'});
  await page.getByTestId('case-tab-0').focus();await page.keyboard.press('ArrowRight');
  check(await page.getByTestId('case-tab-1').getAttribute('aria-selected')==='true','case tabs: keyboard ArrowRight');
  const focus=await page.getByTestId('case-tab-1').evaluate(element=>({focused:document.activeElement===element,outline:getComputedStyle(element).outlineStyle}));
  check(focus.focused&&focus.outline!=='none','case tabs: visible keyboard focus');
  check(await page.locator('#through-wall-rf-radar .oep-ts-target-card').count()===0,'no automatic synthetic targets');
  await page.getByRole('checkbox',{name:/DEMO/}).check();
  check(await page.locator('#through-wall-rf-radar .oep-ts-target-card').count()===3,'opt-in DEMO contains three synthetic emitters');
  await page.getByRole('checkbox',{name:/DEMO/}).uncheck();
  await page.evaluate(()=>{
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Injected permission-denied fixture','NotAllowedError');}});
  });
  await page.locator('#rf-explorer').getByRole('button',{name:'Autorizar · Cámara',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="sensor-camera-status"]').textContent==='PERMISSION_DENIED');
  check(true,'fixture: denied camera never claims connected');
  await page.getByTestId('toggle-ar-camera').click();
  await page.waitForFunction(()=>document.querySelector('#through-wall-rf-radar').textContent.includes('UNAVAILABLE'));
  check(await page.locator('#through-wall-rf-radar video').evaluate(element=>element.srcObject===null),'legacy camera denial: no media resource');
  const live=page.getByTestId('live-hardware-console');
  await page.getByTestId('btn-live-ecdsa-safe').click();
  await page.waitForFunction(()=>document.querySelector('#live-hardware-and-funding').textContent.includes('LAB_ONLY'));
  check((await page.getByTestId('live-ecdsa-verification-status').innerText()).includes('SIGNATURE_VALID_UNTRUSTED'),'real browser signature: valid but untrusted');
  report.loopbackStatus=await page.getByTestId('webrtc-loopback-status').innerText();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('oep_real_durable_queue_v1')));
  check(stored.length===1&&/^[0-9a-f-]{36}$/.test(stored[0].messageId),'bounded local storage contains UUID lab packet');
  const peer=await page.context().newPage();
  await peer.goto(`${base}/es/`);
  await peer.waitForFunction(()=>!document.querySelector('[data-testid="btn-live-ecdsa-safe"]').disabled);
  await page.evaluate(packet=>{const c=new BroadcastChannel('oep_live_p2p_bus_v1');c.postMessage(packet);c.close();},stored[0]);
  await peer.waitForFunction(()=>document.querySelector('#live-hardware-and-funding').textContent.includes('BROADCAST_CHANNEL_SAME_ORIGIN_TAB'));
  check((await peer.getByTestId('live-ecdsa-verification-status').innerText()).includes('SIGNATURE_VALID_UNTRUSTED'),'same-origin second tab verifies real signature without asserting device delivery');
  await page.evaluate(packet=>{const c=new BroadcastChannel('oep_live_p2p_bus_v1');c.postMessage(packet);c.close();},stored[0]);
  await peer.waitForFunction(()=>document.querySelector('#live-hardware-and-funding').textContent.includes('REPLAY_REJECTED'));
  check(true,'second tab rejects replayed UUID');
  await peer.close();
  await live.getByRole('button',{name:/VACIAR/}).click();
  check(await page.evaluate(()=>localStorage.getItem('oep_real_durable_queue_v1')===null),'local purge verified by readback');
  check(await page.getByTestId('live-ecdsa-packet-box').count()===0,'purge clears packet view');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Injected storage failure','QuotaExceededError');};});
  await page.getByTestId('btn-live-ecdsa-safe').click();
  await page.waitForFunction(()=>document.querySelector('#live-hardware-and-funding').textContent.includes('STORAGE_UNAVAILABLE'));
  check(true,'fixture: storage failure reported without durability claim');
  await live.getByRole('button',{name:/VACIAR/}).click();
  await page.locator('#rf-explorer').getByRole('button',{name:/STOP/}).click();
  check(await page.getByTestId('sensor-camera-status').innerText()==='NO_SENSOR','STOP resets denied camera state');
  await page.goto(base);
  await page.setViewportSize({width:1440,height:900});
  await page.getByTestId('sensor-camera-status').waitFor();
  await page.screenshot({path:'docs/engineering/evidence/2026-10-24/home-after-1440.png'});
  await page.evaluate(()=>document.body.style.zoom='2');
  const zoom=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
    clipped:[...document.querySelectorAll('main *')].some(element=>{
      const rect=element.getBoundingClientRect();return rect.width>0&&rect.right>innerWidth+2&&!element.closest('.oep-chapter-nav');
    })}));
  check(zoom.scroll===zoom.width&&!zoom.clipped,'200% CSS zoom: no clipped content at 1440px');
  await page.evaluate(()=>document.body.style.zoom='1');
  await page.locator('#architecture').scrollIntoViewIfNeeded();
  await page.locator('.scroll-globe-canvas canvas').waitFor();
  await page.locator('.scroll-globe-canvas canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  check(await page.locator('.scroll-globe-fallback').isVisible(),'WebGL context loss displays fallback');
  check(report.errors.length===0,'no browser page errors or hydration mismatches');
  report.failed=report.checks.filter(check=>!check.passed);
  return report;
}
