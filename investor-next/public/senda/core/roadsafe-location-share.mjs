/**
 * SENDA RoadSafe · Compartir la ubicación en segundos, por cualquier canal, en un formato que el 112 entiende.
 *
 * Formatos: coordenadas decimales con precisión, Open Location Code / Plus Code (algoritmo abierto,
 * Apache-2.0; sin servicio externo), carretera + PK + sentido (lo que pregunta el 112), URI geo: (RFC 5870),
 * enlace sms: con el texto listo y tel:112. what3words NO se usa (propietario).
 * El texto SMS cabe en 160 caracteres GSM-7 (sin tildes si hace falta) para funcionar con mala cobertura.
 */

const OLC = '23456789CFGHJMPQRVWX';
/** Plus Code de 10 dígitos (~14 × 14 m). */
export function plusCode(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('coordenadas no válidas');
  let la = Math.min(Math.max(lat, -90), 90) + 90, lo = ((((lon + 180) % 360) + 360) % 360);
  if (la >= 180) la = 180 - 1e-10;
  let code = '', res = 20;
  for (let i = 0; i < 5; i++) {
    const dLa = Math.floor(la / res), dLo = Math.floor(lo / res);
    la -= dLa * res; lo -= dLo * res; code += OLC[dLa] + OLC[dLo];
    if (i === 3) code += '+';
    res /= 20;
  }
  return code;
}
/** Decodificación del centro de un Plus Code de 10 dígitos (para verificar). */
export function plusCodeCenter(code) {
  const c = code.replace('+', '').toUpperCase(); if (c.length !== 10) throw new Error('solo códigos de 10 dígitos');
  let la = -90, lo = -180, res = 20;
  for (let i = 0; i < 10; i += 2) { la += OLC.indexOf(c[i]) * res; lo += OLC.indexOf(c[i + 1]) * res; res /= 20; }
  res *= 20; return { lat: +(la + res / 2).toFixed(6), lon: +(lo + res / 2).toFixed(6) };
}

const toGsm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E\n]/g, '');

/**
 * Paquete de ubicación para compartir. fix: { lat, lon, accuracyM, at }, road?: { roadId, pk, sentido, towards }
 * info?: { kind, people, injured, trapped, fire }
 */
export function locationPackage(fix, { road = null, info = {}, lang = 'es' } = {}) {
  const pc = plusCode(fix.lat, fix.lon), coords = `${fix.lat.toFixed(5)},${fix.lon.toFixed(5)}`;
  const hhmm = fix.at ? new Date(fix.at * 1000).toISOString().slice(11, 16) + 'Z' : '';
  const where = road ? `${road.roadId}${road.pk != null ? ` PK ${String(road.pk).replace('.', ',')}` : ''}${road.sentido ? ` sentido ${road.sentido}` : ''}` : '';
  const kind = { BREAKDOWN: 'AVERIA', CRASH: 'ACCIDENTE', SECONDARY: 'ALCANCE' }[info.kind] ?? 'INCIDENTE';
  const parts = [`SOS SENDA ${kind}`, where, `${coords}${fix.accuracyM ? ` (+-${Math.round(fix.accuracyM)}m)` : ''}`, pc, info.people != null ? `${info.people} pers` : '', info.injured ? `${info.injured} herid` : '', info.trapped ? `${info.trapped} atrap` : '', info.fire ? 'FUEGO' : '', hhmm].filter(Boolean);
  let sms = toGsm(parts.join(' - ')); if (sms.length > 160) sms = toGsm(parts.filter((p, i) => i !== 3).join(' - ')).slice(0, 160);
  return {
    coords, accuracyM: fix.accuracyM ?? null, plusCode: pc, roadText: where || null,
    geoUri: `geo:${fix.lat.toFixed(6)},${fix.lon.toFixed(6)}${fix.accuracyM ? `;u=${Math.round(fix.accuracyM)}` : ''}`,
    sms, smsHref: `sms:?&body=${encodeURIComponent(sms)}`, tel112: 'tel:112',
    spoken: lang === 'es' ? `Estoy en ${where || 'una carretera sin identificar'}. Coordenadas ${fix.lat.toFixed(5).replace('.', ' coma ')} y ${fix.lon.toFixed(5).replace('.', ' coma ')}. Código ${pc.split('').join(' ')}.` : `I am at ${where || 'an unidentified road'}. Coordinates ${coords}. Code ${pc}.`,
    warnings: [fix.accuracyM > 50 ? 'Precisión baja: confirma carretera, PK y sentido de viva voz.' : null, !road ? 'Sin carretera/PK: dilo con referencias visibles.' : null].filter(Boolean),
  };
}
