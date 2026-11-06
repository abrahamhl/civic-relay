# Datos reales del incendio de San Martín de Valdeiglesias (julio de 2026)

Scripts que reproducen los ficheros de `investor-next/public/senda/data/smv2026/`. Todo sale de fuentes abiertas en AWS Open Data, que esta sesión sí podía alcanzar.

| Fuente | Qué | Licencia |
|---|---|---|
| Copernicus DEM GLO-30 (`copernicus-dem-30m`) | Terreno, remuestreado a 100 m | Gratuita con atribución: © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, proporcionado en el marco de COPERNICUS por la UE y la ESA |
| Sentinel-2 L2A (`sentinel-cogs`, tesela 30TUK) | Color natural y bandas B04, B08, B12 y SCL del 16-07, 24-07, 29-07 y 08-08 | Licencia abierta de Copernicus: «Contiene datos modificados de Copernicus Sentinel (2026)» |
| NOAA GFS 0,25° (`noaa-gfs-bdp-pds`) | Pasada del 23-07-2026 12 UTC, de +0 a +12 h | Dominio público (NOAA) |

## Pasos

```
pip install rasterio numpy pillow scipy eccodes
curl -o dem.tif https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N40_00_W005_00_DEM/Copernicus_DSM_COG_10_N40_00_W005_00_DEM.tif
python3 -I gfs_descargar.py salida_gfs          # solo descarga por rangos los campos necesarios
python3 -I s2_procesar.py dem.tif salida_s2      # lee solo la ventana de la zona (COG remoto)
python3 -I compactar.py salida_s2 salida_gfs ../../investor-next/public/senda/data/smv2026
node ../../packages/senda/scripts/fire3d-real.mjs  # experimentos → fire3d.json, prob_roi.bin, arrival_roi.bin y docs/paper/resultados_v019.json
```

## Decisiones documentadas

- **Calibración radiométrica.** Los metadatos dicen escala 1e-4 y desfase −0,1, pero el agua del embalse tiene DN ≈ 450. Con ese desfase su reflectancia sería negativa, así que se usa reflectancia = DN × 1e-4 sin desfase.
- **Gravedad.** Diferencia del índice NBR (dNBR) con las clases de Key y Benson (2006):
  - baja: 0,10–0,27;
  - moderada-baja: 0,27–0,44;
  - moderada-alta: 0,44–0,66;
  - alta: ≥ 0,66.

  Se excluyen nubes, sombras y agua (SCL), y las manchas de menos de 50 ha.
- **Combustible aproximado por el NDVI del 16-07:**
  - por debajo de 0,15, sin vegetación;
  - por debajo de 0,32, pasto seco;
  - por debajo de 0,5, matorral;
  - el resto, arbolado.

  Es una aproximación; el siguiente paso son los modelos de combustible del Inventario Forestal o de SIOSE.
