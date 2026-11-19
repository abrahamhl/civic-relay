"""SENDA · Escáner de vídeos de cámaras de vehículo: TeslaCam (memoria USB del propio Tesla) y dashcams.

Lo ejecuta el DUEÑO en su equipo, sobre sus propios clips. Detecta anomalías en la vía (vehículo atravesado,
vehículo detenido delante, persona en la calzada) con YOLOX (Apache-2.0) y emite EVENTOS
`senda-camera-event/1` (JSON por línea): qué, dónde y cuándo. NUNCA emite imágenes, matrículas ni caras.

Verdad sobre las fuentes (docs/roadsafe/19_*):
- TeslaCam: carpetas TeslaCam/SavedClips y TeslaCam/SentryClips con subcarpetas por evento, vídeos por cámara
  (…-front.mp4, …-back.mp4, …-left_repeater.mp4, …-right_repeater.mp4) y event.json. Tesla documenta las
  carpetas y que event.json «tiene información del evento», pero NO publica sus campos: se leen de forma
  defensiva (est_lat/est_lon/timestamp/reason si existen; nombres no verificados).
- Las reglas de detección son HEURÍSTICAS SIN VALIDAR y sus umbrales se DECLARAN en un fichero de
  configuración (regla de veracidad: sin valores por defecto). Ejemplo declarado: example_scan_config.json.
- El `score` es la salida del detector, no una probabilidad calibrada.
- El tiempo hasta el impacto (TTC) por crecimiento de la caja usa diferencias hacia atrás: va ~1 paso de
  muestreo por detrás del real (más prudente cuanto menor sea strideFrames).

Uso:
  python3 vehicle_camera_scan.py --config example_scan_config.json --model yolox_s.onnx \
      --teslacam /media/USB/TeslaCam --device-label "mi-coche" [--share] [--out eventos.jsonl]
  python3 vehicle_camera_scan.py --config cfg.json --model yolox_s.onnx --video clip.mp4 \
      --lat 40.4 --lon -3.7 --start-epoch 1763460000 --device-label dashcam1 [--share]
"""
import argparse, hashlib, json, math, os, re, sys

SCHEMA = "senda-camera-event/1"
REQUIRED_CFG = ["egoLane", "roadArea", "strideFrames", "minScore", "minFrames", "acrossAspect", "minBoxHFrac", "ttcS", "maxSeconds"]
VEHICLE_IDS, PERSON_ID = {2, 3, 5, 7}, 0
TESLA_CAMS = ("front", "back", "left_repeater", "right_repeater", "left_pillar", "right_pillar")


def load_config(path):
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    missing = [k for k in REQUIRED_CFG if k not in cfg]
    if missing:
        raise ValueError(f"configuración incompleta: {', '.join(missing)} deben declararse")
    return cfg


def device_pseudonym(label):
    """Seudónimo estable del dispositivo: nunca se lee el VIN ni datos del vehículo."""
    return "dev-" + hashlib.sha256(("senda-camera|" + label).encode("utf-8")).hexdigest()[:16]


def read_event_json(path):
    """event.json de TeslaCam leído de forma defensiva (campos no documentados por Tesla)."""
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, ValueError):
        return {}
    out = {"raw_keys": sorted(raw.keys())}
    for k_lat, k_lon in (("est_lat", "est_lon"), ("lat", "lon")):
        try:
            lat, lon = float(raw[k_lat]), float(raw[k_lon])
            if -90 <= lat <= 90 and -180 <= lon <= 180 and not (lat == 0 and lon == 0):
                out["lat"], out["lon"] = lat, lon
                break
        except (KeyError, TypeError, ValueError):
            continue
    if isinstance(raw.get("timestamp"), str):
        out["timestamp"] = raw["timestamp"]
    if isinstance(raw.get("reason"), str):
        out["reason"] = raw["reason"]
    return out


FOLDER_TIME = re.compile(r"(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})")


def find_teslacam_clips(root):
    """Eventos guardados (SavedClips, SentryClips): carpeta, vídeo frontal y event.json si existe."""
    clips = []
    for sub in ("SavedClips", "SentryClips"):
        base = os.path.join(root, sub)
        if not os.path.isdir(base):
            continue
        for d in sorted(os.listdir(base)):
            folder = os.path.join(base, d)
            if not os.path.isdir(folder):
                continue
            fronts = sorted(f for f in os.listdir(folder) if f.endswith("-front.mp4"))
            if not fronts:
                continue
            ej = os.path.join(folder, "event.json")
            clips.append({"kind": sub, "folder": folder, "name": d, "front": [os.path.join(folder, f) for f in fronts],
                          "event": read_event_json(ej) if os.path.isfile(ej) else {}})
    return clips


def _inside(poly, x, y):
    """Punto en polígono (coordenadas normalizadas 0–1), por rayos."""
    inside, n = False, len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-12) + x1:
            inside = not inside
    return inside


def analyze_detections(frames, cfg, width, height):
    """Heurísticas SIN VALIDAR sobre detecciones por fotograma.

    frames: [(t_s, [(x1, y1, x2, y2, cls, score), …]), …] en píxeles.
    Devuelve [(anomaly, t_first, max_score, heuristic_name)], una por tipo y por racha de fotogramas.
    """
    rules = {
        "VEHICLE_ACROSS_LANE": "caja-ancha-en-carril-propio",
        "STOPPED_VEHICLE_IN_LANE": "ttc-por-crecimiento-de-caja",
        "PERSON_ON_ROADWAY": "persona-en-area-de-calzada",
    }
    streak = {k: 0 for k in rules}; first = {}; best = {}; prev_h = None; prev_t = None; out = []
    for t, dets in frames:
        hits = {k: None for k in rules}
        lane_h = None
        for (x1, y1, x2, y2, cls, sc) in dets:
            if sc < cfg["minScore"]:
                continue
            cx, by = (x1 + x2) / 2 / width, y2 / height
            w, h = (x2 - x1), (y2 - y1)
            if cls in VEHICLE_IDS and _inside(cfg["egoLane"], cx, by):
                if h / height >= cfg["minBoxHFrac"] and w / max(h, 1e-6) >= cfg["acrossAspect"]:
                    hits["VEHICLE_ACROSS_LANE"] = max(sc, hits["VEHICLE_ACROSS_LANE"] or 0)
                lane_h = max(lane_h or 0, h)
            if cls == PERSON_ID and _inside(cfg["roadArea"], cx, by):
                hits["PERSON_ON_ROADWAY"] = max(sc, hits["PERSON_ON_ROADWAY"] or 0)
        if lane_h and prev_h and prev_t is not None and t > prev_t and lane_h > prev_h:
            ttc = lane_h / ((lane_h - prev_h) / (t - prev_t))
            if ttc <= cfg["ttcS"]:
                hits["STOPPED_VEHICLE_IN_LANE"] = 1.0  # sin score de clase propio: se usa 1.0 como «regla cumplida»
        prev_h, prev_t = lane_h, t
        for k in rules:
            if hits[k] is not None:
                streak[k] += 1; first.setdefault(k, t); best[k] = max(best.get(k, 0), hits[k])
                if streak[k] == cfg["minFrames"]:
                    out.append((k, first[k], best[k] if k != "STOPPED_VEHICLE_IN_LANE" else None, rules[k]))
            else:
                streak[k] = 0; first.pop(k, None); best.pop(k, None)
    return out


def make_event(anomaly, at, lat, lon, device_id, score, heuristic, model, share, origin):
    return {"schema": SCHEMA, "eventId": hashlib.sha256(f"{device_id}|{origin}|{anomaly}|{at:.1f}".encode()).hexdigest()[:20],
            "source": "TESLACAM_USB" if origin.startswith("teslacam:") else "GENERIC_DASHCAM", "deviceId": device_id,
            "at": round(at, 1), "lat": lat, "lon": lon, "anomaly": anomaly,
            "detector": {"model": model, "version": "0.1.1rc0", "score": None if score is None else round(float(score), 3)},
            "heuristic": {"name": heuristic, "validated": False}, "consent": {"share": bool(share)}}


def detect_video(path, detector, cfg):
    """Ejecuta el detector sobre un vídeo con el paso declarado. Devuelve (frames, ancho, alto, fps)."""
    import cv2
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    if fps <= 0:
        raise ValueError(f"vídeo sin fps legible: {path}")
    W, H = int(cap.get(3)), int(cap.get(4)); frames, i = [], 0
    classes = {2: "coche", 3: "moto", 5: "autobús", 7: "camión", 0: "persona"}
    while i / fps <= cfg["maxSeconds"]:
        ok, img = cap.read()
        if not ok:
            break
        if i % int(cfg["strideFrames"]) == 0:
            boxes, scores, ids = detector(img, conf=cfg["minScore"], classes=classes)
            frames.append((i / fps, [(*map(float, b), int(c), float(s)) for b, s, c in zip(boxes, scores, ids)]))
        i += 1
    cap.release()
    return frames, W, H, fps


def scan_teslacam(root, detector, cfg, device_id, share, model, utc_offset_min=None):
    events, skipped = [], []
    for clip in find_teslacam_clips(root):
        lat, lon = clip["event"].get("lat"), clip["event"].get("lon")
        m = FOLDER_TIME.search(clip["name"])
        if lat is None or lon is None:
            skipped.append({"clip": clip["name"], "why": "sin posición en event.json: no se emite evento"}); continue
        if not m or utc_offset_min is None:
            skipped.append({"clip": clip["name"], "why": "hora del clip sin zona horaria declarada (--utc-offset-min)"}); continue
        import calendar
        y, mo, d, hh, mi, ss = map(int, m.groups())
        t0 = calendar.timegm((y, mo, d, hh, mi, ss, 0, 0, 0)) - utc_offset_min * 60
        for front in clip["front"]:
            frames, W, H, _ = detect_video(front, detector, cfg)
            for anomaly, t, sc, heur in analyze_detections(frames, cfg, W, H):
                events.append(make_event(anomaly, t0 + t, lat, lon, device_id, sc, heur, model, share, f"teslacam:{clip['name']}"))
    return events, skipped


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True); ap.add_argument("--model", required=True)
    ap.add_argument("--device-label", required=True); ap.add_argument("--share", action="store_true")
    ap.add_argument("--teslacam"); ap.add_argument("--video")
    ap.add_argument("--lat", type=float); ap.add_argument("--lon", type=float); ap.add_argument("--start-epoch", type=float)
    ap.add_argument("--utc-offset-min", type=int); ap.add_argument("--out")
    a = ap.parse_args(argv)
    cfg = load_config(a.config)
    from yolox_onnx import YoloxOnnx
    det, dev = YoloxOnnx(a.model), device_pseudonym(a.device_label)
    if a.teslacam:
        events, skipped = scan_teslacam(a.teslacam, det, cfg, dev, a.share, os.path.basename(a.model), a.utc_offset_min)
    elif a.video:
        if a.lat is None or a.lon is None or a.start_epoch is None:
            ap.error("con --video hay que declarar --lat, --lon y --start-epoch (no se inventa posición ni hora)")
        frames, W, H, _ = detect_video(a.video, det, cfg)
        events = [make_event(k, a.start_epoch + t, a.lat, a.lon, dev, sc, h, os.path.basename(a.model), a.share, f"video:{os.path.basename(a.video)}")
                  for k, t, sc, h in analyze_detections(frames, cfg, W, H)]
        skipped = []
    else:
        ap.error("indica --teslacam o --video")
    out = open(a.out, "w", encoding="utf-8") if a.out else sys.stdout
    for e in events:
        out.write(json.dumps(e, ensure_ascii=False) + "\n")
    if a.out:
        out.close()
    print(json.dumps({"events": len(events), "skipped": skipped, "basis": "HEURISTICA_SIN_VALIDAR"}, ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    main()
