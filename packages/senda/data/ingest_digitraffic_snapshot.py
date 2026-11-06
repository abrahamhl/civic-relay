#!/usr/bin/env python3
"""Load verified RAW Digitraffic physical detector observations into SENDA SQLite.
Explicit file-based ingestion: prevents generated/typed fixtures masquerading as live.
Each imported batch is cryptographically bound to the recorded official HTTP response.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import sqlite3
from build_source_db import create_database
from fetch_real_digitraffic_tms import normalize_tms, parsed_utc

def ingest_digitraffic_snapshot(db: pathlib.Path, directory: pathlib.Path, station: int=23001)->dict:
    create_database(db)
    norm_path=directory/f"digitraffic_tms_{station}.normalized.json"
    norm=json.loads(norm_path.read_text(encoding="utf-8"))
    raw=directory/norm["raw_filename"]
    data=raw.read_bytes()
    sha=hashlib.sha256(data).hexdigest()
    if sha!=norm["raw_sha256"]: raise ValueError("Official raw response SHA-256 mismatch")
    if norm["source_url"]!=f"https://tie.digitraffic.fi/api/tms/v1/stations/{station}/data":
        raise ValueError("Unexpected unapproved data origin")
    recorded=json.loads(data)
    # Derive the actual capture time from the publisher's own observation fields,
    # not from our machine's wall clock or user-specified date.
    measurement_ts=parsed_utc(norm["station_measured_utc"])
    replay=normalize_tms(recorded,station,parsed_utc(norm["retrieved_utc"]))
    if replay["station_measured_utc"]!=norm["station_measured_utc"]:
        raise ValueError("Normalized values differ from original wire data")
    if replay["records"]!=norm["records"]:
        raise ValueError("Measurement values altered after receipt")
    batch_id="fi-"+hashlib.sha256((str(station)+sha).encode()).hexdigest()[:24]
    observed=measurement_ts.isoformat().replace("+00:00","Z")
    conn=sqlite3.connect(db);conn.execute("PRAGMA foreign_keys=ON")
    added=0
    try:
        with conn:
            conn.execute("""INSERT OR IGNORE INTO observation_batches
              (batch_id,source_id,acquisition_start_utc,acquisition_end_utc,
               imported_at_utc,original_url,content_sha256,capture_license_text,license_evidence_url,
               raw_mask_preserved,origin_type,validation_state)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
              (batch_id,"digitraffic_tms",observed,observed,
              dt.datetime.now(dt.timezone.utc).isoformat(),norm["source_url"],sha,
              norm["source_licence"],norm["licence_evidence_url"],0,"MEASURED",
              "RESEARCH_ONLY_UNCALIBRATED_FOR_FIRE_AND_EVACUATION"))
            for rec in norm["records"]:
                # The API measurement value is from a physical loop station, distinct
                # from model-derived YOLOX image counts.
                sid="fi-tms-"+str(station)+"-"+rec["sensor_id"]+"-"+hashlib.sha256(rec["sensor_name"].encode()).hexdigest()[:8]
                conn.execute("""INSERT OR IGNORE INTO sensors
                    (sensor_id,source_id,modality,operational_permission,metadata_json)
                    VALUES(?,?,'TRAFFIC_DETECTOR',0,?)""",
                    (sid,"digitraffic_tms",json.dumps({"station_id":station,
                       "name":rec["sensor_name"],"provider_unit":rec["unit"],
                       "no_precise_coordinate_without_official_station_metadata":True},
                       sort_keys=True)))
                obsid="fi-"+hashlib.sha256((batch_id+sid+rec["sensor_name"]).encode()).hexdigest()[:29]
                before=conn.total_changes
                conn.execute("""INSERT OR IGNORE INTO observations
                    (observation_id,batch_id,sensor_id,observed_utc,received_utc,
                     metric,value,unit,uncertainty,source_quality_code,calibration_id,
                     evidence_json,allow_model_fusion)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                    (obsid,batch_id,sid,observed,norm["retrieved_utc"],
                     rec["sensor_name"],float(rec["value"]),rec["unit"],None,
                     "REAL_PHYSICAL_SENSOR_RESEARCH_UNCALIBRATED",None,
                     json.dumps({"publisher_url":norm["source_url"],
                        "original_sha256":sha,"window_start_utc":rec.get("window_start_utc"),
                        "dataset_licence":norm["source_licence"],"freshness":norm["freshness"],
                        "independent_data_validation":"NOT_CERTIFIED"},sort_keys=True)))
                added+=conn.total_changes-before
        return {"station":station,"ingested_physical_readings":added,"recorded_publisher_time":observed,
                "raw_source_sha256":sha,"no_operational_fusion":True,
                "count_all_measured_and_derived_research_observations":
                   conn.execute("SELECT count(*) FROM observations").fetchone()[0]}
    finally:
        conn.close()

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--db",type=pathlib.Path,required=True)
    p.add_argument("--snapshot-dir",type=pathlib.Path,required=True)
    p.add_argument("--station",type=int,default=23001)
    a=p.parse_args()
    print(json.dumps(ingest_digitraffic_snapshot(a.db,a.snapshot_dir,a.station),sort_keys=True))
