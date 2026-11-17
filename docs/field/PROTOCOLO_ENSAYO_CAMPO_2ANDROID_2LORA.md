# Protocolo de Ensayo de Campo: 2 Terminales Android + 2 Dispositivos LoRa EU868 Autorizados

- **Fecha:** 2026-11-17
- **Estado:** **PENDIENTE DE EJECUCIÓN (0 ensayos físicos realizados hasta la fecha)**
- **Advertencia obligatoria:** Compilar un APK, pasar pruebas en emulador o ejecutar pruebas de IPC entre dos procesos en Node.js **NO** constituye validación física ni de radiofrecuencia.

---

## 1. Objetivo y Alcance

Sustituir las probabilidades hipotéticas por contacto (`BEARER_PROFILES`, `RADIO_PROFILES`) y los perfiles de consumo/latencia por mediciones reales en condiciones controladas con hardware propio y frecuencias libres autorizadas (EU868 SRD), sin emitir señales de emergencia ni interferir con canales del 112.

## 2. Equipamiento Mínimo Autorizado

| Elemento | Cantidad | Requisitos |
|---|---|---|
| Teléfonos Android físicos | 2 | Android 11+ (≥ 3–4 GB RAM), APK `apps/senda-android` y/o lab `experimental/android-nearby`, modo avión + Bluetooth/Wi-Fi activados solo por toque del usuario |
| Nodos LoRa EU868 homologados | 2 | Conformes con CE/RED y ciclo de trabajo ETSI EN 300 220 (1 % / 0,1 % / 10 % según subbanda); p. ej. placas basadas en SX1262 con firmware trazable |
| Reloj de referencia / GNSS | 2 | Sincronización UTC de inicio de prueba + registro local de deriva tras apagado |
| Entorno de prueba | 1 | Zona rural/periurbana con obstrucción vegetal/relieve medida, ≥ 300 m–2 km, sin uso de bandas licenciadas |

## 3. Casos de Prueba Prerregistrados (≥ 30 intentos fechados por escenario)

1. **Arranque offline y caché PWA / WebView (`apps/senda-android`):**
   - Instalar APK sin permiso de Internet (`android.permission.INTERNET` ausente).
   - Verificar carga de `/senda`, `/senda/centro`, `/senda/visor` y `/senda/atlas` con Wi-Fi/datos desactivados.
   - Registrar tiempo de arranque en frío y pico de memoria RAM del WebView.
2. **Persistencia, SIGKILL y revocación de consentimiento (`LabPersistentQueue` + `db.mjs`):**
   - Encolar 10 sobres de ejercicio (`SYNTHETIC_EXERCISE_ONLY`, TTL = 15 min).
   - Forzar cierre de proceso (`adb shell am force-stop` / matar app) y reabrir.
   - Revocar consentimiento de 3 mensajes: verificar borrado inmediato de carga útil y retención de tumba `REVOKED` tras nuevo reinicio.
   - Verificar descarte de duplicados y purga por caducidad TTL sin transmisión.
3. **Enlace BLE Nearby / Módem acústico MFSK-16 entre 2 Android:**
   - Medir tasa de entrega de tramas (PDR), tiempo de establecimiento, consumo de batería (%/h) y tasa de éxito del arranque acústico a 0,5 m, 2 m y 5 m con ruido ambiente medido (dBA).
   - Verificar que las órdenes firmadas por clave no anclada (`IMPOSTOR`) o rol no autorizado son rechazadas en el segundo terminal.
4. **Enlace LoRa EU868 entre 2 nodos autorizados:**
   - Ejecutar ≥ 30 envíos fechados por escenario (línea de vista, obstrucción arbórea, NLOS urbano/valle) respetando el gobernador de ciclo de trabajo ETSI EU868 (`governEtsiDutyCycle`).
   - Registrar para cada intento: `timestamp_utc`, `payload_bytes`, `rssi_dbm`, `snr_db`, `ack_received` (ECDSA P-256), `latency_ms`, `duty_cycle_used_pct` y consumo energético.
5. **Calibración honesta (H4 / H5):**
   - Contrastar la pérdida de trayecto medida frente a la predicción ITU-R P.526/P.1812 sobre DEM.
   - Registrar también resultados negativos o enlaces caídos sin filtrar datos adversos.

## 4. Criterios de Aceptación y Prohibiciones

- **Aceptación de prueba:** exportación íntegra de `field_trials.csv` + recibos firmados + registro de batería y caídas, anexado al repositorio con SHA-256 sin editar fallos.
- **Prohibido:** declarar cobertura garantizada, sustituir mediciones por simulaciones, activar radios en segundo plano sin toque explícito del usuario o enviar tramas `CAP Actual` a salas de emergencia reales.
