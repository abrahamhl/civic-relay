#!/usr/bin/env python3
"""SENDA evidence-first SQLite registry builder (stdlib only, zero network).
Usage: python3 packages/senda/data/build_source_db.py --db /tmp/senda_sources.db
The registry does NOT attest that any camera stream or third-party API is currently live.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import pathlib
import sqlite3
from typing import Any

HERE = pathlib.Path(__file__).resolve().parent
SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS sources (
 id TEXT PRIMARY KEY, region TEXT NOT NULL, owner TEXT NOT NULL,
 kind TEXT NOT NULL, modality TEXT NOT NULL, homepage TEXT NOT NULL,
 rights TEXT NOT NULL, access_class TEXT NOT NULL, auth TEXT NOT NULL,
 documentary_status TEXT NOT NULL, video_permission INTEGER,
 spatial_accuracy TEXT, timing TEXT, intended_use TEXT,
 unresolved_gap TEXT NOT NULL, reviewed_at_utc TEXT NOT NULL,
 catalog_checked_utc TEXT, endpoint_checked_utc TEXT,
 permitted_to_ingest INTEGER NOT NULL DEFAULT 0 CHECK(permitted_to_ingest IN (0,1)),
 CHECK(video_permission IN (0,1) OR video_permission IS NULL)
);
CREATE TABLE IF NOT EXISTS sensors (
 sensor_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
 modality TEXT NOT NULL CHECK(modality IN ('RGB','THERMAL_RADIOMETRIC',
    'THERMAL_NON_RADIOMETRIC','SATELLITE_FHS','VIIRS','MET_STATION',
    'TRAFFIC_DETECTOR','OTHER')),
 lat REAL CHECK(lat BETWEEN -90 AND 90), lon REAL CHECK(lon BETWEEN -180 AND 180),
 coordinate_uncertainty_m REAL, operational_permission INTEGER NOT NULL DEFAULT 0,
 permission_evidence_url TEXT, permission_expires_at_utc TEXT,
 metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS calibrations (
 calibration_id TEXT PRIMARY KEY, sensor_id TEXT NOT NULL REFERENCES sensors(sensor_id),
 method TEXT NOT NULL, valid_from_utc TEXT NOT NULL, valid_to_utc TEXT,
 uncertainty_value REAL NOT NULL CHECK(uncertainty_value>0), uncertainty_unit TEXT NOT NULL,
 parameters_json TEXT NOT NULL, laboratory_report_url TEXT, evidence_sha256 TEXT,
 CHECK(valid_to_utc IS NULL OR valid_to_utc > valid_from_utc)
);
CREATE TABLE IF NOT EXISTS observation_batches (
 batch_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
 acquisition_start_utc TEXT NOT NULL, acquisition_end_utc TEXT NOT NULL,
 imported_at_utc TEXT NOT NULL, original_url TEXT NOT NULL,
 content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64),
 capture_license_text TEXT, license_evidence_url TEXT,
 raw_mask_preserved INTEGER NOT NULL CHECK(raw_mask_preserved IN (0,1)),
 origin_type TEXT NOT NULL CHECK(origin_type IN ('MEASURED','FORECAST','MODEL','SIMULATION')),
 validation_state TEXT NOT NULL DEFAULT 'PENDING',
 CHECK(acquisition_end_utc>=acquisition_start_utc)
);
CREATE TABLE IF NOT EXISTS observations (
 observation_id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES observation_batches(batch_id),
 sensor_id TEXT NOT NULL REFERENCES sensors(sensor_id),
 observed_utc TEXT NOT NULL, received_utc TEXT NOT NULL,
 metric TEXT NOT NULL, value REAL, unit TEXT, uncertainty REAL CHECK(uncertainty>0),
 source_quality_code TEXT, calibration_id TEXT REFERENCES calibrations(calibration_id),
 lat REAL CHECK(lat BETWEEN -90 AND 90), lon REAL CHECK(lon BETWEEN -180 AND 180),
 geo_uncertainty_m REAL CHECK(geo_uncertainty_m>=0),
 evidence_json TEXT NOT NULL DEFAULT '{}',
 allow_model_fusion INTEGER NOT NULL DEFAULT 0 CHECK(allow_model_fusion IN (0,1))
);
CREATE TABLE IF NOT EXISTS verification_events (
 event_id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL REFERENCES sources(id),
 checked_at_utc TEXT NOT NULL, verification_kind TEXT NOT NULL,
 result TEXT NOT NULL, evidence_url TEXT, evidence_sha256 TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS experiment_runs (
 run_id TEXT PRIMARY KEY, created_at_utc TEXT NOT NULL, code_sha TEXT NOT NULL,
 input_batch_ids_json TEXT NOT NULL, algorithm TEXT NOT NULL,
 evaluation_protocol TEXT NOT NULL, output_sha256 TEXT,
 status TEXT NOT NULL CHECK(status IN ('RESEARCH_ONLY','FAILED','INDEPENDENTLY_VALIDATED')),
 metrics_json TEXT NOT NULL, limitations TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_obs_sensor_time ON observations(sensor_id, observed_utc);
CREATE INDEX IF NOT EXISTS idx_obs_batch ON observations(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_time ON observation_batches(acquisition_start_utc);
CREATE INDEX IF NOT EXISTS idx_verify_source ON verification_events(source_id, checked_at_utc);
"""

def validate(source: dict[str, Any], ids: set[str]) -> None:
    required = ("id", "owner", "region", "homepage", "rights", "access",
                "auth", "kind", "modality", "gap", "status")
    if any(not isinstance(source.get(k), str) or not source[k].strip() for k in required):
        raise ValueError("Incomplete source record")
    if not source["homepage"].startswith("https://"):
        raise ValueError("Non-HTTPS source homepage")
    if source["id"] in ids:
        raise ValueError("Duplicate source id")
    if source["status"] != "OFFICIAL_DOCUMENTATION_CHECKED":
        raise ValueError("Unexpected documentary status: manual review required")
    ids.add(source["id"])

def create_database(db_path: pathlib.Path, catalog_path: pathlib.Path = HERE / "source-registry.v021.json") -> dict:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if catalog.get("schema") != "senda-source-registry/v0.21":
        raise ValueError("Unsupported registry schema")
    date = catalog["reviewedAtUTC"]
    if not date.endswith("Z") or dt.datetime.fromisoformat(date.replace("Z", "+00:00")).utcoffset() != dt.timedelta(0):
        raise ValueError("Expected RFC3339 UTC review time")
    sources = catalog["sources"]
    ids: set[str] = set()
    for s in sources:
        validate(s, ids)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(SCHEMA)
        with connection:
            for s in sources:
                vp = s.get("productionVideoPermission")
                connection.execute("""
                INSERT INTO sources(id,region,owner,kind,modality,homepage,rights,access_class,
                                    auth,documentary_status,video_permission,spatial_accuracy,
                                    timing,intended_use,unresolved_gap,reviewed_at_utc,permitted_to_ingest)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                ON CONFLICT(id) DO UPDATE SET
                    region=excluded.region,owner=excluded.owner,kind=excluded.kind,
                    modality=excluded.modality,homepage=excluded.homepage,rights=excluded.rights,
                    access_class=excluded.access_class,auth=excluded.auth,
                    documentary_status=excluded.documentary_status,
                    video_permission=excluded.video_permission,spatial_accuracy=excluded.spatial_accuracy,
                    timing=excluded.timing,intended_use=excluded.intended_use,
                    unresolved_gap=excluded.unresolved_gap,reviewed_at_utc=excluded.reviewed_at_utc
                """, (s["id"],s["region"],s["owner"],s["kind"],s["modality"],
                      s["homepage"],s["rights"],s["access"],s["auth"],s["status"],
                      None if vp is None else int(vp),s.get("spatialAccuracy"),
                      s.get("timing"),s.get("use"),s["gap"],date))
        count = connection.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
        permitted = connection.execute("SELECT COUNT(*) FROM sources WHERE permitted_to_ingest=1").fetchone()[0]
        observations = connection.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
        return {"db":str(db_path),"sources":count,"permitted_to_ingest":permitted,
                "observations":observations,"review_level":"DOCUMENTATION_ONLY"}
    finally:
        connection.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=pathlib.Path, required=True, help="SQLite path; use :memory: for ephemeral tests")
    parser.add_argument("--registry", type=pathlib.Path, default=HERE/"source-registry.v021.json")
    options = parser.parse_args()
    print(json.dumps(create_database(options.db, options.registry), ensure_ascii=False))
