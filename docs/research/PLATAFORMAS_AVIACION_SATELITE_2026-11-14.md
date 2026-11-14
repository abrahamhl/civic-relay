# Plataformas de referencia (aviación, marítimo, satélite y emergencias): qué copiar para SENDA

Fecha: 14-11-2026. Autor: Claude Code. Regla de veracidad: `CLAUDE.md` §1. Lo no confirmado en la fuente oficial está marcado.

## 1. El patrón común: plataformas de datos alimentadas por su comunidad

| Plataforma | Modelo | Qué recibe quien aporta datos | Fuente |
|---|---|---|---|
| **Flightradar24** | Planes Free, Silver, Gold y Business. Las cifras de historial de cada plan **varían entre fuentes** | Plan **Contributor** gratis al activar su receptor; el plan **Business se mantiene mientras se comparten datos** (pasa a Gold 48 h después de dejar de aportar) | [FR24 premium](https://www.flightradar24.com/premium/), [blog FR24](https://www.flightradar24.com/blog/inside-flightradar24/important-information-about-the-new-flightradar24-for-existing-premium-subscribers/) |
| **FlightAware** | AeroAPI (pago por consulta) y Firehose (flujo con licencia) | **10 $/mes** de crédito en la API frente a 5 $ para el resto | [AeroAPI](https://flightaware.com/aeroapi), [datos comerciales](https://flightaware.com/commercial/data) |
| **MarineTraffic** | Planes web y API comercial aparte. Los precios **no coinciden** entre fuentes | Planes Professional y Professional Plus gratis para propietarios de estación AIS; Enterprise con más del 85 % de disponibilidad | [soporte de MarineTraffic](https://support.marinetraffic.com/en/articles/9553011-the-new-station-owners-free-subscription-plans-is-here) |
| **ADS-B Exchange** | Datos sin filtrar; uso comercial con licencia y precios no publicados | Comunidad de receptores; adquirida por JETNET | [uso comercial](https://adsbexchange.com/?p=19798), [Hackaday](https://hackaday.com/2023/01/26/ads-b-exchange-sells-up-contributors-unhappy) |
| **adsb.lol** | API abierta, datos **ODbL 1.0** | Clave de contribuidor: 7.200 consultas/día y acceso a la «re-api» en bruto | especificación OpenAPI en api.adsb.lol (leída el 14-11) |
| **OpenSky Network** | Gratis para investigación académica y gubernamental; licencias comerciales | Más cuota para quien aporta datos (según terceros, **no verificado**) | [Wikipedia](https://en.wikipedia.org/wiki/OpenSky_Network) |

**Conclusión para SENDA:** la plataforma crece si **cada pasarela, nodo Vigía o receptor que pone un municipio, un radioaficionado o un vecino** recibe acceso ampliado mientras aporta datos. Es un efecto red con coste de infraestructura casi nulo para SENDA.

## 2. Comunicación por satélite (mensajería de emergencia)

- **Garmin inReach** (red Iridium): planes mensuales sin permanencia y SOS activo incluso con el plan suspendido en dispositivos compatibles. **Precios no verificados.**
- **ZOLEO**: desde 2026, planes Prepare (17,99 £/mes, 50 mensajes) y Protect (29,99 £/mes, ilimitados). Precios del Reino Unido según una tienda ([GPS Training](https://gpstraining.co.uk/blogs/news/zoleo-plan-changes-2026)).
- **Satélite directo al móvil en Europa**:
  - Orange Francia lo ofrece comercialmente con Skylo.
  - MasOrange probaba Starlink en febrero de 2026 ([CCS Insight](https://www.ccsinsight.com/blog/europes-satellite-direct-to-device-market-takes-shape-starting-with-orange/)).
  - Skylo ofrece SOS y texto en móviles compatibles en buena parte de Europa ([Skipcall](https://skipcall.io/en/blog/satellite-texting-phones)).
  - Para España **no consta lanzamiento comercial de Starlink directo al móvil**.
- **Encaje con SENDA:** cada línea cifrada de 160 caracteres cabe en un SMS por satélite (Skylo) o en un mensaje de inReach o ZOLEO. SENDA es la capa de **cifrado, firma y agregación** por encima de cualquiera de esas redes, sin depender de una sola.

## 3. Plataformas de emergencias (competencia y socios)

- **Everbridge + RapidSOS**: 911 Connect usa los datos de RapidSOS para mejorar la ubicación en las llamadas al 911 y permite avisos masivos a una zona. RapidSOS declara datos en más de 5.000 centros de emergencia (fuentes de 2021: [Business Wire](https://www.businesswire.com/news/home/20210726005191/en), [RapidSOS](https://rapidsos.com/blog/why-everbridge-became-rapidsos-ready/)).
- **Genasys**: suite con gestión de emergencias, evacuación (Zonehaven), notificación masiva y altavoces de largo alcance ([Genasys](https://eu.genasys.com/genasys-emergency-management)). La reducción del 90 % en tiempos de respuesta es una afirmación del propio fabricante, **no verificada**.
- **Hueco de SENDA:**
  - funciona **sin red**: no depende de la nube ni del operador;
  - lleva **firma criptográfica** de cada reporte;
  - publica **datos abiertos con fuente y licencia**;
  - usa **CAP 1.2**, que lo hace integrable con estas suites en vez de competir de frente.

## 4. Implementado hoy a partir de esto (14-11-2026)

1. **API de datos abiertos v1** (`/senda/api/v1`):
   - catálogo con fuente, licencia, hora y SHA-256;
   - GeoJSON por capa;
   - parte del día;
   - contrato OpenAPI 3.1.

   La genera `packages/senda/scripts/build-platform-api.mjs` y la comprueba `tests/platform-api.test.mjs`.
2. **Mapa embebible** (`/senda/atlas?embed=1`) para webs municipales, como los widgets de las plataformas de seguimiento.
3. **Zonas vigiladas con parte CAP 1.2** (`zoneDigestToCap`): restringido y de ejercicio, con área en círculo o polígono.
4. **Página `/senda/plataforma`**:
   - canales;
   - estado de cada fuente: antigüedad, licencia y huella;
   - ejemplo real de la API;
   - código para embeber;
   - **modelo de acceso propuesto sin precios**, con el nivel «Contribuidor» al estilo de Flightradar24 y MarineTraffic.
5. **Vídeo «SENDA, la plataforma»** (82 s, grabado de la app real, con rótulos de dato real o simulación).

## 5. Pendiente

- Validar con el fundador:
  - la filosofía de plataforma;
  - los niveles de acceso;
  - si el nivel Contribuidor se basa en la disponibilidad de la pasarela, como hace MarineTraffic con el umbral del 85 %.
- Comprobar en sus fuentes oficiales los precios de Garmin, MarineTraffic y ADS-B Exchange.
- Actualización automática de capas: pendiente de la decisión del fundador.
