# Caso real: colapso glaciar de Langtang Lirung y crecida del Bhote Koshi (Nepal, 26-08-2026)

Fecha: 14-11-2026. Autor: Claude Code. Regla de veracidad: `CLAUDE.md` §1.

## Qué se ha MEDIDO o DESCARGADO con código del repo

| Dato | Valor | Origen | Script |
|---|---|---|---|
| Señal sísmica del colapso | **M 5,2 ms_vx**, tipo **«landslide»**, 2026-08-26 02:52:10 UTC, 28,271 N · 85,515 E | USGS ComCat, evento [us7000tbwb](https://earthquake.usgs.gov/earthquakes/eventpage/us7000tbwb) | `scripts/datos-reales/usgs_sismos_snapshot.mjs` |
| Segunda señal | M 4,2 ms_vx, «landslide», 2026-08-26 06:00:35 UTC | USGS ComCat, [us7000tc90](https://earthquake.usgs.gov/earthquakes/eventpage/us7000tc90) | ídem |
| Imagen antes | Sentinel-2 L2A S2C_45RUM_20260812_0_L2A (86,7 % de píxeles despejados en el área) | Copernicus vía AWS sentinel-cogs, búsqueda STAC en Earth Search | `scripts/datos-reales/nepal_langtang_s2.py` |
| Imagen después | S2B_45RUM_20261026_0_L2A (75,3 % despejado); también S2C_45RUM_20260928_0_L2A (cortada por el borde de pasada) | ídem | ídem |
| Cambio detectado | 18,02 km² tras filtrar manchas < 0,05 km²; mancha conexa mayor 2,49 km² | **Cálculo de SENDA** (NDVI) | ídem |
| Ruta del cauce afectado | 44,6 km, 89,5 % sobre píxeles con cambio | **Cálculo de SENDA** (camino de mínimo coste sobre la máscara) | `scripts/datos-reales/nepal_langtang_3d.py` |
| Relieve | Copernicus DEM GLO-30 remuestreado a 60 m (1229–7207 m en el área) | AWS copernicus-dem-30m | ídem |

## Límites declarados

- La máscara de cambio es una **detección espectral**, no un mapa oficial de daños. Revisada a ojo, el cauce arrasado del Lhende Khola y el Bhote Koshi sale de forma continua. También hay **falsos positivos junto al límite de la nieve** (cambio estacional entre agosto y octubre), así que los km² totales no son la superficie afectada.
- La ruta sigue lo que se detecta como cambio; no es un trazado oficial del flujo.
- **Víctimas: no se muestran.** Las fuentes de prensa no coinciden: Britannica habla de unos 1.500 muertos y más de 5.000 desaparecidos, y otras fuentes de cifras distintas. No hay un parte oficial nepalí consultado.
- Volumen y mecanismo (cifras de 142 millones de m³ y de 10–15 km³ en la prensa): **no verificados**, y no se usan.

## Concordancia GDACS ↔ USGS (nuevo módulo `cross-source.mjs`)

- Datos: 537 de 555 sismos de GDACS emparejados con USGS (96,8 %), con una diferencia mediana de **0 km, 0,5 s y 0 de magnitud**.
- Interpretación: GDACS reproduce la solución de USGS. GDACS declara que toma parámetros sísmicos de USGS NEIC, EMSC, GEOFON y redes asociadas, y usa ShakeMaps de USGS ([GDACS, modelo EQ](https://gdacs.org/Knowledge/models_EQ.aspx); [De Groeve et al. 2006](https://www.idl.iscram.org/files/degroeve/2006/429_DeGroeve_etal2006.pdf)).
- Por eso SENDA lo trata como **concordancia, no como confirmación independiente**, y el motor de fusión no suma USGS como corroboración de una alerta sísmica de GDACS.

## Licencias

- **USGS:** obra del Gobierno de EE. UU. Varias fuentes secundarias indican que es de dominio público en EE. UU. (17 U.S.C. §105). La página de USGS sobre derechos de autor devolvió 403 desde la sesión: **no leída directamente**.
- **Sentinel-2 y Copernicus DEM:** licencia de datos Copernicus, uso libre con atribución. DEM © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018.
- **NDW:** CC0 1.0, verificada el 14-11 en sus [condiciones](https://docs.ndw.nu/algemeen/data-gebruiksvoorwaarden/).
