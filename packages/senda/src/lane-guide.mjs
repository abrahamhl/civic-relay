// @ts-check
/**
 * SENDA · guía de carriles minimalista. Datos: carriles de la intersección de cada maniobra que devuelve OSRM
 * (`step.intersections[0].lanes`: indicaciones por carril de izquierda a derecha y si el carril es válido para la ruta),
 * que proceden de las etiquetas `turn:lanes` de OpenStreetMap. Si OSM no las tiene, no se dibuja nada (no se inventan carriles).
 */
const ARROW = { left: -90, 'sharp left': -135, 'slight left': -40, straight: 0, 'slight right': 40, right: 90, 'sharp right': 135, uturn: 180, none: 0 };

/** Resumen en palabras: «3 carriles · usa los 2 de la derecha». lanes: [{ indications: string[], valid: boolean }] */
export function laneGuide(lanes) {
  if (!Array.isArray(lanes) || !lanes.length) return null;
  const n = lanes.length, idx = lanes.map((l, i) => (l.valid ? i : -1)).filter((i) => i >= 0);
  if (!idx.length || idx.length === n) return { count: n, valid: idx, text: `${n} carril${n > 1 ? 'es' : ''}${idx.length === n && n > 1 ? ' · cualquiera vale' : ''}` };
  const k = idx.length, first = idx[0], last = idx[idx.length - 1], contiguous = last - first + 1 === k;
  let where;
  if (contiguous && first === 0) where = k === 1 ? 'el de la izquierda' : `los ${k} de la izquierda`;
  else if (contiguous && last === n - 1) where = k === 1 ? 'el de la derecha' : `los ${k} de la derecha`;
  else if (k === 1) where = `el ${first + 1}.º empezando por la izquierda`;
  else where = `los carriles ${idx.map((i) => i + 1).join(', ')} (desde la izquierda)`;
  return { count: n, valid: idx, text: `${n} carriles · usa ${where}` };
}

/** Pictograma SVG: una banda de carriles con su flecha; los válidos en blanco, el resto atenuados. */
export function laneSvg(lanes, { laneW = 30, h = 40, valid = '#ffffff', dim = 'rgba(255,255,255,.3)' } = {}) {
  if (!Array.isArray(lanes) || !lanes.length) return '';
  const w = lanes.length * laneW, f = (n) => n.toFixed(1);
  const parts = lanes.map((l, i) => {
    const cx = i * laneW + laneW / 2, col = l.valid ? valid : dim, ind = l.indications?.length ? l.indications : ['straight'];
    const arrows = ind.map((d) => {
      const a = ((ARROW[d] ?? 0) * Math.PI) / 180, bendY = a === 0 ? 8 : 20, len = a === 0 ? 0 : 11;
      const ex = cx + Math.sin(a) * len, ey = bendY - Math.cos(a) * len, hx = Math.sin(a), hy = -Math.cos(a), px = -hy, py = hx, k = 6;
      const head = `${f(ex + hx * k)},${f(ey + hy * k)} ${f(ex + px * k * 0.8)},${f(ey + py * k * 0.8)} ${f(ex - px * k * 0.8)},${f(ey - py * k * 0.8)}`;
      return `<path d="M${cx} ${h - 4} L${cx} ${bendY}${len ? ` Q${cx} ${bendY - 6} ${f(ex)} ${f(ey)}` : ''}" fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round"/><polygon points="${head}" fill="${col}"/>`;
    }).join('');
    const sep = i ? `<line x1="${i * laneW}" y1="3" x2="${i * laneW}" y2="${h - 3}" stroke="rgba(255,255,255,.45)" stroke-width="1.6" stroke-dasharray="5 4"/>` : '';
    return sep + arrows;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${laneGuide(lanes)?.text ?? ''}">${parts}</svg>`;
}
