#!/usr/bin/env python3
"""Planchas reales para la película SENDA Drive (reproducible, sin datos inventados).

Fuentes (licencias verificadas):
  · Ortofoto PNOA máxima actualidad · © Instituto Geográfico Nacional (IGN), CC BY 4.0 · servicio WMS
    https://www.ign.es/wms-inspire/pnoa-ma  (autovía A-2, Madrid; solo como FONDO GENÉRICO de autopista)
  · Vídeos de dashcam de Udacity (CarND-Vehicle-Detection, CarND-Advanced-Lane-Lines) · licencia MIT
Salidas (en build/plates/, no versionadas): franja aérea alineada con la calzada, sprites de vehículos
recortados de la propia ortofoto y secuencias JPG de los vídeos a 25 fps (1280×536).
La geometría de carriles (plates.json) se MIDIÓ sobre la ortofoto (0,1186 m/px; carril ≈ 30 px ≈ 3,6 m).

Uso: python3 build-drive-plates.py
"""
import json, math, pathlib, subprocess, urllib.parse
import cv2
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'build' / 'sources'
OUT = ROOT / 'build' / 'plates'
OUT.mkdir(parents=True, exist_ok=True); (SRC / 'pnoa').mkdir(parents=True, exist_ok=True)

# ── 1. Ortofoto PNOA: 5 teselas consecutivas a lo largo de la A-2
LAT0, LON0, DLAT, DLON, TW, TH = 40.491, -3.39, 0.0012, 0.0028, 4000, 2250
STEP_LAT, STEP_LON = 0.0024, 0.0056 * 2700 / 4000          # la calzada avanza 2700 px a la derecha por 2250 px arriba
def tile(k):
    p = SRC / 'pnoa' / (f't{k}.jpg' if k == int(k) else f'h{int(k * 2)}.jpg')
    if not p.exists():
        lat, lon = LAT0 + (k - 2) * STEP_LAT, LON0 + (k - 2) * STEP_LON
        q = {'SERVICE': 'WMS', 'REQUEST': 'GetMap', 'VERSION': '1.3.0', 'LAYERS': 'OI.OrthoimageCoverage', 'STYLES': '', 'CRS': 'EPSG:4326',
             'BBOX': f'{lat - DLAT},{lon - DLON},{lat + DLAT},{lon + DLON}', 'WIDTH': str(TW), 'HEIGHT': str(TH), 'FORMAT': 'image/jpeg'}
        subprocess.run(['curl', '-sS', '--max-time', '180', '-o', str(p), 'https://www.ign.es/wms-inspire/pnoa-ma?' + urllib.parse.urlencode(q)], check=True)
    return Image.open(p).convert('RGB')
tiles = [tile(k) for k in range(5)]
mosaic = Image.new('RGB', (TW + 4 * 2700, TH + 4 * 2250))
for k in (0.5, 1.5, 2.5, 3.5):                                        # teselas intermedias: rellenan los huecos de la diagonal
    mosaic.paste(tile(k), (int(k * 2700), int((4 - k) * 2250)))
for k, t in enumerate(tiles): mosaic.paste(t, (k * 2700, (4 - k) * 2250))

PHI = math.radians(math.degrees(math.atan2(2250, 2700)) + 1.7)        # rumbo de la calzada medido
def to_orig(px, py, WR=4488, HR=4336, co=(2000, 1125)):              # tesela central rotada → original
    dx, dy = px - WR / 2, py - HR / 2; c, s = math.cos(-PHI), math.sin(-PHI)
    return co[0] + dx * c - dy * s, co[1] + dx * s + dy * c
qx, qy = to_orig(2200, 1803); mx, my = qx + 2 * 2700, qy + 2 * 2250   # carril central de la calzada B (medido)
d, n = (math.cos(PHI), -math.sin(PHI)), (math.sin(PHI), math.cos(PHI))
L, H, U0, V0 = 13600, 900, 6800, 560
strip = mosaic.transform((L, H), Image.AFFINE, (d[0], n[0], mx - U0 * d[0] - V0 * n[0], d[1], n[1], my - U0 * d[1] - V0 * n[1]), resample=Image.BICUBIC)
X0, Y0, CW, CH = 3400, 180, 7000, 700                                 # tramo central de 3 carriles (medido)
crop = np.array(strip.crop((X0, Y0, X0 + CW, Y0 + CH)))

# ── 2. Geometría medida (coordenadas del recorte)
# Línea interior (junto a la mediana) de la calzada B, MEDIDA con perfiles de brillo de las marcas viales
# (picos de píxeles > 185 en ventanas de 200 px). Los carriles van cada ≈ 30 px (3,6 m).
INNER_B = [[3000, 284], [3700, 286], [4400, 294], [5100, 281], [5800, 277], [6500, 287]]
geo = {'pxPerM': 1 / 0.1186, 'w': CW, 'h': CH, 'innerB': INNER_B, 'laneW': 30,
       'B': {'dir': 1, 'fast': 15, 'middle': 45, 'right': 75, 'edgeR': 89, 'shoulder': 104},
       'A': {'dir': -1, 'fast': -83, 'middle': -114, 'right': -144},
       'actionX': [3700, 6500],
       'source': 'PNOA © IGN CC BY 4.0 · A-2 (Madrid) · fondo genérico; el caso real ocurrió en Bélgica'}
def inner_y(x):
    P = INNER_B
    if x <= P[0][0]: return P[0][1]
    for (x0, y0), (x1, y1) in zip(P, P[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return P[-1][1]
def lane_y(off, x): return inner_y(x) + off

# ── 3. Quitar los vehículos de la foto en los carriles (para que no parezcan aparcados)
gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
bg = cv2.medianBlur(gray, 41)
diff = cv2.absdiff(gray, bg)
mask = np.zeros_like(gray)
for side in ('A', 'B'):
    for k in ('fast', 'middle', 'right'):
        off = geo[side][k]
        for x in range(2600, CW, 25):
            y = int(round(lane_y(off, x + 12))); mask[max(0, y - 8):y + 9, x:x + 25] = 255
m = ((diff > 20) & (mask > 0)).astype(np.uint8) * 255
m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2) & cv2.dilate(mask, np.ones((3, 3), np.uint8))
clean = cv2.inpaint(cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), m, 7, cv2.INPAINT_TELEA)
clean = cv2.cvtColor(clean, cv2.COLOR_BGR2RGB)
for i in range(2):
    Image.fromarray(clean[:, i * CW // 2:(i + 1) * CW // 2]).save(OUT / f'aerial-{i}.jpg', quality=92)
geo['tiles'] = ['aerial-0.jpg', 'aerial-1.jpg']

# ── 4. Sprites reales recortados de la ortofoto (tesela central rotada, mismo píxel y misma luz)
rot = tiles[2].rotate(-math.degrees(PHI), resample=Image.BICUBIC, expand=True)
band = rot.crop((1100, 1300, 3300, 2150))
def sprite(box, name, flip=False):
    im = band.crop(box).convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    a = Image.new('L', im.size, 0); w, h = im.size
    inner = Image.new('L', (max(1, w - 6), max(1, h - 6)), 255); a.paste(inner, (3, 3)); a = a.filter(ImageFilter.GaussianBlur(1.6))
    im.putalpha(a); im = im.resize((w * 4, h * 4), Image.LANCZOS); im.save(OUT / name); return {'file': name, 'lenPx': w, 'widPx': h}
geo['sprites'] = {
    'truck': sprite((553, 306, 702, 340), 'sprite-truck.png', flip=True),   # cabina al frente (+x)
    'car': sprite((941, 468, 987, 492), 'sprite-car.png'),                  # morro a la derecha (+x)
}

# ── 5. Secuencias de los vídeos (MIT) a 25 fps, 1280×536, con gradación suave
CLIPS = {'dash': ('udacity-vehicle-project.mp4', 110), 'harder': ('udacity-lane-harder.mp4', 120), 'challenge': ('udacity-lane-challenge.mp4', 110)}
for name, (f, y0) in CLIPS.items():
    od = OUT / name; od.mkdir(exist_ok=True)
    if any(od.iterdir()): continue
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(SRC / f), '-vf',
                    f'fps=25,crop=1280:536:0:{y0},eq=contrast=1.08:saturation=0.82:gamma=0.96,colorbalance=rs=-0.03:bs=0.04:rh=0.04:bh=-0.03',
                    '-q:v', '3', str(od / '%05d.jpg')], check=True)
    geo[f'frames_{name}'] = len(list(od.glob('*.jpg')))
for name in CLIPS: geo[f'frames_{name}'] = len(list((OUT / name).glob('*.jpg')))
(OUT / 'plates.json').write_text(json.dumps(geo, indent=1))
print('=>', OUT, {k: v for k, v in geo.items() if k.startswith('frames_')})
