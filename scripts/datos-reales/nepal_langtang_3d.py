"""SENDA · Relieve y ruta de vuelo para el caso de Langtang (Nepal, 26-08-2026).
Copernicus DEM GLO-30 (AWS copernicus-dem-30m) remuestreado a la malla del caso (UTM 45N) a 60 m → dem_60m.bin
(uint16, metros, fila 0 = norte). Ruta de cámara CALCULADA a partir de la máscara de cambio Sentinel-2 que produce
nepal_langtang_s2.py: distancia geodésica sobre la máscara desde el punto más cercano al origen USGS (us7000tbwb) y
media por tramos. Escribe nepal_3d.json con procedencia. Uso: python3 -I nepal_langtang_3d.py (después del de S2)."""
import os, json, numpy as np, rasterio
from collections import deque
from PIL import Image
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform as wtr
from rasterio.transform import from_origin
from scipy import ndimage
os.environ['CURL_CA_BUNDLE'] = '/root/.ccr/ca-bundle.crt'; os.environ['GDAL_DISABLE_READDIR_ON_OPEN'] = 'EMPTY_DIR'
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'investor-next', 'public', 'senda', 'data', 'nepal2026')
S2 = json.load(open(os.path.join(D, 'nepal_s2.json'))); x0, y0, x1, y1 = S2['bounds_utm']; CRS = S2['crs']
RES = 60; W, H = int((x1 - x0) / RES), int((y1 - y0) / RES); T = from_origin(x0, y1, RES, RES)
DEM_URL = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N28_00_E085_00_DEM/Copernicus_DSM_COG_10_N28_00_E085_00_DEM.tif'
dem = np.zeros((H, W), dtype='float32')
with rasterio.open('/vsicurl/' + DEM_URL) as src: reproject(rasterio.band(src, 1), dem, dst_transform=T, dst_crs=CRS, resampling=Resampling.bilinear)
np.clip(dem, 0, 65535).astype('<u2').tofile(os.path.join(D, 'dem_60m.bin'))
# Ruta: camino de mínimo coste sobre la máscara de cambio (a 60 m): coste 1 en píxeles cambiados, 12 fuera.
# Inicio: píxel más cercano al origen USGS (us7000tbwb). Final: píxel cambiado más al suroeste (extremo aguas abajo en el área).
import heapq
m20 = np.array(Image.open(os.path.join(D, 'cambio_pre_post.png')))[:, :, 3] > 0; f = RES // S2['resolucion_m']
hh, ww = m20.shape[0] // f, m20.shape[1] // f; m = m20[:hh * f, :ww * f].reshape(hh, f, ww, f).any(axis=(1, 3))
cost = np.where(m, 1.0, 12.0); oi, oj = [v // f for v in S2['origenUSGS']['pixel']]
ys, xs = np.nonzero(m); k = np.argmin(np.hypot(ys - oi, xs - oj)); start = (int(ys[k]), int(xs[k])); k2 = np.argmax(ys - xs); goal = (int(ys[k2]), int(xs[k2]))
dist = np.full(m.shape, np.inf); prev = {}; dist[start] = 0; pq = [(0.0, start)]
while pq:
    d, (i, j) = heapq.heappop(pq)
    if (i, j) == goal: break
    if d > dist[i, j]: continue
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            a2, b2 = i + di, j + dj
            if (di or dj) and 0 <= a2 < hh and 0 <= b2 < ww:
                nd = d + cost[a2, b2] * (1.4142 if di and dj else 1.0)
                if nd < dist[a2, b2]: dist[a2, b2] = nd; prev[(a2, b2)] = (i, j); heapq.heappush(pq, (nd, (a2, b2)))
cells = [goal]
while cells[-1] != start: cells.append(prev[cells[-1]])
cells.reverse(); onMask = float(np.mean([m[c] for c in cells]))
path, acc, last = [], 0.0, None
for idx, (i, j) in enumerate(cells):
    if last is not None: acc += np.hypot(i - last[0], j - last[1]) * RES
    last = (i, j)
    if idx and acc - (path[-1]['km'] * 1000 if path else 0) < 1000 and idx != len(cells) - 1: continue
    ex, ny = x0 + (j + 0.5) * RES, y1 - (i + 0.5) * RES; lon, lat = wtr(CRS, 'EPSG:4326', [ex], [ny])
    path.append({'lat': round(lat[0], 5), 'lon': round(lon[0], 5), 'u': round(float((j + 0.5) / ww), 4), 'v': round(float((i + 0.5) / hh), 4), 'z': float(dem[min(i, H - 1), min(j, W - 1)]), 'km': round(acc / 1000, 2)})
reach_km = acc / 1000
out = {'dem': {'fichero': 'dem_60m.bin', 'formato': 'uint16 little-endian, metros, fila 0 = norte', 'ancho': W, 'alto': H, 'resolucion_m': RES, 'min': float(dem.min()), 'max': float(dem.max()), 'fuente': DEM_URL,
  'licencia': 'Copernicus DEM GLO-30 © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, proporcionado en el marco de COPERNICUS por la Unión Europea y la ESA'},
  'ruta': {'metodo': 'camino de mínimo coste a 60 m sobre la máscara de cambio Sentinel-2 (coste 1 dentro, 12 fuera), del punto más cercano al origen USGS us7000tbwb al píxel cambiado más al suroeste del área; un punto por km', 'puntos': path,
    'longitud_km_aprox': round(reach_km, 1), 'fraccionSobreCambio': round(onMask, 3), 'aviso': 'La ruta sigue lo detectado como cambio, no un trazado oficial del flujo.'}}
json.dump(out, open(os.path.join(D, 'nepal_3d.json'), 'w'), ensure_ascii=False, indent=1)
print('DEM', W, H, dem.min(), dem.max(), '· ruta', len(path), 'puntos ·', out['ruta']['longitud_km_aprox'], 'km')
