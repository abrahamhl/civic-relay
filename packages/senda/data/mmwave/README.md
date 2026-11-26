# SENDA · Grabaciones y regresión del radar mmWave 24 GHz (RD-03D / LD2450)

> **AVISO EPISTÉMICO (`CLAUDE.md` §1):**
> **No existe todavía ninguna grabación de hardware real RD-03D / LD2450 en este repositorio.**
> Por tanto, **SENDA NO publica ninguna cifra de precisión de distancia, ángulo ni penetración con hardware real** hasta que se añadan grabaciones de campo realizadas siguiendo [`PROTOCOLO_MEDIDA.md`](PROTOCOLO_MEDIDA.md), con su huella SHA-256 verificable y verificación ciega.

## Manifiesto de grabaciones

| Archivo | Tipo (`basis`) | Tramas | Huella SHA-256 | Estado |
|---|---|---:|---|---|
| `synthetic-crossing-2p.jsonl` | **`SIMULATION`** (sintético determinista) | 51 (10 Hz, 5,0 s) | `8a1da7a1765b02cdb9cfa8a70cee8d45a5bb6d4a2662caf11bf630c3dd82a8a3` | Regresión del parser, limpieza y tracker en `packages/senda/tests/mmwave-regression.test.mjs` |
| Grabaciones reales con RD-03D / LD2450 | `MEASURED` | — | *pendiente de hardware físico* | **Bloqueado: sin sensor físico RD-03D/LD2450 en el entorno de desarrollo** |

## Puente USB-OTG en Android (F5)

- Código propio Java 17 (cero dependencias externas, cero conflictos de licencia, compatible con la versión `base` del APK sin permiso `INTERNET` ni Google Play Services):
  - `apps/senda-android/app/src/main/java/eu/senda/field/UsbSerialCodec.java` (probado en JVM: `UsbSerialCodecTest`, 18/18 OK)
  - `apps/senda-android/app/src/main/java/eu/senda/field/UsbSerialBridge.java` (CH340, CP210x, FTDI, CDC-ACM a 256000 8N1 → `window.sendaUsbSerial(b64)` → `createFrameParser`)
  - Conectado en `investor-next/public/senda/personas.mjs` junto a Web Serial de escritorio.
