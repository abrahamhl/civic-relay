"""SENDA · Medición del cordón de cámaras (señales REALES de cámaras públicas de la DGT).

Para cada cámara del plan (scripts/datos-reales/perimetro_plan.mjs) toma DOS capturas separadas al menos 130 s
(la DGT declara max-age=119, pero el 14-11-2026 medimos imágenes de 4 a 13 min de antigüedad) y mide:
  - ageS: antigüedad de la imagen (cabecera Date − Last-Modified del propio servidor de la DGT);
  - placeholder: si la imagen es el aviso «imagen no disponible» de la DGT (mismo SHA-256 que el aviso de referencia);
  - motion: fracción media de cambio de gris entre las dos capturas (160×120, 0–1); None si la fuente no renovó la imagen;
  - vehicles: vehículos detectados por YOLOX-s (Apache 2.0) en la segunda captura (coche, moto, autobús, camión).
Nunca identifica personas ni matrículas. Guarda una miniatura de 320 px de la segunda captura (CC BY, DGT) y el SHA-256
de cada imagen original. Uso: python3 -I camaras_perimetro.py <plan.json> <yolox_s.onnx> <dir_salida>
"""
import sys, os, json, time, hashlib, ssl, io, urllib.request, email.utils
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yolox_onnx import YoloxOnnx, VEHICLES

PLAN, MODEL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
CA = '/root/.ccr/ca-bundle.crt'; CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
GAP_S = 130
plan = json.load(open(PLAN))
cams = {}
for c in plan['casos']:
    for s in c['sectores']:
        if s['camara']: cams[s['camara']['id']] = s['camara']

def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'SENDA-perimetro/1.0'}), context=CTX, timeout=30) as r:
            body = r.read(); h = r.headers
            date = email.utils.parsedate_to_datetime(h['Date']).timestamp() if h.get('Date') else time.time()
            lm = email.utils.parsedate_to_datetime(h['Last-Modified']).timestamp() if h.get('Last-Modified') else None
            return {'bytes': body, 'sha256': hashlib.sha256(body).hexdigest(), 'date': date, 'lastModified': lm, 'n': len(body)}
    except Exception as e:
        return {'error': str(e)[:120]}

ref = get('https://etraffic.dgt.es/camarasEtraffic/768.jpg')  # aviso de referencia (cámara sin imagen, comprobado a mano)
REF_SHA = ref.get('sha256')
def round_(tag):
    with ThreadPoolExecutor(12) as ex: res = dict(zip(cams, ex.map(lambda k: get(cams[k]['url']), cams)))
    print(tag, sum(1 for r in res.values() if 'bytes' in r), 'de', len(res), flush=True); return res
t0 = time.time(); A = round_('captura 1')
time.sleep(max(0, GAP_S - (time.time() - t0))); B = round_('captura 2')

det = YoloxOnnx(MODEL)
def gray(b): return np.asarray(Image.open(io.BytesIO(b)).convert('L').resize((160, 120)), dtype=np.float32)
out = {}
for k, c in cams.items():
    a, b = A[k], B[k]
    if 'bytes' not in b: out[k] = {'error': b.get('error')}; continue
    ph = b['sha256'] == REF_SHA
    sig = {'placeholder': ph, 'ageS': round(b['date'] - b['lastModified'], 1) if b['lastModified'] else None, 'sha256': [a.get('sha256'), b['sha256']], 'bytes': [a.get('n'), b['n']],
           'capturas': [time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(a.get('date', 0))), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(b['date']))]}
    if not ph:
        sig['identicas'] = a.get('sha256') == b['sha256']
        # Si la fuente no ha renovado la imagen entre capturas, el movimiento NO se puede medir (no es «0»)
        sig['motion'] = None if sig['identicas'] or 'bytes' not in a else round(float(np.mean(np.abs(gray(a['bytes']) - gray(b['bytes']))) / 255), 4)
        img = Image.open(io.BytesIO(b['bytes'])).convert('RGB'); bgr = np.asarray(img)[:, :, ::-1].copy()
        boxes, scores, ids = det(bgr)
        sig['vehicles'] = int(len(ids)); sig['porClase'] = {VEHICLES[i]: int((ids == i).sum()) for i in set(ids.tolist())}
        th = img.copy(); th.thumbnail((320, 240)); th.save(os.path.join(OUT, f'cam_{k}.jpg'), quality=78, optimize=True); sig['miniatura'] = f'cam_{k}.jpg'
    out[k] = sig
res = {'generado': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'plan': os.path.basename(PLAN), 'separacionMinS': GAP_S,
       'modelo': {'nombre': 'YOLOX-s ONNX (Megvii, Apache 2.0)', 'sha256': hashlib.sha256(open(MODEL, 'rb').read()).hexdigest(), 'umbral': 0.35, 'clases': list(VEHICLES.values())},
       'avisoReferencia': {'url': 'https://etraffic.dgt.es/camarasEtraffic/768.jpg', 'sha256': REF_SHA},
       'fuente': 'DGT · imágenes de cámaras (etraffic.dgt.es), inventario DATEX II v3.7 (CC BY)', 'privacidad': 'solo recuentos agregados de vehículos; sin personas ni matrículas',
       'camaras': out}
json.dump(res, open(os.path.join(OUT, 'medicion.json'), 'w'), ensure_ascii=False, indent=1)
ok = [s for s in out.values() if 'error' not in s]
print('medidas', len(ok), '· aviso no disponible', sum(1 for s in ok if s['placeholder']), '· con vehículos', sum(1 for s in ok if s.get('vehicles', 0) > 0), '· idénticas', sum(1 for s in ok if s.get('identicas')))
