/**
 * SENDA RoadSafe · Avisos por voz tipo «megafonía de metro» para el conductor que se acerca.
 *
 * Como en el metro («próxima estación…», «atención al hueco…»), el conductor recibe frases cortas,
 * previsibles y escalonadas por distancia — sin mirar la pantalla. Reglas:
 *  1. Solo DESCRIBEN el peligro y su distancia; nunca ordenan maniobras («precaución» sí, «frena» no).
 *  2. Pasan antes por `warningDecision` (ventana útil, calzada, confianza): si dice SUPPRESS, silencio.
 *  3. Escalera de distancias fija (2 km, 1 km, 500 m, 200 m) recortada por el tiempo hasta el peligro;
 *     como máximo 3 avisos por peligro y uno cada 15 s; un aviso nuevo de mayor gravedad interrumpe.
 *  4. Idiomas ES/EN/NL/DE/FR; tono (earcon) distinto para ADVISORY y WARNING.
 */
import { warningDecision } from './roadsafe-secondary-risk.mjs';

const KIND = {
  STOPPED_SHOULDER: { es: 'vehículo detenido en el arcén', en: 'vehicle stopped on the hard shoulder', nl: 'stilstaand voertuig op de vluchtstrook', de: 'liegengebliebenes Fahrzeug auf dem Seitenstreifen', fr: 'véhicule arrêté sur la bande d’arrêt d’urgence' },
  STOPPED_LANE: { es: 'vehículo detenido en el carril', en: 'vehicle stopped in the lane', nl: 'stilstaand voertuig op de rijstrook', de: 'stehendes Fahrzeug auf dem Fahrstreifen', fr: 'véhicule arrêté sur la voie' },
  SERVICE_STOPPING: { es: 'vehículo de servicio deteniéndose', en: 'service vehicle stopping', nl: 'dienstvoertuig dat stopt', de: 'haltendes Dienstfahrzeug', fr: 'véhicule de service en train de s’arrêter' },
  ACCIDENT: { es: 'accidente', en: 'accident', nl: 'ongeval', de: 'Unfall', fr: 'accident' },
  QUEUE_TAIL: { es: 'final de retención', en: 'end of queue', nl: 'staart van de file', de: 'Stauende', fr: 'fin de bouchon' },
  PEOPLE_ON_ROAD: { es: 'personas en la calzada', en: 'people on the road', nl: 'mensen op de weg', de: 'Personen auf der Fahrbahn', fr: 'personnes sur la chaussée' },
};
const W = {
  es: { att: 'Atención', at: (d) => `a ${d}`, care: 'Precaución.', right: 'a la derecha', left: 'a la izquierda', km: (x) => `${x} kilómetro${x === 1 ? '' : 's'}`, m: (x) => `${x} metros` },
  en: { att: 'Caution', at: (d) => `in ${d}`, care: 'Take care.', right: 'on the right', left: 'on the left', km: (x) => `${x} kilometre${x === 1 ? '' : 's'}`, m: (x) => `${x} metres` },
  nl: { att: 'Let op', at: (d) => `over ${d}`, care: 'Voorzichtig.', right: 'rechts', left: 'links', km: (x) => `${x} kilometer`, m: (x) => `${x} meter` },
  de: { att: 'Achtung', at: (d) => `in ${d}`, care: 'Vorsicht.', right: 'rechts', left: 'links', km: (x) => `${x} Kilometer${x === 1 ? '' : 'n'}`, m: (x) => `${x} Metern` },
  fr: { att: 'Attention', at: (d) => `dans ${d}`, care: 'Prudence.', right: 'à droite', left: 'à gauche', km: (x) => `${x} kilomètre${x === 1 ? '' : 's'}`, m: (x) => `${x} mètres` },
};
export const LADDER_M = Object.freeze([2000, 1000, 500, 200]);
const fmtDist = (L, m) => (m >= 1000 ? L.km(Math.round(m / 1000)) : L.m(Math.round(m / 50) * 50));

/** Frase para un peligro a una distancia dada. */
export function phrase({ kind, distanceM, side = null, lang = 'es' }) {
  const L = W[lang] ?? W.es, k = (KIND[kind] ?? KIND.ACCIDENT)[lang] ?? KIND[kind].es;
  return `${L.att}: ${k}${side ? ' ' + L[side] : ''} ${L.at(fmtDist(L, distanceM))}. ${L.care}`;
}

/** Estado por conductor: qué se ha dicho ya para no repetir ni saturar. */
export function createAnnouncer({ lang = 'es', minGapS = 15, maxPerHazard = 3 } = {}) {
  const said = new Map(); let lastAt = -Infinity, lastLevel = 'NONE';
  return {
    /**
     * hz: { id, kind, side, distanceM, speedMs, trustCeiling, carriageway, posErrM, confidenceP, official, risk }
     * Devuelve { speak:boolean, text, level, earcon, why }.
     */
    consider(hz, now) {
      const t = hz.speedMs > 0 ? hz.distanceM / hz.speedMs : Infinity;
      const dec = warningDecision({ trustCeiling: hz.trustCeiling, carriageway: hz.carriageway, areaHazard: hz.areaHazard, posErrM: hz.posErrM, timeToHazardS: t, confidenceP: hz.confidenceP, risk: hz.risk, official: hz.official });
      if (dec.level === 'SUPPRESS' || dec.level === 'ABSTAIN') return { speak: false, level: dec.level, why: dec.why };
      const st = said.get(hz.id) ?? { rungs: new Set(), count: 0 };
      const rung = LADDER_M.find((m) => hz.distanceM <= m && hz.distanceM > m / 2 - 1);
      if (rung == null || st.rungs.has(rung)) return { speak: false, level: dec.level, why: ['sin nuevo escalón de distancia'] };
      if (st.count >= maxPerHazard) return { speak: false, level: dec.level, why: ['máximo de avisos para este peligro'] };
      const escalates = dec.level === 'WARNING' && lastLevel !== 'WARNING';
      if (now - lastAt < minGapS && !escalates) return { speak: false, level: dec.level, why: ['demasiado pronto tras el aviso anterior'] };
      st.rungs.add(rung); st.count++; said.set(hz.id, st); lastAt = now; lastLevel = dec.level;
      return { speak: true, level: dec.level, earcon: dec.level === 'WARNING' ? 'DOUBLE_TONE' : 'SINGLE_TONE', text: phrase({ kind: hz.kind, distanceM: hz.distanceM, side: hz.side, lang }), why: dec.why };
    },
  };
}
