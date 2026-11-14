"""SENDA · Caso real: DANA de Valencia, activación Copernicus EMS Rapid Mapping EMSR773 (29-10-2024).
Descarga la ficha pública de la activación (estadísticas oficiales, zonas de interés, productos e imágenes) y las
capas «observedEventA» (zona inundada observada) de la última versión de cada producto de delimitación (DEL).
Simplifica la geometría para la web (tolerancia declarada) y calcula la superficie en EPSG:3035 (LAEA Europa).
Salidas en investor-next/public/senda/data/dana2024/: emsr773.json (resumen + procedencia) y emsr773_inundacion.geojson.
Licencia: CEMS On-Demand Mapping, acceso libre con reproducción, distribución y adaptación, citando la fuente
(https://mapping.emergency.copernicus.eu/terms-and-conditions/, leídas el 14-11-2026). Uso: python3 -I cems_emsr773_snapshot.py"""
import os, json, hashlib, ssl, urllib.request
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid
from rasterio.warp import transform_geom
CA = '/root/.ccr/ca-bundle.crt'; CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'investor-next', 'public', 'senda', 'data', 'dana2024'); os.makedirs(OUT, exist_ok=True)
API = 'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?code=EMSR773'
def get(url):
    with urllib.request.urlopen(url, context=CTX, timeout=120) as r: raw = r.read()
    return raw, hashlib.sha256(raw).hexdigest()
raw, h = get(API); act = json.loads(raw)['results'][0]; prov = [{'url': API, 'sha256': h}]
TOL = 0.0002  # grados (~20 m): simplificación declarada para la web
aois, feats = [], []
for a in act['aois']:
    dels = [p for p in a['products'] if p['type'] == 'DEL']
    rec = {'numero': a['number'], 'nombre': a['name'], 'productos': [{'tipo': p['type'], 'monitorizacion': p.get('monitoringNumber'), 'imagenes': [{'sensor': i.get('sensorName'), 'hora': i.get('acquisitionTime')} for i in p.get('images', [])]} for p in a['products']]}
    if dels:
        last = max(dels, key=lambda p: p.get('monitoringNumber') or 0)
        lay = [l for l in last.get('layers', []) if 'observedEventA' in l['name'] and l.get('json')]
        if lay:
            r2, h2 = get(lay[0]['json']); fc = json.loads(r2); prov.append({'url': lay[0]['json'], 'sha256': h2})
            geoms = [make_valid(shape(f['geometry'])) for f in fc['features'] if f.get('geometry')]
            if geoms:
                u = unary_union(geoms); km2 = shape(transform_geom('EPSG:4326', 'EPSG:3035', mapping(u))).area / 1e6
                s = u.simplify(TOL, preserve_topology=True)
                imgs = last.get('images', []); hora = max((i.get('acquisitionTime') or '' for i in imgs), default=None)
                rec.update({'inundacionObservada_km2': round(km2, 2), 'producto': lay[0]['name'].split('/')[-1], 'imagen': hora})
                g = json.loads(json.dumps(mapping(s)), parse_float=lambda x: round(float(x), 5))
                feats.append({'type': 'Feature', 'properties': {'aoi': a['number'], 'nombre': a['name'], 'km2': round(km2, 2), 'imagen': hora, 'producto': rec['producto'], 'source': 'Copernicus EMS Rapid Mapping EMSR773', 'basis': 'OFFICIAL_MAPPING'}, 'geometry': g})
    aois.append(rec)
summ = {'codigo': act['code'], 'nombre': act['name'], 'motivo': act['reason'], 'horaEvento': act['eventTime'], 'horaActivacion': act['activationTime'], 'gdacs': act.get('gdacsId'),
  'centroide': act.get('centroid'), 'estadisticasOficiales': act.get('stats'), 'zonas': aois, 'informe': act.get('reportLink'),
  'fuente': 'Copernicus Emergency Management Service (CEMS) Rapid Mapping, activación EMSR773', 'licencia': 'CEMS On-Demand Mapping: acceso libre (reproducción, distribución, adaptación) citando la fuente · https://mapping.emergency.copernicus.eu/terms-and-conditions/',
  'cita': 'Contains modified Copernicus Emergency Management Service information 2024', 'descargadoUTC': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
  'procesado': {'simplificacion_grados': TOL, 'areas': 'calculadas por SENDA en EPSG:3035 sobre la geometría ORIGINAL (antes de simplificar)', 'capas': 'observedEventA de la última versión de cada producto DEL'},
  'procedencia': prov, 'sumaInundacionObservada_km2': round(sum(f['properties']['km2'] for f in feats), 2)}
json.dump(summ, open(os.path.join(OUT, 'emsr773.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(OUT, 'emsr773_inundacion.geojson'), 'w'), separators=(',', ':'))
print('EMSR773:', len(aois), 'zonas,', len(feats), 'con inundación observada · suma', summ['sumaInundacionObservada_km2'], 'km² · oficial «Event Extent [ha]»', (act.get('stats') or {}).get('Event Extent [ha]'))
