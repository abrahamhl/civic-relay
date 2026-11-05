/**
 * SENDA · Cámaras públicas: solo las que la ley y su licencia permiten, para ver la carretera, el monte
 * y el agua, nunca a las personas.
 *
 * Qué se integra: cámaras de tráfico y de paisaje que un organismo publica para que se reutilicen
 * (DGT, Open Data Euskadi, Generalitat de Catalunya…), con su licencia, su frecuencia y su ubicación.
 * Qué NO, por diseño: cámaras privadas sin protección indexadas en buscadores (entrar en ellas es un
 * acceso ilícito a un sistema), agregadores de datos personales tipo «Ojo de Dios», reconocimiento
 * facial y lectura de matrículas. En Países Bajos, Rijkswaterstaat no publica sus cámaras: solo las
 * ve su central de tráfico (RGPD), así que allí únicamente cabe un convenio para emergencias.
 *
 * Qué se mide en una imagen, sin personas: la VISIBILIDAD. Con el modelo de dispersión atmosférica
 * (I = J·t + A·(1 − t), t = e^(−β·d)) y la ley de Koschmieder (V = 3,912 / β), basta un objeto oscuro a
 * distancia conocida en el encuadre (calibrado una vez por cámara) para estimar en metros cuánto se ve.
 * La transmisión t se obtiene con el «canal oscuro» (He, Sun y Tang, 2009). Esa visibilidad entra en
 * `safeSpeedForVisibility` y en el aviso de niebla para los que se acercan a esa cámara.
 * Para el humo de incendios, mejor un modelo entrenado abierto (Pyronear, Apache 2.0) que un umbral.
 */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export const CAMERA_SOURCES = Object.freeze([
  { id: 'dgt', country: 'ES', operator: 'DGT (red estatal salvo País Vasco y Cataluña)', what: 'Ubicaciones de las cámaras en DATEX II v3.6; el conjunto antiguo con imagen en tiempo real queda obsoleto el 12-01-2026', license: 'Punto de Acceso Nacional (gratuito); licencia exacta pendiente de confirmar en la ficha', access: 'PASIVO', url: 'https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-6-nuevo' },
  { id: 'euskadi', country: 'ES', operator: 'Open Data Euskadi (7 administraciones vascas)', what: 'Listado de cámaras con URL de la imagen y localización (CSV, XML, JSON, GeoJSON) y API REST', license: 'CC BY 4.0 según el catálogo (confirmar en el conjunto)', access: 'PASIVO', url: 'https://datos.gob.es/es/iniciativas/open-data-euskadi' },
  { id: 'catalunya', country: 'ES', operator: 'Generalitat de Catalunya', what: 'Cámaras de tráfico en carreteras catalanas con su PK (XML)', license: 'Reutilización citando fuente y fecha (pendiente de verificar en el portal oficial)', access: 'PASIVO', url: 'https://wiki.openstreetmap.org/wiki/Ca:Import_Generalitat_de_Catalunya' },
  { id: 'madrid', country: 'ES', operator: 'Ayuntamiento de Madrid (Informo)', what: '~270 cámaras con captura de los últimos minutos', license: 'Licencia de las imágenes no confirmada', access: 'CONVENIO', url: 'https://diario.madrid.es/blog/notas-de-prensa/arranca-la-renovada-web-de-informacion-del-trafico/' },
  { id: 'rws', country: 'NL', operator: 'Rijkswaterstaat', what: 'Las cámaras solo se ven en la central de tráfico; no se graban ni se publican (RGPD)', license: 'No públicas', access: 'CONVENIO', url: 'https://www.rijkswaterstaat.nl/wegen/wegbeheer/onderzoek/verkeersonderzoek/wat-doet-rijkswaterstaat-met-camerabeelden' },
  { id: 'pyronear', country: 'UE', operator: 'Pyronear (código abierto)', what: 'Modelos y plataforma de detección temprana de humo en cámaras propias o de socios', license: 'Apache 2.0', access: 'PASIVO', url: 'https://github.com/pyronear/PyroNear' },
  { id: 'propias', country: '—', operator: 'Cámara SENDA en un punto de rebote (ESP32-CAM o móvil viejo)', what: 'Solo paisaje (humo, nivel del río, nieve), sin enfocar la vía pública ni a personas', license: 'Propia', access: 'PASIVO', url: null },
  { id: 'abiertas-sin-permiso', country: '—', operator: 'Cámaras privadas sin contraseña indexadas en buscadores', what: 'Entrar es un acceso ilícito a un sistema y una intromisión en la intimidad', license: '—', access: 'NUNCA', url: null },
  { id: 'ojo-de-dios', country: '—', operator: 'Agregadores de datos personales («Ojo de Dios» y similares)', what: 'Localizan y perfilan a personas', license: '—', access: 'NUNCA', url: null },
  { id: 'biometria', country: '—', operator: 'Reconocimiento facial o de matrículas', what: 'Identificar personas o vehículos', license: '—', access: 'NUNCA', url: null },
]);

/** Cámaras a menos de `bufferKm` de la ruta (lista local de cámaras con lat/lon), en orden de paso. */
export function camerasAlong(cams, route, { bufferKm = 1 } = {}) {
  const R = 6371e3, rad = Math.PI / 180, lat0 = route[0].lat * rad, X = (p) => ({ x: p.lon * rad * Math.cos(lat0) * R, y: p.lat * rad * R }), xy = route.map(X), cum = [0];
  for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
  return cams.map((c) => { const q = X(c); let best = { d: Infinity, s: 0 }; for (let i = 1; i < xy.length; i++) { const a = xy[i - 1], b = xy[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, u = clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / l2), d = Math.hypot(q.x - a.x - u * dx, q.y - a.y - u * dy); if (d < best.d) best = { d, s: cum[i - 1] + u * Math.sqrt(l2) }; } return { ...c, offKm: +(best.d / 1000).toFixed(2), alongKm: +(best.s / 1000).toFixed(1) }; })
    .filter((c) => c.offKm <= bufferKm).sort((a, b) => a.alongKm - b.alongKm);
}

// ---------------------------------------------------------------- Visibilidad por el canal oscuro y Koschmieder
/** Canal oscuro: mínimo de R, G y B en una ventana (normalizado 0..1). */
export function darkChannel(rgba, w, h, { patch = 5 } = {}) {
  const m = new Float32Array(w * h), out = new Float32Array(w * h), r = patch >> 1;
  for (let i = 0; i < w * h; i++) m[i] = Math.min(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]) / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 1; for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) v = Math.min(v, m[j * w + i]); out[y * w + x] = v; }
  return out;
}
/** Luz atmosférica A: media de los píxeles con el canal oscuro más alto (el 0,5 % más brillante del cielo/niebla). */
export function atmosphericLight(rgba, dc) {
  const idx = [...dc.keys()].sort((a, b) => dc[b] - dc[a]).slice(0, Math.max(1, Math.round(dc.length * 0.005)));
  return idx.reduce((s, i) => s + (rgba[4 * i] + rgba[4 * i + 1] + rgba[4 * i + 2]) / 3 / 255, 0) / idx.length;
}
/** V = 3,912 / β, con β = −ln(t) / d (contraste mínimo del 2 % de Koschmieder). */
export const visibilityKoschmieder = (t, dRefM) => { const tt = clamp(t, 1e-4, 0.9999), beta = -Math.log(tt) / dRefM; return { betaPerM: beta, visM: 3.912 / beta }; };
/**
 * Visibilidad estimada en una imagen con una zona de referencia oscura a distancia conocida.
 * @param {{x,y,w,h,distM}} ref zona calibrada una vez por cámara (un poste, una señal, el borde de un bosque)
 */
export function estimateVisibility(rgba, w, h, ref, { patch = 5 } = {}) {
  const dc = darkChannel(rgba, w, h, { patch }), A = atmosphericLight(rgba, dc);
  let s = 0, n = 0; for (let y = ref.y; y < ref.y + ref.h; y++) for (let x = ref.x; x < ref.x + ref.w; x++) { s += dc[y * w + x]; n++; }
  const t = clamp(1 - s / n / Math.max(1e-3, A), 1e-4, 0.9999), v = visibilityKoschmieder(t, ref.distM);
  return { A: +A.toFixed(3), t: +t.toFixed(3), visM: Math.round(v.visM) };
}
/** Fracción de suelo blanco y poco saturado en la mitad inferior: indicio de nieve en la calzada. */
export function snowIndex(rgba, w, h) {
  let snow = 0, n = 0;
  for (let y = h >> 1; y < h; y++) for (let x = 0; x < w; x++) { const i = 4 * (y * w + x), r = rgba[i] / 255, gg = rgba[i + 1] / 255, b = rgba[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); n++; if (mx > 0.78 && (mx - mn) / (mx || 1) < 0.15) snow++; }
  return +(snow / n).toFixed(3);
}

/**
 * Escena SINTÉTICA de carretera con niebla para probar el método: cielo, asfalto, arcén y objetos
 * oscuros a 30, 60, 120 y 250 m, oscurecidos por el modelo de dispersión con la visibilidad dada.
 */
export function fogScene({ w = 160, h = 100, visM = 120, snow = false } = {}) {
  const rgba = new Uint8ClampedArray(w * h * 4), beta = 3.912 / visM, A = 0.86, horizon = Math.round(h * 0.42);
  const objs = [{ d: 30, x: 18, s: 20 }, { d: 60, x: 52, s: 13 }, { d: 120, x: 92, s: 9 }, { d: 250, x: 124, s: 6 }];
  const put = (x, y, J, d) => { const t = Math.exp(-beta * d), i = 4 * (y * w + x); for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(255 * clamp(J[c] * t + A * (1 - t))); rgba[i + 3] = 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (y < horizon) put(x, y, [0.86, 0.86, 0.86], 1e6);
    else { const d = Math.min(400, 6 * (h - horizon) / Math.max(0.5, y - horizon + 0.5)), road = Math.abs(x - w / 2) < (y - horizon) * 0.9 + 2; put(x, y, snow && !road ? [0.95, 0.95, 0.96] : road ? [0.32, 0.33, 0.35] : [0.28, 0.42, 0.22], d); }
  }
  const refs = objs.map((o) => { const yb = horizon + Math.round(6 * (h - horizon) / (o.d / 1)) , y0 = Math.max(0, Math.min(h - 1, horizon - o.s + 2)); return { x: o.x, y: y0, w: Math.max(3, o.s >> 1), h: o.s, distM: o.d, yb }; });
  for (const r of refs) for (let y = r.y; y < Math.min(h, r.y + r.h); y++) for (let x = r.x; x < Math.min(w, r.x + r.w); x++) put(x, y, [0.04, 0.04, 0.05], r.distM);
  return { rgba, w, h, refs: refs.map(({ yb, ...r }) => r), visM };
}
/** Con varias referencias calibradas, usa la que tiene la transmisión más informativa (más cerca de 0,5). */
export function estimateVisibilityMulti(rgba, w, h, refs, opts) {
  const all = refs.map((r) => ({ ...estimateVisibility(rgba, w, h, r, opts), distM: r.distM }));
  const ok = all.filter((e) => e.t > 0.03 && e.t < 0.95), best = (ok.length ? ok : all).sort((a, b) => Math.abs(a.t - 0.5) - Math.abs(b.t - 0.5))[0];
  return { ...best, all };
}
