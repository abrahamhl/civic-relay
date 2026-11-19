#!/usr/bin/env python3
"""Independent SciPy HiGHS cross-check of SENDA finite scenario box/simplex LP.
DOES NOT validate RF/satellite or field reliability. Run:
  pip install scipy==1.17.0
  python packages/senda/scripts/verify-robust-lp.py
"""
import hashlib
import json
import pathlib
import random
import subprocess
from scipy.optimize import linprog

ROOT=pathlib.Path(__file__).resolve().parents[3]
NCASES=250
SEED=20261117
rng=random.Random(SEED)
cases=[]
for _ in range(NCASES):
    n=rng.randrange(2,14)
    raw=[rng.random()+.001 for _ in range(n)]
    nominal=[x/sum(raw) for x in raw]
    states=[]
    bounds={}
    for j,m in enumerate(nominal):
        lo=m*rng.random()
        hi=m+(1-m)*rng.random()
        name="R"+str(j)
        states.append({"id":name,"lowerMass":lo,"upperMass":hi,"nominalMass":m})
        lower=rng.random()
        upper=lower+(1-lower)*rng.random()
        bounds[name]={"lower":lower,"upper":upper,
                     "nominal":lower+(upper-lower)*rng.random()}
    cases.append({"states":states,"successByState":bounds})
node_js="""
import {readFileSync} from 'node:fs';
import {evaluateScenarioUncertainty} from './packages/senda/src/robust-scenario-risk.mjs';
const items=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(items.map(x=>evaluateScenarioUncertainty(x))));
"""
proc=subprocess.run(["node","--input-type=module","-e",node_js],cwd=ROOT,
    input=json.dumps(cases),capture_output=True,text=True,check=True)
results=json.loads(proc.stdout)
assert len(results)==NCASES
max_error=0.0
max_normalization_error=0.0
for item,result in zip(cases,results):
    states=item["states"]
    conditional=item["successByState"]
    limits=[(s["lowerMass"],s["upperMass"]) for s in states]
    low=[conditional[s["id"]]["lower"] for s in states]
    negative_high=[-conditional[s["id"]]["upper"] for s in states]
    rows=[[1]*len(states)]
    low_lp=linprog(low,A_eq=rows,b_eq=[1],bounds=limits,method="highs")
    high_lp=linprog(negative_high,A_eq=rows,b_eq=[1],bounds=limits,method="highs")
    assert low_lp.success and high_lp.success, "independent LP failed"
    error=max(abs(result["robustLower"]-low_lp.fun),
              abs(result["robustUpper"]+high_lp.fun))
    max_error=max(max_error,error)
    assert error<1e-9, ("robust risk mismatch",error)
    for key in ["worstCaseScenarioMass","bestCaseScenarioMass"]:
        mass=result[key]
        total=sum(mass.values())
        max_normalization_error=max(max_normalization_error,abs(total-1))
        assert abs(total-1)<1e-9
        for s in states:
            assert mass[s["id"]]>=s["lowerMass"]-1e-9
            assert mass[s["id"]]<=s["upperMass"]+1e-9
source=ROOT/"packages"/"senda"/"src"/"robust-scenario-risk.mjs"
summary={
  "test":"independent scipy.optimize.linprog HiGHS vs checked-in Node robust-scenario-risk",
  "cases":NCASES,"rng_seed":SEED,
  "node":subprocess.run(["node","-v"],capture_output=True,text=True).stdout.strip(),
  "max_absolute_probability_error":max_error,
  "max_abs_mass_normalization_error":max_normalization_error,
  "pass":True,
  "qualification":"valid for declared finite probability envelopes, not measured RF",
  "sha256_source":hashlib.sha256(source.read_bytes()).hexdigest()
}
out=ROOT/"evidence"/"senda"/"research"/"robust-risk-lp-crosscheck.json"
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary,indent=2))
