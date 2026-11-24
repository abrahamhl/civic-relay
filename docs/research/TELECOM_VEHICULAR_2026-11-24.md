# SENDA Drive · comunicaciones para un móvil en un coche en marcha (2026-11-24)

Objetivo: qué canales existen hoy para que SENDA intercambie avisos y datos en carretera, cuáles puede usar
un móvil Android sin hardware extra, y qué hace falta para el resto. Regla CLAUDE.md: solo lo que tiene fuente;
alcances y velocidades **no verificados** salvo que se citen.

## 1. Canales y estado en SENDA

| Canal | ¿Lo puede usar un móvil? | Estado en SENDA | Lo que falta |
|---|---|---|---|
| **Bluetooth LE GATT (1M)** | Sí, todos | ✅ `BleMailbox` + `hazard-share` (avisos 0xA5) | Alcance POR MEDIR (prueba guiada BLE 1/5/10/20/40 m) |
| **Bluetooth LE Coded PHY (largo alcance)** | Depende del móvil: la API `isLeCodedPhySupported()` existe desde API 26, pero hay móviles que dicen «sí» y no conectan [1][2] | 🔧 La caja negra ya registra si tu móvil la declara (`radioCaps`) | Probar anuncio extendido Coded en dos móviles reales antes de usarlo |
| **Wi-Fi Aware (NAN)** | Android 8+ si el chip lo tiene; distancia con RTT (802.11mc) desde Android 9 [3] | 🔧 `radioCaps` registra si está | Prototipo de descubrimiento + datos; medir en marcha |
| **Nearby Connections (Google)** | Solo versión play (Play Services) | ⏳ Trabajo de Antigravity (firmado ECDSA) aún NO recibido | Que Antigravity lo entregue (rama o bundle) |
| **Datos móviles 4G/5G** | Sí | ✅ DGT DATEX II en vivo (play), mapa, rutas | Buzón de Internet: decisión del fundador (A/B/C) |
| **DGT 3.0 (vehículo conectado)** | No directamente: acceso para terceros por **solicitud a la DGT**; intercambio por API REST y colas MQTT [4]; la V-16 conectada ya envía ubicaciones a navegadores [5] | ⏳ Usamos el feed público DATEX II | Pedir acceso con el formulario «Forma parte de la DGT 3.0» [4] (sin coste conocido: **no verificado**) |
| **ETSI C-ITS (ITS-G5 / C-V2X PC5): CAM, DENM** | No: un móvil no tiene radio ITS-G5 ni PC5 | ⏳ | Hardware de coche o unidad de carretera. Pila abierta de referencia: Vanetza (LGPL-3.0) [6]; OpenC2X [7] |

## 2. Qué es lo más potente que podemos activar ya, sin gasto
1. **Medir antes de prometer**: la caja negra (`blackbox.mjs`) guarda posición, sensores, detector, alertas, red,
   batería, Bluetooth y las radios que declara el móvil. Con dos viajes reales sabremos el alcance BLE y
   la latencia real del detector en tu móvil.
2. **DENM como formato de intercambio**: los avisos SENDA ya tienen tipo/posición/tiempo; mapearlos a los campos
   de DENM (causa, posición, validez) nos dejaría hablar el idioma de la DGT 3.0 y de los coches C-ITS cuando
   haya acceso. Sin hardware nuevo. (Diseño pendiente; no hecho.)
3. **Solicitud a DGT 3.0**: es el único camino para recibir eventos V-16 y de vehículo conectado en tiempo real.
   Requiere que el fundador lo pida como empresa/proyecto.

## 3. Lo que NO se hace
- No se usan marcas ni iconos de terceros; no se promete comunicación coche a coche que un móvil no puede hacer.
- Ningún servicio de pago sin permiso escrito (Routes API, Gemini Live: pendientes de decisión).

## Fuentes
1. Android `BluetoothAdapter` API 26 (isLeCodedPhySupported): https://developer.android.com/sdk/api_diff/26/changes/android.bluetooth.BluetoothAdapter
2. Nordic DevZone, informes de móviles con Coded PHY declarado que no conecta: https://devzone.nordicsemi.com/f/nordic-q-a/70038/android-nrf-connect---proper-indication-of-coded-phy-support · Google Issue Tracker: https://issuetracker.google.com/issues/148487283
3. Android Wi-Fi Aware (AOSP): https://source.android.com/docs/core/connect/wifi-aware
4. DGT, «Forma parte de la DGT 3.0»: https://www.dgt.es/muevete-con-seguridad/tecnologia-e-innovacion-en-carretera/forma-parte-de-la-dgt-3.0/
5. Ministerio del Interior, V-16 conectada en navegadores: https://www.interior.gob.es/opencms/es/detalle/articulo/DGT-3.0-ya-envia-a-los-navegadores-la-ubicacion-de-los-vehiculos-averiados-en-carretera-que-utilizan-la-V-16-conectada/ · DGT, abril 2026: https://www.dgt.es/comunicacion/noticias/20260428-mas-conectados-mas-visibles
6. Vanetza: https://github.com/riebl/vanetza
7. OpenC2X (2016): https://www.ccs-labs.org/bib/laux2016openc2x/laux2016openc2x.pdf
