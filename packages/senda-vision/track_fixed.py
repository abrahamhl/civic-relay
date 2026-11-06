"""SENDA · Cámara fija: detección (YOLOX) + seguimiento (ByteTrack) + conteo por sentido en una línea.

Uso: python3 track_fixed.py <video> <modelo.onnx> <salida_dir> [--line 0.5]
Salida: fixed.mp4 (anotado), fixed.json (métricas agregadas). Nada identifica personas ni vehículos
concretos: los números de seguimiento son temporales y anónimos y la imagen no sale del relé en producción.
"""
import sys, json, subprocess, time
import cv2, numpy as np, supervision as sv
from PIL import ImageDraw
from yolox_onnx import YoloxOnnx, VEHICLES
from overlay import font, begin, end, corners, chip, panel, CYAN, AMBER, GREEN, WHITE

src, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
LINE = float(sys.argv[sys.argv.index("--line") + 1]) if "--line" in sys.argv else 0.5
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 12.5; W, H = int(cap.get(3)), int(cap.get(4))
det, tracker = YoloxOnnx(model), sv.ByteTrack(frame_rate=int(round(fps)))
ff = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{out}/fixed.mp4"], stdin=subprocess.PIPE)
ly = int(H * LINE); last, trails, counts, events, per_frame = {}, {}, {"baja": 0, "sube": 0}, [], []
F1, F2, F3 = font(15), font(13, "Medium"), font(22, "Bold")
i, t0 = 0, time.time()
while True:
    ok, frame = cap.read()
    if not ok: break
    t = i / fps; boxes, scores, cls = det(frame)
    d = sv.Detections(xyxy=boxes, confidence=scores, class_id=cls) if len(boxes) else sv.Detections.empty()
    d = tracker.update_with_detections(d)
    img, layer, ov = begin(frame)
    ov.line([(0, ly), (W, ly)], fill=AMBER + (220,), width=2); chip(ov, (8, ly - 4), "línea de conteo", AMBER, F2)
    for xyxy, tid, c, s in zip(d.xyxy, d.tracker_id if d.tracker_id is not None else [], d.class_id, d.confidence):
        cx, cy = (xyxy[0] + xyxy[2]) / 2, (xyxy[1] + xyxy[3]) / 2
        tr = trails.setdefault(tid, []); tr.append((cx, cy)); del tr[:-24]
        if tid in last and (last[tid] - ly) * (cy - ly) < 0:
            dirn = "baja" if cy > last[tid] else "sube"; counts[dirn] += 1; events.append({"t": round(t, 2), "sentido": dirn, "clase": VEHICLES[int(c)]})
        last[tid] = cy
        if len(tr) > 1: ov.line(tr, fill=CYAN + (150,), width=2)
        corners(ov, tuple(map(float, xyxy)), CYAN); chip(ov, (xyxy[0], xyxy[1] - 2), f"{VEHICLES[int(c)]} · {s:.2f} · #{tid}", CYAN, F2)
    n = len(d); per_frame.append(n); total = counts["baja"] + counts["sube"]; rate = total / max(t, 1) * 60
    panel(ov, (12, H - 112), [("SENDA · cámara fija (vídeo real)", F1, WHITE), (f"{total} vehículo{'s' if total != 1 else ''} cruza{'n' if total != 1 else ''} · ↓ {counts['baja']}  ↑ {counts['sube']}", F3, GREEN),
                          (f"{rate:.1f} veh/min · {n} en imagen · t = {t:.1f} s", F2, WHITE), ("YOLOX (Apache 2.0) + ByteTrack · sin identificar a nadie", F2, (159, 178, 188))], w=360)
    ff.stdin.write(end(img, layer).tobytes()); i += 1
ff.stdin.close(); ff.wait(); dur = i / fps
bins = [sum(1 for e in events if k * 5 <= e["t"] < (k + 1) * 5) for k in range(int(np.ceil(dur / 5)))]
res = {"video": src.split("/")[-1], "frames": i, "fps": fps, "durationS": round(dur, 2), "counts": counts, "total": sum(counts.values()),
       "perMinute": round(sum(counts.values()) / dur * 60, 1), "per5s": bins, "meanInFrame": round(float(np.mean(per_frame)), 2), "maxInFrame": int(max(per_frame)),
       "events": events, "model": "YOLOX-s ONNX (Apache 2.0)", "tracker": "ByteTrack (supervision, MIT)", "procSeconds": round(time.time() - t0, 1)}
json.dump(res, open(f"{out}/fixed.json", "w"), ensure_ascii=False, indent=1); print(json.dumps({k: v for k, v in res.items() if k != "events"}, ensure_ascii=False))
