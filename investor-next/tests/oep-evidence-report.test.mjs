import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeEvidenceReport} from '../scripts/oep-evidence-run.mjs';
test('evidence report executes 810 deterministic synthetic runs, with zero invariant violations',()=>{
 const report=makeEvidenceReport();
 assert.equal(report.runCount,810);
 assert.equal(report.caseGroups,6);
 assert.equal(report.passedInvariantChecks,12150);
 assert.equal(report.failedInvariantChecks,0);
 assert.equal(report.groups.reduce((sum,g)=>sum+g.cases,0),810);
 assert.deepEqual(makeEvidenceReport(),report);
});
test('no invented physical, satellite, official-alert or rescue claims appear in machine report',()=>{
 const r=makeEvidenceReport();
 assert.equal(r.evidence.proofLevel,'SIMULATED');
 for(const key of ['physicalDeliveryMeasured','radiosActivated','satelliteLinkTested',
  'officialCAPVerified','distressCallsSent','humanRescueVerified','batteryPerformanceMeasured'])
  assert.equal(r.evidence[key],false,key);
 assert.match(r.dataSemantics,/modelled synthetic events/);
 assert.ok(r.limitations.some(s=>s.includes('not a safety certificate')));
});
test('zero consent and isolation cannot generate synthetic messages or ACKs',()=>{
 const r=makeEvidenceReport();
 const noParticipants=r.groups.find(g=>g.name==='noParticipants');
 const isolation=r.groups.find(g=>g.name==='isolation');
 assert.equal(noParticipants.syntheticAcks,0);
 assert.equal(noParticipants.queued,0);
 assert.equal(isolation.syntheticAcks,0);
 assert.ok(isolation.queued>0);
});
