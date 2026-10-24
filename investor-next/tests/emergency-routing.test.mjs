import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runScenario} from '../lib/emergency-routing.mjs';
test('20..100 nodes and repeatable seed',()=>{
 for(const n of [20,40,100]){
   const params={devices:n,seed:731,responses:6,helpRequests:2};
   const result=runScenario(params);
   assert.equal(result.devices.length,n);
   assert.deepEqual(result,runScenario(params));
 }
});
test('silence never causes an inferred SOS',()=>{
 const r=runScenario({devices:40,participation:100,responses:0,helpRequests:0});
 assert.equal(r.summary.humanSOS,0);
 assert.equal(r.summary.humanUnknown,40);
 assert.equal(r.routes.length,0);
});
test('no consent means no user messages and no relays',()=>{
 const r=runScenario({participation:0,responses:15,helpRequests:15});
 assert.equal(r.summary.participating,0);
 assert.equal(r.summary.permissioned,0);
 assert.equal(r.summary.modelledMessages,0);
});
test('offline without gateway queues every explicit message',()=>{
 const r=runScenario({participation:100,permissions:100,damaged:100,gateway:false,
   devices:100,responses:30,helpRequests:3});
 assert.equal(r.summary.syntheticAcks,0);
 assert.equal(r.summary.queued,33);
 assert.equal(r.summary.humanSOS,3);
});
test('critical battery never relays an intermediate device',()=>{
 const r=runScenario({participation:100,permissions:100,damaged:100,battery:5,
   responses:15,helpRequests:2});
 for(const route of r.routes)for(const intermediary of route.path.slice(1,-1))
   assert.equal(r.devices.find(d=>d.id===intermediary)?.energy==='CRITICAL',false);
});
test('simulation never claims institutional authenticity or physical delivery',()=>{
 const r=runScenario({devices:40,responses:7,helpRequests:4});
 assert.equal(r.zone.institutionalAuthentication,false);
 assert.equal(r.assumptions.realSatellite,false);
 assert.equal(r.assumptions.live112,false);
 assert.ok(r.routes.every(m=>['ACK_SYNTHETIC','QUEUED_LOCAL'].includes(m.delivery)));
 assert.ok(r.routes.every(m=>m.evidence==='SIMULATED_ONLY'));
});
test('no radio plus total outage cannot invent a local route',()=>{
 const r=runScenario({participation:100,permissions:100,damaged:100,
   bluetooth:false,wifi:false,gateway:true,responses:5,helpRequests:1});
 assert.equal(r.summary.syntheticAcks,0);
});
test('offline to online transition and gateway recovery restore synthetic acknowledgments deterministically',()=>{
 const totalOutage=runScenario({seed:9001,devices:50,participation:100,permissions:100,damaged:100,gateway:false,responses:10,helpRequests:4});
 assert.equal(totalOutage.summary.syntheticAcks,0);
 assert.equal(totalOutage.summary.queued,14);

 const gatewayRestored=runScenario({seed:9001,devices:50,participation:100,permissions:100,damaged:100,gateway:true,responses:10,helpRequests:4});
 assert.ok(gatewayRestored.summary.simulatedLocalGatewayAcks>0);
 assert.equal(gatewayRestored.summary.syntheticAcks+gatewayRestored.summary.queued,14);

 const cellularRestored=runScenario({seed:9001,devices:50,participation:100,permissions:100,damaged:0,gateway:false,responses:10,helpRequests:4});
 assert.equal(cellularRestored.summary.cellularOnlyAcks,14);
 assert.equal(cellularRestored.summary.syntheticAcks,14);
 assert.equal(cellularRestored.summary.queued,0);
});
test('revoked relay permissions prevent multi-hop local gateway forwarding during cellular outage',()=>{
 const noPermissions=runScenario({seed:9001,devices:50,participation:100,permissions:0,damaged:100,gateway:true,responses:8,helpRequests:2});
 assert.equal(noPermissions.summary.permissioned,0);
 assert.equal(noPermissions.summary.simulatedLocalGatewayAcks,0);
 assert.equal(noPermissions.summary.syntheticAcks,0);
 assert.equal(noPermissions.summary.queued,10);
});
