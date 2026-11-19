/**
 * SENDA H16 — Falsifiable matched-policy evaluation, strictly offline.
 *
 * Complementary to calibration-gates.mjs (Brier/RMSE). This asks whether a
 * frozen routing policy actually delivered ON TIME more often than a frozen
 * baseline on identical exogenous traces, under the same energy/cost budget.
 *
 * Unit of statistical independence = one DECLARED causal emergency event,
 * NEVER one packet, neighborhood report, or device. Reusing one weather event
 * as multiple incidents is blocked when causalBlockId is the same.
 *
 * With paired D_i = 1{new delivered on time} - 1{baseline on time},
 * D_i in [-1,1]. Hoeffding: P(|mean(D)-E(D)| > eps) <=
 *   2*exp(-n*eps^2/2). A time-uniform alpha-spending bound replaces
 *   alpha with alpha/[n(n+1)] for each n. Confidence requires IID episodes,
 * frozen policies, comparable traces, and no label/data leakage: the module
 * validates ONLY the shape and declared provenance, not these field facts.
 *
 * Established statistics; neither novel theory nor RF/certification evidence.
 */
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{1,127}$/;
const SHA=/^[0-9a-f]{64}$/i;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0&&x<=8.64e15;
const quantile=(sorted,q)=>sorted.length?sorted[Math.ceil(q*sorted.length)-1]:null;
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
const clamp=x=>Math.max(-1,Math.min(1,x));

export function evaluateFrozenPairedPolicy({protocol,episodes,alpha=.05}={}){
  if(!protocol||typeof protocol!=='object'||!ID.test(protocol.id??'')||
    !ID.test(protocol.candidateVersion??'')||!ID.test(protocol.baselineVersion??'')||
    protocol.candidateVersion===protocol.baselineVersion||
    !safe(protocol.frozenAtMs)||!Number.isSafeInteger(protocol.deadlineMs)||
    protocol.deadlineMs<1||protocol.deadlineMs>7*24*3600000||
    !finite(protocol.maxEnergyMj)||protocol.maxEnergyMj<0||
    !finite(protocol.maxCostEUR)||protocol.maxCostEUR<0||
    protocol.design!=='FROZEN_SYNTHETIC_PAIRED_REPLAY'||
    protocol.sameExogenousTraceDeclared!==true||
    protocol.licenseReviewDeclared!==true||
    typeof alpha!=='number'||!finite(alpha)||alpha<=0||alpha>.2)
    throw new TypeError('invalid or unfrozen matched-replay protocol');
  if(!Array.isArray(episodes)||episodes.length<30||episodes.length>5000)
    throw new RangeError('require 30..5000 independent causal event pairs');
  const incidentIds=new Set(),causalIds=new Set(),traces=new Set();
  const totals=[],strata=new Map();
  const latencies={baseline:[],candidate:[]};
  const energy={baseline:[],candidate:[]};
  const cost={baseline:[],candidate:[]};
  let win=0,loss=0,ties=0;
  for(const e of episodes){
    if(!e||!ID.test(e.incidentKey??'')||!ID.test(e.causalBlockId??'')||
      !ID.test(e.scenarioId??'')||!SHA.test(e.traceSha256??'')||
      e.fold!=='TEST'||!safe(e.traceObservedAtMs)||
      e.traceObservedAtMs<=protocol.frozenAtMs||
      incidentIds.has(e.incidentKey)||causalIds.has(e.causalBlockId)||
      traces.has(e.traceSha256))
      throw new TypeError('duplicate, non-held-out or undocumented causal replay');
    incidentIds.add(e.incidentKey);causalIds.add(e.causalBlockId);
    traces.add(e.traceSha256);
    const outcome={};
    for(const arm of ['baseline','candidate']){
      const x=e[arm];
      if(!x||typeof x.acked!=='boolean'||!finite(x.energyMj)||
        !finite(x.costEUR)||x.energyMj<0||
        x.energyMj>protocol.maxEnergyMj||x.costEUR<0||
        x.costEUR>protocol.maxCostEUR||
        (x.acked && (!Number.isSafeInteger(x.ackLatencyMs)||
         x.ackLatencyMs<0||x.ackLatencyMs>7*24*3600000))||
        (!x.acked && x.ackLatencyMs!==null))
        throw new RangeError('invalid, unfair or inconsistent replay receipt on '+arm);
      outcome[arm]=x.acked&&x.ackLatencyMs<=protocol.deadlineMs?1:0;
      if(x.acked)latencies[arm].push(x.ackLatencyMs);
      energy[arm].push(x.energyMj);cost[arm].push(x.costEUR);
    }
    const diff=outcome.candidate-outcome.baseline;
    if(diff===1)win++;else if(diff===-1)loss++;else ties++;
    totals.push(diff);
    if(!strata.has(e.scenarioId))strata.set(e.scenarioId,{n:0,delta:0});
    const st=strata.get(e.scenarioId);st.n++;st.delta+=diff;
  }
  const n=episodes.length,delta=mean(totals);
  const fixedRadius=Math.sqrt(2*Math.log(2/alpha)/n);
  const anytimeRadius=Math.sqrt(2*Math.log(2*n*(n+1)/alpha)/n);
  const fixed={lower:clamp(delta-fixedRadius),upper:clamp(delta+fixedRadius)};
  const anytime={lower:clamp(delta-anytimeRadius),upper:clamp(delta+anytimeRadius)};
  let status='NO_PAIRED_GAIN_DEMONSTRATED_IN_SYNTHETIC_REPLAY';
  if(anytime.lower>0)status='POSITIVE_PAIRED_GAIN_IN_SYNTHETIC_REPLAY_ONLY';
  else if(anytime.upper<0)status='POSSIBLE_PAIRED_HARM_IN_SYNTHETIC_REPLAY_ONLY';
  return {
    status,
    design:protocol.design,
    sampleSize:n,
    pairedCandidateWins:win,pairedBaselineWins:loss,pairedTies:ties,
    candidateOnTimeMinusBaseline:delta,
    fixedNHoeffding:{...fixed,epsilon:fixedRadius},
    anytimeHoeffding:{...anytime,epsilon:anytimeRadius},
    byScenario:Object.fromEntries([...strata].sort(([a],[b])=>a.localeCompare(b))
      .map(([id,x])=>[id,{n:x.n,meanPairedDelta:x.delta/x.n}])),
    candidateMeanEnergyMj:mean(energy.candidate),
    baselineMeanEnergyMj:mean(energy.baseline),
    candidateMeanCostEUR:mean(cost.candidate),
    baselineMeanCostEUR:mean(cost.baseline),
    candidateAckedP95LatencyMs:quantile(latencies.candidate.sort((a,b)=>a-b),.95),
    baselineAckedP95LatencyMs:quantile(latencies.baseline.sort((a,b)=>a-b),.95),
    latencyConditionedOnAcknowledgementSurvivorBias:true,
    comparedUnderSameDeclaredBudgets:true,
    trueMatchedCausalProcessVerified:false,
    realReceiverReceiptsCryptographicallyVerified:false,
    sourceLicensesIndependentlyAudited:false,
    eventIIDVerified:false,
    fieldDeploymentAuthorized:false,
    mayClaimCertifiedGain:false,
    scientificNoveltyClaim:false,
    interpretation:'Statistical bounds valid only for IID independent paired episodes and frozen trustworthy replay; labels/receipts are not verified here.'
  };
}
