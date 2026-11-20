# Muestras reales de avisos (descargadas el 20-11-2026, 18:14–18:15 UTC)

Recortes sin modificar de las respuestas públicas de cada fuente, para las pruebas de `alert-watch.mjs`:

| Archivo | Fuente |
|---|---|
| `meteoalarm-es.xml` | https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain (6 primeras entradas) |
| `aemet-cap.xml` | CAP 1.2 de AEMET enlazado desde esa fuente (aviso de viento, Rías Baixas) |
| `usgs.json` | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson (5 eventos) |
| `emsc.json` | https://www.seismicportal.eu/fdsnws/event/1/query (5 eventos) |
| `gdacs.json` | https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH (5 eventos) |
| `eonet.json` | https://eonet.gsfc.nasa.gov/api/v3/events?status=open (5 eventos) |

Los avisos de otras pruebas que llevan polígonos o círculos son SINTÉTICOS y se rotulan como tales en el propio test.
