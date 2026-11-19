"""SENDA · Datos reales del incendio de San Martín de Valdeiglesias y Almorox (julio de 2026).
Sentinel-2 L2A (Copernicus, AWS sentinel-cogs) + Copernicus DEM GLO-30 → malla UTM 30N común.
Salidas: color natural (pre, 24-07, 29-07, 08-08), dNBR y clases de gravedad (Key y Benson, 2006), perímetros,
modelo de elevación y combustible aproximado por NDVI previo. Uso: python3 -I s2_process.py <dem.tif> <salida>"""
import os, sys, json, numpy as np, rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds, reproject, transform as wtransform
from rasterio.transform import from_origin
from PIL import Image
os.environ['CURL_CA_BUNDLE'] = '/root/.ccr/ca-bundle.crt'; os.environ['GDAL_DISABLE_READDIR_ON_OPEN'] = 'EMPTY_DIR'
DEM, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
B = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/30/T/UK/2026/'
SCN = {'pre': '7/S2A_30TUK_20260716_1_L2A', 'd0724': '7/S2C_30TUK_20260724_0_L2A', 'd0729': '7/S2B_30TUK_20260729_0_L2A', 'd0808': '8/S2B_30TUK_20260808_0_L2A'}
AOI = (-4.62, 40.18, -4.18, 40.48); CRS = 'EPSG:32630'; RES = 20
x0, y0, x1, y1 = transform_bounds('EPSG:4326', CRS, *AOI); x0, y0 = np.floor(x0 / 100) * 100, np.floor(y0 / 100) * 100; x1, y1 = np.ceil(x1 / 100) * 100, np.ceil(y1 / 100) * 100
W, H = int((x1 - x0) / RES), int((y1 - y0) / RES); T = from_origin(x0, y1, RES, RES)
print('malla', W, H, 'UTM', x0, y0, x1, y1, flush=True)
def band(pid, name, dtype='float32', res=Resampling.average):
    m, p = pid.split('/'); dst = np.zeros((H, W), dtype=dtype)
    with rasterio.open(f'/vsicurl/{B}{m}/{p}/{name}.tif') as src:
        reproject(rasterio.band(src, 1), dst, dst_transform=T, dst_crs=CRS, resampling=res)
    return dst
def visual(pid, step=2):
    m, p = pid.split('/'); h, w = H // step, W // step; dst = np.zeros((3, h, w), dtype='uint8')
    with rasterio.open(f'/vsicurl/{B}{m}/{p}/TCI.tif') as src:
        for k in range(3): reproject(rasterio.band(src, k + 1), dst[k], dst_transform=from_origin(x0, y1, RES * step, RES * step), dst_crs=CRS, resampling=Resampling.average)
    return dst
def offs(pid):
    m, p = pid.split('/'); j = json.load(open(os.path.join(os.path.dirname(sys.argv[0]), '..', 'real', 's2', p.split('/')[-1] + '.json'))) if False else None
    return 0.0  # COMPROBADO: estos COG no llevan el desfase +1000 (agua con DN≈450 en B04/B08/B12); los metadatos dicen −0,1 pero darían reflectancias negativas
S = {}
for k, pid in SCN.items():
    n0, s0, r0 = band(pid, 'B08'), band(pid, 'B12'), band(pid, 'B04'); ok = (n0 > 0) & (s0 > 0) & (r0 > 0)
    nir, sw, red = n0 * 1e-4 + offs(pid), s0 * 1e-4 + offs(pid), r0 * 1e-4 + offs(pid)  # escala 1e-4; sin desfase (ver offs)
    scl = band(pid, 'SCL', 'uint8', Resampling.nearest)
    with np.errstate(all='ignore'):
        nbr = np.where(ok & (nir + sw > 0.05), np.clip((nir - sw) / (nir + sw), -1, 1), np.nan); ndvi = np.where(ok & (nir + red > 0.05), np.clip((nir - red) / (nir + red), -1, 1), np.nan)
    S[k] = dict(nbr=nbr, ndvi=ndvi, scl=scl)
    v = visual(pid); img = Image.fromarray(np.transpose(v, (1, 2, 0))); img = img.point(lambda q: min(255, int(q * 1.25))); img.save(os.path.join(OUT, f'tci_{k}.jpg'), quality=82, optimize=True)
    print(k, pid, 'NBR medio %.3f' % float(np.nanmean(nbr)), 'NDVI medio %.3f' % float(np.nanmean(ndvi)), flush=True)
bad = lambda s: np.isin(s, [0, 3, 6, 8, 9, 10])
res = {'fuente': 'Contiene datos modificados de Copernicus Sentinel (2026), procesados por SENDA; Copernicus DEM GLO-30 © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, proporcionado en el marco de COPERNICUS por la Unión Europea y la ESA',
       'escenas': SCN, 'calibracion': 'reflectancia = DN × 1e-4 sin desfase: comprobado empíricamente (agua del embalse con DN ≈ 450); los metadatos raster:bands indican −0,1, que daría reflectancias negativas', 'malla': {'crs': CRS, 'x0': x0, 'y1': y1, 'res': RES, 'w': W, 'h': H}, 'clases': {'baja': [0.10, 0.27], 'moderada-baja': [0.27, 0.44], 'moderada-alta': [0.44, 0.66], 'alta': [0.66, 9]}, 'fechas': {}}
from scipy import ndimage
for k in ['d0724', 'd0729', 'd0808']:
    d = S['pre']['nbr'] - S[k]['nbr']; valid = ~(bad(S['pre']['scl']) | bad(S[k]['scl'])) & np.isfinite(d)
    d = np.nan_to_num(d, nan=0.0)
    burn = (d >= 0.27) & valid
    burn = ndimage.binary_opening(burn, iterations=1); lab, n = ndimage.label(burn); sizes = ndimage.sum(burn, lab, range(1, n + 1)) * RES * RES / 1e4
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 50]); keepf = ndimage.binary_closing(keep, iterations=2)
    low = (d >= 0.10) & valid & ndimage.binary_dilation(keepf, iterations=10)
    a = lambda m: round(float(m.sum()) * RES * RES / 1e4, 1)
    cls = {c: a(keepf & (d >= lo) & (d < hi)) for c, (lo, hi) in res['clases'].items() if c != 'baja'}
    res['fechas'][k] = {'ha_moderada_o_mas': a(keepf), 'ha_incluida_baja': a(keepf | low), 'por_clase_ha': cls, 'componentes_50ha': int(sum(1 for s in sizes if s >= 50)), 'pixeles_validos_pct': round(100 * float(valid.mean()), 1)}
    np.save(os.path.join(OUT, f'burn_{k}.npy'), keepf.astype('uint8')); np.save(os.path.join(OUT, f'dnbr_{k}.npy'), np.where(valid, d, np.nan).astype('float32'))
    print(k, res['fechas'][k], flush=True)
# Color de gravedad (08-08) a 40 m con transparencia
d = np.load(os.path.join(OUT, 'dnbr_d0808.npy'))[::2, ::2]; rgba = np.zeros(d.shape + (4,), 'uint8')
for lo, hi, col in [(0.10, 0.27, (255, 235, 120, 120)), (0.27, 0.44, (255, 170, 60, 190)), (0.44, 0.66, (240, 90, 30, 215)), (0.66, 9, (170, 20, 40, 235))]:
    m = (d >= lo) & (d < hi); rgba[m] = col
Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'dnbr_d0808.png'), optimize=True)
# DEM y combustible a 100 m
R2 = 100; W2, H2 = int((x1 - x0) / R2), int((y1 - y0) / R2); T2 = from_origin(x0, y1, R2, R2); dem = np.zeros((H2, W2), 'float32')
with rasterio.open(DEM) as src: reproject(rasterio.band(src, 1), dem, dst_transform=T2, dst_crs=CRS, resampling=Resampling.average)
ndvi = np.nan_to_num(np.nanmean(S['pre']['ndvi'][:H2*5, :W2*5].reshape(H2, 5, W2, 5), axis=(1, 3)), nan=0.0); water = (S['pre']['scl'][:H2*5, :W2*5] == 6).reshape(H2, 5, W2, 5).mean(axis=(1, 3)) > 0.5
fuel = np.select([water, ndvi < 0.15, ndvi < 0.32, ndvi < 0.5], [0, 4, 1, 2], 3).astype('uint8')
dem.astype('<i2').tofile(os.path.join(OUT, 'dem_100m.bin')); fuel.tofile(os.path.join(OUT, 'fuel_100m.bin'))
res['dem'] = {'res': R2, 'w': W2, 'h': H2, 'min': float(dem.min()), 'max': float(dem.max()), 'fichero': 'dem_100m.bin (Int16 LE, m)'}
res['combustible'] = {'fichero': 'fuel_100m.bin (Uint8: 0 agua, 1 pasto, 2 matorral, 3 arbolado, 4 sin vegetación o urbano)', 'regla': 'NDVI previo (16-07-2026): <0,15 sin vegetación; <0,32 pasto seco; <0,5 matorral; ≥0,5 arbolado; agua por SCL', 'pct': {str(c): round(100 * float((fuel == c).mean()), 1) for c in range(5)}}
# Esquinas en lat/lon para colocar las texturas
lon, lat = wtransform(CRS, 'EPSG:4326', [x0, x1, x1, x0], [y1, y1, y0, y0]); res['esquinas_lonlat'] = [[round(a, 6), round(b, 6)] for a, b in zip(lon, lat)]
json.dump(res, open(os.path.join(OUT, 'real.json'), 'w'), ensure_ascii=False, indent=1)
print('listo', res['dem'], res['combustible']['pct'])
