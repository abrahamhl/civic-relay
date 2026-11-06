# Huecos del 112, canales ciudadanos y sensores de oportunidad: cómo los une SENDA (05-11-2026)

> **Firma:** Asistente de Orquestación Senior (Claude), v0.19.
> **Estructura:** entrada → procesamiento → validación → salida.
> **Reglas:** cada dato lleva su fuente; lo no verificado va marcado **«pendiente de verificar»**; SENDA es siempre un **canal secundario**.

## 1. Lo que el 112 aún no cubre bien y qué aporta SENDA

| Hueco | Qué dice la norma o la práctica | Qué aporta SENDA (sin sustituir al 112) |
|---|---|---|
| **Accesibilidad** | La Ley Europea de Accesibilidad exige que el 112 sea accesible: voz, texto en tiempo real y conversación total. El servicio que recibe texto en tiempo real responde por el mismo medio. Los interfaces digitales siguen la EN 301 549 (WCAG 2.1 AA), y la Comisión desarrolla el art. 109(8) del Código Europeo de Comunicaciones Electrónicas ([accessible.org](https://accessible.org/eaa-emergency-communications/) · [EDF](https://www.edf-feph.org/eu-accessibility-act/)) | Modo fácil de un toque, mensajes de texto cifrados, módem acústico y triaje guiado. Accesibilidad probada en 26 pantallas (E2E) |
| **Saturación o caída de la red** | En grandes incendios caen antenas y se satura la voz | Malla de teléfonos, mulas, LoRa y satélite con reparto k-de-n (módulos ya existentes) |
| **Localización en altura e interiores** | La posición del móvil (AML) no da la planta; el estado de AML por comunidad autónoma está **pendiente de verificar** | Planta por barómetro diferencial (`sensor-fabric.mjs`) |
| **Conciencia situacional** | El 112 recibe llamadas, no un mapa vivo de lo que ven ciudadanos, cámaras y coches | Fusión de rumbos, perímetros y viento → avisos CAP con sus fuentes (`fire-watch`, `atmos3d`, `fire-field`) |
| **Seguimiento tras la alerta** | ES-Alert avisa en un sentido; no sabe quién está bien | «Estoy bien» o «estoy atrapado» de un toque, que viaja sin red |

## 2. Canales ciudadanos que SENDA enruta (sin atenderlos)

- **España:**
  - 112, emergencias;
  - **017**, línea de ciberseguridad de INCIBE, para estafas y suplantaciones de alertas durante una emergencia;
  - ES-Alert, solo recepción;
  - los derechos de información y el deber de colaboración de la Ley 17/2015 del Sistema Nacional de Protección Civil, con el voluntariado de protección civil como receptor natural de las tareas de SENDA.
- **Países Bajos:**
  - 112;
  - NL-Alert, solo recepción;
  - **Burgernet**: ciudadanos que ayudan a la policía en búsquedas locales, solo por convenio;
  - las fases de riesgo de incendio de **natuurbrandrisico.nl**, a las que las regiones de seguridad remiten a los vecinos ([documento municipal de Gemert-Bakel](https://gemertbakel.bestuurlijkeinformatie.nl/Document/View/ee102409-6f43-4301-b4e6-743fd9e754be)).

  El Gobierno neerlandés anunció en septiembre de 2026 medidas adicionales contra el riesgo de incendio forestal ([Rijksoverheid](https://www.rijksoverheid.nl/actueel/nieuws/2026/09/02/kabinet-komt-met-extra-stappen-om-natuurbrandrisico-te-verkleinen)).
- **Regla:** SENDA sugiere el canal correcto y adjunta el contexto que el usuario autorice; nunca se hace pasar por ese canal.

## 3. Sensores de oportunidad: cada coche, móvil y cámara como estación meteorológica

| Sensor | Qué mide | Base técnica | Modo |
|---|---|---|---|
| **Coche por OBD-II** | Presión barométrica absoluta (PID 0x33, kPa) y temperatura ambiente (PID 0x46, A − 40 °C) | SAE J1979 (`obdDecode`) | PASIVO, con el permiso del conductor |
| **Coche en rueda libre** | Viento a lo largo de la vía: m·a = −½ρ·CdA·(v − w)·\|v − w\| − m·g·(Crr·cosθ + senθ) | Física de la deceleración (`coastdownWind`); varios rumbos dan el vector (`fleetWind`) | PASIVO |
| **Barómetros de móviles** | Presión con ruido y sesgo por aparato | Mass y Madaus (2014) mostraron su potencial ([BAMS, DOI 10.1175/BAMS-D-13-00188.1](https://bibliotheque.meteo.fr/pub/DOC00028702-surface-pressure-observations-from-smartphones-pot.html)). Después se documentó ruido notable (Madaus y Mass, 2017) y la necesidad de corregir el sesgo y la elevación (McNicholas y Mass, 2018) ([NOAA](https://repository.library.noaa.gov/view/noaa/48416/noaa_48416_DS1.pdf)). SENDA lo hace con Kalman por aparato e interpolación óptima | PASIVO |
| **Dashcam propia** | Humo, visibilidad y llama, analizados en el teléfono | Koschmieder, parpadeo de la llama (`flickerSpectrum`) | PASIVO |
| **Cámaras de seguridad cedidas** | Rumbo a la columna y parpadeo; nunca la imagen | Alta voluntaria del titular | CONVENIO |
| **Torres y cámaras públicas** | Rumbos y altura de la columna | Triangulación 3D con oclusión del relieve | CONVENIO |
| **Estaciones oficiales** | Observación de referencia | KNMI: observaciones de 10 minutos con licencia CC BY 4.0 por la Data Platform, con clave gratuita ([KNMI](https://dataplatform.knmi.nl/dataset/10-minute-in-situ-meteorological-observations-1-0)). AEMET OpenData | PASIVO |
| **Modelos y satélites** | Perfiles verticales, terreno y cicatrices | NOAA GFS, Copernicus DEM y Sentinel-2 (descargados de verdad en v0.19) | PASIVO |

**Países Bajos encaja especialmente:**
- llano, con una flota muy densa y carreteras en todas las direcciones, lo ideal para la anemometría de flota;
- datos de KNMI abiertos;
- riesgo creciente de incendios forestales en el Veluwe y en los brezales.

## 4. Hacer convivir canales que no se diseñaron para hablarse

Todos los adaptadores producen un **evento canónico**: qué, dónde, cuándo, incertidumbre, fuente y modo de acceso. Ese evento se fusiona en el núcleo y sale en el formato de cada destino.

| Entra | Adaptador | Sale |
|---|---|---|
| CAP (OASIS), DATEX II (NAP), ES-Alert y NL-Alert recibidos | `feeds`, `datex2` | Avisos al ciudadano y al coche |
| C-ITS DENM y CAM (ETSI) | `c-its-denm` (CONVENIO: certificados CCMS) | Tramas HAZARD de 24 bytes |
| OBD-II, Ley de Datos, DFRS | `vehicle-link`, `atmos3d` | Presión, temperatura y viento de zona |
| BLE, Wi-Fi Aware, sonido, LoRa, satélite | `bearers`, `acoustic-modem`, `voice-mesh` | Mensajes sin red |
| GFS, Copernicus, KNMI, AEMET | `atmos3d`, `fire-field` | Viento 3D, probabilidad de llegada, CAP al 112 |
| ADS-B (solo recepción) | `adsb-recepcion` (marco legal **pendiente de verificar**) | Posición de medios aéreos para modelar estelas y descargas |

**Siempre NUNCA:**
- interceptar comunicaciones (TETRA);
- cámaras sin permiso;
- reconocimiento de caras o matrículas;
- detectar radares;
- volar drones sobre un incendio;
- emitir sin licencia.

**Confianza: 75 %.** Las normas de accesibilidad y los datos de KNMI tienen fuente. El estado de AML por comunidad y el marco legal de la recepción ADS-B están pendientes de verificar.
