# SENDA — independent source-access verification backlog (2026-11-07 UTC)

**Status: ACCESS BLOCKED / PROPOSAL ONLY.** Independent review of PR #18 (head `ece979b5c5be510a5a5d413fbd261b37aaa88ddb`), not a calibration or dataset acquisition. This branch starts from PR #18's **base**, not its head, to avoid touching DeepSeek or competing calibration changes. Runtime HTTPS request to USGS failed with DNS resolution error; web inspection of USGS metadata and Digitraffic pages also failed. Therefore **no new raw bytes, SHA-256, publication timestamps, license approvals or precision measurements are claimed**. Do not invent these values.

| Source / official entry | Acquisition target | Access barrier / verification still required |
|---|---|---|
| NOAA GOES ABI FHS: https://www.ncei.noaa.gov/products/satellite/goes-r-series | one historical L2 FHS granule including Mask and DQF | locate official public object, confirm product version, archive license, pixel geolocation and bit definitions; avoid treating pixel center as fire perimeter |
| NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/download/ | VIIRS standard science-quality historical extract | confirm Earthdata/token requirements, collection version, redistribution terms, confidence/quality definitions and acquisition vs publication time |
| NIST WUI: https://www.nist.gov/programs-projects/wildland-urban-interface-wui-fire-data-collection-parcel-vulnerabilities | published Camp Fire timeline | verify report revision, event time uncertainty and public reuse rights |
| EFFIS: https://forest-fire.emergency.copernicus.eu/applications/data-and-services | historical burned-area perimeter | check registration, product-level attribution/license, polygon precision and release lag |
| MTBS: https://burnseverity.cr.usgs.gov/direct-download | one historical burn-severity product | verify public access, metadata, projection, release date, processing revision; post-event label only |
| ERA5: https://cds.climate.copernicus.eu/ | one bounded reanalysis grid/time | CDS account/API acceptance may be needed; record ERA5 release availability and uncertainty; never use future reanalysis as real-time predictor |
| Digitraffic TMS: https://www.digitraffic.fi/en/road-traffic/ | one station/time snapshot | check current API policy and license, sensor timestamp, units, quality/coverage and rate limits; avoid camera matching without calibration |
| Caltrans PeMS: https://dot.ca.gov/programs/traffic-operations/mpr/pems-source | bounded station series | user registration/approval and redistribution conditions require confirmation |
| GloFAS: https://ewds.climate.copernicus.eu/datasets/cems-glofas-historical | one historical river cell/time | CDS/EWDS login and terms; forecast vs reanalysis availability, units and spatial support must be separated |
| USGS Water: https://api.waterdata.usgs.gov/ | one site, one short interval | API availability blocked here; check provisional vs approved flags, datum, station timezone, units and publication/revision |
| USGS ComCat: https://earthquake.usgs.gov/fdsnws/event/1/ | one small GeoJSON historical window | DNS resolution blocked here; preserve updated time, uncertainty, depth/magnitude type, review status, and revised-event semantics |
| NOAA NGS CORS/GNSS: https://www.ngs.noaa.gov/CORS/data.shtml | one short station RINEX observation | confirm accessible archive and applicable reuse terms, RINEX epoch/time system, station coordinates and receiver metadata; not a phone positioning benchmark |

## Reproducible acceptance gate (before any future data commit)
1. Fetch only from official HTTPS host, with redirects disabled or validated **before** following; bounded request, size cap, retry/backoff and explicit HTTP status. Do not publish API keys or station-sensitive records.
2. Preserve exact response bytes (not JSON reserialization) and compute `raw_sha256` over them. Record request URL without secrets, response headers (ETag/Last-Modified if supplied), retrieved_at_utc, source_published_at_utc **or null**, product version, license URL and verified rights scope **or UNVERIFIED**.
3. Include time zone/time scale (UTC/GPS as applicable), spatial CRS, units, source quality flags and their official dictionary, uncertainty, coverage and missing-data semantics; null if absent rather than invented.
4. Offline contract tests: SHA256 recomputation; bounds and max size; timestamp parse; reject nonfinite values; unit/CRS consistency; flags preserved; license unknown => no redistribution; `available_at_utc <= decision_t0` for predictors; grouped event/site holdouts.
5. Only after successful rights verification and retrieval, open a follow-up evidence PR with a tiny licensed snapshot and tests. No change to models, calibration coefficients, production or PR #18.

**This document is a blocked-access work item, not evidence that official links, license terms or rate limits were successfully checked today.**
