# Fuentes públicas: cámaras, ríos, fuego y avisos oficiales (noviembre de 2026)

> **Fecha:** 12-11-2026. **Autor:** subagente de investigación (Claude).
> **Para qué:** que ciudadanos y personal de emergencias puedan (1) ver cámaras públicas cerca de un peligro, (2) contrastar avisos oficiales y (3) alimentar mejor la predicción de incendio e inundación en SENDA.
> **Código relacionado:** `packages/senda/src/cameras.mjs`, `corridor-connectors.mjs`, `flood-watch.mjs`, `wildfire.mjs`, `fire-watch.mjs`, `nasa-firms.mjs`, `copernicus-cdse.mjs`, `copernicus-ems.mjs`, `feeds.mjs`; `apps/senda-live/server/domain/` (`aemet-cap.mjs`, `metno-weather-grid.mjs`, `weather-grid.mjs`, `copernicus-effis.mjs`). Anteriores: `FUENTES_INCENDIO_E_IMAGENES_2026-11-05.md`, `SENDA_FUENTES_PREDICCION_V021_2026-11-06.md`.

## 0. Cómo se ha verificado (y qué NO se ha podido)

- **Desde esta sesión no se pudo abrir ninguna web de las fuentes.** `curl` sale por el proxy del entorno y recibe `403` en `CONNECT` para todos los hosts probados (datos.madrid.es, informo.madrid.es, nap.dgt.es, infocar.dgt.es, opendata.aemet.es, saih.chj.es, saihtajo.chtajo.es, www.saihebro.com, www.chsegura.es, www.chguadalquivir.es, firms.modaps.eosdis.nasa.gov, forest-fire.emergency.copernicus.eu, dataspace.copernicus.eu, api.open-meteo.com, api.met.no, www.gdacs.org, feeds.meteoalarm.org, waterwebservices.rijkswaterstaat.nl, www.comunidad.madrid, www.efas.eu, es-alert.gob.es, www.nl-alert.nl, opendata.ndw.nu, www.miteco.gob.es). `WebFetch` responde `ENOTFOUND` (fuera de los dominios permitidos) para informo.madrid.es y datos.madrid.es.
- **Solo funcionó el buscador web.** Todo lo de abajo procede de resultados de búsqueda (fichas de catálogo, documentación oficial indexada, notas de prensa y, cuando se indica, terceros). Nada se ha descargado ni probado en vivo.
- **Columna «Confianza»:** **Alta** = lo dice la ficha o documento oficial que aparece en el buscador; **Media** = fuente oficial parcial o varias secundarias coincidentes; **Baja** = una sola fuente secundaria o conocimiento previo. «no verificado» = no se ha podido comprobar.
- **CORS:** ninguna cabecera CORS se pudo comprobar desde aquí; todas quedan «no verificado» salvo que se diga otra cosa. Recomendación: consumir siempre a través del relé (servidor), no desde el navegador.
- Para desbloquear la verificación: permitir esos dominios en la red del entorno, o capturar las respuestas en una máquina sin bloqueo y guardarlas en `fixtures/` con su licencia (como ya se hizo con NDW).

---

## 1. Cámaras públicas — Madrid y España

| Fuente | URL | Tipo de dato | Frecuencia | ¿Legible por máquina? | Licencia / condiciones | CORS | Confianza |
|---|---|---|---|---|---|---|---|
| **Ayuntamiento de Madrid · Tráfico. Cámaras** (conjunto 202088) | KML: `http://datos.madrid.es/egob/catalogo/202088-0-trafico-camaras.kml` · Ficha: https://datos.madrid.es/en/dataset/202088-0-trafico-camaras/resource/202088-1-trafico-camaras · Catálogo nacional: https://datos.gob.es/en/catalogo/l01280796-trafico-camaras1 · NAP DGT: https://nap.dgt.es/en/dataset/trafico-camaras | Ubicación de cámaras de control de tráfico + enlace a imagen fija (captura) | La imagen se renueva cada **10 min** según el NAP de la DGT (otra fuente dice cada 5 min: **no verificado** cuál vale hoy) | Sí: KML (fichero), imagen JPG por cámara. Sin API | **CC BY 4.0** según el PDF de estructura del conjunto y el NAP («Creative Commons Attribution»). Otros conjuntos del portal remiten al aviso legal general (https://datos.madrid.es/egob/catalogo/aviso-legal). Reutilización permitida con atribución; **confirmar** en la ficha 202088 | no verificado | Media-alta |
| **Ayuntamiento de Madrid · Calle 30 (M-30) Cámaras** | XML: `datos.madrid.es/egob/catalogo/212166-7899870-trafico-calle30-camaras.xml` · NAP: https://nap.dgt.es/en/dataset/trafico-calle-30-camaras | Datos e imágenes de las cámaras de control del túnel/vía M-30 | **5 min** (según NAP) | Sí: XML | «Creative Commons Attribution» según NAP | no verificado | Media |
| **Informo (portal de tráfico del Ayuntamiento)** | https://informo.madrid.es/ · nota: https://diario.madrid.es/blog/notas-de-prensa/arranca-la-renovada-web-de-informacion-del-trafico/ | Visor web: tráfico en tiempo real + ubicación de ~270 cámaras (otra nota municipal habla de 323 cámaras CCTV) | Minutos | **No** como API; es una web. Los datos profesionales se ofrecen en datos.madrid.es (fila anterior) | Web pública; reutilización vía el portal de datos abiertos | — | Media |
| **DGT · Cámaras DATEX II v3.6 (nuevo)** | https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-6-nuevo · localizaciones v3.6: https://nap-pre.dgt.es/en/dataset/camaras-dgt-localizaciones-datex2-v3-6 | Ubicación y metadatos de cámaras en carreteras del Estado (salvo País Vasco y Cataluña) | no verificado | Sí: XML DATEX II v3.6 | NAP gratuito; licencia exacta **no verificada** | no verificado | Alta (existencia) |
| **DGT · Cámaras DATEX II v3.7** (aún más nuevo, no está en el repo) | Recurso: https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-7/resource/31f5727a-bbfe-4aa8-b1dc-d2fce1302e69 · fichero: `https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml` | Ídem, perfil DevicePublication | no verificado | Sí: XML DATEX II v3.7 | El NAP avisa con **2 meses** de antelación de cambios o bajas | no verificado | Media |
| **DGT · Cámaras tiempo real (OBSOLETO 12-01-2026)** | https://nap.dgt.es/en/dataset/camaras-dgt · `http://infocar.dgt.es/datex2/dgt/CCTVSiteTablePublication/all/content.xml` | Tabla CCTV antigua | — | XML DATEX II v2 | CC BY según el NAP | — | Alta (está obsoleto) |
| **DGT · imágenes de cámara (eTraffic / infocar)** | https://infocar.dgt.es/etraffic/ | Imagen JPG por cámara | Minutos | El patrón de URL de imagen **no está documentado** en lo encontrado; **no verificado** si DATEX v3.6/3.7 trae URL de imagen | no verificado | no verificado | Baja |
| **Comunidad de Madrid · Vialidad Invernal (Dirección General de Carreteras)** | https://www.comunidad.madrid/node/76584 | Estado diario de puertos (seca/abierto/cadenas) + campaña con **31 cámaras de vigilancia** y 27 estaciones meteorológicas en puertos (campaña 2025/26) | Diario (informe); cámaras: no verificado | Informe en PDF (p. ej. https://www.comunidad.madrid/sites/default/files/doc/transportes/informe_estado_de_puertos_-_20260419.pdf). **No se ha encontrado** página pública con las imágenes de esas 31 cámaras ni API | Web institucional; reutilización no verificada | — | Media (existencia de las cámaras) / Baja (acceso público a imágenes) |
| **Comunidad de Madrid · 40 cámaras «inteligentes» de tráfico** (anuncio de julio de 2026) | Noticia: https://madridinforma.eldiario.es/?p=59858 | Análisis de flujo con IA, sin fin sancionador | — | **No** consta acceso público | — | — | Baja |
| Agregadores (RACE, km77…) | https://www.race.es/mapa-de-carreteras-espana/camaras-trafico-comunidad-madrid | Reproducen cámaras DGT | — | No (web de terceros) | De terceros: **no reutilizar**; ir a la fuente (DGT) | — | — |

### 1.1 La página «por sectores» con canal de policía / protección civil

**No se ha podido identificar con certeza.** Lo que aparece en fuentes públicas:

- **CISEM** (Centro Integrado de Seguridad y Emergencias de Madrid, Ayuntamiento) y **CISEVI** (Centro Integrado de Señales de Vídeo): la revista de la Policía Municipal de noviembre de 2025 dice que controlan cámaras «al servicio del operativo» (https://www.madrid.es/UnidadesDescentralizadas/Policia/Publicaciones/RevistaCompromisoyParticipacion/2025/Ficheros/Revista%20Polic%C3%ADa%20Municipal%20Madrid%20Noviembre%202025.pdf). Es un sistema **interno**.
- **ESICAM179** (sucesor de BESCAM, policías locales de 110 ayuntamientos) y el **CECOM** previsto en la estrategia regional (personal de la Comunidad, voluntarios de Protección Civil y policías locales). Además, la Comunidad anunció **1.123 cámaras de videovigilancia con lectura de matrículas** en municipios pequeños (programa «Pueblos con Vida»). Todo ello es videovigilancia policial: **no es de acceso público** y está sujeta a la LO 4/1997 de videovigilancia y al RGPD/LO 7/2021.
- **ASEM 112** (Ley 5/2023, Sistema Integrado de Protección Civil y Emergencias): su proyecto de reglamento (https://www.comunidad.madrid/transparencia/sites/default/files/proyecto_decreto_reglamento_sipce_20261001.pdf) tiene un capítulo de sistemas de información; no describe un visor público.

**Conclusión:** si la página que recuerda el fundador muestra cámaras «por sector» con un canal de policía local / protección civil, lo más probable es que sea una **herramienta interna** (CISEM/CISEVI, CECOM/ESICAM o un visor de ASEM 112) que estaba visible sin querer o que exige credenciales. **No es para acceso público**, y SENDA no debe enlazarla, rastrearla ni intentar acceder a ella. Tampoco se documentan aquí formas de saltarse su control de acceso. La vía correcta es un **convenio** con ASEM 112 o con el Ayuntamiento (Dirección General de Gestión y Vigilancia de la Circulación / Policía Municipal), donde SENDA reciba solo lo que necesita (rumbo y hora de un humo, visibilidad) y nunca imágenes de personas. Si el fundador encuentra la URL, conviene **avisar al organismo** (posible exposición accidental) en lugar de usarla.

---

## 2. Cámaras y tráfico — Países Bajos (breve)

| Fuente | URL | Qué hay | Legible por máquina | Licencia | Confianza |
|---|---|---|---|---|---|
| **Rijkswaterstaat · cámaras** | https://www.rijkswaterstaat.nl/wegen/wegbeheer/onderzoek/verkeersonderzoek/wat-doet-rijkswaterstaat-met-camerabeelden · privacidad: https://www.rijkswaterstaat.nl/privacy/specifieke-privacyverklaringen-wegen/privacyverklaring-monitoring-camerabeelden-door-de-verkeerscentrale | ~3.000 cámaras; solo las ven las centrales de tráfico; **no se graban ni se publican** («uitsluitend voor Rijkswaterstaat zelf en niet voor gebruik door derden») | No | No públicas → solo **convenio** | Alta |
| **NDW (open data)** | https://opendata.ndw.nu/ (ya en el repo: `actueel_beeld.xml.gz`, `trafficspeed.xml.gz`) · visor: https://english.ndw.nu/products-and-services/ndw-viewer | Medidas (velocidad, intensidad, tiempos de recorrido por minuto), situaciones SRTI. **Sin imágenes** | Sí: DATEX II (XML gz) | CC0 según el repo; política RWS «open, tenzij» | Alta |
| **Open data Rijkswaterstaat** | https://www.rijkswaterstaat.nl/zakelijk/open-data | Catálogo general | Varios | Abierta salvo privacidad | Media |

---

## 3. Ríos e inundación (datos en vivo)

### 3.1 SAIH de las Confederaciones Hidrográficas (España)

Advertencia común (manual MITECO 2009, https://www.miteco.gob.es:443/content/dam/miteco/es/agua/publicaciones/SAIH_-_Manual_de_Usuario_Nov_2009_tcm30-136205.pdf): los datos en tiempo real se cargan **sin filtrar ni depurar** y son **provisionales**. Ninguna confederación publica, que se haya encontrado, una **API abierta documentada** con licencia explícita.

| Cuenca | URL pública | Datos | Frecuencia | ¿API? | Licencia / términos | Confianza |
|---|---|---|---|---|---|---|
| **Tajo (CHT)** — Madrid: Jarama, Manzanares, Henares, Alberche | Web SAIH: `https://saihtajo.chtajo.es/` (**URL no verificada**, conocimiento previo) | Niveles y caudales en ríos, embalses, lluvia; umbrales por estación (p. ej. Jarama en San Fernando, rojo 1,75 m) | no verificado (minutos) | **No encontrada** | Aviso legal no encontrado | Media (existe) / Baja (URL) |
| **Ebro (CHE)** | https://www.saihebro.com/ · nota: https://chebro.es/documents/20121/2264767/NP%2020241022%20Web%20SAIH.pdf | Aforos, embalses, pluviómetros en tiempo real; «datos a la carta» para históricos (descarga diaria, mensual, anual y quinceminutal **con registro**, según un blog) | Tiempo real; histórico 15 min | No API pública documentada; descarga web con registro | no verificado | Media |
| **Júcar (CHJ)** — ya en el repo como `CATALOG_ONLY` | https://saih.chj.es/ | Panel público en tiempo real | 5 min (según tercero) | **API privada**: `https://api-saih.chj.es:8000` (Swagger en `/docs`), solo por **lista blanca de IP o VPN** previa solicitud a la CHJ (fuente: proyecto PGTEC, https://pgtec-vrain.github.io/data_sources/metadata_datasources/siah_datasource) | Convenio | Media |
| **Segura (CHS)** | iVisor: https://saihweb.chsegura.es/apps/iVisor/inicial.php | Lluvia y caudal en cauces y **ramblas** | Las estaciones comunican cada **5 min** (nota CHS) | No API documentada (visor web) | no verificado | Media-alta |
| **Guadalquivir (CHG)** | https://www.chguadalquivir.es/saih/ (sección; visor en vivo **no verificado**) · ficha: https://datos.gob.es/en/catalogo/ea0043519-sistema-automatico-de-informacion-hidrologica-saih-de-la-demarcacion-hidrografica-del-guadalquivir | 214 pluviómetros/nivómetros, registros cada 10 min; informes mensuales PDF | 10 min | No encontrada | Condiciones en la ficha de datos.gob.es (no leídas) | Media |
| **MITECO · estaciones SAIH (catálogo)** | https://datos.gob.es/es/catalogo/e0dat0002-estaciones-de-aforo-en-rio-saih-caudal1 · https://datos.gob.es/es/catalogo/e0dat0002-estaciones-de-aforo-en-embalse-saih1 | Inventario de estaciones (no valores en vivo) | — | Ficheros | Condiciones en la ficha | Media |

**Recomendación:** pedir acceso formal por convenio a CHT (Madrid) y CHJ (Valencia), y mientras tanto usar el SAIH solo como **enlace** para que la persona lo consulte (no hacer scraping de visores sin permiso).

### 3.2 AEMET OpenData

| Elemento | Detalle | Confianza |
|---|---|---|
| Portal | https://opendata.aemet.es/ · doc: https://opendata.aemet.es/dist/index.html · info: https://www.aemet.es/en/datos_abiertos/AEMET_OpenData | Alta |
| Acceso | **Clave gratuita** (API key por correo, en cabecera `api_key` o parámetro). Respuesta en dos pasos: la API devuelve una URL `datos` que hay que pedir después | Alta |
| Avisos | CAP 1.2: `/opendata/api/avisos_cap/ultimoelaborado/area/{area}` (último) y `/opendata/api/avisos_cap/archivo/fechaini/{..}/fechafin/{..}` (histórico). Ya usado en `apps/senda-live/server/domain/aemet-cap.mjs`. También RSS/Atom sin clave: https://www.aemet.es/es/rss_info/avisos/esp | Media-alta |
| Radar | `/opendata/api/red/radar/nacional` (compuesto nacional cada 30 min; regional cada 10 min según https://datos.gob.es/es/catalogo/e05068001-datos-de-radares). Imagen, no matriz de datos | Media |
| Estaciones | Observación convencional (últimas 24 h por estación), vía API | Media |
| Límites | **No verificado oficialmente**: el paquete R `climaemet` cita 40 peticiones/min por clave; un agregador cita otros valores. Planificar con ≤ 40/min y caché | Baja |
| Licencia | Reutilización con **cita de AEMET** (aviso legal de AEMET; texto no leído en esta sesión) | Media |
| CORS | no verificado (la doble petición complica el uso directo desde navegador; usar relé) | — |

### 3.3 Rijkswaterstaat Waterinfo (NL)

| Elemento | Detalle | Confianza |
|---|---|---|
| API | WaterWebservices (versión «ddapi20» según el wrapper `rws-waterinfo`): https://waterwebservices.rijkswaterstaat.nl/ · doc: https://rijkswaterstaat.github.io/wm-ws-dl · ficha: https://developer.overheid.nl/apis/rijkswaterstaat-wm-ws-dl | Media |
| Operaciones | `OphalenWaarnemingen` (observaciones), `OphalenLaatsteWaarnemingen`, catálogo `METADATASERVICES_DBO/OphalenCatalogus` (POST JSON) | Media |
| Acceso | Gratis, sin clave (autenticación «onbekend» en la ficha); disponibilidad garantizada 95 % | Media |
| Licencia | **Dominio público** según data.overheid.nl (https://data.overheid.nl/dataset/9442-waterinfo-rijkswateren) | Media |
| Visor | https://www.rijkswaterstaat.nl/waterinfo | Alta |
| CORS | no verificado | — |

### 3.4 EFAS / GloFAS (Copernicus CEMS)

| Elemento | Detalle | Confianza |
|---|---|---|
| Acceso | Early Warning Data Store (EWDS): https://ewds.climate.copernicus.eu/ (web + API `cdsapi`, con cuenta) · guía: https://european-flood.emergency.copernicus.eu/en/node/260 | Alta |
| **Tiempo real** | **Restringido a socios EFAS** (autoridades). Abierto solo lo **> 30 días** de antigüedad. Para uso operativo en tiempo real: solicitud al ECMWF Support Portal | Alta |
| Licencia | CEMS-Floods licence rev. 1 (https://ewds.climate.copernicus.eu/licences/cems-floods) + términos EWDS rev. 11 (https://ewds.climate.copernicus.eu/licences/terms-of-use-cems). Atribución: «Contains modified Copernicus Emergency Management Service information [año]». **No es un aviso**: solo las autoridades nacionales/regionales avisan | Alta |
| Uso en SENDA | Calibración e histórico (reanálisis, reforecasts); en vivo, solo si un socio (p. ej. Protección Civil) lo comparte | — |

---

## 4. Fuego, combustible y viento

| Fuente | URL | Tipo de dato | Frecuencia | Legible por máquina | Licencia / límites | CORS | Confianza |
|---|---|---|---|---|---|---|---|
| **NASA FIRMS** (ya en `nasa-firms.mjs`) | API: https://firms.modaps.eosdis.nasa.gov/api/ · área: `/api/area/csv/[MAP_KEY]/[SOURCE]/[W,S,E,N]/[1-10 días]/[YYYY-MM-DD opc.]` · clave: https://firms.modaps.eosdis.nasa.gov/api/map_key · WMS: https://firms2.modaps.eosdis.nasa.gov/mapserver/wms-info/ | Focos VIIRS (375 m) y MODIS (1 km), NRT/URT, con FRP | Varias pasadas al día; NRT ~3 h | CSV/JSON/KML/WMS | MAP_KEY gratis por correo; **5.000 transacciones / 10 min**; peticiones largas cuentan varias. Datos abiertos NASA (citar FIRMS) | no verificado | Alta |
| **EFFIS** (parcialmente en `apps/senda-live/.../copernicus-effis.mjs`) | https://forest-fire.emergency.copernicus.eu/ · datos: https://forest-fire.emergency.copernicus.eu/applications/data-and-services · descargas: https://forest-fire.emergency.copernicus.eu/downloads-instructions · API (vista en buscador): `https://api2.effis.emergency.copernicus.eu/api/effis/...` | Peligro FWI previsto (1–6/10 días), áreas quemadas NRT (≳ 30 ha), focos, **mapa de combustibles EFFIS** 2018–2023 (PNG/TIFF) y severidad | Diario | WMS, ficheros (SHP/TIFF) | «Libre y accesible» con licencia enlazada en la web; **CC BY 4.0 no verificado** en esta sesión | no verificado | Media |
| **Sentinel-2 / Sentinel-1 vía CDSE** (STAC ya en `copernicus-cdse.mjs`) | APIs: https://documentation.dataspace.copernicus.eu/APIs.html · cuotas: https://documentation.dataspace.copernicus.eu/Quotas.html · STAC: `https://catalogue.dataspace.copernicus.eu/stac/search` · también OData, S3, Sentinel Hub (Process/Catalog), openEO | Imagen óptica 10–20 m (dNBR, humedad), radar SAR | Revisita S2 ~5 días | Sí (STAC/OData sin cuenta para catálogo; descarga y Sentinel Hub con cuenta OAuth) | Datos Copernicus libres; **cuotas mensuales** en el nivel gratuito (cifras **no verificadas**); términos CDSE cap. 3 | no verificado | Media |
| **Sentinel-3 SLSTR FRP NRT** | Producto: https://sentiwiki.copernicus.eu/web/slstr-products · EUMETSAT: https://www.eumetsat.int/S3-NRT-FRP | Focos de fuego con potencia radiativa, gránulos de 5 min, de día y de noche | NRT (horas) | NetCDF; vía EUMETSAT Data Store y CDSE (colección `sentinel-3-sl-2-frp-nrt`, **no verificada** en CDSE) | Datos Copernicus libres; estado «preliminary operational» (aviso de 2021) | — | Media |
| **Mapa Forestal de España (MFE25/MFE50)** | https://www.miteco.gob.es/es/biodiversidad/temas/inventarios-nacionales/mapa-forestal-espana/mfe_25.html · WMS: `https://wms.mapama.gob.es/sig/Biodiversidad/MFE/wms.aspx` (registro IDEE: https://idee.es/csw-codsi-idee/srv/api/records/8f8c2c68-b930-4a35-ae47-77d44ff0cb14) | Formaciones forestales; según MITECO el MFE25 recoge también datos de matorral, herbazal y **modelos de combustible** (formato de descarga **no verificado**) | Por provincia (2007–2024) | WMS + descarga SHP por provincia | Datos públicos MITECO (licencia exacta **no verificada**) | — | Media |
| **Modelos de combustible (Rothermel / Prometheus)** | Nacional: **no se encontró** una capa nacional descargable de MITECO. Regional: Baleares, «Modelo de combustible forestal (Rothermel)» (https://datos.gob.es/ca/catalogo/a04003003-inventario-forestal-modelo-combustible.ttl). Global: GWIS/JRC (https://gwis.jrc.ec.europa.eu/gwis-es/acerca-de-es/antecedentes-tecnicos-es/mapa-global-de-combustibles-es). Europa: mapa de combustibles EFFIS | Clases de combustible | Estático | CSV/JSON/XML (Baleares); TIFF (EFFIS) | Varía | — | Media (Baleares/EFFIS) / Baja (nacional) |
| **Open-Meteo** (ya en `apps/senda-live/.../weather-grid.mjs`) | https://api.open-meteo.com/v1/forecast · términos: https://open-meteo.com/en/terms · precios: https://open-meteo.com/en/pricing | Viento 10 m / ráfagas / dirección, humedad, previsión horaria y modelos (ECMWF, ICON, AROME, HARMONIE) | Horaria | JSON, sin clave | **Gratis solo uso no comercial** (definición CC); datos **CC BY 4.0**; ~10.000 llamadas/día, 5.000/h, 600/min (**cifras de terceros, no verificadas**); uso comercial requiere suscripción | CORS: sí según conocimiento previo, **no verificado** | Media |
| **MET Norway** (ya en `apps/senda-live/.../metno-weather-grid.mjs`) | https://api.met.no/weatherapi/locationforecast/2.0/ · términos: https://api.met.no/doc/TermsOfService · FAQ: https://docs.api.met.no/doc/FAQ | Previsión de viento y tiempo por punto (cobertura global; mejor en Escandinavia) | Horaria | JSON | **User-Agent identificativo obligatorio** (si falta o es genérico: bloqueo); respetar caché (`Expires`/`If-Modified-Since`); licencia y límite de tasa **no verificados** aquí (conocimiento previo: CC BY 4.0 / NLOD, ~20 req/s por aplicación) | no verificado | Media |

---

## 5. Avisos oficiales para contrastar

| Fuente | URL | Qué da | Legible por máquina | Licencia / notas | Confianza |
|---|---|---|---|---|---|
| **ES-Alert (Protección Civil)** | Información: https://www.interior.gob.es/opencms/es/detalle/articulo/Proteccion-Civil-ensaya-el-envio-de-alertas-a-moviles-ES-Alert-en-diversas-Comunidades-Autonomas/ | Alertas a móviles (cell broadcast), operativo en toda España desde 22-02-2023 | **No existe** (que se haya encontrado) un **histórico público** ni feed. Hay un portal interno de Protección Civil. Recuentos regionales en prensa (Cataluña: 57 en 2025) | Vía: solicitud de acceso a información pública a la DGPCE; o convenio | Media |
| **Meteoalarm** (ya en `feeds.mjs`: `meteoalarm-legacy-atom-spain`) | Legacy Atom: `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain` · `.../meteoalarm-legacy-atom-netherlands` (patrón, **no verificado**) · API nueva: `https://feeds.meteoalarm.org/api/v1/warnings/...` (vista en documentación de meteoblue) · redistribución: hub en meteoalarm.org | Avisos meteorológicos CAP de los servicios nacionales (AEMET, KNMI) | Atom + CAP; API v1 JSON | Hay informes de que los feeds legacy **no funcionan para muchos países**; condiciones de redistribución **no verificadas**. Para España es mejor el CAP de AEMET directo | Media |
| **AEMET avisos** | ver 3.2; RSS: https://www.aemet.es/es/rss_info/avisos/esp | Avisos FMA (Meteoalerta) | CAP 1.2 / RSS / Atom | Cita a AEMET | Alta |
| **112 Comunidad de Madrid (ASEM 112)** | https://www.comunidad.madrid/seguridad-emergencias-asem-112 · ejemplo de página de incidente: https://www.comunidad.madrid/seguridad-emergencias-asem-112/incendio-forestal-almorox-ifalmorox-villa-prado-julio-2026 · X: `@112cmadrid` (**no verificado** en esta sesión) | Estado oficial de incendios, cortes, confinamientos | **No se encontró RSS**. X requiere API de pago; no hacer scraping | Información pública oficial | Media |
| **Protección Civil (DGPCE)** | https://www.proteccioncivil.es/ (no verificado en esta sesión) | Notas y avisos; Sistema de Avisos a la Población gestionado por el CENEM | No se encontró RSS nacional | — | Baja |
| **NL-Alert** | https://www.nl-alert.nl/english · archivo de mensajes en **Crisis.nl** (372 NL-Alerts leíbles según Binnenlands Bestuur: https://www.binnenlandsbestuur.nl/digitaal/ambtelijke-samenwerking/grote-regionale-verschillen-bij-inzet-en-inhoud-nl-alerts) | Mensajes enviados | Web (Crisis.nl); **API/feed no verificado** | — | Media |
| **GDACS** (ya referenciado en `source-evidence.mjs` y `apps/senda-live`) | RSS: https://www.gdacs.org/xml/rss.xml · 7 días: https://gdacs.org/xml/rss_7d.xml · API: `geteventlist/SEARCH` (GeoJSON), `geteventdata` — guía: https://data.gdacs.org/Documents/2025/GDACS_API_quickstart_v1.pdf | Terremotos, ciclones, inundaciones, volcanes, incendios forestales grandes, sequía (escala global) | RSS/GeoRSS, CAP, GeoJSON | Términos de uso **no verificados** (UE/ONU, uso libre con cita según conocimiento previo) | Media |
| **Copernicus EMS Rapid Mapping** (ya en `copernicus-ems.mjs`) | https://emergency.copernicus.eu/mapping/list-of-activations-rapid | Activaciones y perímetros | Feeds y ficheros | Copernicus | Alta |

---

## 6. Qué falta en los conectores del repositorio

1. **Cámaras de Madrid mal clasificadas.** `cameras.mjs` tiene `madrid` como `CONVENIO` con la URL de una nota de prensa. Existen **dos conjuntos abiertos** del Ayuntamiento en el NAP de la DGT: `202088-0-trafico-camaras.kml` (≈ 10 min, CC BY 4.0 a confirmar) y `212166-7899870-trafico-calle30-camaras.xml` (M-30, 5 min, CC BY). Pueden pasar a `PASIVO` tras confirmar la licencia en la ficha.
2. **DGT v3.7.** El repo apunta a v3.6; el NAP ya tiene **v3.7** (`camaras_datex2_v37.xml`). Falta comprobar si incluye URL de imagen.
3. **Comunidad de Madrid.** No hay fuente para las 31 cámaras de Vialidad Invernal en puertos (Sierra: incendio y nieve). Solo cabe un **convenio** con la Dirección General de Carreteras o ASEM 112.
4. **SAIH.** Solo hay una entrada `CATALOG_ONLY` del Júcar. Falta el **Tajo** (Madrid), además de Ebro, Segura y Guadalquivir. No hay API abierta: hay que pedir convenio (la CHJ ya tiene API privada con lista blanca).
5. **AEMET.** El CAP de avisos ya existe en `apps/senda-live`, pero no en `packages/senda`. Faltan **radar** y **estaciones** para `flood-watch.mjs` (lluvia observada aguas arriba).
6. **Waterinfo (NL).** No hay conector (`waterwebservices` no aparece en el código). Es abierto, en dominio público y sin clave: es el candidato más fácil para niveles de río en NL.
7. **EFAS/GloFAS.** No hay conector. En vivo está restringido; sirve para calibrar con histórico (> 30 días).
8. **Combustibles.** `wildfire.mjs` usa 5 clases ilustrativas. Falta cargar **MFE25** (WMS/SHP), el **mapa de combustibles EFFIS** o la capa Rothermel regional (Baleares) y mapear sus clases a `FUELS`.
9. **Sentinel-3 FRP.** No hay conector. Complementaría a FIRMS con potencia radiativa nocturna.
10. **Avisos.** Meteoalarm usa el feed *legacy* (posiblemente roto en varios países): migrar a la API v1 o al CAP de AEMET/KNMI. **ES-Alert** no tiene histórico público: el contraste debe hacerse con la página oficial del 112 autonómico. Falta el archivo de **NL-Alert** (Crisis.nl).
11. **Verificación pendiente.** Licencias de EFFIS, DGT NAP, datos.madrid.es 202088, MET Norway y GDACS, y las cabeceras CORS de todas las fuentes, cuando la red del entorno permita estos dominios.

## 7. Fuentes consultadas (vía buscador)

- NAP DGT: https://nap.dgt.es/en/dataset/trafico-camaras · https://nap.dgt.es/en/dataset/trafico-calle-30-camaras · https://nap.dgt.es/en/dataset/camaras-dgt · https://nap.dgt.es/en/dataset/camaras-dgt-datex2-v3-7/resource/31f5727a-bbfe-4aa8-b1dc-d2fce1302e69
- datos.madrid.es / datos.gob.es: https://datos.gob.es/en/catalogo/l01280796-trafico-camaras1 · https://datos.madrid.es/FWProjects/egob/Catalogo/Transporte/Ficheros/Estructura%20de%20datos.%20Ubicaci%C3%B3n%20de%20c%C3%A1maras%20ZBEDEP%20Distrito%20Centro.pdf
- Comunidad de Madrid: https://www.comunidad.madrid/node/76584 · https://www.comunidad.madrid/node/60074 · https://vivirediciones.es/?p=1138798
- Rijkswaterstaat/NDW: enlaces de la sección 2 y 3.3
- SAIH: enlaces de la sección 3.1 · https://www.iagua.es/blogs/ignasi-servia/donde-consultar-niveles-reservas-agua · https://www.eldebate.com/espana/madrid/20260209/aviso-rojo-madrid-riesgo-desbordamiento-varios-tramos-rios-jarama-henares-alberche_383272_amp.html
- AEMET: https://jentic.com/apis/aemet.es/aemet (tercero) · https://dieghernan.r-universe.dev/climaemet/NEWS (tercero)
- EFAS: https://european-flood.emergency.copernicus.eu/sites/default/files/documents/EFAS_Condition_of_Access_new_final.pdf
- FIRMS: https://appliedsciences.nasa.gov/sites/default/files/2025-05/Part%203%20FIRMS%202025%20Q&A%20Session.docx.pdf
- CDSE: https://dataspace.copernicus.eu/node/1031 · https://documentation.dataspace.copernicus.eu/FAQ.html
- MET Norway: https://docs.api.met.no/doc/FAQ · Open-Meteo: https://open-meteo.com/en/terms
- GDACS: https://github.com/exxamalte/python-aio-georss-gdacs · Meteoalarm: https://community.home-assistant.io/t/a-new-take-on-meteoalarm-custom-component/291962
