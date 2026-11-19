# RoadSafe · SENDA como compañero de viaje: avisos a todos los conductores, Waze, sensores y física del impacto

## 1. ¿Cómo conseguir que «todos los conductores» se enteren? (la verdad técnica)

Ninguna app llega por sí sola a todos los conductores. El alcance casi universal solo existe a través de los canales que los conductores **ya** reciben. Escalera de alcance:

| # | Canal | Alcance | Qué necesita SENDA | Estado |
|---|---|---|---|---|
| 1 | **Paneles en la vía (PMV/DRIP, cruz roja)** vía centro de tráfico | Todos los que pasan | El plan de zona (`roadsafe-zone`) **propone** texto y ubicación; el centro aprueba | Contrato listo; requiere acuerdo |
| 2 | **DGT 3.0 → navegadores y servicios conectados** | Todos los usuarios de navegadores conectados a DGT 3.0 | Alta como actor DGT 3.0 (formulario, IP en lista blanca, X.509; REST/MQTT) | PARTNER_ACCESS_REQUIRED. Qué navegadores consumen DGT 3.0: **por verificar** |
| 3 | **Waze for Cities / feed CIFS** | Usuarios de Waze en la zona | Ser socio (Partner Hub), normalmente a través de una administración; `toCifsIncident` y `validateCifs` ya cumplen la especificación | PARTNER_ACCESS_REQUIRED |
| 4 | Radio de tráfico (RDS-TMC / DAB-TPEG) | Coches con receptor | A través del centro de tráfico | Fuera del alcance directo |
| 5 | C-ITS (DENM) | Coches equipados (minoría) | Estación homologada + PKI | PROTOTYPE_ONLY |
| 6 | **App SENDA**: megafonía por voz | Usuarios de SENDA | Ya implementado (`roadsafe-announcer`) | ✅ |
| 7 | BLE entre móviles y cápsulas firmadas | Usuarios de SENDA cerca | Ya implementado (`roadsafe-frame-trust`) | ✅ (alcance real por medir) |

**Conclusión:** la estrategia ganadora es **ser la mejor fuente verificada** (gemelo del incidente sin doble conteo, plan de zona, parada de servicio señalizada) y **entregarla a los canales 1–3**. La app es el canal de máxima calidad, pero no el de máximo alcance.

## 2. Waze: ¿plugin o motor propio?

| Pregunta | Respuesta verificada |
|---|---|
| ¿Se puede hacer un plugin dentro de Waze? | No hay una API pública de plugins de terceros dentro de la app. Lo documentado son los **deep links** (abrir navegación) y los **feeds de socios** (CIFS). |
| ¿SENDA puede leer los avisos de usuarios de Waze? | Solo en programas de socios; no hay API pública. Prohibido extraerlos por ingeniería inversa. |
| ¿SENDA puede publicar en Waze? | Sí, como socio: feed CIFS validado (`HAZARD_ON_SHOULDER_CAR_STOPPED`, `ACCIDENT_MINOR`…). |
| ¿Convivir con Waze abierto? | Sí. SENDA se ejecuta en segundo plano y emite **voz** (megafonía) sin tapar el mapa de Waze. Lleva un botón «abrir en Waze/Google» por deep link. |

**Arquitectura propuesta:** SENDA es el **motor de seguridad y emergencia**, que funciona sin red: gemelo del incidente, guía, ocupantes, ubicación rápida y rutas guardadas. El navegador lo elige el usuario. La integración con Waze es de entrada (deep links) y de salida (feed CIFS como socio).

## 3. Rutas guardadas y modo sin conexión (lo que pediste)

- **Rutas favoritas** (`createRouteStore`): guardar, marcar favoritas, exportar e importar.
- **Paquete de ruta sin conexión** (`offlineRoutePack`): solo la RUTA, no el mapa entero. Incluye:
  - geometría simplificada con Douglas–Peucker, hitos y PK;
  - peligros del corredor con la calzada separada;
  - talleres y servicios a menos de 3 km y el 112.

  Ocupa decenas de KB (en la prueba, <20 KB) y caduca a las 6 h.
- **Comparar rutas por riesgo** (`compareRoutesByRisk`): puntos negros reales del dataset, en riesgo por km. Elige el conductor.
- **Pendiente:** cálculo de rutas propio (OSRM con el OSM del corredor) para generar las alternativas sin depender de un servicio externo.

## 4. Sensores del móvil y del coche

| Fuente | Acceso legítimo | Qué se obtiene | Módulo |
|---|---|---|---|
| Acelerómetro y giroscopio del móvil | DeviceMotionEvent (web, con permiso en iOS) / SensorManager (Android nativo) | Aceleración en ejes del coche, guiñada, pulso de choque | `estimateMounting`, `toVehicleFrame`, `classifyImpulse`, `pulseDeltaV` |
| GNSS del móvil | Geolocation (velocidad Doppler, rumbo, precisión) | Velocidad fiable sin depender de cómo esté colocado el móvil | `detectHardBrake` (existente) |
| **Coche no inteligente: OBD-II** (ELM327) | Web Bluetooth (solo adaptadores BLE) o app nativa (Bluetooth clásico) | Velocidad (PID 0D), RPM (0C), acelerador (11)… El freno **no** es un PID estándar | `decodeObd`, `obdDecel` |
| Coche conectado (API del fabricante) | Contrato | Airbag, frenada, posición | CONTRACT_REQUIRED |
| eCall | Inaccesible para apps | — | NOT_SUPPORTED |

**Choque o caída del móvil:** se exige un pico alto, una duración de pulso compatible **y** una caída de velocidad del vehículo (GNSS u OBD). Un pico precedido de caída libre y sin cambio de velocidad es `PHONE_DROP`. Siempre se pide confirmación humana (cuenta atrás).

## 5. Física del impacto: momento lineal y angular

`roadsafe-crash-physics`:
- **Impacto plano de cuerpos rígidos** con restitución: impulso J, Δv de cada vehículo y Δω (guiñada) por el brazo del impulso. Conserva **exactamente** los momentos lineal y angular; está probado.
- **Golpe centrado:** no hay rotación. **Golpe descentrado:** el vehículo gira y puede invadir otros carriles.
- **Trayectoria posterior:** deslizamiento con μ·g y frenado de la guiñada hasta el reposo; el recorrido coincide con v²/(2·η·μ·g).
- **Envolvente de peligro (Monte Carlo):** mapa de celdas que pueden quedar barridas, probabilidad de invasión de cada carril y alcance p50/p95 aguas abajo. Con esto se avisa también a los carriles **contiguos**.
- **Gravedad por Δv:** bandas orientativas (umbrales hipotéticos, a calibrar con datos de registradores de eventos) → prioridad para el 112.

## 6. Taxi que recoge y parada señalizada

`roadsafe-service-stop`:
- Plan de aproximación: detenerse en el arcén **por delante** del averiado si hay espacio, deceleración progresiva y emisión desde ~45 s antes.
- Cápsula firmada con banderas `SERVICE_STOP | ASSISTANCE_TO_INCIDENT | PASSENGER_PICKUP`.
- Observación «asistencia llegando» en el gemelo del incidente, y la megafonía dice: «vehículo de servicio deteniéndose a 300 metros».

## 7. Emergencia: ubicación, ocupantes, quedarse o salir

- **Ubicación en segundos** (`roadsafe-location-share`): coordenadas con precisión, **Plus Code** (algoritmo abierto, verificado con el ejemplo canónico), carretera + PK + sentido, SMS de 160 caracteres GSM, enlace `geo:` y `tel:112`.
- **Ocupantes y móviles** (`roadsafe-occupants`): manifiesto voluntario con invitación HMAC y comprobación «¿estás bien?» tras el choque.
  - Persona y dispositivo se separan; los móviles quedan como POSSIBLY_LOST o POSSIBLY_SEPARATED.
  - Orden firmada para que el móvil perdido suene y emita una baliza BLE.
  - Al 112 solo se pasan **recuentos**: personas a bordo, necesitan ayuda, sin confirmar.
- **Guía** (`roadsafe-guidance`): 9 preguntas de un toque en 5 idiomas, y decisión EXIT_NOW_FIRE / EXIT_TO_REFUGE / STAY_BELTED / STAY_WITH_INJURED / CALL_112_AND_STAY_ALERT con pasos. **Pendiente de validación por la DGT y el 112.**
- **Servicios de emergencia en tiempo real** (`roadsafe-responders`): solo si el organismo comparte con credencial. Las posiciones caducan, la visibilidad depende del rol y la unidad cercana es una **propuesta**: SENDA no asigna recursos públicos.
