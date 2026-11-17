import test from 'node:test';
import assert from 'node:assert/strict';
import { fitBridging, bridgingStatus, majorityStatus, CN_DEFAULTS, syntheticPolarizedScenario } from '../src/bridging-trust.mjs';

// Escenario SINTÉTICO (declarado): 20 vecinos en dos «bandos» de 10 que suelen discrepar entre sí.
const A = Array.from({ length: 10 }, (_, k) => `a${k}`), B = Array.from({ length: 10 }, (_, k) => `b${k}`);
function scenario() {
  const r = [];
  // Historial que revela los bandos: reportes que solo apoya cada bando
  for (let k = 0; k < 6; k++) { for (const u of A) r.push({ rater: u, item: `soloA${k}`, helpful: 1 }); for (const u of B) r.push({ rater: u, item: `soloA${k}`, helpful: 0 }); }
  for (let k = 0; k < 6; k++) { for (const u of B) r.push({ rater: u, item: `soloB${k}`, helpful: 1 }); for (const u of A) r.push({ rater: u, item: `soloB${k}`, helpful: 0 }); }
  // «inundacion»: lo confirman 8 de A y 8 de B (consenso amplio real)
  for (const u of [...A.slice(0, 8), ...B.slice(0, 8)]) r.push({ rater: u, item: 'inundacion', helpful: 1 });
  for (const u of [...A.slice(8), ...B.slice(8)]) r.push({ rater: u, item: 'inundacion', helpful: 0 });
  // «bulo»: lo «confirma» todo el bando A en bloque (11 sí de 13), B lo niega
  for (const u of A) r.push({ rater: u, item: 'bulo', helpful: 1 }); for (const u of B.slice(0, 3)) r.push({ rater: u, item: 'bulo', helpful: 0 }); r.push({ rater: 'b9', item: 'bulo', helpful: 1 });
  return r;
}

test('usa los parámetros por defecto del modelo original de Notas de la Comunidad', () => {
  assert.equal(CN_DEFAULTS.userFactorLambda, 0.03); assert.equal(CN_DEFAULTS.noteInterceptLambda, 0.15); assert.equal(CN_DEFAULTS.crhThreshold, 0.40); assert.equal(CN_DEFAULTS.minRatingsNeeded, 5);
});

test('consenso amplio: confirma lo que apoyan los dos bandos y no lo que apoya un solo bando aunque gane por mayoría', () => {
  const r = scenario(), st = bridgingStatus(fitBridging(r)), maj = majorityStatus(r);
  assert.equal(maj.bulo.status, 'MAYORIA_SI', 'la mayoría simple se deja llevar por el bando');
  assert.notEqual(st.bulo.status, 'CONFIRMADO_CONSENSO_AMPLIO', JSON.stringify(st.bulo));
  assert.ok(st.inundacion.intercept > st.bulo.intercept, 'el reporte apoyado por ambos bandos puntúa más');
  assert.equal(st.inundacion.status, 'CONFIRMADO_CONSENSO_AMPLIO', JSON.stringify(st.inundacion));
  assert.ok(Math.abs(st.bulo.factor) > Math.abs(st.inundacion.factor), 'el apoyo del bulo lo explica el factor de bando');
});

test('reproducible (semilla fija) y con mínimo de valoraciones', () => {
  const r = scenario(), a = fitBridging(r), b = fitBridging(r);
  assert.equal(a.items.bulo.intercept, b.items.bulo.intercept);
  const few = bridgingStatus(fitBridging([{ rater: 'x', item: 'i', helpful: 1 }, { rater: 'y', item: 'i', helpful: 1 }]));
  assert.equal(few.i.status, 'POCAS_VALORACIONES');
  assert.throws(() => fitBridging([]));
});

test('el escenario de demostración exportado está marcado como simulación y reproduce el mismo resultado', () => {
  const sc = syntheticPolarizedScenario(); assert.equal(sc.basis, 'SIMULATION');
  const st = bridgingStatus(fitBridging(sc.ratings));
  assert.equal(st.inundacion.status, 'CONFIRMADO_CONSENSO_AMPLIO'); assert.notEqual(st.bulo.status, 'CONFIRMADO_CONSENSO_AMPLIO');
});
