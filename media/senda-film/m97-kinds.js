// SENDA · escenas nuevas de la película m97 (deterministas: todo depende solo del tiempo local `lt`).
// Técnicas inspiradas en los «comandos» de vídeo explicativo (gráfico que se construye, despiece por capas,
// ruta animada en un mapa, gráficos minimalistas con puntos en movimiento) hechas con canvas 2D y datos reales.
(() => {
  const C = { bg: '#07111a', card: '#0a1722', line: '#223c50', t: '#eef3f4', m: '#93a7b1', c: '#ff7756', e: '#34d399', i: '#91d7e8', a: '#fbbf24', r: '#ff5b6e', v: '#b48cff' };
  const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const S = { borders: null, img: {} };
  const tr = (o) => (typeof o === 'string' ? o : o?.[document.documentElement.lang] ?? o?.es ?? o?.en ?? '');
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function setup(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(640 * dpr)) { cv.width = Math.round(640 * dpr); cv.height = Math.round(600 * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 640, 600);
    g.fillStyle = C.bg; rr(g, 0, 0, 640, 600, 16); g.fill(); g.strokeStyle = '#132636'; g.lineWidth = 1; g.stroke();
    return g;
  }
  function wrap(g, text, x, y, maxW, lh) {
    const words = String(text).split(' '); let line = '', yy = y;
    for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
    if (line) g.fillText(line, x, yy); return yy + lh;
  }
  function head(g, kick, tag, title) {
    g.font = '700 12px ui-monospace,monospace'; g.fillStyle = C.c; g.fillText(kick.toUpperCase(), 22, 34);
    if (tag) { g.font = '700 11px ui-monospace,monospace'; const w = g.measureText(tag.toUpperCase()).width + 18; g.strokeStyle = 'rgba(251,191,36,.55)'; rr(g, 618 - w, 20, w, 22, 11); g.stroke(); g.fillStyle = C.a; g.fillText(tag.toUpperCase(), 627 - w, 35); }
    g.font = '700 19px Inter,system-ui'; g.fillStyle = C.t; wrap(g, title, 22, 66, 596, 24);
  }
  function foot(g, text) { g.font = '12px Inter,system-ui'; g.fillStyle = C.m; wrap(g, '✓ ' + text, 22, 572, 596, 15); }

  /* ── graph: barras que se construyen solas (escala lineal o logarítmica) ── */
  function drawGraph(cv, lt, d, v) {
    const g = setup(cv); head(g, tr(v.kick), tr(v.tag), tr(v.title));
    const bars = v.bars, x0 = 22, x1 = 618, y0 = 118, rowH = Math.min(86, (520 - y0) / bars.length);
    const vals = bars.map((b) => (v.log ? Math.log10(b.value) : b.value)), lo = v.log ? Math.min(...vals) - 0.6 : 0, hi = Math.max(...vals);
    bars.forEach((b, i) => {
      const p = ease((lt - 0.6 - i * 0.9) / 1.1), y = y0 + i * rowH, frac = ((vals[i] - lo) / (hi - lo || 1)) * p;
      g.globalAlpha = Math.min(1, p * 2); g.font = '600 15px Inter,system-ui'; g.fillStyle = C.t; g.fillText(tr(b.label), x0, y + 18);
      g.fillStyle = '#0f2232'; rr(g, x0, y + 28, x1 - x0, 22, 6); g.fill();
      g.fillStyle = b.color ?? C.e; rr(g, x0, y + 28, Math.max(6, (x1 - x0 - 170) * frac), 22, 6); g.fill();
      g.font = '800 17px ui-monospace,monospace'; g.fillStyle = b.color ?? C.e; g.fillText(tr(b.shown), x0 + Math.max(6, (x1 - x0 - 170) * frac) + 10, y + 45);
      if (b.note) { g.font = '12px Inter,system-ui'; g.fillStyle = C.m; g.fillText(tr(b.note), x0, y + 68); }
      g.globalAlpha = 1;
    });
    foot(g, tr(v.foot));
  }

  /* ── breakdown: despiece por capas de lo que viaja ── */
  function drawBreakdown(cv, lt, d, v) {
    const g = setup(cv); head(g, tr(v.kick), tr(v.tag), tr(v.title));
    const L = v.layers, n = L.length, open = ease((lt - 1.2) / 2.2), top = 104;
    L.forEach((l, i) => {
      const p = ease((lt - 0.4 - i * 0.55) / 0.8), y = top + i * (54 + 14 * open) + (1 - open) * (n - 1 - i) * -8, w = 360 - i * 18 * (1 - open);
      g.globalAlpha = p; g.fillStyle = C.card; rr(g, 22, y, w, 48, 10); g.fill(); g.strokeStyle = l.color ?? C.i; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = l.color ?? C.i; g.font = '700 14px Inter,system-ui'; g.fillText(tr(l.label), 36, y + 20);
      g.fillStyle = C.m; g.font = '12px Inter,system-ui'; g.fillText(tr(l.note), 36, y + 38);
      g.font = '800 16px ui-monospace,monospace'; g.fillStyle = C.t; g.fillText(tr(l.size), 22 + w + 14 * open + 6, y + 30);
      g.globalAlpha = 1;
    });
    const pr = ease((lt - (0.6 + n * 0.55 + 1.6)) / 0.8);
    if (pr > 0) {
      g.globalAlpha = pr; const y = 498; g.fillStyle = '#0b1a26'; rr(g, 22, y - 26, 596, 66, 10); g.fill();
      g.fillStyle = C.a; g.font = '700 12px ui-monospace,monospace'; g.fillText(tr(v.seenLabel).toUpperCase(), 34, y - 8);
      let s = 1234567; const hx = []; for (let k = 0; k < 34; k++) { s = (s * 16807) % 2147483647; hx.push((s % 256).toString(16).padStart(2, '0')); }
      g.fillStyle = C.i; g.font = '600 13px ui-monospace,monospace'; g.fillText(hx.join(' ').slice(0, 74), 34, y + 14); g.fillText(hx.reverse().join(' ').slice(0, 74), 34, y + 32); g.globalAlpha = 1;
    }
    foot(g, tr(v.foot));
  }

  /* ── route: ruta animada sobre el mapa (Natural Earth) ── */
  function drawRoute(cv, lt, d, v) {
    const g = setup(cv); head(g, tr(v.kick), tr(v.tag), tr(v.title));
    const [lo0, lo1, la0, la1] = v.bbox, X = (lo) => 22 + ((lo - lo0) / (lo1 - lo0)) * 596, Y = (la) => 100 + ((la1 - la) / (la1 - la0)) * 420;
    g.save(); rr(g, 22, 100, 596, 420, 10); g.clip(); g.fillStyle = '#081621'; g.fillRect(22, 100, 596, 420);
    if (S.borders) { g.strokeStyle = 'rgba(145,215,232,.28)'; g.lineWidth = 1; for (const line of S.borders) { g.beginPath(); line.forEach(([lo, la], k) => (k ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la)))); g.stroke(); } }
    g.restore();
    const P = v.points.map((p) => ({ ...p, x: X(p.lon), y: Y(p.lat) })), segs = P.length - 1;
    const prog = Math.min(segs, Math.max(0, (lt - 1.0) / ((d - 3) / segs)));
    for (let k = 0; k < segs; k++) {
      const a = P[k], b = P[k + 1], f = Math.max(0, Math.min(1, prog - k)); if (f <= 0) continue;
      g.strokeStyle = b.color ?? C.c; g.lineWidth = 3; g.setLineDash(b.dash ? [7, 7] : []); g.beginPath(); g.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 40; for (let s = 0; s <= 30 * f; s++) { const u = s / 30; g.lineTo((1 - u) ** 2 * a.x + 2 * (1 - u) * u * mx + u * u * b.x, (1 - u) ** 2 * a.y + 2 * (1 - u) * u * my + u * u * b.y); } g.stroke(); g.setLineDash([]);
      if (f < 1) { const u = f; g.fillStyle = C.t; g.beginPath(); g.arc((1 - u) ** 2 * a.x + 2 * (1 - u) * u * mx + u * u * b.x, (1 - u) ** 2 * a.y + 2 * (1 - u) * u * my + u * u * b.y, 5, 0, 7); g.fill(); }
      if (f >= 1 && b.leg) { g.font = '600 12px Inter,system-ui'; g.fillStyle = b.color ?? C.c; g.fillText(tr(b.leg), (a.x + b.x) / 2 - 40, my + 8); }
    }
    P.forEach((p, k) => { const on = prog >= k - 0.02; g.globalAlpha = on ? 1 : 0.35; g.fillStyle = p.color ?? C.i; g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill(); g.fillStyle = C.t; g.font = '700 13px Inter,system-ui'; g.fillText(tr(p.label), p.x + (p.dx ?? 10), p.y + (p.dy ?? -10)); g.globalAlpha = 1; });
    foot(g, tr(v.foot));
  }

  /* ── formulas: la ciencia, tarjeta a tarjeta, con puntos que fluyen al núcleo ── */
  function drawFormulas(cv, lt, d, v) {
    const g = setup(cv); head(g, tr(v.kick), tr(v.tag), tr(v.title));
    const F = v.items, cols = 2, cw = 291, ch = Math.min(96, 440 / Math.ceil(F.length / cols) - 8);
    F.forEach((f, i) => {
      const x = 22 + (i % cols) * (cw + 14), y = 102 + Math.floor(i / cols) * (ch + 8), p = ease((lt - 0.5 - i * ((d - 4) / F.length)) / 0.7);
      g.globalAlpha = 0.15 + 0.85 * p; g.fillStyle = C.card; rr(g, x, y, cw, ch, 10); g.fill(); g.strokeStyle = p > 0.95 ? (f.color ?? C.i) : C.line; g.lineWidth = 1; g.stroke();
      g.fillStyle = f.color ?? C.i; g.font = '700 12px ui-monospace,monospace'; g.fillText(tr(f.name).toUpperCase(), x + 12, y + 20);
      g.fillStyle = C.t; g.font = '600 13px ui-monospace,monospace'; g.fillText(f.eq, x + 12, y + 41);
      g.fillStyle = C.m; g.font = '11.5px Inter,system-ui'; wrap(g, tr(f.gives), x + 12, y + 60, cw - 24, 14);
      g.globalAlpha = 1;
    });
    foot(g, tr(v.foot));
  }

  /* ── rivals: con quién nos comparan y cómo nos sumamos ── */
  function drawRivals(cv, lt, d, v) {
    const g = setup(cv); head(g, tr(v.kick), tr(v.tag), tr(v.title));
    const R = v.rows, y0 = 108, rh = Math.min(70, 430 / R.length);
    g.font = '700 11px ui-monospace,monospace'; g.fillStyle = C.m; g.fillText(tr(v.cols[0]).toUpperCase(), 22, y0); g.fillText(tr(v.cols[1]).toUpperCase(), 210, y0); g.fillText(tr(v.cols[2]).toUpperCase(), 420, y0);
    R.forEach((r, i) => {
      const p = ease((lt - 0.6 - i * ((d - 4) / R.length)) / 0.6), y = y0 + 14 + i * rh; g.globalAlpha = p;
      g.strokeStyle = '#16303f'; g.beginPath(); g.moveTo(22, y); g.lineTo(618, y); g.stroke();
      g.fillStyle = C.t; g.font = '700 14px Inter,system-ui'; g.fillText(r.name, 22, y + 20); g.fillStyle = C.m; g.font = '11px Inter,system-ui'; g.fillText(tr(r.what), 22, y + 36);
      g.fillStyle = C.m; g.font = '11.5px Inter,system-ui'; wrap(g, tr(r.gap), 210, y + 19, 196, 13);
      g.fillStyle = C.e; wrap(g, tr(r.join), 420, y + 19, 198, 13);
      g.globalAlpha = 1;
    });
    foot(g, tr(v.foot));
  }

  /* ── ticks: el chat de siempre, con tics que se pueden comprobar ── */
  function drawTicks(cv, lt, d, v) {
    const g = setup(cv); head(g, tr(v.kick), tr(v.tag), tr(v.title));
    const B = v.bubbles; let y = 104;
    B.forEach((b, i) => {
      const p = ease((lt - 0.5 - i * 1.1) / 0.6); if (p <= 0) return; g.globalAlpha = p;
      const w = 300, h = b.img ? 128 : 52, x = b.me ? 618 - w : 22;
      g.fillStyle = b.me ? '#0f3b2c' : '#13212c'; rr(g, x, y, w, h, 12); g.fill();
      if (b.img && S.img[b.img]) g.drawImage(S.img[b.img], x + 10, y + 10, 160, 90);
      g.fillStyle = C.t; g.font = '14px Inter,system-ui'; wrap(g, tr(b.text), b.img ? x + 180 : x + 12, b.img ? y + 26 : y + 22, b.img ? 110 : w - 24, 16);
      const stage = Math.min(b.ticks?.length ?? 0, Math.floor(Math.max(0, lt - 1.2 - i * 1.1) / 1.4) + 1);
      if (b.ticks) { const tk = b.ticks[Math.max(0, stage - 1)]; g.font = '700 12px Inter,system-ui'; g.fillStyle = tk.c === 'blue' ? C.i : C.m; g.fillText(tr(tk.l), x + 12, y + h - 10); }
      g.globalAlpha = 1; y += h + 12;
    });
    foot(g, tr(v.foot));
  }

  window.M97 = {
    async init(script) {
      if (script.scenes.some((s) => s.visual.kind === 'route')) S.borders = (await (await fetch('/senda/data/radar/fronteras-110m.json')).json()).lineas;
      const imgs = new Set(script.scenes.flatMap((s) => (s.visual.bubbles ?? []).map((b) => b.img).filter(Boolean)));
      await Promise.all([...imgs].map((f) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = () => { S.img[f] = im; ok(); }; im.src = `assets/${f}`; })));
    },
    draw(kind, el, lt, d, cue, v) {
      const cv = el.querySelector('canvas.c2d'); if (!cv) return;
      if (kind === 'graph') drawGraph(cv, lt, d, v); else if (kind === 'breakdown') drawBreakdown(cv, lt, d, v); else if (kind === 'route') drawRoute(cv, lt, d, v);
      else if (kind === 'formulas') drawFormulas(cv, lt, d, v); else if (kind === 'rivals') drawRivals(cv, lt, d, v); else if (kind === 'ticks') drawTicks(cv, lt, d, v);
    },
  };
})();
