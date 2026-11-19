#!/usr/bin/env python3
"""Detecciones REALES de YOLOX-s (Apache-2.0) sobre el vídeo de dashcam de Udacity (MIT) para la película.
Salida: assets/plates/udacity-vehicle-detections.json  ({fps, w, h, frames:[[ [cls, x0,y0,x1,y1, score], ...], ...]})
Uso: python3 detect-plate.py <video> <modelo.onnx> [salida]
"""
import json, sys, pathlib
import cv2
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'packages' / 'senda-vision'))
from yolox_onnx import YoloxOnnx

video, model = sys.argv[1], sys.argv[2]
out = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else pathlib.Path(__file__).parent / 'assets' / 'plates' / 'udacity-vehicle-detections.json')
out.parent.mkdir(parents=True, exist_ok=True)
det = YoloxOnnx(model)
cap = cv2.VideoCapture(video)
fps = cap.get(cv2.CAP_PROP_FPS); w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
frames = []
while True:
    ok, img = cap.read()
    if not ok: break
    boxes, scores, ids = det(img, conf=0.35)
    frames.append([[int(c), *[round(float(v), 1) for v in b], round(float(s), 3)] for b, s, c in zip(boxes, scores, ids)])
    if len(frames) % 100 == 0: print(len(frames), flush=True)
out.write_text(json.dumps({'source': 'Udacity CarND-Vehicle-Detection project_video.mp4 (MIT)', 'model': 'YOLOX-s ONNX (Apache-2.0) · packages/senda-vision/yolox_onnx.py', 'fps': fps, 'w': w, 'h': h, 'frames': frames}, separators=(',', ':')))
print('=>', out, len(frames))
