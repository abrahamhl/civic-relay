"""SENDA · Datos reales para el planificador de radio: relieve de la cuenca del barranco del Poyo (Valencia).

  1. Relieve: Copernicus DEM GLO-30 (tesela N39 W001, AWS copernicus-dem-30m), remuestreado (bilineal) a 0,001° (~86 × 111 m).
  2. Municipios: coordenadas de Nominatim (OpenStreetMap), una consulta por nombre, 1 petición/s.
Salida: investor-next/public/senda/data/radio/poyo.json
Licencias: Copernicus DEM © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, proporcionado por la UE y la ESA ·
OSM © colaboradores de OpenStreetMap, ODbL 1.0. Uso: python3 -I radio_poyo_dem.py
"""
import os, json, ssl, time, hashlib, urllib.request, urllib.parse
import numpy as np, rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
os.environ.setdefault('CURL_CA_BUNDLE', '/root/.ccr/ca-bundle.crt')
CA = '/root/.ccr/ca-bundle.crt'; CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'investor-next', 'public', 'senda', 'data', 'radio'); os.makedirs(OUT, exist_ok=True)
W, S, E, N, RES = -0.86, 39.34, -0.32, 39.56, 0.001
DEM_URL = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N39_00_W001_00_DEM/Copernicus_DSM_COG_10_N39_00_W001_00_DEM.tif'
w, h = round((E - W) / RES) + 1, round((N - S) / RES) + 1
dem = np.zeros((h, w), dtype=np.float32)
T = from_origin(W - RES / 2, N + RES / 2, RES, RES)  # centros de celda en (W + i·RES, N − j·RES)
with rasterio.open('/vsicurl/' + DEM_URL) as src: reproject(rasterio.band(src, 1), dem, dst_transform=T, dst_crs='EPSG:4326', resampling=Resampling.bilinear)
TOWNS = ['Chiva', 'Cheste', 'Buñol', 'Godelleta', 'Turís', 'Torrent', 'Paiporta', 'Picanya', 'Alaquàs', 'Aldaia', 'Loriguilla', 'Riba-roja de Túria', 'Quart de Poblet',
         'Catarroja', 'Massanassa', 'Alfafar', 'Benetússer', 'Sedaví', 'Montserrat', 'Alcàsser', 'Picassent', 'Xirivella']
towns, prov = [], [{'url': DEM_URL, 'nota': 'leído por ventanas (COG); sin SHA del fichero completo'}]
for t in TOWNS:
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': f'{t}, València, España', 'format': 'jsonv2', 'limit': 1})
    raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'SENDA-research/1.0'}), context=CTX, timeout=60).read(); r = json.loads(raw)
    prov.append({'url': url, 'sha256': hashlib.sha256(raw).hexdigest()}); time.sleep(1.1)
    if not r: print('no encontrado', t); continue
    lon, lat = float(r[0]['lon']), float(r[0]['lat'])
    if W <= lon <= E and S <= lat <= N: towns.append({'nombre': t, 'lon': round(lon, 5), 'lat': round(lat, 5), 'osm': f"{r[0]['osm_type']}/{r[0]['osm_id']}", 'tipo': r[0].get('addresstype')})
    else: print('fuera del recorte', t, lon, lat)
out = {'caso': 'Cuenca del barranco del Poyo (Chiva → l\'Horta Sud)', 'generadoUTC': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
       'dem': {'w': w, 'h': h, 'west': W, 'north': N, 'dx': RES, 'dy': RES, 'min': int(dem.min()), 'max': int(dem.max()), 'data': [int(round(float(v))) for v in dem.ravel()],
               'fuente': 'Copernicus DEM GLO-30 (modelo digital de SUPERFICIE), remuestreado a 0,001°', 'licencia': '© DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, proporcionado en el marco de COPERNICUS por la Unión Europea y la ESA', 'basis': 'MEASURED_SATELLITE'},
       'municipios': towns, 'notaMunicipios': 'punto que devuelve Nominatim (OSM) para el nombre del municipio; © colaboradores de OpenStreetMap, ODbL 1.0', 'procedencia': prov}
p = os.path.join(OUT, 'poyo.json'); json.dump(out, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print('DEM', w, h, dem.min(), dem.max(), 'municipios', len(towns), 'bytes', os.path.getsize(p))
