#!/usr/bin/env python3
"""Import only existing compact REAL NOAA GOES/HRRR archives from SENDA PR #13.
This data was derived from genuine products, but GOES Mask/DQF and original NOAA
file checksums were discarded by v0.20: these rows are NEVER ground-truth fronts.
The original HRRR forecast issue times were also discarded, so no retrospective
alert replay is permissible using these snapshots.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import math
import pathlib
import sqlite3
from build_source_db import create_database
from fetch_real_digitraffic_tms import parsed_utc

ROOT=pathlib.Path(__file__).resolve().parents[3]
ARCHIVE=ROOT/"investor-next/public/senda/data/referencias/goes_casos.json"
PROVENANCE_REV="594bba717d9c5efc107ee25f9fb6c1677e04974a"
SOURCE_URL=("https://github.com/abrahamhl/civic-relay/blob/"+PROVENANCE_REV+
            "/investor-next/public/senda/data/referencias/goes_casos.json")
VALID_WEATHER_UNITS={"u10":"m/s","v10":"m/s","gust":"m/s","t2":"degC","rh2":"percent"}

def digest_id(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:30]

def ingest_archived_real_goes_hrrr(db: pathlib.Path, archive: pathlib.Path=ARCHIVE) -> dict:
    create_database(db)
    b=archive.read_bytes()
    h=hashlib.sha256(b).hexdigest()
    obj=json.loads(b)
    cases=obj.get("casos")
    if not isinstance(cases,dict) or len(cases)<1: raise ValueError("Missing original NOAA compact case records")
    cx=sqlite3.connect(db);cx.execute("PRAGMA foreign_keys=ON")
    counts={"cases":0,"goes_pixel_observations":0,"goes_missing_or_zero_frp":0,
            "hrrr_forecast_values":0,"hrrr_forecast_issue_time_known":False,
            "goes_mask_and_dqf_preserved":False,"operational_fusion_authorizations":0,
            "source_sha256":h,"data_origin":"REAL_NOAA_DERIVED_COMPACT_LEGACY_NEEDS_RAW_RECONSTRUCTION"}
    try:
      with cx:
        for case,info in cases.items():
            frames=info.get("frames")
            hrrr=info.get("hrrr")
            if not isinstance(frames,list) or not isinstance(hrrr,list):
                raise ValueError("Source case missing real frames or forecast rows")
            counts["cases"]+=1
            case_id=digest_id("noaa-archive|"+h+"|"+case)
            satellite=info.get("satelite","NOAA_GOES_UNKNOWN")
            sensor_goes="GOES-"+case+"-"+digest_id(case+"|"+str(satellite))[:9]
            sensor_hrrr="HRRR-"+case
            frame_times=[parsed_utc(f["t"]) for f in frames]
            if frame_times!=sorted(frame_times):
                raise ValueError("Nonmonotonic NOAA frame UTC")
            # Record the full time interval INCLUDING frames with zero detections.
            for name,source_id,sid,modality,times,source_type,status in (
                ("goes","noaa_goes_fhs",sensor_goes,"SATELLITE_FHS",
                 frame_times,"MEASURED","COMPACT_LEGACY_MASK_DQF_AND_RAW_NOAA_HASH_LOST"),
                ("hrrr","noaa_hrrr",sensor_hrrr,"OTHER",
                 [parsed_utc(f["validUTC"]) for f in hrrr],"FORECAST",
                 "FORECAST_ISSUE_TIME_UNKNOWN_HISTORICAL_ONLY")
            ):
                if not times: continue
                bid=digest_id("batch|"+name+"|"+case_id)
                meta={"case":case,"product":name,"satellite":satellite,
                      "non_detection_not_proof_of_absence":True,
                      "time_precision":"GOES_PRODUCT_ACQUISITION_OR_HRRR_VALID_TIME",
                      "goes_mask_dqf_available":False,
                      "hrrr_forecast_issue_time_available":False,
                      "non_operational":True}
                cx.execute("""INSERT OR IGNORE INTO sensors
                  (sensor_id,source_id,modality,operational_permission,metadata_json)
                  VALUES(?,?,?,0,?)""",(sid,source_id,modality,json.dumps(meta,sort_keys=True)))
                cx.execute("""INSERT OR IGNORE INTO observation_batches
                  (batch_id,source_id,acquisition_start_utc,acquisition_end_utc,imported_at_utc,
                   original_url,content_sha256,capture_license_text,license_evidence_url,
                   raw_mask_preserved,origin_type,validation_state)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (bid,source_id,min(times).isoformat(),max(times).isoformat(),
                   dt.datetime.now(dt.timezone.utc).isoformat(),SOURCE_URL,h,
                   "NOAA_US_FEDERAL_OPEN_DATA_WITH_ORIGINAL_PRODUCTS_UNVERIFIED",
                   "https://registry.opendata.aws/noaa-goes/" if name=="goes"
                   else "https://registry.opendata.aws/noaa-hrrr-pds/",
                   0,source_type,status))
                if name=="goes":
                    for fi,frame in enumerate(frames):
                        t=parsed_utc(frame["t"]).isoformat().replace("+00:00","Z")
                        for di,pixel in enumerate(frame.get("det",[])):
                            if not isinstance(pixel,list) or len(pixel)<3:
                                raise ValueError("Malformed legacy pixel coordinates")
                            lat,lon,power=pixel[:3]
                            if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (lat,lon)) or abs(lat)>90 or abs(lon)>180:
                                raise ValueError("Invalid NOAA-derived center coordinates")
                            if power is not None and (not isinstance(power,(float,int)) or not math.isfinite(power) or power<0):
                                raise ValueError("Invalid NOAA power")
                            # v0.20 represented missing FRP by 0. Zero cannot be trusted as zero MW.
                            unresolved=(power is None or power==0)
                            val=None if unresolved else power
                            oid="noaa-"+digest_id(bid+"|"+str(fi)+"|"+str(di))
                            before=cx.total_changes
                            cx.execute("""INSERT OR IGNORE INTO observations
                              (observation_id,batch_id,sensor_id,observed_utc,received_utc,
                              metric,value,unit,uncertainty,source_quality_code,calibration_id,
                              lat,lon,evidence_json,allow_model_fusion)
                              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                              (oid,bid,sid,t,dt.datetime.now(dt.timezone.utc).isoformat(),
                               "NOAA_ABI_FIRE_ANOMALY_FRP_RETRIEVAL",val,"MW",None,
                               "REAL_SATELLITE_PIXEL_MASK_LOST_NO_CALIBRATION",None,lat,lon,
                               json.dumps({"case":case,"frame_index":fi,"detection_index":di,
                                 "original_file_sha256":h,
                                 "source_quality_mask":"MISSING_IN_COMPACT_SOURCE",
                                 "dqf":"MISSING_IN_COMPACT_SOURCE",
                                 "zero_or_null_frp_unrecoverable":unresolved,
                                 "does_not_define_fire_boundary":True},sort_keys=True)))
                            counts["goes_pixel_observations"]+=cx.total_changes-before
                            if unresolved:counts["goes_missing_or_zero_frp"]+=1
                else:
                    for hi,row in enumerate(hrrr):
                        t=parsed_utc(row["validUTC"]).isoformat().replace("+00:00","Z")
                        for metric,unit in VALID_WEATHER_UNITS.items():
                            v=row.get(metric)
                            if not isinstance(v,(int,float)) or not math.isfinite(v):
                                raise ValueError("Missing historical HRRR model field")
                            oid="hrrr-"+digest_id(bid+"|"+str(hi)+"|"+metric)
                            before=cx.total_changes
                            cx.execute("""INSERT OR IGNORE INTO observations
                              (observation_id,batch_id,sensor_id,observed_utc,received_utc,
                              metric,value,unit,uncertainty,source_quality_code,calibration_id,
                              evidence_json,allow_model_fusion)
                              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                              (oid,bid,sid,t,dt.datetime.now(dt.timezone.utc).isoformat(),
                               "HRRR_"+metric,v,unit,None,
                               "REAL_NOAA_ARCHIVED_FORECAST_ISSUE_TIME_MISSING",None,
                               json.dumps({"case":case,"row_index":hi,"valid_utc":t,
                                  "original_file_sha256":h,
                                  "forecast_issue_time_utc":None,
                                  "original_value_was_a_forecast_not_observed_weather":True,
                                  "cannot_claim_real_time_availability_in_historic_event":True},sort_keys=True)))
                            counts["hrrr_forecast_values"]+=cx.total_changes-before
      counts["operational_fusion_authorizations"]=cx.execute("SELECT count(*) FROM observations WHERE allow_model_fusion=1").fetchone()[0]
      counts["total_research_observations"]=cx.execute("SELECT count(*) FROM observations").fetchone()[0]
      return counts
    finally:
      cx.close()

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--db",required=True,type=pathlib.Path)
    p.add_argument("--archive",default=ARCHIVE,type=pathlib.Path)
    a=p.parse_args()
    print(json.dumps(ingest_archived_real_goes_hrrr(a.db,a.archive),sort_keys=True))
