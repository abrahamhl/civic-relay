#!/usr/bin/env python3
"""SENDA: ingest REAL recorded camera measurements already committed in PR #13.

No synthetic data, network, faces, plate identifiers, or operational use.
Produces derived detector counts from actual 2026 clips; these are NOT hand-counted
ground truth. Records have deliberately coarse capture-time precision and fail-closed
fusion permission. Historic 2018/2025 fires must NEVER be co-timed with 2026 clips.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import sqlite3
from zoneinfo import ZoneInfo
from build_source_db import create_database

ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA = ROOT / "investor-next/public/senda/data/referencias"
PROVENANCE_REV = "594bba717d9c5efc107ee25f9fb6c1677e04974a"
RECORDINGS = (
    ("tfl_jamcams", "tfl_camaras.json"),
    ("caltrans_cctv", "caltrans_corredores.json"),
)

def utc_time(s: str) -> dt.datetime:
    if not isinstance(s, str):
        raise ValueError("Missing capture time")
    if s.endswith("Z"):
        d = dt.datetime.fromisoformat(s.replace("Z","+00:00"))
    else:
        raise ValueError("Capture time not explicit UTC")
    if d.utcoffset() != dt.timedelta(0):
        raise ValueError("Time not UTC")
    return d

def capture_time(source: str, obj: dict) -> dt.datetime:
    if source == "tfl_jamcams":
        return utc_time(obj["capturaUTC"])
    if source == "caltrans_cctv":
        local = dt.datetime.fromisoformat(obj["capturaPST"])
        if local.tzinfo is not None:
            raise ValueError("Local California time expected without offset")
        return local.replace(tzinfo=ZoneInfo("America/Los_Angeles")).astimezone(dt.timezone.utc)
    raise ValueError("Unknown source")

def digest_id(prefix: str, value: str) -> str:
    return prefix + hashlib.sha256(value.encode()).hexdigest()[:26]

def store_recorded(db_path: pathlib.Path, data_dir: pathlib.Path = DATA) -> dict:
    create_database(db_path)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON")
    result = {"sources_with_real_recorded_clips": 0, "sensors_from_original_recordings": 0,
              "videos_with_detector_measurements": 0, "observations_inserted": 0,
              "historical_co_temporal_fire_camera_matches": 0,
              "operational_fusion_authorizations": 0,
              "data_kind": "MEASURED_VIDEO_WITH_UNVALIDATED_MODEL_DERIVED_COUNTS",
              "no_raw_frames_or_personally_identifiable_data": True}
    try:
        with conn:
            for source,filename in RECORDINGS:
                path = data_dir / filename
                b = path.read_bytes()
                obj = json.loads(b)
                sha = hashlib.sha256(b).hexdigest()
                t = capture_time(source,obj)
                capture_utc = t.isoformat().replace("+00:00", "Z")
                relpath = f"investor-next/public/senda/data/referencias/{filename}"
                immutable_link = f"https://github.com/abrahamhl/civic-relay/blob/{PROVENANCE_REV}/{relpath}"
                batch_id = digest_id("batch-", source+"|"+sha)
                # Captured at an approximate batch time, not a per-frame verified timestamp.
                conn.execute("""INSERT OR IGNORE INTO observation_batches
                   (batch_id,source_id,acquisition_start_utc,acquisition_end_utc,
                   imported_at_utc,original_url,content_sha256,capture_license_text,
                   license_evidence_url,raw_mask_preserved,origin_type,validation_state)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                   (batch_id,source,capture_utc,capture_utc,
                   dt.datetime.now(dt.timezone.utc).isoformat(),
                   immutable_link,sha,"DATA_RIGHTS_PENDING_INDVIDUAL_VIDEO_CONFIRMATION",None,0,
                   "MEASURED","RESEARCH_ONLY_UNVALIDATED_OBJECT_DETECTION"))
                cameras = obj.get("camaras")
                if not isinstance(cameras,list):
                    raise ValueError("Missing authentic camera records")
                result["sources_with_real_recorded_clips"] += 1
                for idx,cam in enumerate(cameras):
                    station = str(cam.get("camara") if source=="tfl_jamcams" else cam.get("id"))
                    if not station or station=="None": raise ValueError("Missing source station id")
                    sid = digest_id("sensor-",source+"|"+station)
                    lat,lon = cam.get("lat"),cam.get("lon")
                    if not isinstance(lat,(float,int)) or not isinstance(lon,(float,int)):
                        raise ValueError("Missing official camera geolocation")
                    meta = {"source_camera_id":station,
                            "data_source":"recorded 2026 official video analyzed by YOLOX/ByteTrack",
                            "capture_time_precision":"APPROX_BATCH_NOT_PER_FRAME",
                            "capture_time_uncertainty_seconds":1800,
                            "video_reuse_licence":"UNVERIFIED_FOR_INDEPENDENT_REPUBLICATION",
                            "automated_detector_ground_truth":"NOT_INDEPENDENTLY_VALIDATED",
                            "historic_fire_overlap":"NONE",
                            "original_record_sha256":sha,
                            "original_camera_URL":cam.get("imagenEnDirecto") if source=="caltrans_cctv" else None}
                    conn.execute("""INSERT OR IGNORE INTO sensors
                      (sensor_id,source_id,modality,lat,lon,operational_permission,metadata_json)
                      VALUES(?,?,?,?,?,0,?)""",
                      (sid,source,"RGB",lat,lon,json.dumps(meta,sort_keys=True)))
                    result["sensors_from_original_recordings"]+=1
                    if source=="tfl_jamcams":
                        count = cam.get("cruces")
                        duration = cam.get("durS")
                        avg=cam.get("mediaEnImagen")
                    else:
                        vid = cam.get("video")
                        if not isinstance(vid,dict): continue  # no video != no cars
                        cr=vid.get("cruces")
                        count=sum(cr.values()) if isinstance(cr,dict) else cr
                        duration=vid.get("durS")
                        avg=vid.get("mediaEnImagen")
                    if (isinstance(count,bool) or not isinstance(count,(int,float)) or
                        not isinstance(duration,(int,float)) or count<0 or duration<=0 or
                        duration>600 or not isinstance(avg,(int,float)) or avg<0):
                        raise ValueError(f"Bad detector summary in {filename} record {idx}")
                    result["videos_with_detector_measurements"]+=1
                    for metric,val,unit in (
                        ("YOLOX_ByteTrack_crossings",float(count),"vehicle_crossings_per_clip"),
                        ("YOLOX_ByteTrack_average_occupancy",float(avg),"vehicle_boxes_per_frame"),
                        ("YOLOX_ByteTrack_rate_calculated",float(count)/duration*3600,"vehicle_crossings_per_hour_derived"),
                    ):
                        obsid=digest_id("obs-",batch_id+"|"+sid+"|"+metric)
                        evidence = {"original_file_url":immutable_link,
                            "original_file_sha256":sha,"clip_duration_seconds":float(duration),
                            "measurement_basis":"REAL_CAPTURE_MODEL_DERIVED_NOT_GROUND_TRUTH",
                            "capture_time_uncertainty_seconds":1800,
                            "may_correlate_with_historical_fire":False,
                            "calibration_status":"UNVALIDATED",
                            "source_camera_id":station}
                        before=conn.total_changes
                        conn.execute("""INSERT OR IGNORE INTO observations
                           (observation_id,batch_id,sensor_id,observed_utc,received_utc,
                            metric,value,unit,uncertainty,source_quality_code,
                            calibration_id,lat,lon,evidence_json,allow_model_fusion)
                           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                           (obsid,batch_id,sid,capture_utc,
                            dt.datetime.now(dt.timezone.utc).isoformat(),
                            metric,round(val,6),unit,None,
                            "REAL_VIDEO_MODEL_DERIVED_UNVERIFIED",None,lat,lon,
                            json.dumps(evidence,sort_keys=True)))
                        result["observations_inserted"]+=conn.total_changes-before
        result["current_total_observations"]=conn.execute("SELECT count(*) FROM observations").fetchone()[0]
        result["current_total_sources"]=conn.execute("SELECT count(*) FROM sources").fetchone()[0]
        result["operational_fusion_authorizations"]=conn.execute("SELECT count(*) FROM observations WHERE allow_model_fusion=1").fetchone()[0]
        return result
    finally:
        conn.close()

if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--db",type=pathlib.Path,required=True)
    p.add_argument("--data-dir",type=pathlib.Path,default=DATA)
    args=p.parse_args()
    print(json.dumps(store_recorded(args.db,args.data_dir),ensure_ascii=False,sort_keys=True))
