"""SENDA · Progresión REAL de incendios con GOES-R ABI Fire Detection (FDC, CONUS, cada 5 min) y viento HRRR 3 km.
Fuentes: NOAA GOES-16/18 y NOAA HRRR en AWS Open Data (dominio público). Uso: python3 -I goes_hrrr_incendio.py <caso> <salida>
Casos: camp (Camp Fire, 08-11-2018, GOES-16) y la (Palisades y Eaton, 07/08-01-2025, GOES-18)."""
import os, sys, json, ssl, time, re, urllib.request, numpy as np, netCDF4, eccodes, math
CASE, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
ctx = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
def get(url, rng=None):
    for k in range(6):
        try:
            req = urllib.request.Request(url, headers={'Range': f'bytes={rng[0]}-{rng[1]}'} if rng else {})
            with urllib.request.urlopen(req, context=ctx, timeout=120) as r: return r.read()
        except Exception:
            if k == 5: raise
            time.sleep(2 ** k)
CASES = {
  'camp': {'bucket': 'noaa-goes16', 'slots': [('2018', '312', h) for h in range(14, 24)], 'every': 2,
           'fires': {'camp': {'bbox': (39.55, 40.05, -121.85, -121.25)}}, 'hrrr': [('20181108', list(range(13, 24)))]},
  'la':   {'bucket': 'noaa-goes18', 'slots': [('2025', '007', h) for h in range(18, 24)] + [('2025', '008', h) for h in range(0, 13)], 'every': 2,
           'fires': {'palisades': {'bbox': (33.98, 34.20, -118.72, -118.45)}, 'eaton': {'bbox': (34.12, 34.32, -118.22, -117.98)}}, 'hrrr': [('20250107', list(range(18, 24))), ('20250108', list(range(0, 13)))]},
  'marshall': {'bucket': 'noaa-goes16', 'slots': [('2021', '364', h) for h in range(17, 24)], 'every': 1,
           'fires': {'marshall': {'bbox': (39.90, 40.02, -105.30, -105.05)}}, 'hrrr': [('20211230', list(range(17, 24)))]},
  'smokehouse': {'bucket': 'noaa-goes16', 'slots': [('2024', '057', h) for h in range(19, 24)] + [('2024', '058', h) for h in range(0, 13)], 'every': 2,
           'fires': {'smokehouse': {'bbox': (35.75, 36.60, -101.60, -99.80)}}, 'hrrr': [('20240226', list(range(19, 24))), ('20240227', list(range(0, 13)))]},
  'troublesome': {'bucket': 'noaa-goes16', 'slots': [('2020', '295', h) for h in range(17, 24)] + [('2020', '296', h) for h in range(0, 8)], 'every': 2,
           'fires': {'troublesome': {'bbox': (40.05, 40.55, -106.35, -105.60)}}, 'hrrr': [('20201021', list(range(17, 24))), ('20201022', list(range(0, 8)))]},
  'creek': {'bucket': 'noaa-goes16', 'slots': [('2020', '249', h) for h in range(18, 24)] + [('2020', '250', h) for h in range(0, 12)], 'every': 2,
           'fires': {'creek': {'bbox': (37.05, 37.65, -119.45, -118.85)}}, 'hrrr': [('20200905', list(range(18, 24))), ('20200906', list(range(0, 12)))]},
}
C = CASES[CASE]
def latlon(nc):
    p = nc.variables['goes_imager_projection']; H = p.perspective_point_height + p.semi_major_axis; req, rpol, lon0 = p.semi_major_axis, p.semi_minor_axis, math.radians(p.longitude_of_projection_origin)
    x = nc.variables['x'][:] * p.perspective_point_height / p.perspective_point_height; y = nc.variables['y'][:]
    X, Y = np.meshgrid(np.asarray(x, dtype='f8'), np.asarray(y, dtype='f8'))
    a = np.sin(X) ** 2 + np.cos(X) ** 2 * (np.cos(Y) ** 2 + (req ** 2 / rpol ** 2) * np.sin(Y) ** 2); b = -2 * H * np.cos(X) * np.cos(Y); c = H ** 2 - req ** 2
    with np.errstate(invalid='ignore'):
        rs = (-b - np.sqrt(b * b - 4 * a * c)) / (2 * a); sx = rs * np.cos(X) * np.cos(Y); sy = -rs * np.sin(X); sz = rs * np.cos(X) * np.sin(Y)
        lat = np.degrees(np.arctan((req ** 2 / rpol ** 2) * (sz / np.sqrt((H - sx) ** 2 + sy ** 2)))); lon = np.degrees(lon0 - np.arctan(sy / (H - sx)))
    return lat, lon
FIRE = {10, 11, 12, 13, 14, 30, 31, 32, 33, 34}  # procesado, saturado, nube, probabilidad alta y media (y filtrados en el tiempo)
grid = None; frames = {f: [] for f in C['fires']}
for yr, doy, hh in C['slots']:
    x = get(f"https://{C['bucket']}.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-FDCC/{yr}/{doy}/{hh:02d}/").decode()
    keys = re.findall(r'<Key>([^<]*)</Key>', x)[::C['every']]
    for k in keys:
        data = get(f"https://{C['bucket']}.s3.amazonaws.com/{k}"); nc = netCDF4.Dataset('mem', memory=data)
        if grid is None: lat, lon = latlon(nc); grid = (lat, lon); sel = {f: np.where((lat >= v['bbox'][0]) & (lat <= v['bbox'][1]) & (lon >= v['bbox'][2]) & (lon <= v['bbox'][3])) for f, v in C['fires'].items()}
        mask = nc.variables['Mask'][:]; power = nc.variables['Power'][:]; t = re.search(r'_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})', k).groups()
        tt = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.mktime(time.strptime(f'{t[0]} {t[1]} {t[2]} {t[3]} {t[4]}', '%Y %j %H %M %S')) - time.timezone))
        for f, (jj, ii) in sel.items():
            m = np.asarray(mask[jj, ii]); keep = np.isin(m, list(FIRE)); pw = np.asarray(np.ma.filled(power[jj, ii], np.nan))
            frames[f].append({'t': tt, 'det': [[round(float(grid[0][jj[q], ii[q]]), 4), round(float(grid[1][jj[q], ii[q]]), 4), None if np.isnan(pw[q]) else round(float(pw[q]), 1), int(m[q])] for q in np.where(keep)[0]]})
        nc.close()
    print(CASE, yr, doy, hh, {f: len(frames[f][-1]['det']) for f in frames}, flush=True)
# Viento HRRR en el centroide de las primeras detecciones de cada incendio
hrrr = {f: [] for f in C['fires']}
first = {}
for f, fr in frames.items():
    d0 = next((x['det'] for x in fr if x['det']), [])
    first[f] = (float(np.mean([d[0] for d in d0])), float(np.mean([d[1] for d in d0]))) if d0 else None
for day, hh in [(d, h) for d, hs in C['hrrr'] for h in hs]:
    base = f"https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.{day}/conus/hrrr.t{hh:02d}z.wrfsfcf00.grib2"; idx = get(base + '.idx').decode().splitlines(); ent = []
    for i, l in enumerate(idx): p = l.split(':'); ent.append((p[3], p[4], int(p[1]), int(idx[i + 1].split(':')[1]) - 1 if i + 1 < len(idx) else None))
    vals = {}
    for v, lev in [('UGRD', '10 m above ground'), ('VGRD', '10 m above ground'), ('GUST', 'surface'), ('TMP', '2 m above ground'), ('RH', '2 m above ground')]:
        e = [q for q in ent if q[0] == v and q[1] == lev][0]; g = eccodes.codes_new_from_message(get(base, (e[2], e[3])))
        la = eccodes.codes_get_array(g, 'latitudes'); lo = eccodes.codes_get_array(g, 'longitudes'); lo = np.where(lo > 180, lo - 360, lo); va = eccodes.codes_get_values(g); eccodes.codes_release(g)
        for f, pt in first.items():
            if pt is None: continue
            k = int(np.argmin((la - pt[0]) ** 2 + ((lo - pt[1]) * math.cos(math.radians(pt[0]))) ** 2)); vals.setdefault(f, {})[v] = float(va[k])
    for f, v in vals.items(): hrrr[f].append({'validUTC': f'{day[:4]}-{day[4:6]}-{day[6:]}T{hh:02d}:00Z', 'u10': round(v['UGRD'], 2), 'v10': round(v['VGRD'], 2), 'gust': round(v['GUST'], 2), 't2': round(v['TMP'] - 273.15, 1), 'rh2': round(v['RH'], 1)})
    print('hrrr', hh, flush=True)
json.dump({'fuente': 'NOAA GOES-R ABI L2 Fire Detection (FDCC) y NOAA HRRR 3 km, AWS Open Data; dominio público', 'caso': CASE, 'satelite': C['bucket'], 'frames': frames, 'hrrr': hrrr, 'primerFoco': first}, open(os.path.join(OUT, f'goes_{CASE}.json'), 'w'))
print('ok')
