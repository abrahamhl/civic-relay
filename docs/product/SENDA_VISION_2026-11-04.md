# SENDA — Sistema de Enrutamiento de Emergencia por canales alternativos

**Identificador:** `SENDA-VM-2026-11-04` · **Sustituye el enfoque de** `CR-VM-2026-10-25` (Civic Relay / OEP) · **Promotor:** Abraham Haddioui
**Código:** [`packages/senda/`](../../packages/senda) · **Evidencia:** [`evidence/senda/scenarios.json`](../../evidence/senda/scenarios.json)

> *Si existe un camino hasta tu gente, SENDA lo encuentra.*

## 1. La idea del fundador (corrección del 04-11-2026)

1. **No es «otro WhatsApp con un gateway».** Si Abraham escribe desde Arnhem a su hermano en San Martín de Valdeiglesias y allí ha caído la antena, WhatsApp entregará cuando el teléfono del hermano recupere SU conexión. Un gateway que retiene el mensaje no aporta nada. SENDA debe **llegar antes que WhatsApp** usando **cualquier** camino real que exista en ese momento.
2. **Todos los canales a la vez:** teléfonos vecinos con la app (Bluetooth, Wi-Fi Direct/Aware), alguien con Internet por satélite o de otro operador, SMS que todavía entran, satélites directos al móvil cuando pasan sobre la zona, accesorios LoRa, gateways y estaciones terrestres.
3. **Zonas de emergencia:** cuando una autoridad emite una alerta (EU-Alert/ES-Alert/NL-Alert, CAP), o cuando sismógrafos públicos y los acelerómetros de los teléfonos detectan un evento, la zona se declara y los teléfonos con SENDA **pasan a modo relé automáticamente**, porque el usuario lo **preautorizó al instalar** y aceptar los términos.
4. **Alerta secundaria:** SENDA redistribuye y complementa el sistema de alertas europeo por la malla de teléfonos (sin suplantar al emisor oficial) y añade predicción propia por sensores.
5. **Enrutador que decide:** «¿hay Bluetooth? conecta y envía; ¿no? prueba otra cosa; ¿pasa un satélite que da más conectividad? úsalo».
6. **Escombros:** si alguien está atrapado sin cobertura y alguien encima sí tiene, el teléfono de arriba hace de **puente** (como un repetidor) por Bluetooth.
7. **Coordinación:** cualquiera puede ofrecerse como coordinador; familias registran a quién buscan; documentos por canal seguro; **canales internos** para policía, bomberos, protección civil y sanidad.
8. **Ver a través de muros para rescatar:** usar el teléfono (cámara incluida) y señales radio para localizar víctimas detrás de paredes o escombros.
9. **Aprovechar proyectos abiertos existentes** (satélites meteorológicos, seguimiento orbital, gateways, sismología) en vez de reinventarlos.

## 2. Cómo lo resuelve el código (implementado y probado)

| Idea | Módulo | Qué hace | Estado |
| --- | --- | --- | --- |
| Llegar antes que WhatsApp | `router.mjs` | **Contact Graph Routing** (técnica de redes tolerantes a retardos de NASA/CCSDS): calcula la llegada más temprana por cualquier cadena de contactos en el tiempo y lanza **varias rutas en paralelo** (carrera multicanal). Compara con la línea base WhatsApp. | Algoritmo implementado + tests |
| Todos los canales | `channels.mjs` | BLE, Wi-Fi Direct/Aware, hotspot, LoRa, datos, SMS, satélite directo al móvil, Internet satelital, troncal; con alcance, caudal, energía, tamaño máximo y si el SO exige un toque. | Implementado |
| Decidir qué probar | `ladder.mjs` | Escalera de intentos ordenada por llegada esperada: envía ya, escanea, espera ventana de satélite o pide un toque para encender una radio. Si falla, baja al siguiente escalón. | Implementado + tests |
| Zona y relé preautorizado | `zones.mjs` | Ingesta CAP con verificación de emisor, zonas por catálogo sísmico, perfil de consentimiento de instalación, activación OFF/STANDBY/RELAY_ACTIVE con límites de batería/datos. | Implementado + tests |
| Predicción sísmica | `seismic.mjs` | STA/LTA en cada teléfono, localización de epicentro por la red (≥4 teléfonos), segundos hasta la onda S en cada ciudad. Una sola fuente no oficial no activa: hace falta corroboración. | Implementado + tests (datos sintéticos) |
| Fuentes abiertas | `feeds.mjs` | USGS, EMSC, CAP/Meteoalarm, CelesTrak (TLE de satélites meteorológicos, Starlink, Iridium), SatNOGS (red abierta de estaciones terrestres). | Parsers + tests con formato real; conexión en vivo pendiente de despliegue |
| Satélites | `orbital.mjs` | Propagador Kepler + J2 sin dependencias, ventanas de paso, conversión a contactos del enrutador solo si el servicio es compatible. Enchufable a SGP4 (satellite.js). | Implementado + tests |
| Cifrado y relés ciegos | `envelope.mjs` | E2E con WebCrypto (ECDH P-256 + AES-GCM + firma ECDSA). Los relés solo ven la cabecera. Deduplicación en el receptor. | Implementado + tests |
| Coordinación e instituciones | `roles.mjs` | Credenciales firmadas por cada organismo (ancla de confianza), revocación, matriz de permisos, registro de familias con minimización, canales internos e interagencia. | Implementado + tests |
| Puente bajo escombros | `rubble.mjs` + `router.mjs` | Elige el mejor teléfono de superficie como puente y enruta el mensaje de la víctima. | Implementado + tests |
| «Ver» a la víctima | `rubble.mjs` | Trilateración BLE (RSSI) mientras el rescatador camina + **proyección en la cámara (realidad aumentada)** con su incertidumbre. | Implementado + tests (RSSI sintético) |
| A través de muros | `through-wall.mjs` | Análisis **Wi-Fi CSI**: movimiento y **respiración (rpm)** tras paredes con accesorio ESP32 (ESP32-CSI-Tool) o Nexmon CSI. | Implementado + tests (CSI sintético); requiere calibración de campo |

Resultado de los escenarios (`pnpm --filter @senda/core evidence`):
- **S01 Arnhem → San Martín** (antena caída 8 h, vecina con Internet satelital, vecino con Bluetooth): **SENDA ≈ 4 min**, satélite directo al móvil ≈ 91 min como ruta paralela, **WhatsApp 480 min**. Sin vecinos ni satélite compatible, SENDA no inventa: entrega a la vez que WhatsApp.
- **S04 sismo:** epicentro con error ≈ 0,5 km a partir de 14 teléfonos; el relé solo se activa al corroborarlo un catálogo público.
- **S05 escombros:** posición de la víctima con error horizontal < 1 m (RSSI sintético), puente elegido automáticamente, mensaje a la familia; CSI detecta 14 rpm con persona y nada en sala vacía.
- **S07 coordinación:** bombero verificado actualiza a «localizado a salvo»; la familia lo recibe; el voluntario no puede cambiar estados; canales internos aislados por organismo.

## 3. Lo que la física y los sistemas operativos permiten (y cómo lo resolvemos)

| Deseo | Realidad | Solución en SENDA |
| --- | --- | --- |
| Activar Bluetooth/Wi-Fi solo | Android 13+ e iOS exigen un toque del usuario para encender radios | Permisos concedidos en la instalación + **un toque** preautorizado cuando la radio está apagada (`PROMPT_USER_ENABLE`); si ya está encendida, actúa sin preguntar |
| Usar el satélite SOS del móvil (Apple/Pixel) | Cerrado a terceros | Satélite **directo al móvil de operador** (SMS por ventanas) y terminales de Internet satelital de vecinos/servicios |
| Ser la alerta oficial | Solo las autoridades emiten EU-Alert | **Canal secundario**: reenvía alertas verificadas por la malla y añade predicción etiquetada como tal; convenio para integración oficial |
| Red sísmica de Google | Privada | Red propia de acelerómetros (tipo MyShake) + EMSC/USGS/IGN |
| Ver a través de la pared con la cámara | La cámara capta luz, no radio | La cámara es la **pantalla de realidad aumentada**; la «visión» la aporta la señal BLE del teléfono de la víctima o un accesorio **Wi-Fi CSI** |
| Relés que leen mensajes ajenos | Riesgo de privacidad | Cifrado de extremo a extremo; el relé solo ve destino cifrado, prioridad y caducidad |

## 4. Proyectos abiertos que se integran

| Proyecto | Uso en SENDA | Licencia |
| --- | --- | --- |
| CelesTrak GP / TLE | Órbitas de satélites meteorológicos, de comunicaciones y D2D | Datos públicos |
| SatNOGS Network | Estaciones terrestres abiertas como gateways y fuente de pasos | AGPL / datos abiertos |
| satellite.js | SGP4 de producción (enchufable en `orbital.mjs`) | MIT |
| USGS / EMSC / IGN | Catálogos sísmicos en tiempo real | Datos públicos |
| Meteoalarm / CAP 1.2 | Alertas meteorológicas europeas | Datos públicos |
| ESP32-CSI-Tool, Nexmon CSI | Captura CSI para detección tras muros | MIT / GPL |
| Meshtastic | Malla LoRa (ya existe adaptador en `packages/transports`) | GPL-3.0 |
| Google Nearby Connections | Bluetooth/Wi-Fi entre Android (laboratorio en `experimental/android-nearby`) | SDK de Google |

**«El ojo de Dios»:** pendiente de que el promotor indique el repositorio exacto para integrarlo.

## 5. Próximos pasos (en orden de evidencia)

1. **Android:** conectar `ladder.mjs` a Nearby/BLE GATT/Wi-Fi Aware/SmsManager en `experimental/android-nearby` y medir con dos y tres teléfonos (incluido el puente bajo un forjado).
2. **Fuentes en vivo:** servicio que ejecute `pullAll()` cada minuto y publique zonas firmadas a los teléfonos.
3. **Accesorio CSI:** prototipo ESP32 + app; calibración en edificio real con equipos de rescate.
4. **Convenios:** protección civil / bomberos para anclas de confianza, y un operador con satélite directo al móvil.
5. **Rebranding completo** de web, vídeo y documentos de inversión a SENDA.

*Todo resultado de este documento procede de simulación con los algoritmos reales; ninguno sustituye a un ensayo físico. No usar en emergencias reales hasta superar la validación de campo.*
