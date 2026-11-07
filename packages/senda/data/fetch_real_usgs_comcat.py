#!/usr/bin/env python3
"""SENDA research-only Earthquake Catalog (USGS ComCat) historical snapshot.
Never a phone accelerometer calibration or authority-issued earthquake alert.
Standard library only; no credentials, redirects, PII, or live notifications.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query"
MAX_BYTES = 6_000_000
UTC = dt.timezone.utc

def iso_ms(timestamp):
    if isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)):
        raise ValueError("USGS epoch milliseconds required")
    moment = dt.datetime.fromtimestamp(timestamp / 1000, tz=UTC)
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")

def normalize_catalog(payload, start_date, end_date, min_magnitude, retrieved_at):
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise ValueError("Expected real USGS GeoJSON FeatureCollection")
    features = payload.get("features")
    if not isinstance(features, list) or len(features) > 500:
        raise ValueError("Unexpected USGS feature list")
    start = dt.date.fromisoformat(start_date)
    end = dt.date.fromisoformat(end_date)
    if end <= start: raise ValueError("Time interval is not increasing")
    seen, events = set(), []
    for f in features:
        if not isinstance(f, dict): raise ValueError("Invalid USGS event")
        event_id = f.get("id")
        props = f.get("properties")
        geometry = f.get("geometry")
        if (not isinstance(event_id, str) or not event_id or event_id in seen or
            not isinstance(props, dict) or not isinstance(geometry, dict) or
            geometry.get("type") != "Point"):
            raise ValueError("Missing/duplicate event ID or invalid USGS feature")
        seen.add(event_id)
        coords = geometry.get("coordinates")
        if (not isinstance(coords, list) or len(coords) < 3 or
            any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in coords[:3]) or
            not (-180 <= coords[0] <= 180) or not (-90 <= coords[1] <= 90)):
            raise ValueError("Invalid event coordinates")
        magnitude = props.get("mag")
        if (isinstance(magnitude, bool) or not isinstance(magnitude, (int, float)) or
            magnitude < min_magnitude or magnitude > 10):
            raise ValueError("Invalid/out-of-range event magnitude")
        t = iso_ms(props.get("time"))
        rev = iso_ms(props.get("updated"))
        if not (start_date <= t[:10] < end_date):
            raise ValueError("Event time outside requested interval")
        if rev < t: raise ValueError("Revision precedes event")
        events.append({
            "catalog_event_id": event_id,
            "origin_utc": t,
            "revision_updated_utc": rev,
            "magnitude": magnitude,
            "magnitude_type": props.get("magType"),
            "longitude": coords[0],
            "latitude": coords[1],
            "depth_km": coords[2],
            "event_status": props.get("status"),
            "label_type": "RETROSPECTIVE_CATALOG_LABEL_NOT_SENSOR_TRUTH",
        })
    return {
        "schema": "senda-usgs-comcat-snapshot/1",
        "source": "USGS Earthquake Hazards ComCat / FDSN",
        "source_url": ENDPOINT,
        "query": {"starttime": start_date, "endtime": end_date, "minmagnitude": min_magnitude},
        "retrieved_at_utc": retrieved_at,
        "count": len(events),
        "records": events,
        "availability_assumption": "SNAPSHOT_RETRIEVED_AT_UTC; original event publication timestamp is unknown",
        "operational_safety_clearance": False,
        "calibrates_mobile_mem_sensors": False
    }

def acquire(start, end, min_magnitude, out):
    a, b = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    if (b <= a or (b-a).days > 60 or b > dt.datetime.now(UTC).date() or
        not (4 <= min_magnitude <= 10)):
        raise ValueError("Only bounded historical research requests allowed")
    params = urllib.parse.urlencode({
        "format": "geojson", "starttime": start, "endtime": end,
        "minmagnitude": min_magnitude, "limit": 500,
        "orderby": "time-asc", "eventtype": "earthquake"
    })
    url = ENDPOINT + "?" + params
    request = urllib.request.Request(url, headers={
        "User-Agent": "SENDA-research/0.1 (https://github.com/abrahamhl/civic-relay)",
        "Accept": "application/geo+json, application/json"
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.geturl() != url or response.status != 200:
            raise ValueError("Unexpected redirect/HTTP status")
        raw = response.read(MAX_BYTES + 1)
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError("Empty/oversized snapshot")
    data = json.loads(raw)
    now = dt.datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    norm = normalize_catalog(data, start, end, min_magnitude, now)
    norm["source_url"] = url
    norm["raw_sha256"] = "sha256:" + hashlib.sha256(raw).hexdigest()
    norm["source_terms"] = "USGS FDSN API; cite source and review terms before redistribution"
    out.mkdir(parents=True, exist_ok=True)
    (out/"usgs_comcat.raw.json").write_bytes(raw)
    (out/"usgs_comcat.normalized.json").write_text(
        json.dumps(norm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return {"rows": norm["count"], "sha256": norm["raw_sha256"],
            "retrieved_at_utc": now, "status": "REAL_USGS_RESEARCH_SNAPSHOT_NOT_CALIBRATION"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2026-10-01")
    parser.add_argument("--end", default="2026-11-01")
    parser.add_argument("--min-magnitude", type=float, default=6.0)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    opts = parser.parse_args()
    print(json.dumps(acquire(opts.start, opts.end, opts.min_magnitude, opts.out), sort_keys=True))
