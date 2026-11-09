"""Descarga perfiles reales de GFS 0,25° (NOAA, dominio público) para el 23-07-2026 sobre San Martín de Valdeiglesias.
Lee el índice .idx y pide solo los bytes de cada campo (HTTP Range). Decodifica con eccodes."""
import sys, os, json, urllib.request, ssl, eccodes, math
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
BASE = 'https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.20260723/12/atmos/gfs.t12z.pgrb2.0p25.f{h:03d}'
LEV = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500]
VARS = ['HGT', 'TMP', 'RH', 'UGRD', 'VGRD', 'VVEL']
SFC = [('PRES', 'surface'), ('TMP', '2 m above ground'), ('RH', '2 m above ground'), ('UGRD', '10 m above ground'), ('VGRD', '10 m above ground'), ('GUST', 'surface'), ('HPBL', 'surface'), ('CAPE', 'surface'), ('HGT', 'surface'), ('PRMSL', 'mean sea level')]
LAT0, LAT1, LON0, LON1 = 38.5, 42.0, 354.0, 358.5  # caja sinóptica (−6 a −1,5 E)
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt')
import time
def get(url, rng=None):
    for k in range(6):
        try:
            req = urllib.request.Request(url, headers={'Range': f'bytes={rng[0]}-{rng[1]}'} if rng else {})
            with urllib.request.urlopen(req, context=ctx, timeout=120) as r: return r.read()
        except Exception as e:
            if k == 5: raise
            time.sleep(2 ** k)
res = {'source': 'NOAA GFS 0.25° (NCEP), run 2026-07-23 12Z, AWS Open Data (noaa-gfs-bdp-pds); dominio público', 'times': []}
for h in [0, 3, 6, 9, 12]:
    cache = os.path.join(OUT, f'h{h:03d}.json')
    if os.path.exists(cache): res['times'].append(json.load(open(cache))); res.setdefault('grid', json.load(open(os.path.join(OUT, 'grid.json')))); print('cache', h); continue
    idx = get(BASE.format(h=h) + '.idx').decode().splitlines()
    ent = []
    for i, l in enumerate(idx):
        p = l.split(':'); start = int(p[1]); end = int(idx[i + 1].split(':')[1]) - 1 if i + 1 < len(idx) else None
        ent.append((p[3], p[4], start, end))
    want = [(v, f'{L} mb') for v in VARS for L in LEV] + SFC
    fields = {}
    for v, lev in want:
        m = [e for e in ent if e[0] == v and e[1] == lev]
        if not m: continue
        _, _, s, e = m[0]; data = get(BASE.format(h=h), (s, e))
        g = eccodes.codes_new_from_message(data)
        Ni = eccodes.codes_get(g, 'Ni'); Nj = eccodes.codes_get(g, 'Nj'); vals = eccodes.codes_get_values(g)
        la1 = eccodes.codes_get(g, 'latitudeOfFirstGridPointInDegrees'); dj = eccodes.codes_get(g, 'jDirectionIncrementInDegrees'); di = eccodes.codes_get(g, 'iDirectionIncrementInDegrees')
        eccodes.codes_release(g)
        lats = [la1 - j * dj for j in range(Nj)]; sub = {}
        js = [j for j in range(Nj) if LAT0 - 1e-6 <= lats[j] <= LAT1 + 1e-6]; is_ = [i for i in range(Ni) if LON0 - 1e-6 <= i * di <= LON1 + 1e-6]
        fields[f'{v}@{lev}'] = [[round(float(vals[j * Ni + i]), 3) for i in is_] for j in js]
        if 'grid' not in res: res['grid'] = {'lats': [round(lats[j], 3) for j in js], 'lons': [round(i * di - 360, 3) for i in is_]}
    entry = {'validUTC': f'2026-07-23T{12 + h:02d}:00Z' if 12 + h < 24 else '2026-07-24T00:00Z', 'fhour': h, 'fields': fields}
    json.dump(entry, open(cache, 'w')); json.dump(res['grid'], open(os.path.join(OUT, 'grid.json'), 'w')); res['times'].append(entry)
    print('f%03d' % h, len(fields), 'campos', flush=True)
json.dump(res, open(os.path.join(OUT, 'gfs_20260723_12z.json'), 'w'))
print('ok')
