#!/usr/bin/env python3
"""Independent adversarial joint-distribution oracle for SENDA H11-D.

For binary packet-group success X_i, enumerate all 2^n joint patterns.
Solve via scipy.optimize.linprog(HiGHS):
  min P(sum(w_i X_i)>=k) subject to P(X_i=1)>=p_i
  max P(sum(w_i X_i)>=k) subject to P(X_i=1)==p_i
Compare with dependency-agnostic-shards.mjs safe lower/upper bounds.
This does not establish the source reliability of p_i or field performance.
"""
import json
import math
import pathlib
import random
import subprocess
import sys
from scipy.optimize import linprog
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[3]
RNG=random.Random(20261117)
CASES=[]
for j in range(160):
    n=2+(j%6)  # 2..7 groups; at most 128 joint states
    p=[RNG.choice([0.0,1.0]) if j%17==0 else round(RNG.uniform(.02,.98),5) for _ in range(n)]
    w=[RNG.randrange(1,4) for _ in range(n)]
    k=RNG.randint(1,sum(w))
    CASES.append({"groups":[{"p":x,"shards":v} for x,v in zip(p,w)],"k":k})

NODE_CODE="""import {readFileSync} from 'node:fs';
import {arbitraryDependencyShardBounds} from './packages/senda/src/dependency-agnostic-shards.mjs';
const cases=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(cases.map(c=>arbitraryDependencyShardBounds(c.groups,c.k,{marginalsAreExact:true}))));
"""
resp=subprocess.run(
    ["node","--input-type=module","-e",NODE_CODE],
    input=json.dumps(CASES),text=True,cwd=ROOT,capture_output=True,check=True
)
bounds=json.loads(resp.stdout)
largest_lower_slack=0.0
largest_upper_slack=0.0
for j,(case,cert) in enumerate(zip(CASES,bounds)):
    p=np.array([g["p"] for g in case["groups"]],dtype=float)
    w=np.array([g["shards"] for g in case["groups"]],dtype=int)
    n=len(p)
    states=np.array([[(mask>>i)&1 for i in range(n)] for mask in range(1<<n)],dtype=float)
    success=(states @ w >= case["k"]).astype(float)
    mass=np.ones((1,1<<n))
    minlp=linprog(success,A_ub=-states.T,b_ub=-p,A_eq=mass,b_eq=[1.0],
                  bounds=(0,None),method="highs")
    if not minlp.success:
        raise RuntimeError(f"min LP failed case {j}: {minlp.message}")
    maxlp=linprog(-success,A_eq=np.vstack((mass,states.T)),
                  b_eq=np.r_[1.0,p],bounds=(0,None),method="highs")
    if not maxlp.success:
        raise RuntimeError(f"max LP failed case {j}: {maxlp.message}")
    actual_min=float(minlp.fun)
    actual_max=float(-maxlp.fun)
    lower=float(cert["lowerBound"])
    upper=float(cert["upperBound"])
    if not math.isfinite(lower) or not math.isfinite(upper):
        raise AssertionError(f"nonfinite JS bounds case {j}")
    if lower>actual_min+1e-7 or upper<actual_max-1e-7:
        raise AssertionError(f"UNSAFE bounds case {j}: cert=[{lower},{upper}],"
                             f" feasible min={actual_min}, max={actual_max}, data={case}")
    largest_lower_slack=max(largest_lower_slack,actual_min-lower)
    largest_upper_slack=max(largest_upper_slack,upper-actual_max)

out={
    "status":"PASS_SYNTHETIC_INDEPENDENT_JOINT_LP_ORACLE",
    "cases":len(CASES),
    "max_joint_states":128,
    "reference_solver":"scipy.optimize.linprog(method=highs)",
    "lower_bound_violations":0,
    "upper_bound_violations":0,
    "largest_conservatism_gap_lower":largest_lower_slack,
    "largest_conservatism_gap_upper":largest_upper_slack,
    "conclusion":"Mathematical bound tested for artificial marginals; NOT field delivery calibration or certification"
}
dest=ROOT/"evidence/senda/research/dependency-agnostic-joint-lp-crosscheck.json"
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n",encoding="utf-8")
print(json.dumps(out,indent=2))
