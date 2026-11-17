/**
 * SENDA safe k-of-n fragment bounds under ARBITRARY CONDITIONAL DEPENDENCE.
 * Lower p_i are supposed valid marginal success lower bounds, NOT trusted data.
 * Set S=sum_i shards_i*X_i, N=sum_i shards_i, μ=sum_i shards_i*p_i.
 * E[S]>=μ and E[S]<=(k-1)+(N-k+1)*P(S>=k), so
 * P(S>=k) >= max(0,(μ-(k-1))/(N-k+1)).
 * Any subset A with sum_A shards_i>=k succeeds if ALL its packet groups
 * succeed; Boole/Fréchet gives P(all A)>=max(0,1-sum_A(1-p_i)).
 * Taking maximum over valid lower bounds is conservative without independence.
 * If marginal probabilities are EXACT model inputs, upper <= min(1,μ/k)
 * by Markov; otherwise the only safe upper is 1.
 * This is established mathematics, NOT a real RF delivery guarantee.
 */
const unit=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
export function arbitraryDependencyShardBounds(groups,k,{marginalsAreExact=false}={}){
  if(!Array.isArray(groups)||!groups.length||groups.length>32||
    !groups.every(g=>g&&Number.isSafeInteger(g.shards)&&g.shards>0&&
      g.shards<=255&&unit(g.p))||!Number.isSafeInteger(k)||k<1||
    typeof marginalsAreExact!=='boolean')
    throw new TypeError('invalid packet groups, probability or k');
  const N=groups.reduce((a,g)=>a+g.shards,0);
  if(k>N||N>255)throw new RangeError('invalid k or GF(256) shard budget');
  const mu=groups.reduce((a,g)=>a+g.shards*g.p,0);
  const moment=Math.max(0,(mu-k+1)/(N-k+1));
  let frechet=0,considered=0;
  if(groups.length<=10){
    for(let bits=1;bits<(1<<groups.length);bits++){
      let shards=0,failSum=0;
      for(let j=0;j<groups.length;j++)if(bits&(1<<j)){
        shards+=groups[j].shards;failSum+=1-groups[j].p;
      }
      if(shards>=k){considered++;frechet=Math.max(frechet,1-failSum);}
    }
  }else{
    // Valid but not necessarily tight 32-group fallback.
    const ordered=[...groups].sort((a,b)=>
      (1-a.p)/a.shards-(1-b.p)/b.shards);
    let shards=0,failSum=0;
    for(const g of ordered){shards+=g.shards;failSum+=1-g.p;
      if(shards>=k){frechet=Math.max(frechet,1-failSum);break;}
    }
    considered=1;
  }
  const lower=Math.min(1,Math.max(0,moment,frechet));
  const upper=marginalsAreExact?Math.min(1,mu/k):1;
  if(lower>upper+1e-10)throw new Error('inconsistent probability bounds');
  return {lowerBound:lower,upperBound:Math.max(lower,upper),
    method:'BOOLE_FRECHET_PLUS_REVERSE_EXPECTATION_BOUND',
    winningSubsetsEvaluated:considered,
    exhaustiveWinningSubsets:groups.length<=10,
    conditionalIndependenceRequired:false,
    validOnlyIfMarginalBoundsHold:true,
    upperUsesExactMarginals:marginalsAreExact,
    statisticalCalibrationVerified:false,
    physicalDeliveryVerified:false};
}
