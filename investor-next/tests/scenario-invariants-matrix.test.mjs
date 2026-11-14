import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runScenario} from '../lib/emergency-routing.mjs';

// Research-only property matrix. These checks validate the MODEL, never real radios or lives saved.
test('scenario conservation invariants survive heterogeneous seeded parameter sweeps',()=>{
 let evaluated=0;
 for(const devices of [20,60,100]){
  for(const seed of [1,7,42,20261020,2147483647]){
   for(const participation of [0,35,100]){
    for(const damaged of [0,50,100]){
     for(const gateway of [false,true]){
      const options={devices,seed,participation,damaged,gateway,
        responses:14,helpRequests:5,permissions:65,battery:24,bluetooth:true,wifi:true};
      const run=runScenario(options);
      const x=run.summary;
      assert.equal(run.devices.length,devices);
      assert.equal(x.participating+x.noContact,devices);
      assert.equal(x.humanSafe+x.humanSOS+x.humanUnknown,x.participating);
      assert.equal(x.modelledMessages,x.humanSafe+x.humanSOS);
      assert.equal(x.syntheticAcks+x.queued,x.modelledMessages);
      assert.ok(x.permissioned<=x.participating);
      assert.ok(x.cellularOnlyAcks<=x.syntheticAcks);
      assert.ok(x.simulatedLocalGatewayAcks<=x.syntheticAcks);
      assert.equal(run.assumptions.realRadio,false);
      assert.equal(run.assumptions.live112,false);
      assert.equal(run.zone.institutionalAuthentication,false);
      assert.ok(run.routes.every(route=>route.evidence==='SIMULATED_ONLY'));
      assert.equal(run.routes.some(route=>route.humanStatus==='UNKNOWN'),false);
      if(!gateway)assert.equal(x.simulatedLocalGatewayAcks,0);
      if(participation===0)assert.equal(x.modelledMessages,0);
      assert.deepEqual(run,runScenario(options));
      evaluated++;
     }
    }
   }
  }
 }
 assert.equal(evaluated,270);
});
test('no radio, no cellular, no gateway means every explicit message stays queued',()=>{
 for(const seed of [1,17,63,20261020]){
  const r=runScenario({seed,devices:100,participation:100,permissions:100,
   responses:30,helpRequests:10,damaged:100,gateway:false,bluetooth:false,wifi:false});
  assert.equal(r.summary.syntheticAcks,0);
  assert.equal(r.summary.queued,40);
  assert.equal(r.summary.humanUnknown,60);
  assert.equal(r.summary.humanSOS,10);
 }
});
