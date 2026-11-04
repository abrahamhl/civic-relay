# SENDA Android (`eu.senda.field`)

Compañero nativo de la app web **SENDA Campo**. Hace solo lo que un navegador no puede:

| Función | Para qué | Límite real del sistema operativo |
|---|---|---|
| **Baliza BLE** (`BleBeacon`) | La persona atrapada emite su estado, batería, planta y puerta; un rescatador o vecino la oye a decenas de metros. | Bluetooth debe estar encendido: Android exige el toque del usuario para encenderlo. Bajo consumo = ráfaga de 5 s cada 60 s. |
| **Escucha de balizas** | Cada baliza oída en un punto conocido se guarda como fila `ble:<id>` del barrido y la web la trilatera como un router. | Requiere permisos BLE (Android 12+) y ubicación precisa. |
| **Barrido Wi-Fi** (`WifiSurveyRecorder`) | Routers visibles por punto y planta → la web los sitúa en el gemelo 3D (planta, puerta, si son pasarela con Internet). | `getScanResults()` exige ubicación precisa; Android 9+ limita a 4 barridos / 2 min en primer plano (se avisa y se usan datos en caché). |

**Cómo llega una alerta aquí:** la web verifica la firma del coordinador (organismo → credencial →
clave → firma, consentimiento, zona y destino). Si el plan incluye acciones nativas, muestra
«📶 Activar baliza / barrido con SENDA Android», que abre `senda://accion?a=BLE_BEACON,…&id=…&f=3&u=B`.
La app solo acepta una **lista blanca** (`BLE_BEACON`, `LOW_POWER_BEACON`, `WIFI_SCAN`) y **no hace nada
hasta que el usuario pulsa**. No tiene permiso de Internet: el barrido se entrega a la web con «Compartir»
(y se copia al portapapeles).

## Formatos (idénticos en web, Android y ESP32)

- Trama de baliza de 18 bytes en *Manufacturer Specific Data* → `SendaFormats.encodeFrame/decodeFrame`
  (= `packages/senda/src/beacon.mjs`, = `hardware/esp32-survey/senda_frame.h`).
- Barrido JSONL `{x,y,z,bssid,ssid,rssi,t,connected?,internet?,source}` → `SendaFormats.surveyLine`
  (= `parseSurvey` en la web, que lo pasa a `building-twin.locateAccessPoints`).
- **Company ID 0xFFFF** es el identificador de *pruebas* del Bluetooth SIG. Un despliegue real debe
  solicitar su propio Company Identifier y cambiarlo en los tres sitios (los tests lo detectarán).

## Verificación

```bash
# JVM pura (sin Android): mismos vectores literales que la web y el ESP32
javac --release 17 -d /tmp/j app/src/main/java/eu/senda/field/{SendaFormats,NativeAction}.java app/src/test/java/eu/senda/field/SendaFormatsTest.java
java -cp /tmp/j eu.senda.field.SendaFormatsTest      # PASS: 14 invariantes
# APK (CI: .github/workflows/senda-android-ci.yml)
gradle :app:assembleDebug
```

La compilación del APK demuestra que el código es válido para Android 8–15; el alcance real de la
baliza y la precisión del barrido se miden en **pilotos de campo** (ver `docs/architecture/SENDA_ARCHITECTURE.md`).
