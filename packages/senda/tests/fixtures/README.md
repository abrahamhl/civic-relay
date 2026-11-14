# Fixtures de pruebas · origen de cada fichero

Regla: `CLAUDE.md` §1. Un fixture **sintético** sirve para probar un analizador y **nunca** se cita como dato real.

| Fichero | Origen | ¿Real? |
|---|---|---|
| `digitraffic-tms-2026-11-10.json` | Volcado de la API pública de Digitraffic (Finlandia), 10-11-2026 | Sí (descarga) |
| `madrid-pm-2026-11-10-sample.xml` | Volcado del XML de puntos de medida de tráfico de Madrid, 10-11-2026 | Sí (descarga) |
| `madrid_pop_1km_2021.csv` | Rejilla de población de 1 km de 2021 (ver `packages/senda/data/population/*.provenance.json`) | Sí (descarga) |
| `cems-activations-sample-2026.json` | Escrito a mano imitando Copernicus EMS. El código EMSR765 es **incorrecto** (la activación real de la DANA de Valencia es [EMSR773](https://mapping.emergency.copernicus.eu/news/flood-in-valencia-region-spain/)); perímetros y áreas inventados | **No: sintético** |
| `cdse-stac-sample-2026.json` | Escrito a mano imitando una respuesta STAC de Copernicus Data Space; escenas no verificadas | **No: sintético** |
| `firms-sample-2026.json` | 3 detecciones escritas a mano con el formato CSV/JSON de NASA FIRMS (fechas de 2026-08-14) | **No: sintético** |

Revisado el 14-11-2026 (revisión horaria 24). Los volcados «Sí» se identifican como descargas por su tamaño y su estructura completa. Su URL exacta de descarga no está registrada en el repo, así que su origen no está verificado con una fuente.
