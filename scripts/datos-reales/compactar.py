"""Compacta la salida de s2_procesar.py y gfs_descargar.py en los ficheros que usa la web (investor-next/public/senda/data/smv2026).
Uso: python3 -I compactar.py <salida_s2> <dir_gfs> <destino>"""
import json, sys, shutil, numpy as np
from PIL import Image
out, gdir, D = sys.argv[1:4]
r = json.load(open(f'{out}/real.json')); W2, H2 = r['dem']['w'], r['dem']['h']
bits = np.zeros((H2, W2), 'uint8')
for b, k in enumerate(['d0724', 'd0729', 'd0808']):
    m = np.load(f'{out}/burn_{k}.npy')[:H2 * 5, :W2 * 5].reshape(H2, 5, W2, 5).mean(axis=(1, 3)) >= 0.5; bits |= (m.astype('uint8') << b)
bits.tofile(f'{D}/burn_100m.bin')
for f in ['dem_100m.bin', 'fuel_100m.bin', 'dnbr_d0808.png']: shutil.copy(f'{out}/{f}', D)
for k in ['pre', 'd0724', 'd0729', 'd0808']: Image.open(f'{out}/tci_{k}.jpg').save(f'{D}/tci_{k}.jpg', quality=76, optimize=True, progressive=True)
gf = json.load(open(f'{gdir}/gfs_20260723_12z.json')); lats, lons = gf['grid']['lats'], gf['grid']['lons']
J = [j for j, la in enumerate(lats) if 39.75 - 1e-6 <= la <= 41.0 + 1e-6]; I = [i for i, lo in enumerate(lons) if -5.25 - 1e-6 <= lo <= -3.5 + 1e-6]
sub = lambda A: [[A[j][i] for i in I] for j in J]
gfs = {'source': gf['source'], 'grid': {'lats': [lats[j] for j in J], 'lons': [lons[i] for i in I]}, 'times': [{'validUTC': t['validUTC'], 'fhour': t['fhour'], 'fields': {k: sub(v) for k, v in t['fields'].items()}} for t in gf['times']]}
syn = {'lats': lats, 'lons': lons, 'times': [{'validUTC': t['validUTC'], 'mslp': t['fields']['PRMSL@mean sea level'], 'u10': t['fields']['UGRD@10 m above ground'], 'v10': t['fields']['VGRD@10 m above ground'], 't2': t['fields']['TMP@2 m above ground']} for t in gf['times']]}
json.dump(gfs, open(f'{D}/gfs_20260723_12z.json', 'w'), separators=(',', ':')); json.dump(syn, open(f'{D}/gfs_sinoptico.json', 'w'), separators=(',', ':'))
r['quemado_100m'] = {'fichero': 'burn_100m.bin (Uint8, bits: 0 = 24-07, 1 = 29-07, 2 = 08-08; gravedad moderada-baja o más)'}
r['meteo'] = {'fichero': 'gfs_20260723_12z.json (perfiles 0,25°, 1000-500 hPa + superficie) y gfs_sinoptico.json (presión a nivel del mar, viento a 10 m y T a 2 m)', 'fuente': gf['source']}
json.dump(r, open(f'{D}/real.json', 'w'), ensure_ascii=False, indent=1); print('ok')
