"""SENDA · Caso real: colapso glaciar de Langtang Lirung y crecida del Bhote Koshi (Nepal, 26-08-2026).
Sentinel-2 L2A (Copernicus, AWS sentinel-cogs, catálogo STAC Earth Search de Element 84) → malla UTM 45N, 20 m.
Salidas en investor-next/public/senda/data/nepal2026/: color natural antes y después (JPG), máscara de cambio (PNG)
y nepal_s2.json con procedencia (escenas, URL, nubes locales por SCL) y superficie de cambio CALCULADA.
La máscara de cambio es una detección espectral (caída de NDVI a suelo desnudo, sin nube, nieve ni sombra en
ninguna de las dos fechas), NO un mapa oficial de daños. Uso: python3 -I nepal_langtang_s2.py"""
import os, sys, json, numpy as np, rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds, reproject
from rasterio.transform import from_origin
from PIL import Image
os.environ['CURL_CA_BUNDLE'] = '/root/.ccr/ca-bundle.crt'; os.environ['GDAL_DISABLE_READDIR_ON_OPEN'] = 'EMPTY_DIR'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'investor-next', 'public', 'senda', 'data', 'nepal2026'); os.makedirs(OUT, exist_ok=True)
B = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/R/UM/2026/'
SCN = {'pre': '8/S2C_45RUM_20260812_0_L2A', 'post': '9/S2C_45RUM_20260928_0_L2A', 'post2': '10/S2B_45RUM_20261026_0_L2A'}
AOI = (85.28, 28.12, 85.62, 28.36); CRS = 'EPSG:32645'; RES = 20
x0, y0, x1, y1 = transform_bounds('EPSG:4326', CRS, *AOI); x0, y0 = np.floor(x0 / 100) * 100, np.floor(y0 / 100) * 100; x1, y1 = np.ceil(x1 / 100) * 100, np.ceil(y1 / 100) * 100
W, H = int((x1 - x0) / RES), int((y1 - y0) / RES); T = from_origin(x0, y1, RES, RES)
def url(pid, name): m, p = pid.split('/'); return f'{B}{m}/{p}/{name}.tif'
def band(pid, name, dtype='float32', res=Resampling.average):
    dst = np.zeros((H, W), dtype=dtype)
    with rasterio.open('/vsicurl/' + url(pid, name)) as src: reproject(rasterio.band(src, 1), dst, dst_transform=T, dst_crs=CRS, resampling=res)
    return dst
def visual(pid):
    dst = np.zeros((3, H, W), dtype='uint8')
    with rasterio.open('/vsicurl/' + url(pid, 'TCI')) as src:
        for k in range(3): reproject(rasterio.band(src, k + 1), dst[k], dst_transform=T, dst_crs=CRS, resampling=Resampling.average)
    return dst
BAD = {0, 1, 3, 8, 9, 10, 11}  # SCL: sin dato, saturado, sombra de nube, nube media/alta, cirro, nieve/hielo
S, meta = {}, {}
for k, pid in SCN.items():
    red, nir = band(pid, 'B04') * 1e-4, band(pid, 'B08') * 1e-4; scl = band(pid, 'SCL', 'uint8', Resampling.nearest)
    with np.errstate(all='ignore'): ndvi = np.where(nir + red > 0.02, (nir - red) / (nir + red), np.nan)
    clear = ~np.isin(scl, list(BAD)); S[k] = dict(ndvi=ndvi, clear=clear)
    v = visual(pid); Image.fromarray(np.transpose(v, (1, 2, 0))).point(lambda q: min(255, int(q * 1.3))).save(os.path.join(OUT, f'tci_{k}.jpg'), quality=82, optimize=True)
    meta[k] = {'escena': pid.split('/')[1], 'fecha': pid.split('_')[2], 'tci': url(pid, 'TCI'), 'pixelesDespejados': round(float(clear.mean()), 3)}
    print(k, pid, 'despejado %.1f %%' % (100 * clear.mean()), flush=True)
from scipy import ndimage
both = S['pre']['clear'] & S['post2']['clear']
raw = both & (S['pre']['ndvi'] - S['post2']['ndvi'] > 0.3) & (S['post2']['ndvi'] < 0.15)
px_km2 = RES * RES / 1e6
lab, n = ndimage.label(raw, structure=np.ones((3, 3)))
sizes = ndimage.sum(raw, lab, range(1, n + 1)); keep = np.isin(lab, 1 + np.nonzero(sizes * px_km2 >= 0.05)[0]); chg = raw & keep
# Componente más cercana al origen catalogado por USGS (us7000tbwb, 28.271 N 85.515 E)
from rasterio.warp import transform as wtr
ux, uy = wtr('EPSG:4326', CRS, [85.515], [28.271]); ui, uj = int((y1 - uy[0]) / RES), int((ux[0] - x0) / RES)
k0 = 1 + int(np.argmax(sizes)); main = lab == k0; yy, xx = np.nonzero(main); dmin = np.hypot(yy - ui, xx - uj)
cy, cx = yy.mean(), xx.mean(); clon, clat = wtr(CRS, 'EPSG:4326', [x0 + (cx + 0.5) * RES], [y1 - (cy + 0.5) * RES])
ext = {'criterio': 'mancha conexa más grande', 'centroide': [round(clat[0], 5), round(clon[0], 5)], 'km2': round(float(main.sum()) * px_km2, 2), 'distanciaAlOrigenUSGS_m': round(float(dmin.min()) * RES), 'extension_km': round(float(np.hypot(yy.max() - yy.min(), xx.max() - xx.min())) * RES / 1000, 1)}
rgba = np.zeros((H, W, 4), dtype='uint8'); rgba[chg] = (255, 91, 110, 200); Image.fromarray(rgba).save(os.path.join(OUT, 'cambio_pre_post.png'), optimize=True)
out = {'caso': 'Colapso glaciar de Langtang Lirung y crecida del Bhote Koshi, Nepal, 26-08-2026',
  'fuente': 'Copernicus Sentinel-2 L2A (ESA) vía AWS sentinel-cogs; búsqueda STAC en earth-search.aws.element84.com', 'licencia': 'Datos Copernicus Sentinel: uso libre con atribución (aviso legal de Copernicus)',
  'aoi_wgs84': AOI, 'imagen_bounds_wgs84': [round(v, 5) for v in transform_bounds(CRS, 'EPSG:4326', x0, y0, x1, y1)], 'origenUSGS': {'id': 'us7000tbwb', 'lat': 28.271, 'lon': 85.515, 'pixel': [ui, uj]}, 'crs': CRS, 'resolucion_m': RES, 'ancho': W, 'alto': H, 'bounds_utm': [x0, y0, x1, y1], 'escenas': meta,
  'cambio': {'metodo': 'NDVI del 12-08 − NDVI del 26-10 > 0,3 y NDVI después < 0,15, solo en píxeles despejados (SCL) en ambas fechas', 'km2': round(float(chg.sum()) * px_km2, 2), 'km2_bruto_sin_filtrar': round(float(raw.sum()) * px_km2, 2), 'filtro': 'se descartan manchas < 0,05 km²', 'componentePrincipal': ext, 'despues': 'post2',
    'km2_comparables': round(float(both.sum()) * px_km2, 1), 'aviso': 'Detección espectral calculada por este script. No es un mapa oficial de daños: incluye cualquier pérdida de vegetación entre fechas (cultivos, deslizamientos menores) y excluye lo que tapan nubes, sombras o nieve. Revisado a ojo: el cauce arrasado del Lhende Khola y el Bhote Koshi sale de forma continua, pero también hay falsos positivos dispersos junto al límite de la nieve (cambio estacional entre agosto y octubre), así que los km² totales NO son la superficie afectada.'}}
json.dump(out, open(os.path.join(OUT, 'nepal_s2.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out['cambio'], ensure_ascii=False))
