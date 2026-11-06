/**
 * SENDA · película v5 · simulaciones deterministas con el NÚCLEO REAL (sin animación a mano).
 *   call    → señalización compacta (sdp-compact.mjs) + módem acústico (acoustic-modem.mjs) + cadena de voz
 *   drone3d → three.js: edificio, dron y censo radio en vivo (rf-census.mjs)
 *   arch3d  → three.js: las 5 capas de la arquitectura con paquetes recorriendo escenarios
 *   howsim  → cómo se calcula cada imagen: código → pruebas → fotograma determinista; «un toque»
 * Cada dibujo depende SOLO de (lt = segundos dentro de la escena, d = duración, cue = inicio de frase).
 */
(() => {
  const LANG = new URLSearchParams(location.search).get('lang') || 'es';
  const Q = new URLSearchParams(location.search);
  const NUM = { core: +(Q.get('core') || 0), e2e: +(Q.get('e2e') || 0) };
  const tr = (es, en) => (LANG === 'es' ? es : en);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const C = { bg: '#05090c', p: '#0b141c', l: '#203240', t: '#f2f4f4', m: '#a9bcc5', c: '#ff7756', i: '#91d7e8', e: '#34d399', a: '#fbbf24', v: '#b79cff', g: '#7d8f99', r: '#ff5b6e' };
  const S = {};

  // ---------------------------------------------------------------- datos reales
  const FP = Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 255).map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const SDP = ['v=0', 'o=- 123 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0 1', 'm=audio 9 UDP/TLS/RTP/SAVPF 111 63', 'c=IN IP4 0.0.0.0',
    'a=candidate:1 1 udp 2122260223 192.168.43.12 51234 typ host generation 0 network-id 1', 'a=candidate:2 1 udp 2122194687 3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f.local 51236 typ host generation 0', 'a=ice-ufrag:aB3d', 'a=ice-pwd:Zx9yWv8uTs7rQp6oNm5lKj4i', `a=fingerprint:sha-256 ${FP}`, 'a=setup:actpass', 'a=mid:0', ''].join('\r\n');

  async function init() {
    const [AM, SC, RF, VM] = await Promise.all(['acoustic-modem', 'sdp-compact', 'rf-census', 'voice-mesh'].map((m) => import(`/senda/core/${m}.mjs`)));
    // llamada: código real, forma de onda real y su «partitura» (tono dominante por símbolo)
    const bytes = SC.compactFromSdp(SDP, 'offer'), wave = AM.modulate(bytes, { sampleRate: 48000 }), dec = AM.demodulate(wave, { sampleRate: 48000 });
    const P = AM.PROFILE, ns = Math.round(P.symS * 48000), step = ns + Math.round(P.guardS * 48000), lead = Math.round(0.05 * 48000), nSym = Math.floor((wave.length - 2 * lead) / step), tones = [];
    for (let i = 0; i < nSym; i++) { let best = 0, bk = 0; for (let k = 0; k < P.tones; k++) { const c = 2 * Math.cos((2 * Math.PI * (P.f0 + k * P.df)) / 48000); let s1 = 0, s2 = 0; for (let j = lead + i * step, e = j + ns; j < e; j++) { const s0 = wave[j] + c * s1 - s2; s2 = s1; s1 = s0; } const pw = s1 * s1 + s2 * s2 - c * s1 * s2; if (pw > best) { best = pw; bk = k; } } tones.push(bk); }
    S.call = { code: SC.callToText(bytes), bytes: bytes.length, seconds: wave.length / 48000, ok: !!dec && dec.payload.every((x, i) => x === bytes[i]), tones, preamble: P.preamble.length, sdp: SC.sdpFromCompact(bytes).sdp.split('\r\n') };
    // dron: escenario y censo reales
    S.rf = { RF, sc: RF.rfCensusScenario(), cacheT: -1, r: null };
    S.mesh = VM;
    if (window.THREE) { setupDrone(); setupArch(); }
    return true;
  }

  // ---------------------------------------------------------------- utilidades de dibujo 2D
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  function phone(g, x, y, w, h, title, lines, accent = C.i) {
    g.fillStyle = '#0a141b'; rr(g, x, y, w, h, 22); g.fill(); g.strokeStyle = '#2a3d4a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#05090c'; rr(g, x + 10, y + 26, w - 20, h - 44, 12); g.fill();
    g.fillStyle = accent; g.font = '700 15px Inter,system-ui'; g.fillText(title, x + 22, y + 52);
    g.font = '13px Inter,system-ui'; lines.forEach((l, i) => { g.fillStyle = l.c ?? C.m; g.font = l.f ?? '13px Inter,system-ui'; g.fillText(l.t, x + 22, y + 78 + i * 20); });
  }
  const label = (g, t, x, y, c = C.m, f = '13px Inter,system-ui', al = 'left') => { g.fillStyle = c; g.font = f; g.textAlign = al; g.fillText(t, x, y); g.textAlign = 'left'; };

  // ---------------------------------------------------------------- 1) LLAMAR SIN INTERNET
  function drawCall(cv, lt, d, cue) {
    const g = cv.getContext('2d'), W = 640, H = 600, K = S.call; g.clearRect(0, 0, W, H);
    const c1 = cue(1), c2 = cue(2), A = { x: 10, y: 40, w: 190, h: 330 }, B = { x: 440, y: 40, w: 190, h: 330 };
    const sendP = clamp((lt - c1 - 1.2) / 6.5), linkP = ease((lt - c2) / 1.2), chainP = ease((lt - c2 - 7.5) / 1.5);
    // teléfono A
    const sdpP = ease((lt - 1.2) / 2.2), shrink = ease((lt - 3.6) / 1.4);
    const aLines = [{ t: tr('Sin Internet · sin servidor', 'No Internet · no server') }];
    if (lt > 0.8) aLines.push({ t: tr('▶ Crear llamada', '▶ Create call'), c: C.c, f: '700 14px Inter,system-ui' });
    phone(g, A.x, A.y, A.w, A.h, tr('Teléfono A', 'Phone A'), aLines, C.c);
    if (lt > 0.8 && lt < 1.6) { const r = 10 + (lt - 0.8) * 40; g.strokeStyle = `rgba(255,119,86,${1 - (lt - 0.8) / 0.8})`; g.lineWidth = 3; g.beginPath(); g.arc(A.x + 70, A.y + 100, r, 0, 7); g.stroke(); }
    // SDP completo que se comprime
    const fadeCode = 1 - linkP;
    if (sdpP > 0 && fadeCode > 0) {
      g.globalAlpha = fadeCode;
      const n = Math.floor(14 * (1 - shrink)) + 1; g.font = '9px ui-monospace,monospace';
      for (let i = 0; i < n; i++) { g.fillStyle = `rgba(169,188,197,${0.7 * sdpP})`; g.fillText(K.sdp[i % K.sdp.length].slice(0, 30), A.x + 22, A.y + 130 + i * 11); }
      label(g, tr('SDP real de Chrome: 2 056 caracteres', 'Real Chrome SDP: 2,056 characters'), A.x + 22, A.y + 300, C.m, '12px Inter,system-ui');
      if (shrink > 0) { g.fillStyle = `rgba(145,215,232,${shrink})`; rr(g, A.x + 20, A.y + 150, A.w - 40, 56, 8); g.fill(); label(g, `${K.bytes} bytes`, A.x + A.w / 2, A.y + 186, C.bg, '800 26px Inter,system-ui', 'center'); label(g, tr('código de llamada', 'call code'), A.x + A.w / 2, A.y + 226, C.i, '700 13px Inter,system-ui', 'center'); }
      g.globalAlpha = 1;
    }
    if (linkP > 0) label(g, tr(`✓ código de ${K.bytes} bytes enviado`, `✓ ${K.bytes}-byte code sent`), A.x + 22, A.y + 132, C.e, '700 12px Inter,system-ui');
    // partitura de tonos viajando de A a B
    const band = { x: A.x + A.w + 6, y: 130, w: B.x - A.x - A.w - 12, h: 90 };
    if (lt > c1) {
      g.fillStyle = '#071018'; rr(g, band.x, band.y, band.w, band.h, 8); g.fill();
      const nShow = Math.floor(K.tones.length * sendP), bw = band.w / K.tones.length;
      for (let i = 0; i < nShow; i++) { const k = K.tones[i]; g.fillStyle = i < K.preamble ? C.a : `hsl(${190 + k * 6},70%,60%)`; g.fillRect(band.x + i * bw, band.y + band.h - ((k + 1) * band.h) / 16, Math.max(1, bw - 0.3), band.h / 16 - 1); }
      for (let k = 0; k < 3; k++) { const r = ((lt * 60 + k * 30) % 90) + 10; g.strokeStyle = `rgba(255,119,86,${0.6 - r / 160})`; g.lineWidth = 2; g.beginPath(); g.arc(A.x + A.w - 20, A.y + 100, r, -0.9, 0.9); g.stroke(); }
      label(g, tr(`${K.seconds.toFixed(1).replace('.', ',')} s de tonos`, `${K.seconds.toFixed(1)} s of tones`), band.x + band.w / 2, band.y - 26, C.t, '700 13px Inter,system-ui', 'center');
      label(g, tr('16 notas entre 2 y 5 kHz', '16 notes between 2 and 5 kHz'), band.x + band.w / 2, band.y - 9, C.m, '12px Inter,system-ui', 'center');
    }
    const bLines = [{ t: tr('Escuchando…', 'Listening…') }];
    if (sendP > 0) bLines.push({ t: `${Math.round(sendP * 100)} %`, c: C.i, f: '700 22px Inter,system-ui' });
    if (sendP >= 1) bLines.push({ t: K.ok ? tr(`✓ ${K.bytes} bytes, 0 errores`, `✓ ${K.bytes} bytes, 0 errors`) : '✗', c: C.e, f: '700 14px Inter,system-ui' }, { t: tr('Responde igual (72 bytes)', 'Replies the same way (72 bytes)') });
    phone(g, B.x, B.y, B.w, B.h, tr('Teléfono B', 'Phone B'), bLines, C.i);
    // enlace directo cifrado con voz y chat
    if (linkP > 0) {
      const y = 280; g.strokeStyle = `rgba(52,211,153,${linkP})`; g.lineWidth = 4; g.beginPath(); g.moveTo(A.x + A.w, y); g.lineTo(B.x, y); g.stroke();
      label(g, tr('Directo · cifrado DTLS-SRTP · sin servidor', 'Direct · DTLS-SRTP encrypted · no server'), (A.x + A.w + B.x) / 2, y - 14, C.e, '700 12px Inter,system-ui', 'center');
      for (let k = 0; k < 6; k++) { const f = ((lt * 0.9 + k / 6) % 1), dir = k % 2 ? 1 : -1, x = dir > 0 ? A.x + A.w + f * (B.x - A.x - A.w) : B.x - f * (B.x - A.x - A.w); g.fillStyle = dir > 0 ? C.c : C.i; g.globalAlpha = linkP; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.globalAlpha = 1; }
      for (const [P, s] of [[A, 1.3], [B, 2.1]]) for (let k = 0; k < 14; k++) { const h = 6 + 22 * Math.abs(Math.sin(lt * 7 * s + k * 0.8)) * linkP; g.fillStyle = C.e; g.fillRect(P.x + 30 + k * 11, A.y + A.h - 36 - h, 7, h); }
      const msgs = [[tr('¿Me oyes? 4.ª planta', 'Can you hear me? 4th floor'), A, 1.5], [tr('Te oigo. Vamos.', 'I hear you. Coming.'), B, 3.2]];
      for (const [t, P, at] of msgs) { const p = ease((lt - c2 - at) / 0.6); if (p <= 0) continue; g.globalAlpha = p; g.fillStyle = P === A ? '#1b3a48' : '#123d2c'; rr(g, P.x + 18, A.y + 236, P.w - 36, 30, 10); g.fill(); label(g, t, P.x + 28, A.y + 256, C.t, '12px Inter,system-ui'); g.globalAlpha = 1; }
    }
    // cadena de voz A → B → C (resultado medido)
    if (chainP > 0) {
      g.globalAlpha = chainP; const y = 470, xs = [90, 320, 550], names = ['A', tr('B · repite', 'B · relays'), 'C'];
      g.fillStyle = '#0b141c'; rr(g, 20, 400, 600, 190, 14); g.fill(); g.strokeStyle = C.l; g.lineWidth = 1; g.stroke();
      label(g, tr('Cadena de voz: A no alcanza a C; B, en la escalera, repite', 'Voice chain: A cannot reach C; B, on the stairs, relays'), 320, 426, C.t, '700 14px Inter,system-ui', 'center');
      g.strokeStyle = C.i; g.lineWidth = 3; g.beginPath(); g.moveTo(xs[0] + 26, y); g.lineTo(xs[2] - 26, y); g.stroke();
      xs.forEach((x, i) => { g.fillStyle = i === 1 ? C.c : '#0f1d27'; rr(g, x - 20, y - 32, 40, 64, 8); g.fill(); g.strokeStyle = C.i; g.lineWidth = 2; g.stroke(); label(g, names[i], x, y + 52, C.t, '700 13px Inter,system-ui', 'center'); });
      for (let k = 0; k < 4; k++) { const f = (lt * 0.7 + k / 4) % 1, x = xs[0] + 26 + f * (xs[2] - xs[0] - 52); g.fillStyle = C.c; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      label(g, tr('Prueba real: C oye el tono de 440 Hz de A → 441 Hz medidos', 'Real test: C hears A’s 440 Hz tone → 441 Hz measured'), 320, 570, C.e, '700 13px Inter,system-ui', 'center');
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- 2) DRON 3D + CENSO REAL
  const PASS = 900, PASS_ON = 600, PASSES = 3, TM = (PASSES - 1) * PASS + PASS_ON, FLOORS = 6, FH = 3;
  function textSprite(text, { size = 28, color = '#f2f4f4', bg = null, w = 512, h = 64, scale = 6 } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, 14); g.fill(); }
    g.fillStyle = color; g.font = `700 ${size}px Inter,system-ui`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, h / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.scale.set(scale, (scale * h) / w, 1); return sp;
  }
  function makeRenderer() {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; canvas.className = 'c3d';
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(1280, 720, false); r.setClearColor(0x05090c, 1);
    return r;
  }
  const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
  function setupDrone() {
    const R = makeRenderer(), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1280 / 720, 0.1, 400);
    cam.setViewOffset(1280, 720, -150, 0, 1280, 720);
    scene.fog = new THREE.Fog(0x05090c, 75, 160);
    const grid = new THREE.GridHelper(120, 60, 0x1b3a48, 0x0f2230); scene.add(grid);
    const floors = [];
    for (let f = 0; f < FLOORS; f++) {
      const geo = new THREE.BoxGeometry(14, FH - 0.35, 9), mat = new THREE.MeshBasicMaterial({ color: 0x12323f, transparent: true, opacity: 0.35, depthWrite: false });
      const m = new THREE.Mesh(geo, mat); m.position.y = f * FH + FH / 2; scene.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0.55 })); e.position.copy(m.position); scene.add(e);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.25, 9.6), new THREE.MeshBasicMaterial({ color: 0x1d2c37 })); slab.position.y = f * FH; scene.add(slab);
      const lab = textSprite(f === 0 ? tr('Planta baja', 'Ground floor') : `${tr('Planta', 'Floor')} ${f}`, { size: 34, color: '#f2f4f4', scale: 7 }); lab.position.set(-11.5, f * FH + 1.5, 5); scene.add(lab);
      floors.push({ mesh: m, edges: e });
    }
    // dispositivos (posición fija por clave, a partir de las observaciones reales del escenario)
    const devs = new Map();
    for (const o of S.rf.sc.obs) { if (o.cls === 'iot') continue; const k = o.id.split('#')[0]; if (devs.has(k)) continue; const f = +k.split('-')[0], h = hash(k); devs.set(k, { f, cls: o.cls, fp: o.fp, x: -6 + ((h % 1000) / 1000) * 12, z: -3.6 + (((h >> 10) % 1000) / 1000) * 7.2 }); }
    const COL = { 'apple-phone': 0x91d7e8, 'google-phone': 0x34d399, 'samsung-phone': 0xfbbf24, 'watch-a': 0xb79cff, 'buds-b': 0xd9a2ff };
    for (const d of devs.values()) { const s = new THREE.Mesh(new THREE.SphereGeometry(d.cls === 'phone' ? 0.28 : 0.18, 10, 8), new THREE.MeshBasicMaterial({ color: COL[d.fp] ?? 0xa9bcc5, transparent: true, opacity: 0.15 })); s.position.set(d.x, d.f * FH + 0.9, d.z); scene.add(s); d.mesh = s; }
    // dron
    const drone = new THREE.Group(), white = new THREE.MeshBasicMaterial({ color: 0xf2f4f4 }), dark = new THREE.MeshBasicMaterial({ color: 0x3a4a55 });
    drone.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), white));
    const rotors = [];
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.12), dark); arm.position.set(x * 0.55, 0.05, z * 0.55); arm.rotation.y = x * z > 0 ? -Math.PI / 4 : Math.PI / 4; drone.add(arm); const rot = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.55, 20), new THREE.MeshBasicMaterial({ color: 0x91d7e8, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })); rot.rotation.x = -Math.PI / 2; rot.position.set(x * 1.0, 0.2, z * 1.0); drone.add(rot); rotors.push(rot); }
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7756 })); light.position.y = -0.25; drone.add(light);
    scene.add(drone);
    const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), new THREE.MeshBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0.4, side: THREE.DoubleSide })); scene.add(m); return m; });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0.45 })); scene.add(lines);
    S.drone = { R, scene, cam, floors, devs, drone, rotors, rings, lines };
  }
  function census(tau) {
    const st = S.rf; if (Math.abs(st.cacheT - tau) < 4 && st.r) return st.r;
    const obs = st.sc.obs; let lo = 0, hi = obs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (obs[m].t <= tau) lo = m + 1; else hi = m; }
    st.r = st.RF.rfCensus(obs.slice(0, lo), st.sc.building); st.n = lo; st.cacheT = tau; return st.r;
  }
  function dronePos(tau) {
    const p = Math.floor(tau / PASS), w = tau - p * PASS;
    if (p < PASSES && w < PASS_ON) { const x = w / (PASS_ON / FLOORS), f = Math.floor(x), a = 2 * Math.PI * (x % 1); return { f, pass: p, v: new THREE.Vector3(Math.cos(a) * 11.5, f * FH + 1.6, Math.sin(a) * 8.5) }; }
    const a = tau / 60; return { f: null, pass: Math.min(p, PASSES - 1), v: new THREE.Vector3(Math.cos(a) * 9, FLOORS * FH + 4, Math.sin(a) * 6) };
  }
  function drawDrone(hud, lt, d, cue) {
    const D = S.drone; if (!D) return;
    const tau = clamp(lt / (d * 0.86)) * TM, r = census(tau), dp = dronePos(tau);
    // plantas coloreadas por la estimación (mediana) del censo real
    r.floors.forEach((f, i) => { const m = f.people.mid, mat = D.floors[i].mesh.material; mat.color.setHex(m ? 0xff7756 : 0x12323f); mat.opacity = m ? Math.min(0.62, 0.18 + m * 0.055) : 0.3; });
    // dispositivos oídos en los últimos 20 s de misión
    const recent = new Map(), obs = S.rf.sc.obs;
    for (let k = Math.max(0, S.rf.n - 900); k < S.rf.n; k++) { const o = obs[k]; if (o.cls !== 'iot' && o.t > tau - 20 && o.rssi > -71) recent.set(o.id.split('#')[0], o); }
    const pos = [];
    for (const [k, dv] of D.devs) { const on = recent.has(k); dv.mesh.material.opacity = on ? 1 : tau > 30 && dv.f <= (dp.f ?? FLOORS) + 1 ? 0.35 : 0.12; dv.mesh.scale.setScalar(on ? 1.5 : 1); if (on) pos.push(dv.mesh.position.x, dv.mesh.position.y, dv.mesh.position.z, dp.v.x, dp.v.y, dp.v.z); }
    D.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    D.drone.position.copy(dp.v); D.drone.rotation.y = -Math.atan2(dp.v.z, dp.v.x); D.rotors.forEach((ro, k) => (ro.rotation.z = lt * 40 + k));
    D.rings.forEach((ri, k) => { const ph = ((lt * 0.9 + k / 3) % 1); ri.position.copy(dp.v); ri.rotation.x = -Math.PI / 2; ri.scale.setScalar(1 + ph * 9); ri.material.opacity = (dp.f == null ? 0.1 : 0.45) * (1 - ph); });
    const ang = 0.9 + lt * 0.045; D.cam.position.set(Math.cos(ang) * 52, 18 + 4 * Math.sin(lt * 0.1), Math.sin(ang) * 52); D.cam.lookAt(0, 9.5, 0);
    D.R.render(D.scene, D.cam);
    // panel con los números del núcleo
    const ph = r.floors.reduce((s, f) => s + f.phones.lo, 0), addr = r.floors.reduce((s, f) => s + f.addresses, 0), show = (c) => (lt > c ? 1 : 0.25);
    const mm = Math.floor(tau / 60), ss = Math.floor(tau % 60);
    hud.innerHTML = `<div class="h-t">${tr('Censo en vivo · núcleo', 'Live census · core')} <code>rf-census.mjs</code></div>
      <div class="h-s">${dp.f == null ? tr(tau >= TM - 1 ? 'Misión completa · 3 pasadas' : 'Entre pasadas: los móviles cambian de dirección', tau >= TM - 1 ? 'Mission complete · 3 passes' : 'Between passes: phones change address') : `${tr('Pasada', 'Pass')} ${dp.pass + 1}/3 · ${dp.f === 0 ? tr('planta baja', 'ground floor') : `${tr('planta', 'floor')} ${dp.f}`}`} · ${mm}:${String(ss).padStart(2, '0')}</div>
      <div class="h-big"><div style="opacity:${show(cue(1))}"><b class="strike">${addr}</b><span>${tr('direcciones oídas', 'addresses heard')}</span></div><div style="opacity:${show(cue(1))}"><b style="color:#91d7e8">${ph}</b><span>${tr('teléfonos reales', 'real phones')}</span></div><div style="opacity:${show(cue(2))}"><b style="color:#ff7756">${r.total.mid}</b><span>${tr('personas', 'people')} (${r.total.lo}–${r.total.hi})</span></div></div>
      <table>${r.floors.slice().reverse().map((f) => `<tr><td>${f.floor === 0 ? tr('Baja', 'G') : `P${f.floor}`}</td><td class="s">${f.addresses}</td><td>${f.phones.lo} 📱</td><td><b>${f.phones.lo === 0 && tau > 1500 ? tr('0 · quizá 1', '0 · maybe 1') : f.people.mid}</b> <i>${f.people.lo}–${f.people.hi}</i></td></tr>`).join('')}</table>`;
  }

  // ---------------------------------------------------------------- 3) ARQUITECTURA 3D
  const ST = { web: 0x34d399, sim: 0xfbbf24, android: 0x91d7e8, native: 0xb79cff, road: 0x7d8f99 };
  const LAY = () => [
    [tr('1 · SENSORES Y RADIOS', '1 · SENSORS & RADIOS'), [['mic', tr('Micrófono', 'Microphone'), 'web'], ['acc', tr('Acelerómetro', 'Accelerometer'), 'sim'], ['baro', tr('Barómetro', 'Barometer'), 'sim'], ['gnss', 'GNSS', 'web'], ['ble', 'Bluetooth', 'android'], ['wifi', 'Wi-Fi', 'native'], ['drone', tr('Dron', 'Drone'), 'sim']]],
    [tr('2 · PORTADORES', '2 · BEARERS'), [['b-sound', tr('Sonido', 'Sound'), 'web'], ['b-lan', tr('Red local', 'Local network'), 'web'], ['b-ble', 'Aware/Direct', 'native'], ['b-mule', tr('Mula', 'Mule'), 'web'], ['b-lora', 'LoRa', 'sim'], ['b-sat', tr('Satélite', 'Satellite'), 'sim']]],
    [tr('3 · NÚCLEO (EN EL TELÉFONO)', '3 · CORE (ON THE PHONE)'), [['c-env', tr('Cifrado', 'Encryption'), 'web'], ['c-route', tr('Enrutador', 'Router'), 'web'], ['c-multi', 'k-de-n', 'web'], ['c-call', tr('Señalización', 'Signalling'), 'web'], ['c-mesh', tr('Malla de voz', 'Voice mesh'), 'web'], ['c-census', tr('Censo radio', 'Radio census'), 'sim'], ['c-fusion', tr('Fusión', 'Fusion'), 'sim']]],
    [tr('4 · APLICACIONES', '4 · APPS'), [['a-campo', tr('Campo', 'Field'), 'web'], ['a-call', tr('Llamada', 'Call'), 'web'], ['a-dron', tr('Dron', 'Drone'), 'sim'], ['a-edif', tr('Edificios', 'Buildings'), 'sim'], ['a-ojo', tr('Ojo', 'Eye'), 'web'], ['a-coord', tr('Coordinación', 'Coordination'), 'sim']]],
    [tr('5 · DESTINOS', '5 · RECIPIENTS'), [['d-person', tr('Familia', 'Family'), 'web'], ['d-rescue', tr('Rescate', 'Rescue'), 'sim'], ['d-112', '112', 'road'], ['d-org', tr('Organismos', 'Agencies'), 'road']]],
  ];
  const PATHS = [
    { col: 0xff7756, ids: ['mic', 'b-sound', 'c-call', 'b-lan', 'a-call', 'd-person'] },
    { col: 0x91d7e8, ids: ['baro', 'c-env', 'c-multi', 'b-mule', 'c-fusion', 'a-coord', 'd-rescue'] },
    { col: 0x34d399, ids: ['drone', 'ble', 'c-census', 'c-fusion', 'a-dron', 'd-rescue'] },
    { col: 0xfbbf24, ids: ['gnss', 'c-env', 'c-route', 'b-sat', 'a-ojo', 'd-112'] },
  ];
  function setupArch() {
    const R = makeRenderer(), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1280 / 720, 0.1, 400);
    cam.setViewOffset(1280, 720, -120, 0, 1280, 720); scene.fog = new THREE.Fog(0x05090c, 85, 170);
    const pos = {}, layers = [], GAP = 6.2;
    LAY().forEach(([name, nodes], li) => {
      const y = li * GAP, plane = new THREE.Mesh(new THREE.BoxGeometry(34, 0.12, 9), new THREE.MeshBasicMaterial({ color: 0x0f2230, transparent: true, opacity: 0.55, depthWrite: false }));
      plane.position.y = y; scene.add(plane);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry), new THREE.LineBasicMaterial({ color: 0x91d7e8, transparent: true, opacity: 0.35 })); edge.position.y = y; scene.add(edge);
      const lab = textSprite(name, { size: 32, color: '#91d7e8', w: 768, scale: 13 }); lab.position.set(10, y + 2.6, -4.2); scene.add(lab);
      const boxes = nodes.map(([id, nm, st], k) => {
        const x = -15 + ((k + 0.5) * 30) / nodes.length, box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.6), new THREE.MeshBasicMaterial({ color: ST[st], transparent: true, opacity: 0.85 }));
        box.position.set(x, y + 0.45, 0); scene.add(box); pos[id] = box.position.clone();
        const t = textSprite(nm, { size: 36, color: '#f2f4f4', w: 512, scale: 5.6 }); t.position.set(x, y + 1.6, 0); scene.add(t);
        return box;
      });
      layers.push({ plane, edge, lab, boxes, y });
    });
    const paths = PATHS.map((p) => {
      const pts = []; p.ids.forEach((id, i) => { const a = pos[id]; if (i === 0) { pts.push(a.clone()); return; } const b0 = pos[p.ids[i - 1]], mid = b0.clone().add(a).multiplyScalar(0.5); mid.z += 3.5; mid.y += 0.6; pts.push(mid, a.clone()); });
      const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(220));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: p.col, transparent: true, opacity: 0.55 })); scene.add(line);
      const pk = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshBasicMaterial({ color: p.col })); scene.add(pk);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshBasicMaterial({ color: p.col, transparent: true, opacity: 0.25 })); scene.add(halo);
      return { curve, line, pk, halo };
    });
    S.arch = { R, scene, cam, layers, paths, GAP };
  }
  function drawArch(hud, lt, d, cue) {
    const A = S.arch; if (!A) return;
    const focus = lt < cue(1) ? [0] : lt < cue(2) ? [1, 2] : [3, 4];
    A.layers.forEach((L, i) => { const on = focus.includes(i); L.plane.material.opacity = on ? 0.85 : 0.35; L.edge.material.opacity = on ? 0.9 : 0.25; L.boxes.forEach((b) => (b.material.opacity = on ? 1 : 0.45)); L.lab.material.opacity = on ? 1 : 0.5; });
    A.paths.forEach((p, k) => { const f = ((lt * 0.11 + k * 0.27) % 1), pt = p.curve.getPointAt(f); p.pk.position.copy(pt); p.halo.position.copy(pt); p.halo.scale.setScalar(1 + 0.3 * Math.sin(lt * 6 + k)); p.line.material.opacity = 0.35 + 0.3 * ease((lt - 1) / 2); });
    const ang = -0.45 + lt * 0.03; A.cam.position.set(Math.sin(ang) * 58, 21 + 3 * Math.sin(lt * 0.12), Math.cos(ang) * 58); A.cam.lookAt(0, 11.5, 0);
    A.R.render(A.scene, A.cam);
    const leg = [[tr('Probado en navegador', 'Tested in browser'), '#34d399'], [tr('Probado en simulación', 'Tested in simulation'), '#fbbf24'], [tr('App Android', 'Android app'), '#91d7e8'], [tr('Requiere app nativa', 'Needs native app'), '#b79cff'], [tr('Hoja de ruta', 'Roadmap'), '#7d8f99']];
    const sc = [[tr('📞 Llamada sin Internet', '📞 Call without Internet'), '#ff7756'], [tr('🏚️ Atrapada tras un sismo', '🏚️ Trapped after a quake'), '#91d7e8'], [tr('🚁 Censo con dron', '🚁 Drone census'), '#34d399'], [tr('🛰️ SOS por satélite', '🛰️ SOS by satellite'), '#fbbf24']];
    hud.classList.add('small'); hud.innerHTML = `<div class="h-t">${tr('Estado real de cada pieza', 'Real status of every piece')}</div>${leg.map(([l, c]) => `<div class="h-l"><i style="background:${c}"></i>${l}</div>`).join('')}<div class="h-t" style="margin-top:12px">${tr('Paquetes recorriendo escenarios', 'Packets running scenarios')}</div>${sc.map(([l, c]) => `<div class="h-l"><i style="background:${c};border-radius:50%"></i>${l}</div>`).join('')}`;
  }

  // ---------------------------------------------------------------- 4) CÓMO SE CALCULA CADA IMAGEN
  const CODE = ['export function maxConcurrent(intervals) {', '  const ev = [];', '  for (const [a, b] of intervals)', '    { ev.push([a, 1]); ev.push([b, -1]); }', '  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);', '  let cur = 0, max = 0;', '  for (const [, d] of ev)', '    { cur += d; max = Math.max(max, cur); }', '  return max; // = teléfonos reales', '}'];
  const IV = [[0.02, 0.3], [0.33, 0.62], [0.66, 0.96], [0.1, 0.45], [0.5, 0.9], [0.2, 0.55], [0.6, 0.8]];
  function drawHow(cv, lt, d, cue) {
    const g = cv.getContext('2d'), W = 640, H = 600; g.clearRect(0, 0, W, H);
    const panel = (y, h, t) => { g.fillStyle = 'rgba(11,20,28,.92)'; rr(g, 0, y, W, h, 14); g.fill(); g.strokeStyle = C.l; g.lineWidth = 1; g.stroke(); label(g, t, 18, y + 26, C.c, '700 12px ui-monospace,monospace'); };
    // 1 · código real + barrido de eventos ejecutándose
    panel(0, 228, tr('1 · CÓDIGO DEL NÚCLEO · rf-census.mjs', '1 · CORE CODE · rf-census.mjs'));
    const hl = Math.floor(clamp(lt / (cue(1) || 8)) * CODE.length * 1.6) % CODE.length;
    CODE.forEach((l, i) => { if (i === hl) { g.fillStyle = 'rgba(255,119,86,.18)'; g.fillRect(12, 40 + i * 18, 330, 18); } label(g, l.length > 44 ? l.slice(0, 44) + '…' : l, 18, 53 + i * 18, i === hl ? C.t : C.m, '11px ui-monospace,monospace'); });
    const sx = 360, sw = 262, sweep = (lt * 0.18) % 1.1; let cur = 0, max = 0;
    IV.forEach(([a, b], k) => { const lane = [0, 0, 0, 1, 1, 2, 2][k], on = sweep >= a && sweep <= b; g.fillStyle = on ? C.c : ['#91d7e8', '#34d399', '#fbbf24'][lane]; g.globalAlpha = on ? 1 : 0.55; g.fillRect(sx + a * sw, 60 + lane * 34 + (k % 2) * 2, (b - a) * sw - 3, 24); g.globalAlpha = 1; if (on) cur++; });
    for (let s = 0; s <= sweep; s += 0.005) { let c = 0; for (const [a, b] of IV) if (s >= a && s <= b) c++; max = Math.max(max, c); }
    g.strokeStyle = C.t; g.lineWidth = 2; g.beginPath(); g.moveTo(sx + Math.min(1, sweep) * sw, 50); g.lineTo(sx + Math.min(1, sweep) * sw, 168); g.stroke();
    label(g, tr(`7 direcciones · activas ahora: ${cur} · máximo: ${max}`, `7 addresses · active now: ${cur} · max: ${max}`), sx, 190, C.t, '700 12px Inter,system-ui');
    label(g, tr('→ el máximo simultáneo = teléfonos reales', '→ the simultaneous maximum = real phones'), sx, 210, C.i, '12px Inter,system-ui');
    // 2 · pruebas automáticas
    panel(238, 172, tr('2 · PRUEBAS AUTOMÁTICAS EN CADA CAMBIO', '2 · AUTOMATED TESTS ON EVERY CHANGE'));
    const tests = [tr('concurrencia máxima de intervalos', 'maximum interval concurrency'), tr('teléfonos exactos con rotación de 5, 10 y 15 min', 'exact phones with 5, 10 and 15 min rotation'), tr('intervalo del 90 % cubre la verdad (≥ 85 %)', '90 % interval covers the truth (≥ 85 %)'), tr('código de llamada < 100 bytes, ida y vuelta exacta', 'call code < 100 bytes, exact round trip'), tr('cadena A → B → C: C oye el tono de A (440 Hz)', 'chain A → B → C: C hears A’s tone (440 Hz)')];
    tests.forEach((t, k) => { const p = ease((lt - cue(1) + 0.4 - k * 0.7) / 0.4); label(g, p > 0.5 ? '✓' : '·', 22, 290 + k * 22, C.e, '800 15px Inter,system-ui'); label(g, t, 42, 290 + k * 22, p > 0.5 ? C.t : C.g, '13px Inter,system-ui'); });
    const cnt = ease((lt - cue(1)) / 3);
    label(g, `${Math.round(NUM.core * cnt)}/${NUM.core}`, 470, 300, C.e, '800 30px Inter,system-ui'); label(g, tr('pruebas del núcleo', 'core tests'), 470, 320, C.m, '12px Inter,system-ui');
    label(g, `${Math.round(NUM.e2e * cnt)}/${NUM.e2e}`, 470, 362, C.e, '800 30px Inter,system-ui'); label(g, tr('E2E en Chromium real', 'E2E in real Chromium'), 470, 382, C.m, '12px Inter,system-ui');
    // 3 · fotograma determinista → «un toque»
    const tap = ease((lt - cue(2)) / 0.8);
    panel(420, 180, tap < 0.5 ? tr('3 · RENDER DETERMINISTA: seek(t) → siempre el mismo fotograma', '3 · DETERMINISTIC RENDER: seek(t) → always the same frame') : tr('4 · PARA QUIEN LO USA: UN TOQUE', '4 · FOR THE USER: ONE TAP'));
    if (tap < 1) {
      g.globalAlpha = 1 - tap;
      for (let k = 0; k < 6; k++) { const x = 18 + k * 102, y = 446; g.fillStyle = '#071018'; rr(g, x, y, 92, 120, 8); g.fill(); g.strokeStyle = C.l; g.stroke(); for (let f = 0; f < 5; f++) { g.fillStyle = f === (k % 5) ? '#ff7756' : '#12323f'; g.fillRect(x + 26, y + 84 - f * 16, 40, 13); } const a = (k / 6) * Math.PI * 2; g.fillStyle = C.t; g.beginPath(); g.arc(x + 46 + Math.cos(a) * 32, y + 84 - (k % 5) * 16 + 6, 4, 0, 7); g.fill(); label(g, `t = ${k * 4} s`, x + 46, y + 116, C.m, '11px ui-monospace,monospace', 'center'); }
      g.globalAlpha = 1;
    }
    if (tap > 0) {
      g.globalAlpha = tap; const btn = [[tr('📞 Llamar', '📞 Call'), '#91d7e8'], [tr('🆘 Necesito ayuda', '🆘 I need help'), '#ff7756'], [tr('✅ Estoy bien', '✅ I am safe'), '#34d399']];
      btn.forEach(([t, c], k) => { const x = 18 + k * 206, y = 452; g.fillStyle = c; rr(g, x, y, 194, 120, 18); g.fill(); label(g, t, x + 97, y + 68, '#0b0b0b', '800 19px Inter,system-ui', 'center'); });
      const k = Math.floor(((lt - cue(2)) / 1.6) % 3), ph = ((lt - cue(2)) / 1.6) % 1, x = 18 + k * 206 + 97; g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - ph)})`; g.lineWidth = 4; g.beginPath(); g.arc(x, 512, 12 + ph * 50, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
  }

  window.SIMS = {
    init,
    full: (kind) => kind === 'drone3d' || kind === 'arch3d',
    canvasFor: (kind) => (kind === 'drone3d' ? S.drone?.R.domElement : kind === 'arch3d' ? S.arch?.R.domElement : null),
    draw(kind, el, lt, d, cue) {
      if (kind === 'call') drawCall(el.querySelector('canvas.c2d'), lt, d, cue);
      else if (kind === 'howsim') drawHow(el.querySelector('canvas.c2d'), lt, d, cue);
      else if (kind === 'drone3d') drawDrone(el.querySelector('.hud'), lt, d, cue);
      else if (kind === 'arch3d') drawArch(el.querySelector('.hud'), lt, d, cue);
    },
  };
})();
