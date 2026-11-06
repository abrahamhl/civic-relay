#!/usr/bin/env python3
"""SENDA · fetch a real Finnish road-loop station, with cryptographic provenance.

Only official public API (Digitraffic, CC BY 4.0); no imagery, credentials,
location of individuals, or model-generated observations. Fails closed.
Not a fire-safety alarm feed. Called explicitly by CI/manual opt-in.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import gzip
import json
import pathlib
import re
import urllib.error
import urllib.request

BASE = "https://tie.digitraffic.fi/api/tms/v1/stations/"
LICENSE = "CC BY 4.0 — Fintraffic/Digitraffic"
MAX_BYTES = 2_000_000
MAX_VALUES = 200

def parsed_utc(s: str) -> dt.datetime:
    if not isinstance(s,str) or not re.search(r"(Z|[+-]\d\d:\d\d)$", s):
        raise ValueError("Timestamp missing zone")
    d=dt.datetime.fromisoformat(s.replace("Z","+00:00"))
    return d.astimezone(dt.timezone.utc)

def normalize_tms(payload: dict, station: int, now: dt.datetime) -> dict:
    if not isinstance(payload,dict): raise ValueError("Expected JSON object")
    values=payload.get("tmsStations")
    if not isinstance(values,list) or not values: raise ValueError("No real station observations in response")
    matching=[x for x in values if int(x.get("id",-1))==station]
    if len(matching)!=1: raise ValueError("Expected exactly one matched station")
    x=matching[0]
    when=parsed_utc(x["measuredTime"])
    age=(now-when).total_seconds()
    if age < -60 or age > 86400*30: raise ValueError("Unreasonable station timestamp")
    sensors=x.get("sensorValues")
    if not isinstance(sensors,list) or not sensors or len(sensors)>MAX_VALUES:
        raise ValueError("Unexpected station sensor count")
    readings=[]
    for sv in sensors:
        v=sv.get("sensorValue")
        name=sv.get("name")
        unit=sv.get("sensorUnit")
        if (isinstance(v,bool) or not isinstance(v,(float,int)) or
            not isinstance(name,str) or not name or
            not isinstance(unit,str) or not unit):
            continue  # absence/invalid is not zero
        if v<0: continue  # raw negative values are sensor-specific sentinel or invalid
        start=sv.get("timeWindowStart")
        if start is not None:
            parsed_utc(start)
        readings.append({"sensor_id":str(sv.get("id","")),
          "sensor_name":name,"value":v,"unit":unit,
          "observed_utc":when.isoformat().replace("+00:00","Z"),
          "window_start_utc":start,
          "quality":"REAL_PHYSICAL_SENSOR_UNCALIBRATED_FOR_EMERGENCY_USE"})
    if not readings: raise ValueError("No numeric measurements after validation")
    return {"source_id":"digitraffic_tms","station_id":station,
      "station_measured_utc":when.isoformat().replace("+00:00","Z"),
      "retrieved_utc":now.isoformat().replace("+00:00","Z"),
      "age_seconds":round(age),
      "freshness":"CURRENT" if age <= 900 else "STALE_RESEARCH_ONLY",
      "records":readings,"number_of_numeric_readings":len(readings),
      "operational_safety_clearance":False,
      "meaning":"REAL_INSTRUMENT_READINGS_NOT_CAMERA_VIDEO_NOT_FIRE_PREDICTIONS"}

def pull_one(station: int, out: pathlib.Path) -> dict:
    if station<10000 or station>999999: raise ValueError("Invalid ID")
    url=f"{BASE}{station}/data"
    req=urllib.request.Request(url,headers={
        "User-Agent":"SENDA-Civic-Relay-research/0.22 (https://github.com/abrahamhl/civic-relay)",
        "Accept":"application/json",
        "Accept-Encoding":"gzip",
        "Digitraffic-User":"CivicRelay/0.22"})
    # No URL redirects to unapproved domains; GitHub runner HTTPS only.
    with urllib.request.urlopen(req,timeout=30) as response:
        if response.geturl()!=url: raise ValueError("Unexpected redirect")
        if response.status!=200: raise ValueError(f"HTTP {response.status}")
        b=response.read(MAX_BYTES+1)
        encoding=response.headers.get("Content-Encoding","").lower()
    if len(b)>MAX_BYTES or not b: raise ValueError("Oversized/empty compressed response")
    if encoding=="gzip": b=gzip.decompress(b)
    elif encoding not in ("","identity"): raise ValueError("Unsupported content encoding")
    if len(b)>MAX_BYTES or not b: raise ValueError("Oversized/empty uncompressed response")
    data=json.loads(b)
    now=dt.datetime.now(dt.timezone.utc)
    normalized=normalize_tms(data,station,now)
    out.mkdir(parents=True,exist_ok=True)
    original_path=out/f"digitraffic_tms_{station}.raw.json"
    original_path.write_bytes(b)
    normalized.update({"source_url":url,"raw_sha256":hashlib.sha256(b).hexdigest(),
      "source_licence":LICENSE,
      "raw_filename":original_path.name,
      "licence_evidence_url":"https://catalog.digitraffic.fi/en/dataset/e05167e6-47d8-4787-993e-fa0ae0bf2e91/resource/efcd3e0d-f757-43fd-ad2c-f6dd4fdebe11",
      "captures_live_video":False})
    (out/f"digitraffic_tms_{station}.normalized.json").write_text(json.dumps(normalized,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return {"station":station,"observed_utc":normalized["station_measured_utc"],
      "age_s":normalized["age_seconds"],"freshness":normalized["freshness"],
      "n":len(normalized["records"]),"raw_sha256":normalized["raw_sha256"],"data_origin":"REAL_API_RESPONSE"}

if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--station",type=int,default=23001)
    p.add_argument("--out",type=pathlib.Path,required=True)
    args=p.parse_args()
    print(json.dumps(pull_one(args.station,args.out),sort_keys=True))
