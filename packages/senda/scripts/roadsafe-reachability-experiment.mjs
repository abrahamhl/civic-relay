#!/usr/bin/env node
/** Reproducible SYNTHETIC model falsification. Not a traffic or accident field dataset. */
import { projectQueueTailEnvelope } from '../src/roadsafe-queue-reachability.mjs';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

export function experiment({seed=20261118, trials=4000}={}) {
  if(!Number.isInteger(seed) || !Number.isInteger(trials) || trials < 100 || trials > 100000)
    throw Error('INVALID_EXPERIMENT_CONFIG');
  let state=seed>>>0;
  const rng=()=>{state^=state<<13; state^=state>>>17; state^=state<<5;return (state>>>0)/4294967296;};
  const uniform=(a,b)=>a+(b-a)*rng();
  const NOW=500000;
  const counts={trials,acceptedModel:0,abstained:0,robustDeclaredAdequate:0,
    robustFalseAssurance:0,fixed500DeclaredAdequate:0,fixed500FalseAssurance:0,
    trueAdequate:0,modelUndetermined:0};
  for(let i=0;i<trials;i++){
    const driverTrue=120000;
    const separation=uniform(100,1200);
    const speed=uniform(15,37),waveSpeed=uniform(-9,-1);
    const lag=uniform(0.4,5),reaction=uniform(0.7,3),decel=uniform(1.7,7.5),margin=15;
    const speedMin=Math.max(0,speed-2), speedMax=speed+2;
    const trueTail=driverTrue+separation;
    const s1=trueTail-waveSpeed*10+uniform(-5,5);
    const s2=trueTail+uniform(-5,5);
    const driverObs=driverTrue+uniform(-5,5);
    const road={roadId:'SYNTHETIC-LINK',carriagewayId:'SYNTHETIC-A',direction:'INCREASING',
      incidentKey:'synthetic-tail',mapMatched:true};
    const input={
      observations:[{...road,atMs:NOW-10000,chainageM:s1,uncertaintyM:5},
        {...road,atMs:NOW,chainageM:s2,uncertaintyM:5}],
      driver:{...road,chainageM:driverObs,uncertaintyM:5},nowMs:NOW,
      constraints:{driverSpeedRangeMps:[speedMin,speedMax],latencyRangeS:[0.4,5],
        reactionRangeS:[0.7,3],decelerationRangeMs2:[1.7,7.5],
        clearanceMarginM:margin,maxExtrapolationS:10,maxObservationGapS:30}
    };
    const r=projectQueueTailEnvelope(input);
    const closure=speed-waveSpeed;
    const actualRequired=margin+closure*(lag+reaction)+closure*closure/(2*decel);
    const truthAdequate=separation>=actualRequired;
    if(truthAdequate)counts.trueAdequate++;
    const naive=separation>=500;
    if(naive){counts.fixed500DeclaredAdequate++;if(!truthAdequate)counts.fixed500FalseAssurance++;}
    if(r.status==='SCIENTIFIC_MODEL_ONLY') {
      counts.acceptedModel++;
      if(r.verdict==='TIMING_ROBUST_IN_MODEL'){
        counts.robustDeclaredAdequate++;
        if(!truthAdequate)counts.robustFalseAssurance++;
      } else if(r.verdict==='TIMING_INDETERMINATE') counts.modelUndetermined++;
    } else counts.abstained++;
  }
  return {schema:'senda.h-road-rre-1.synthetic-experiment/1',seed,kind:'SYNTHETIC_NUMERICAL_FALSIFICATION',
    method:'Xorshift32 Monte Carlo; input intervals guaranteed to contain injected truth; constant-speed kinematics',
    baseline:'UNVALIDATED_FIXED_DISTANCE_500M',counts,
    assertions:{robustFalseAssuranceZero:counts.robustFalseAssurance===0,
      naiveCanBeFalselySafe:counts.fixed500FalseAssurance>0,
      noManufacturedFieldClaim:true},
    disclaimer:'All cases synthetic. No BLE, road incident, real traffic, reaction time or accident reduction has been measured.'};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const r=experiment();
  if(!r.assertions.robustFalseAssuranceZero || !r.assertions.naiveCanBeFalselySafe)process.exitCode=1;
  if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(r,null,2)+'\n');
  console.log(JSON.stringify(r,null,2));
}