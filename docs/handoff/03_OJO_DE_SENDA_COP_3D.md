# Ojo de SENDA · Imagen operativa común en 3D (especificación)

> Objetivo del fundador: «ver como el ojo de Dios, pero mejorado», en una sola vista:
> - todos los dispositivos de una zona, cámaras, sensores, incendio y columna de humo, aviones y drones;
> - capas topográficas, urbanas y de construcción;
> - la red de comunicación, con capacidad de activar funciones;
> - todo con **autorización y solo bajo una alerta confirmada y validada**.
>
> Esta especificación separa lo que **se puede hacer ya**, lo que **necesita convenio o permiso**
> y lo que **la física o la ley no permiten**.

## 1. Vista y gestos

- **Motor:** CesiumJS (Apache-2.0), vendorizado con versión fijada.
- **Gestos:**
  - Pellizco y dos dedos inclinan de vista cenital a horizontal.
  - Doble toque para centrar.
  - Línea de tiempo para reproducir lo ocurrido (cada capa guarda su histórico).
- **Sin red:** teselas de terreno, ortofoto y edificios precargadas por zona (paquete «zona» descargable antes de entrar); la app sigue con lo último conocido y lo marca con su edad.
- **Selector de capas** por familias: Terreno · Urbano · Construcción · Red · Incendio · Aire · Aeronaves · Efectivos · Cámaras.

## 2. Capas y fuentes

| Capa | Fuente | Licencia / acceso | Estado en SENDA |
|---|---|---|---|
| Terreno (MDT) y ortofoto | IGN / CNIG (MDT, PNOA) | Datos abiertos del IGN (verificar condiciones de atribución) | Por hacer |
| Edificios 3D | OpenStreetMap (`building:levels`) · Catastro INSPIRE | ODbL · INSPIRE (verificar) | OSM ya se lee (`building-twin.mjs`) |
| Daños por edificio | Evaluación EMS-98 de campo y foto | Propio | **Hecho** |
| Routers y teléfonos por planta | Barridos SENDA (Android, ESP32, dron) | Propio | **Hecho** (trilateración) |
| Cobertura móvil prevista tras el corte | `blackout.mjs` + OpenCelliD | OpenCelliD CC BY-SA (verificar uso comercial) | **Hecho** (modelo) |
| Focos de incendio | NASA FIRMS (VIIRS/MODIS), EFFIS (Copernicus) | Abiertos con atribución (verificar) | Por hacer |
| Perímetro del incendio | Copernicus EMS (mapas rápidos), dron propio | Copernicus abierto; propio | Por hacer |
| Columna, temperatura, viento | AEMET OpenData (clave de API), sensores propios | AEMET con atribución | Por hacer |
| Calidad del aire (volúmenes 3D) | Sensor.Community, EEA, redes autonómicas | Abiertos (verificar cada red) | Por hacer |
| Aeronaves de extinción | **Receptor ADS-B propio** (RTL-SDR + dump1090) | Datos propios | Por hacer. OpenSky solo para pruebas: sus condiciones restringen el uso comercial |
| Drones | Open Drone ID (Bluetooth/Wi-Fi) + telemetría MAVLink | Propio | Decodificador **hecho** (`drone.mjs`) |
| Cámaras de tráfico | DGT (catálogo público) | Datos públicos con atribución | **Hecho** en `sector-camera-engine.mjs` (con bloqueo de cámaras municipales restringidas) |
| Cámaras de vigilancia forestal | Torres de las comunidades autónomas | **Solo con convenio** | Por hacer |
| Cámaras de efectivos y drones | Retransmisión desde la app (WebRTC local) | Propio, con consentimiento | Por hacer |
| Mapa de calor de señales en cámara | `rubble.projectToCamera` + `signalColor` | Propio | **Hecho** (`/senda/edificios`) |
| Efectivos y coordinadores | Posición compartida por la app (consentida) | Propio | Parcial (respuestas de residentes) |

## 3. «Ver a través de las paredes» (verdad técnica)

- **Lo que sí se hace:** proyectar sobre la imagen de la cámara las **señales de radio localizadas** detrás de una pared (balizas BLE de personas atrapadas, routers, teléfonos) con un color según la intensidad. Ya está en `/senda/edificios`. A eso se suma la detección de respiración por Wi-Fi CSI (`through-wall.mjs`) con hardware compatible.
- **Lo que no existe:** una cámara de móvil que vea a través de una pared.
- **Lo que se ha construido (v0.7):** un **motor determinista de fusión de evidencias**
  (`occupancy.mjs`) que combina respuestas, la señal del teléfono, respiración por CSI, golpes,
  térmica real y búsquedas negativas en una probabilidad **calibrada** por vivienda, con intervalo,
  traza en decibanes y la insignia «≥98 %» solo con dos familias independientes. Se pinta sobre la
  cámara por capas (`vision-layers.mjs`: probabilidad, espectro, estructura, topografía, térmica
  real). Validación en simulación y límites: [`docs/architecture/MOTOR_FUSION_EVIDENCIAS.md`](../architecture/MOTOR_FUSION_EVIDENCIAS.md).
- **Escaneo 3D de una habitación:**
  - En iOS con LiDAR, RoomPlan (app nativa).
  - En Android, ARCore Depth.
  - El modelo resultante se sube a la capa «Construcción» del edificio.

## 4. Acciones desde el Ojo (solo con alerta confirmada)

| Acción | Cómo | Salvaguarda |
|---|---|---|
| Alerta sonora por zona o planta («como el 112») | Alerta firmada → teléfonos SENDA con sirena (`remote-command.mjs`) | Credencial de organismo + consentimiento del dueño + zona declarada (**hecho**) |
| Recuento de efectivos y residentes | Respuestas cifradas → cuadro por planta (**hecho**) | Nadie es «víctima» sin confirmación |
| Ajustar el enrutamiento | Activar o desactivar portadores y cambiar el objetivo de entrega (`planMultiBearer`) | Registro de auditoría encadenado (**hecho**) |
| Control de batería | Plan de bajo consumo por batería (**hecho**) | El SO exige el toque del usuario para las radios |
| Desplegar pasarela o dron | Misión de dron y colocación óptima de pasarelas (`placeGateways`) | Autorización del director de extinción / AESA |
| Pasar de radar a «UAV» | Barrido de balizas y routers desde dron o mástil (ESP32) | Solo señales SENDA y routers; nunca contenido ajeno |

## 5. Comunicación bidireccional para bomberos sin Internet («SITRE»)

- **Problema citado por el fundador:** un bombero de la Comunidad de Madrid dijo que usan una aplicación llamada «SITRE» y que falla sin Internet (`docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md`, T17).
- **Pendiente de verificar:** qué es SITRE, quién lo opera y cómo depende de la red.
- **Lo que aporta SENDA mientras no llega Starlink o la red de emergencias:**
  - Mensajería y estado entre efectivos por Bluetooth, sonido, LoRa y mulas.
  - Fragmentos k-de-n por cualquier portador.
  - Imagen operativa precargada sin red.
  - Pasarela en dron o vehículo que lleva el tráfico a la sala en cuanto hay un enlace.
- **No sustituye** a la radio TETRA ni a la red de emergencias: es su complemento de datos.

## 6. WhatsApp y «modo VPN» (verdad técnica)

- **SENDA no es una VPN:**
  - Sin enlace IP no hay llamadas ni WhatsApp en tiempo real.
  - Lo que sí viaja sin IP son **mensajes**, por DTN y fragmentos.
- **Con cualquier enlace** (satélite de banda ancha de un vecino o un dron con Starlink Mini), la pasarela SENDA puede servir Wi-Fi local. Según la documentación de WhatsApp (pendiente de verificar), también podría hacer de **proxy oficial de WhatsApp**: así los teléfonos de la zona usarían WhatsApp sin cobertura móvil, como las llamadas por Wi-Fi.
- **Propuesta a Meta** (agente A12): SENDA como transporte de último recurso para texto cifrado de WhatsApp cuando no hay IP. Requiere su cooperación y respetar su cifrado.
- **«Desde cualquier parte del mundo»:**
  - Iridium SBD tiene cobertura global (340 B por mensaje).
  - El relé SENDA recibe por Internet y lo pasa a la zona por la primera ruta disponible.

## 7. La web de cámaras y comunicaciones (El Tiemblo / San Martín de Valdeiglesias)

- **El recuerdo del fundador** (`VOICE_VISION_REQUIREMENTS_2026-10-22.md`, T04): una web, posiblemente de la Comunidad de Madrid, donde «podías ver las comunicaciones de la policía con Protección Civil y las cámaras alrededor de El Tiemblo», con fuegos, satélites y sectores.
- **No se pudo localizar en esta sesión:** la búsqueda web se agotó.
- **Instrucciones para el agente A8/A10:**
  1. Buscar «visor incendios forestales Comunidad de Madrid cámaras», «cámaras vigilancia incendios Ávila Junta de Castilla y León», «mapa incendio El Tiemblo en directo» y «escáner radio emergencias Madrid en directo».
  2. Mirar también agregadores no oficiales: mapas de incendios en tiempo real, escáneres de radio y comunidades de seguimiento de emergencias.
  3. Comprobar el titular, la licencia de cada capa y si las «comunicaciones» son cuentas públicas oficiales (112, Protección Civil, ayuntamientos) o **audio de radio**.
- **Límite legal** (verificar con A4): en España las comunicaciones de emergencia en TETRA van cifradas. Interceptar o difundir comunicaciones que no sean públicas vulnera el secreto de las comunicaciones (Ley General de Telecomunicaciones y Código Penal).
- **SENDA solo integra:**
  - Avisos públicos oficiales (CAP, cuentas oficiales).
  - Cámaras con licencia o convenio.
  - Nunca escucha de radio de terceros.

## 8. Criterios de aceptación de la primera versión (A8)

1. `/senda/ojo` abre sin red con una zona precargada (≤ 50 MB para 10 km²).
2. Capas: terreno, edificios OSM, focos FIRMS (cacheados), cámaras DGT, teléfonos y pasarelas SENDA, y cobertura prevista.
3. Pellizco para inclinar, selector de capas, línea de tiempo y 60 fps en un portátil medio.
4. Tabla de licencias por capa, con «solo demostración» donde no permitan uso comercial.
5. Acciones (alerta, recuento, enrutamiento) solo disponibles con credencial y alerta confirmada; todo queda en la auditoría.
6. Prueba E2E sin red y auditoría de accesibilidad automática en verde.
