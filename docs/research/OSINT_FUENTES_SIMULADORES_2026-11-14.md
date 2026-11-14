# Fuentes abiertas, mapas OSINT y simuladores útiles para SENDA

Fecha: 14-11-2026. Autor: Claude Code (sesión en la nube). Regla de veracidad: `CLAUDE.md` §1.

- **Método:** búsqueda web con fuentes enlazadas, más una prueba de acceso desde la sesión (código HTTP de hoy).
- **Sin acceso a X/Twitter:** esta sesión no puede entrar en X. Lo que se dice de X sale de fuentes públicas sobre X, no de leer X.
- **Lo marcado «no verificado»** no se ha comprobado en la fuente primaria.

## 1. Mapas OSINT de conflictos (referencia de funciones, no de datos para SENDA)

«Conflict Radar 360» **sigue sin aparecer** en las búsquedas. Proyectos parecidos que sí existen:

| Proyecto | Qué hace (según su propia página) | Qué tomar para SENDA |
|---|---|---|
| [Intelmapper](https://intelmapper.com/) | Mapa OSINT que usa fuentes verificadas de **Telegram y X**, con deslizador de tiempo para repetir cualquier día | Reproducción por días; etiqueta de «verificado» por fuente |
| [battleMap](https://battlemap.online/en) | Agrega canales OSINT, prensa local y voluntarios; se actualiza cada ~5 min | Refresco periódico y capas por tema |
| [Defog](https://defogwar.com/) | Vídeo geolocalizado, imagen satelital y seguimiento día a día | Ficha de evento con prueba (foto o vídeo) enlazada |
| [World Monitor](https://github.com/ramazansancar/koala73_worldmonitor) | Panel abierto con UCDP, ACLED y GDELT; elimina duplicados por distancia | Eliminación de duplicados por distancia (SENDA ya lo hace con `clusterReports`) |
| [IntelHQ](https://gh.r-mj.com/laikhtman/IntelHQ), [ShadowBroker](https://themenonlab.blog/blog/shadowbroker-osint-dashboard), [OSINT War Room](https://github.com/Hue-Jhan/OSINT-War-Room) | Paneles autoalojables con muchas fuentes | Arquitectura de «una capa por fuente, con su licencia» |

**Ya implementado en SENDA** (Atlas, 14-11):
- línea de tiempo con reproducción;
- perímetro de círculo o polígono;
- recuentos por zona;
- exportación GeoJSON y CSV, y enlace que abre la misma vista;
- fuente y base obligatorias en cada punto;
- capas reales: GOES, GDACS, DGT y NDW.

## 2. X (Twitter): qué se puede y qué no

- **API de pago por uso desde febrero de 2026** ([Open Terms Archive](https://opentermsarchive.org/en/memos/x-replaces-its-dollar200-entry-level-api-plan-with-a-pay-per-use-model/)).
  - Según guías de terceros, cuesta unos 0,005 $ por publicación leída y unos 0,015 $ por publicación creada ([postproxy](https://postproxy.dev/blog/x-api-pricing-2026)).
  - Las fechas de retirada de los planes antiguos **no coinciden** entre fuentes.
- **Raspar X sin la API va contra sus condiciones** (según guías de terceros; el texto oficial no se ha leído desde aquí). SENDA **no debe** raspar X.
- **Notas de la Comunidad** ([código](https://www.github.com/twitter/communitynotes), [descarga de datos](https://communitynotes.x.com/guide/en/under-the-hood/download-data); la página responde 200 desde la sesión).
  - El algoritmo de consenso «puente» es de código abierto.
  - Los datos se publican a diario bajo el acuerdo de desarrollador de X.
  - **Valor para SENDA:** es el modelo de referencia para puntuar la credibilidad de reportes ciudadanos. Una nota vale si la apoyan personas que suelen discrepar entre sí.
  - **Aplicación concreta:** el reputómetro de reportes (`assessIncident` hoy usa razones de verosimilitud sin calibrar).
- **Uso razonable de X en SENDA:**
  - leer **cuentas oficiales** (112, AEMET, DGT, protección civil) con la API y dentro de sus condiciones;
  - no perfilar a particulares;
  - no guardar datos personales: RGPD y política de X, a revisar con un jurista antes del piloto.

## 3. Fuentes de datos útiles para emergencias civiles (España, Países Bajos, UE)

| Fuente | Qué da | Acceso hoy desde la sesión | Licencia | Encaje |
|---|---|---|---|---|
| **DGT, nap.dgt.es** | Incidencias DATEX II v3.7 | 200, **integrado** | CC BY (ficha del conjunto) | Capa España del Atlas |
| **NDW, opendata.ndw.nu** | Situación del tráfico DATEX II | 200, **integrado** | «Open data» según NDW; **licencia exacta no verificada** | Capa Países Bajos |
| **GDACS** | Alertas mundiales (terremotos, ciclones, inundaciones…) | 200, **integrado** | [Condiciones de GDACS](https://www.gdacs.org/About/termsofuse.aspx) | Capa Mundo |
| **EFFIS** (Copernicus, incendios en Europa) | Áreas quemadas (desde unas 30 ha), focos activos VIIRS/MODIS, peligro de incendio; servicio de descarga y WMS ([JRC](https://data.jrc.ec.europa.eu/dataset/022cdeed-159f-407d-be18-0dface69ef92), [datos y servicios](https://forest-fire.emergency.copernicus.eu/applications/data-and-services)) | 200 la web; **el punto exacto de la API no está verificado** | © Unión Europea; condiciones por revisar | **Siguiente capa recomendada:** cicatrices reales en España para validar `fire-field` |
| **GloFAS / EFAS** (inundaciones, Copernicus) | Caudal previsto de ríos | Oficial: Climate Data Store con clave ([CDS](https://global-flood.emergency.copernicus.eu/general-information/data-and-services)). Open-Meteo Flood (no oficial, sin clave): **200** | Copernicus abierta; condiciones de Open-Meteo **por verificar** | Avisos de crecida en Valencia, Murcia… cruzados con reportes de «el río sube» |
| **GDELT 2.0 DOC/GEO** | Noticias geolocalizadas de todo el mundo, sin clave ([blog de GDELT](https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/)) | **429** (límite de peticiones), accesible | «100 % libre y abierto» según terceros | Señal de contexto, nunca prueba: mucho ruido |
| **ReliefWeb (ONU OCHA)** | Desastres e informes | **403**: desde el 1-11-2025 hace falta un *appname* aprobado ([ReliefWeb](https://reliefweb.int/blogpost/upcoming-changes-reliefweb-api-what-you-need-know)) | Contenido de sus fuentes | Pedir *appname* con correo del proyecto |
| **UCDP** | Conflicto armado georreferenciado | **401**: requiere token gratuito | Gratis con token | Poco encaje civil en España y Países Bajos |
| **ACLED** | Conflicto y protestas | No probado | Requiere registro (no verificado hoy) | Poco encaje civil |

## 4. Simuladores abiertos que encajan con SENDA

| Simulador | Para qué | Licencia | Uso en SENDA |
|---|---|---|---|
| **Eclipse SUMO** ([GitHub](https://github.com/eclipse-sumo/sumo)) | Tráfico microscópico. Usado para evacuaciones: Google lo aplicó al plan de Mill Valley ([Google Research](https://www.research.google/blog/improving-traffic-evacuations-a-case-study/)) | EPL-2.0 (o GPL-2.0+) | Validar `evacuacion` con redes OSM reales en lugar del modelo de celdas propio |
| **ForeFire** ([JOSS](https://joss.theoj.org/papers/10.21105/joss.08680)) | Propagación de incendios en C++, programable por scripts | GPL-3.0 | Comparar con `fire-field` en San Martín de Valdeiglesias; ambos sin calibrar hasta cotejarlos con cicatrices de EFFIS |
| **ELMFIRE** ([Berkeley Fire Lab](https://firelab.berkeley.edu/software)) | Propagación de incendios por conjunto de nivel | EPL-2.0 | Igual, como segunda referencia independiente |
| **Cell2Fire** ([docs](https://cell2fire.readthedocs.io/en/latest/rstfiles/intro.html)) | Incendio por celdas | GPL-3.0 según un agregador (**no verificado** en su LICENSE); último cambio en 2023 | Baja prioridad |
| **WUI-NITY / GEO-SAFE** ([WUI-NITY](https://lup.lub.lu.se/search/files/224899975/WUI-NITY4.pdf)) | Acopla incendio, peatones y tráfico en evacuaciones | Gratuito (licencia no verificada) | Referencia de diseño para el escenario de Paradise |
| **Ushahidi** ([GitHub](https://github.com/ushahidi/platform)) | Plataforma de reportes ciudadanos en crisis | AGPL según Wikipedia (**verificar** su LICENSE) | Competidor y referencia: SENDA se diferencia por funcionar sin red y con firmas |

## 5. Estrategia recomendada (orden por valor y coste)

1. **EFFIS → validar el modelo de incendio.**
   - Descargar las áreas quemadas reales de España.
   - Medir el acierto de `fire-field`, ForeFire y ELMFIRE con las mismas condiciones.
   - Así se pasa de «sin calibrar» a una cifra medida, que es la pregunta de inversor más difícil hoy.
2. **GloFAS → reportes ciudadanos con contexto hidrológico.**
   - Cuando un vecino reporta «el río sube», mostrar al lado el caudal previsto.
   - Primero por Open-Meteo para la demo, y por el Climate Data Store de Copernicus en producción.
3. **Credibilidad estilo Notas de la Comunidad para los reportes.**
   - Algoritmo puente sobre las confirmaciones entre vecinos.
   - Se puede probar con los datos públicos de Notas antes de tener usuarios.
4. **SUMO para evacuación con redes reales** (OSM): sustituir los «gemelos» de celdas por una simulación abierta y reproducible. Tiene que seguir marcada como SIMULACIÓN.
5. **Tareas programadas** que relancen `scripts/datos-reales/*` para que el Atlas pase de foto a datos de hace minutos.
   - Necesita un servidor o un trabajo de la CI.
   - Cada ejecución guarda su SHA-256.
6. **No hacer:**
   - raspar X ni otras redes sociales;
   - agregar datos personales;
   - usar mapas de conflicto armado como producto civil en España.

— Claude Code, 14-11-2026. Pendientes de verificar en su fuente primaria: licencias de NDW, Cell2Fire, Ushahidi y WUI-NITY, condiciones de Open-Meteo, punto exacto de la API de EFFIS y precios oficiales de X.
