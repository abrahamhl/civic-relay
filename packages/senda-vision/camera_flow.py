"""SENDA · Flujo de una cámara de tráfico oficial: conteo, ocupación y velocidad aproximada.

Uso: python3 camera_flow.py <clip.mp4> <modelo.onnx> <salida.json> [--line 0.6] [--step 2] [--imgs dir]

Entrada: un clip real (p. ej. HLS de Caltrans o DelDOT) y, opcionalmente, una carpeta de imágenes fijas
(la actual y las anteriores que publica el operador) para la serie temporal.
Salida (JSON, sin imágenes):
  - cruces por sentido en una línea horizontal y flujo (veh/h);
  - vehículos en imagen (media y máximo), que es una medida de ocupación;
  - velocidad aproximada por vehículo seguido. La escala sale del propio vehículo: un turismo mide
    ≈ 4,5 m, así que desplazamiento / tamaño de la caja × 4,5 m / Δt. La perspectiva afecta igual
    a ambos y se compensa en parte; la incertidumbre es de ≈ ±30 %, suficiente para distinguir
    flujo libre de congestión;
  - conteo de vehículos en cada imagen fija, en orden temporal.

Privacidad: los números de seguimiento son temporales y anónimos; no se guarda ninguna imagen, ni se
leen matrículas, ni se identifica a nadie.
"""
import sys, json, os, glob, time
import cv2, numpy as np, supervision as sv
from yolox_onnx import YoloxOnnx, VEHICLES

src, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
LINE, STEP, IMGS = arg('--line', 0.6), arg('--step', 2), arg('--imgs', '')
CAR_M = 4.5

det = YoloxOnnx(model)
res = {'clip': os.path.basename(src)}
cap = cv2.VideoCapture(src)
if cap.isOpened():
    fps = cap.get(cv2.CAP_PROP_FPS) or 15.0; W, H = int(cap.get(3)), int(cap.get(4)); ly = H * LINE
    tracker = sv.ByteTrack(frame_rate=max(1, int(round(fps / STEP))))
    last, hist, counts, per_frame, i, t0 = {}, {}, {'baja': 0, 'sube': 0}, [], 0, time.time()
    while True:
        ok, frame = cap.read()
        if not ok: break
        if i % STEP == 0:
            t = i / fps; b, s, c = det(frame)
            d = sv.Detections(xyxy=b, confidence=s, class_id=c) if len(b) else sv.Detections.empty()
            d = tracker.update_with_detections(d); per_frame.append(len(d))
            for xyxy, tid in zip(d.xyxy, d.tracker_id if d.tracker_id is not None else []):
                cx, cy = (xyxy[0] + xyxy[2]) / 2, xyxy[3]  # punto de contacto con la calzada
                size = max(xyxy[2] - xyxy[0], xyxy[3] - xyxy[1])
                hist.setdefault(int(tid), []).append((t, cx, cy, size))
                if tid in last and (last[tid] - ly) * (cy - ly) < 0: counts['baja' if cy > last[tid] else 'sube'] += 1
                last[tid] = cy
        i += 1
    dur = i / fps; speeds = []
    for tid, h in hist.items():
        if len(h) < 4 or h[-1][0] - h[0][0] < 1.0: continue
        dist = sum(np.hypot(h[k][1] - h[k - 1][1], h[k][2] - h[k - 1][2]) for k in range(1, len(h)))
        scale = CAR_M / max(1.0, float(np.median([x[3] for x in h])))
        v = dist * scale / (h[-1][0] - h[0][0]) * 3.6
        if v < 160: speeds.append(round(float(v), 1))
    tot = counts['baja'] + counts['sube']
    res.update({'frames': i, 'fps': fps, 'w': W, 'h': H, 'durS': round(dur, 1), 'cruces': counts, 'total': tot, 'flujoVehH': round(tot / max(dur, 1) * 3600),
                'mediaEnImagen': round(float(np.mean(per_frame)), 2) if per_frame else 0, 'maxEnImagen': int(max(per_frame)) if per_frame else 0,
                'seguidos': len(hist), 'velocidadesKmh': sorted(speeds), 'velMedianaKmh': round(float(np.median(speeds)), 1) if speeds else None,
                # Separar los que circulan de los parados (aparcados o en el semáforo): < 5 km/h = parado.
                'velMedianaMovKmh': round(float(np.median([v for v in speeds if v >= 5])), 1) if any(v >= 5 for v in speeds) else None,
                'fraccionParados': round(sum(v < 5 for v in speeds) / len(speeds), 2) if speeds else None,
                'procS': round(time.time() - t0, 1)})
if IMGS:
    serie = []
    for f in sorted(glob.glob(os.path.join(IMGS, 'ref*.jpg')), reverse=True) + sorted(glob.glob(os.path.join(IMGS, 'now.jpg'))):
        im = cv2.imread(f)
        if im is None: continue
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        # Imagen de relleno del operador («Temporarily Unavailable»): casi toda blanca. No es «cero coches».
        if float((g > 230).mean()) > 0.6: serie.append({'img': os.path.basename(f), 'vehiculos': None, 'sinSenal': True}); continue
        b, s, c = det(im); serie.append({'img': os.path.basename(f), 'vehiculos': int(len(b))})
    res['serieImagenes'] = serie  # de la más antigua a la actual (cada ≈ 15 min según el operador)
json.dump(res, open(out, 'w'), ensure_ascii=False)
print(json.dumps({k: v for k, v in res.items() if k not in ('velocidadesKmh', 'serieImagenes')}, ensure_ascii=False))
