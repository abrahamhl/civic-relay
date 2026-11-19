import test from 'node:test';
import assert from 'node:assert/strict';
import { assessModelRoute } from './route-truth.mjs';
const endpoint = (id, role) => ({ id, role, consent: true, powered: true, radioEnabled: true });
const direct = { from: 'A', to: 'B', kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true };
const route = (roles) => assessModelRoute({nodes: [endpoint('A',roles[0]),endpoint('B',roles[1])],links:[direct],source:'A',destination:'B'});
test('P0 regression: unexpected, empty and missing roles never become relays', () => {
  for (const role of ['UNKNOWN','OBSERVATION_ONLY','PASSIVE','',undefined,'sender',null]) {
    const x=route([role,'RECEIVER']);
    assert.equal(x.modelReachable,false,`unsafe sender role: ${String(role)}`);
    const y=route(['SENDER',role]);
    assert.equal(y.modelReachable,false,`unsafe receiver role: ${String(role)}`);
    assert.equal(x.physicalDeliveryVerified,false);
  }
});
test('explicit sender and receiver roles remain usable strictly in synthetic model', () => {
  const r=route(['SENDER','RECEIVER']);
  assert.equal(r.modelReachable,true);
  assert.equal(r.physicalDeliveryVerified,false);
  assert.equal(r.recipientAcknowledged,false);
});
