"""SENDA · Cámara a bordo (el móvil en el soporte o la cámara del coche): vehículos delante, carril,
distancia estimada y tiempo hasta alcanzarlos.

Uso: python3 track_dashcam.py <video> <modelo.onnx> <salida_dir> [--seconds 36] [--stride 2]
- Tiempo hasta alcanzarlo (TTC) SIN calibrar: TTC = h / (dh/dt), con h la ALTURA de la caja (la anchura
  crece también al ver el lateral al adelantar). Si la caja no crece, no se acerca.
- Distancia ESTIMADA: Z = f·1,45 m / h, suponiendo 1,45 m de altura de turismo y una focal de una cámara de
  ~65° de campo horizontal. Incertidumbre del orden de ±30 % (un camión parece más cerca): orientativa.
- Vehículos de la calzada contraria: se cuentan como CONTACTOS (los que llevarían el SOS de SENDA), no como peligro.
- Carril propio: trapecio fijado a mano para este vídeo (en el producto, detección de líneas).
Salida: dashcam.mp4 (anotado) y dashcam.json (series agregadas). Nada identifica vehículos concretos.
"""
import sys, json, math, subprocess, time
import cv2, numpy as np, supervision as sv
from PIL import ImageDraw
from yolox_onnx import YoloxOnnx, VEHICLES
from overlay import font, begin, end, corners, chip, panel, CYAN, AMBER, RED, GREEN, WHITE

src, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
SECS, STRIDE, OUTW = arg("--seconds", 36), int(arg("--stride", 2)), 960
cap = cv2.VideoCapture(src); fps0 = cap.get(cv2.CAP_PROP_FPS) or 25; W, H = int(cap.get(3)), int(cap.get(4)); fps = fps0 / STRIDE
F = (W / 2) / math.tan(math.radians(65 / 2))      # focal supuesta (px)
EGO = np.array([(255, 690), (600, 445), (680, 445), (1111, 690)], np.int32) * np.array([W / 1280, H / 720])
inside = lambda x, y: cv2.pointPolygonTest(EGO.astype(np.float32), (float(x), float(y)), False) >= 0
det, tracker = YoloxOnnx(model), sv.ByteTrack(frame_rate=int(round(fps)))
OH = int(H * OUTW / W)
ff = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OUTW}x{OH}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{out}/dashcam.mp4"], stdin=subprocess.PIPE)
hist, series, F1, F2, F3 = {}, [], font(20), font(17, "Medium"), font(30, "Bold")
k, i, t0, seen, opp = 0, 0, time.time(), set(), set()
while True:
    ok, frame = cap.read()
    if not ok or k / fps0 > SECS: break
    if k % STRIDE: k += 1; continue
    t = k / fps0; k += 1
    boxes, scores, cls = det(frame)
    d = sv.Detections(xyxy=boxes, confidence=scores, class_id=cls) if len(boxes) else sv.Detections.empty()
    d = tracker.update_with_detections(d)
    img, layer, ov = begin(frame)
    ov.polygon([tuple(p) for p in EGO], fill=(52, 211, 153, 34), outline=(52, 211, 153, 150))
    lead, near = None, None
    for xyxy, tid, c, s in zip(d.xyxy, d.tracker_id if d.tracker_id is not None else [], d.class_id, d.confidence):
        x1, y1, x2, y2 = map(float, xyxy); w = max(1.0, x2 - x1); seen.add(int(tid))
        h = hist.setdefault(tid, []); h.append((t, max(1.0, y2 - y1))); del h[:-int(fps * 1.2)]   # la ALTURA crece solo con la escala; la anchura, también al ver el lateral
        ttc, edge = None, x1 < 6 or x2 > W - 6 or y2 > H - 6        # caja cortada por el borde: su anchura no es fiable
        if edge: h.clear()
        z = F * 1.45 / max(1.0, y2 - y1); mine = inside((x1 + x2) / 2, y2)
        lx = EGO[0][0] + (EGO[1][0] - EGO[0][0]) * (EGO[0][1] - y2) / (EGO[0][1] - EGO[1][1])   # borde izquierdo del carril a esa altura
        oncoming = (x1 + x2) / 2 < lx - 40                                                       # al otro lado de la mediana
        if len(h) >= max(5, int(fps * 0.8)):
            tt = np.array([a for a, _ in h]); lw = np.log([b for _, b in h]); sl = np.polyfit(tt - tt[0], lw, 1)[0]
            ttc = 1 / sl if sl > 1e-3 else None
            if ttc and z / ttc > 25: ttc = None                        # más de 25 m/s de acercamiento: artefacto, no se usa
        if oncoming: opp.add(int(tid))
        col = (RED if ttc and ttc < 4 else AMBER) if mine else (159, 178, 188) if oncoming else CYAN
        corners(ov, (x1, y1, x2, y2), col)
        chip(ov, (x1, y1 - 2), f"{VEHICLES[int(c)]} · ~{z:.0f} m" + (" · sentido contrario" if oncoming else f" · se acerca {ttc:.1f} s" if ttc and ttc < 15 else ""), col, F2)
        if mine and (lead is None or z < lead[0]): lead = (z, ttc, tid)
        if ttc and ttc < 15 and not oncoming and (near is None or ttc < near[1]): near = (z, ttc, 'tu carril' if mine else 'carril contiguo')
    n = len(d)
    if lead and lead[1] and lead[1] < 4: msg, mc = f"¡Frena! Alcanzas al de delante en {lead[1]:.1f} s", RED
    elif lead and lead[1] and lead[1] < 15: msg, mc = f"El de delante se acerca: {lead[1]:.1f} s", AMBER
    elif lead: msg, mc = "Distancia estable con el de delante", GREEN
    elif near: msg, mc = f"Te acercas a un vehículo del {near[2]}: ~{near[0]:.0f} m, {near[1]:.1f} s", CYAN
    else: msg, mc = "Carril libre por delante", GREEN
    panel(ov, (16, 16), [("SENDA · cámara a bordo (vídeo real)", F1, WHITE), (msg, F3 if mc == RED else F2, mc),
                          (f"Delante: {'~%.0f m' % lead[0] if lead else '—'} · a la vista: {n} · cruzados de frente: {len(opp)} · t = {t:.1f} s", F2, WHITE),
                          ("Tiempo hasta alcanzarlo por crecimiento de la caja (sin calibrar)", F2, (159, 178, 188))], w=640)
    series.append({"t": round(t, 2), "n": n, "leadM": round(lead[0], 1) if lead else None, "ttcS": round(lead[1], 2) if lead and lead[1] else None,
                   "nearM": round(near[0], 1) if near else None, "nearTtcS": round(near[1], 2) if near else None, "nearLane": near[2] if near else None})
    ff.stdin.write(cv2.resize(end(img, layer), (OUTW, OH), interpolation=cv2.INTER_AREA).tobytes()); i += 1
ff.stdin.close(); ff.wait()
leadTs = [s for s in series if s["leadM"]]; ttcs = [s["ttcS"] for s in series if s["ttcS"]]
res = {"video": src.split("/")[-1], "framesProcessed": i, "fps": fps, "durationS": round(series[-1]["t"], 2), "vehiclesTracked": len(seen), "oncomingTracked": len(opp), "oncomingPerMin": round(len(opp) / max(1e-9, series[-1]["t"]) * 60, 1),
       "meanVisible": round(float(np.mean([s["n"] for s in series])), 2), "leadShare": round(len(leadTs) / len(series), 3),
       "minTtcS": round(min(ttcs), 2) if ttcs else None, "approachShare": round(sum(1 for s in series if s["nearTtcS"]) / len(series), 3),
       "minApproachTtcS": min([s["nearTtcS"] for s in series if s["nearTtcS"]], default=None), "brakeAlerts": sum(1 for x in ttcs if x < 4), "focalPx": round(F, 1),
       "assumptions": {"carHeightM": 1.45, "hfovDeg": 65, "egoLane": "trapecio fijado a mano", "oncoming": "a la izquierda de la mediana"}, "series": series,
       "model": "YOLOX-s ONNX (Apache 2.0)", "tracker": "ByteTrack (supervision 0.26.1, MIT)", "procSeconds": round(time.time() - t0, 1)}
json.dump(res, open(f"{out}/dashcam.json", "w"), ensure_ascii=False); print(json.dumps({k: v for k, v in res.items() if k != "series"}, ensure_ascii=False))
