#!/usr/bin/env python3
"""Independent Python oracle for SENDA H15 declared N-1/N-2 SRLG cuts.

Generated finite research topologies are sent to production Node module
through stdin. A separate Python powerset enumerator then checks cuts,
required surviving routes, quarantine of absent dependencies, and
deterministic normalization. No field RF or institutional authority claimed.
"""
import itertools
import json
import pathlib
import random
import subprocess

ROOT=pathlib.Path(__file__).resolve().parents[3]
RNG=random.Random(20261117)
INPUTS=[]
for case in range(240):
    n=2+case%6
    links=[]
    paths=[]
    for j in range(n):
        risk=["SHARED-"+str(RNG.randrange(5))]
        if case%17==0 and j==0:
            risk=[]
        links.append({"id":"link-"+str(j),"riskDomains":risk})
        endpoint=["DEVICE-"+str(RNG.randrange(5))]
        if case%29==0 and j==0:
            endpoint=[]
        paths.append({
            "id":"route-"+str(j),
            "linkIds":["link-"+str(j)],
            "endpointRiskDomains":endpoint,
            "consentDeclared":RNG.random()>=.06,
            "linkAuthorizedDeclared":RNG.random()>=.06
        })
    required=RNG.randrange(1,n+1)
    INPUTS.append({"links":links,"paths":paths,"requiredSurvivingPaths":required,
                   "maxSimultaneousFailures":2})

NODE_SCRIPT="""import {readFileSync} from 'node:fs';
import {enumerateDeclaredFailureCuts as run} from './packages/senda/src/failure-domain-cuts.mjs';
const inputs=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(inputs.map(x=>run(x))));
"""
result=subprocess.run(["node","--input-type=module","-e",NODE_SCRIPT],
    input=json.dumps(INPUTS),cwd=ROOT,text=True,capture_output=True,check=True)
observed=json.loads(result.stdout)
for i,(x,y) in enumerate(zip(INPUTS,observed)):
    by_link={v["id"]:v for v in x["links"]}
    incomplete=any(not v["riskDomains"] for v in x["links"])
    rows=[]
    for p in x["paths"]:
        if not p["endpointRiskDomains"]:
            incomplete=True
        domains={"LINK:"+name for name in p["linkIds"]}
        for name in p["linkIds"]:
            domains|={"SRLG:"+d for d in by_link[name]["riskDomains"]}
        domains|={"SRLG:"+d for d in p["endpointRiskDomains"]}
        if not p["endpointRiskDomains"] or any(
            not by_link[name]["riskDomains"] for name in p["linkIds"]):
            domains.add("UNKNOWN_TOPOLOGY")
        rows.append((p,domains))
    if incomplete:
        for _,domains in rows:
            domains.add("UNKNOWN_TOPOLOGY")
    eligible=[(p,dom) for p,dom in rows
              if p["consentDeclared"] and p["linkAuthorizedDeclared"]]
    catalog=sorted(set().union(*(d for _,d in eligible))) if eligible else []
    required=x["requiredSurvivingPaths"]
    single=[]
    double=[]
    for k in (1,2):
        for failed in itertools.combinations(catalog,k):
            survivor=[p["id"] for p,d in eligible if not any(z in d for z in failed)]
            if len(survivor)<required:
                (single if k==1 else double).append(list(failed))
    expected_n1=(len(eligible)>=required and not incomplete and not single)
    expected_n2=(expected_n1 and not double)
    actual_single=[r["failedDomains"] for r in y["singleDomainCuts"]]
    actual_double=[r["failedDomains"] for r in y["doubleDomainCuts"]]
    if actual_single!=single or actual_double!=double or \
       y["declaredN1Resilience"]!=expected_n1 or \
       y["declaredN2Resilience"]!=expected_n2:
        raise AssertionError("SENDA H15 MISCLASSIFIED "+str(i)+": "+
              json.dumps({"input":x,"expectedSingle":single,"actualSingle":actual_single,
                          "expectedDouble":double,"actualDouble":actual_double,
                          "expectedN1":expected_n1,"actualN1":y["declaredN1Resilience"],
                          "expectedN2":expected_n2,"actualN2":y["declaredN2Resilience"]}))
    if y["topologyEvidenceVerified"] or y["mayOperateEmergencyInfrastructure"]:
        raise AssertionError("misleading physical permission claim")

out={
  "status":"PASS_INDEPENDENT_PYTHON_ENUMERATION",
  "synthetic_topologies":len(INPUTS),
  "checked_failures":"ALL_DECLARED_SINGLE_AND_DOUBLE_DOMAINS",
  "misclassified_cuts":0,
  "algorithmic_claim":"EXACT_FOR_DECLARED_FINITE_TOPOLOGY_ONLY",
  "field_rf_verified":False,
  "institutional_authority_verified":False
}
dst=ROOT/"evidence/senda/research/declared-srlg-cuts-crosscheck.json"
dst.parent.mkdir(parents=True,exist_ok=True)
dst.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n",encoding="utf-8")
print(json.dumps(out,indent=2))
