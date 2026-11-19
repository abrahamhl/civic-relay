# Caso real: colapso glaciar de Langtang Lirung y crecida del Bhote Koshi (Nepal, 26-08-2026)

Fecha: 14-11-2026. Autor: Claude Code. Regla de veracidad: `CLAUDE.md` §1.

## Qué dice la prensa (NO lo mide SENDA)

- «Colapso glaciar», en el flanco norte del Langtang Lirung, a unos 5.200 m, y bajada por el Lhende Khola hasta el Bhote Koshi y el Trishuli: es la descripción de [Down To Earth](https://www.downtoearth.org.in/natural-disasters/wake-up-call) y [Himalayan Geographic](https://himalayangeographic.com/2026-himalayan-disaster/). Según esa prensa, USGS registró la señal primero como M 4,4 y la corrigió a 5,2.
- Lo que SENDA comprueba con datos propios: USGS cataloga el suceso como **«landslide»**, el cambio en Sentinel-2 sigue el valle hacia el Bhote Koshi y la ruta calculada sale del glaciar. No comprobamos que la causa fuera un glaciar: lo usamos como nombre del caso, citando a la prensa.

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

## Concordancia USGS ↔ EMSC (segundo catálogo, dependencia evento a evento)

- Datos: EMSC-CSEM SeismicPortal, 1552 sismos M ≥ 4,0 en 31 días, con licencia **CC BY 4.0** ([condiciones](https://www.seismicportal.eu/terms.html), leídas el 14-11).
- EMSC publica para cada sismo la **agencia autora** de su solución. De esos 1552, 426 son de NEIC, es decir, de USGS.
- Resultados con `concordance` (100 km, 120 s):
  - 662 de los 672 sismos de USGS tienen pareja en EMSC.
  - **Pares con solución de NEIC (187): mediana de 0,00 km.** Es la misma solución copiada, así que no cuentan.
  - **Pares con solución de otra agencia (475): mediana de 8,6 km y 0,6 s.** Son soluciones distintas, con lo que **475 de 672 sismos de USGS (70,7 %) tienen confirmación independiente**.

## NASA EONET: por qué no se añade como fuente nueva

En los últimos 30 días, 850 de sus 904 eventos citan **GDACS** como fuente; el resto son IRWIN, JTWC, NATICE, NOAA NHC, BYU y EO. Sumarlo como «otra fuente» duplicaría GDACS. Queda pendiente integrar solo los eventos que no proceden de GDACS (54).

## Licencias

- **USGS:** obra del Gobierno de EE. UU. Varias fuentes secundarias indican que es de dominio público en EE. UU. (17 U.S.C. §105). La página de USGS sobre derechos de autor devolvió 403 desde la sesión: **no leída directamente**.
- **Sentinel-2 y Copernicus DEM:** licencia de datos Copernicus, uso libre con atribución. DEM © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018.
- **NDW:** CC0 1.0, verificada el 14-11 en sus [condiciones](https://docs.ndw.nu/algemeen/data-gebruiksvoorwaarden/).

## Anexo: DANA de Valencia, Copernicus EMS EMSR773 (datos reales que sustituyen al fixture inventado)

- Ficha pública de la activación (dashboard-api de rapidmapping.emergency.copernicus.eu): evento del 29-10-2024 a las 14:30 UTC, activación a las 16:40, 36 zonas de interés y 44 productos. GDACS FL1102983.
- Estadísticas **oficiales** tal como las publica la activación: extensión del evento 9.838,1 ha, 81.080 personas en la zona afectada, 1.125,2 km de carreteras, 7.207 edificios (221,9 ha).
- Capas «observedEventA» de la última versión de cada producto DEL: 6 zonas con inundación observada. **Superficie calculada por SENDA** en EPSG:3035 sobre la geometría original: 106,05 km² en total, de ellos 24,07 km² en Horta Sud. La diferencia con la cifra oficial (98,38 km²) **no está explicada**: la activación no dice qué versiones suma, y el solape entre zonas es solo de 0,17 km².
- Licencia: acceso libre, con reproducción, distribución y adaptación, citando la fuente ([condiciones de CEMS](https://mapping.emergency.copernicus.eu/terms-and-conditions/)). Cita: «Contains modified Copernicus Emergency Management Service information 2024».
- En el Atlas: caso «DANA Valencia» (`/senda/atlas#caso=dana`).
