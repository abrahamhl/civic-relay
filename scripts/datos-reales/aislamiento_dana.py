"""SENDA · Datos reales para el motor de aislamiento por inundación (DANA de Valencia, 29-10-2024).

Descarga y compacta, para el recorte de l'Horta Sud (Paiporta, Picanya, Benetússer, Alfafar, Sedaví, Massanassa, Catarroja…):
  1. Calles, servicios de emergencia/salud y edificios de OpenStreetMap, por la API oficial 0.6 (api.openstreetmap.org),
     en teselas de 0,02°. OJO: es el mapa de HOY (fecha de descarga), no el de octubre de 2024.
  2. Agua OBSERVADA de Copernicus EMS Rapid Mapping EMSR773, AOI01, primer producto de delimitación (DEL_PRODUCT,
     imágenes del 30 y 31-10-2024), capa «observedEventA», recortada al recorte y simplificada (tolerancia declarada).
Salida: investor-next/public/senda/data/aislamiento/dana_horta_sud.json (+ procedencia con SHA-256 de cada descarga).
Licencias: OSM © colaboradores de OpenStreetMap, ODbL 1.0 · CEMS: uso libre citando la fuente.
Uso: python3 -I aislamiento_dana.py
"""
import os, json, hashlib, ssl, time, urllib.request, urllib.error, xml.etree.ElementTree as ET
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
from shapely.validation import make_valid

CA = '/root/.ccr/ca-bundle.crt'; CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'investor-next', 'public', 'senda', 'data', 'aislamiento'); os.makedirs(OUT, exist_ok=True)
BBOX = (-0.47, 39.38, -0.33, 39.46)  # w, s, e, n
STEP = 0.02
ROADS = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
         'unclassified', 'residential', 'living_street', 'pedestrian', 'service'}
SERVICES = {'hospital': 'hospital', 'clinic': 'centro de salud / clínica', 'fire_station': 'bomberos', 'police': 'policía'}
WATER_URL = 'https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR773/AOI01/DEL_PRODUCT/EMSR773_AOI01_DEL_PRODUCT_observedEventA_v1.json'
TOL = 0.00005  # grados (~5 m): simplificación declarada del agua

def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'SENDA-research/1.0'}), context=CTX, timeout=180) as r: raw = r.read()
            return raw, hashlib.sha256(raw).hexdigest()
        except Exception as e:
            if k == tries - 1 or getattr(e, 'code', None) == 400: raise
            time.sleep(5 * (k + 1))

prov, nodes, ways = [], {}, {}
def tile(x, y, step):
    url = f'https://api.openstreetmap.org/api/0.6/map?bbox={x:.4f},{y:.4f},{x + step:.4f},{y + step:.4f}'
    try: raw, h = get(url)
    except urllib.error.HTTPError as e:
        if e.code != 400: raise
        # la API devuelve 400 si la tesela supera 50 000 nodos: se parte en cuatro
        for dx in (0, step / 2):
            for dy in (0, step / 2): tile(x + dx, y + dy, step / 2)
        return
    prov.append({'url': url, 'sha256': h, 'bytes': len(raw)})
    for el in ET.fromstring(raw):
        if el.tag == 'node':
            nodes[el.get('id')] = (float(el.get('lon')), float(el.get('lat')), {t.get('k'): t.get('v') for t in el.findall('tag')})
        elif el.tag == 'way':
            ways[el.get('id')] = ([n.get('ref') for n in el.findall('nd')], {t.get('k'): t.get('v') for t in el.findall('tag')})
    print(url.split('=')[1], len(raw), len(nodes), len(ways), flush=True); time.sleep(1)
nx, ny = round((BBOX[2] - BBOX[0]) / STEP), round((BBOX[3] - BBOX[1]) / STEP)
for i in range(nx):
    for j in range(ny): tile(BBOX[0] + i * STEP, BBOX[1] + j * STEP, STEP)

inb = lambda lon, lat: BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]
idx, coords, outways = {}, [], []
def nid(ref):
    if ref not in idx: idx[ref] = len(coords); coords.append([round(nodes[ref][0], 6), round(nodes[ref][1], 6)])
    return idx[ref]
for wid, (refs, tags) in ways.items():
    hw = tags.get('highway')
    if hw not in ROADS or tags.get('area') == 'yes' or tags.get('access') in ('private', 'no'): continue
    refs = [r for r in refs if r in nodes]
    # se trocea la vía en tramos consecutivos dentro del recorte
    run = []
    for r in refs + [None]:
        if r is not None and inb(nodes[r][0], nodes[r][1]): run.append(r)
        else:
            if len(run) >= 2: outways.append({'id': int(wid), 'hw': hw, 'br': 1 if tags.get('bridge') not in (None, 'no') else 0, 'tn': 1 if tags.get('tunnel') not in (None, 'no') else 0, 'name': tags.get('name') or tags.get('ref'), 'n': [nid(q) for q in run]})
            run = []
def centroid(refs):
    pts = [nodes[r] for r in refs if r in nodes]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else None
services, buildings = [], []
for ref, (lon, lat, tags) in nodes.items():
    if tags.get('amenity') in SERVICES and inb(lon, lat): services.append({'id': f'n{ref}', 'kind': tags['amenity'], 'name': tags.get('name'), 'lon': round(lon, 6), 'lat': round(lat, 6)})
for wid, (refs, tags) in ways.items():
    c = centroid(refs)
    if not c or not inb(*c): continue
    if tags.get('amenity') in SERVICES: services.append({'id': f'w{wid}', 'kind': tags['amenity'], 'name': tags.get('name'), 'lon': round(c[0], 6), 'lat': round(c[1], 6)})
    elif tags.get('building') not in (None, 'no'): buildings.append([round(c[0], 5), round(c[1], 5)])

raw, h = get(WATER_URL); prov.append({'url': WATER_URL, 'sha256': h, 'bytes': len(raw)})
fc = json.loads(raw)
import collections
notacion = dict(collections.Counter(f['properties'].get('notation') for f in fc['features']))
clip = box(*BBOX)
geoms = [make_valid(shape(f['geometry'])) for f in fc['features'] if f.get('geometry')]
u = unary_union(geoms).intersection(clip).simplify(TOL, preserve_topology=True)
polys = [g for g in (u.geoms if hasattr(u, 'geoms') else [u]) if g.geom_type == 'Polygon' and not g.is_empty]
rings = []
for p in polys:
    for r in [p.exterior, *p.interiors]: rings.append([[round(a, 6), round(b, 6)] for a, b in r.coords[:-1]])

out = {
    'caso': 'DANA de Valencia · l\'Horta Sud', 'bbox': list(BBOX), 'generadoUTC': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'agua': {'producto': 'EMSR773_AOI01_DEL_PRODUCT_observedEventA_v1', 'imagenes': ['Landsat-8 2024-10-30T10:37', 'Sentinel-2 2024-10-31T10:51', 'Sentinel-1 2024-10-31T18:02'],
             'nota': 'extensión OBSERVADA en esas imágenes (uno y dos días después de la riada); no es el máximo ni da calado', 'toleranciaGrados': TOL, 'poligonosPorNotacion': notacion,
             'limite': 'incluye «Flooded area» (agua en la imagen) y «Flood trace» (huella de agua que ya pasó). Los huecos del polígono coinciden con cascos urbanos densos (Benetússer, Alfafar, Massanassa, Catarroja): la delimitación por satélite no garantiza ver agua entre edificios, así que un hueco NO significa que allí estuviera seco', 'anillos': rings,
             'fuente': 'Copernicus Emergency Management Service (© Unión Europea), EMSR773', 'basis': 'OFFICIAL_MAPPING'},
    'red': {'coords': coords, 'ways': outways, 'tiposVia': sorted(ROADS), 'nota': 'OpenStreetMap a fecha de descarga (no es el mapa de 2024); sin sendas peatonales ni vías privadas',
            'fuente': '© colaboradores de OpenStreetMap, ODbL 1.0 · API 0.6', 'basis': 'OPEN_MAP'},
    'servicios': services, 'tiposServicio': SERVICES,
    'edificios': {'centroides': buildings, 'nota': 'centroides de edificios OSM: proxy declarado de «dónde hay gente»; NO es población'},
    'procedencia': prov,
}
p = os.path.join(OUT, 'dana_horta_sud.json'); json.dump(out, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print('nodos', len(coords), 'vías', len(outways), 'servicios', len(services), 'edificios', len(buildings), 'anillos agua', len(rings), 'bytes', os.path.getsize(p))
