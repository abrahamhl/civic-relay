# SENDA Drive · F1: arranque automático al coger el coche (2026-11-18)

**Objetivo (fundador):** como en Waze, abrir SENDA debe ser automático al conducir, para acompañar el trayecto y alimentar los avisos del camino. **Condición:** solo con consentimiento expreso y revocable, y sin inventar eficacia.

## Una máquina, tres plataformas

| Pieza | Fichero | Prueba |
|---|---|---|
| Referencia | `packages/senda/src/drive-autostart.mjs` | `packages/senda/tests/drive-autostart.test.mjs` |
| Vectores de conformidad (generados) | `packages/senda/conformance/drive-autostart.vectors.txt` | La prueba JS falla si están desfasados |
| Android (Java) | `apps/senda-android/.../DriveAutostart.java` | `DriveAutostartTest` en la JVM (CI y local: 57 comprobaciones en 10 escenarios) |
| iOS (Swift) | `apps/senda-ios/Sources/DriveAutostart.swift` | `DriveAutostartTests` en el simulador (CI de macOS) |

Estados: `OFF` (sin consentimiento) → `IDLE` → `CANDIDATE` (pista débil) → `DRIVING` → `ENDING` → `IDLE`.

Reglas:
- **Sin consentimiento, nada automático.** Retirarlo cierra la sesión.
- **El coche vinculado es una señal fuerte:** arranca al momento. Mientras siga presente no se cierra por inactividad (atascos largos, GNSS sin velocidad); se cierra cuando el coche se va.
- **«En vehículo» es una pista débil** (puede ser un autobús o ir de pasajero). Solo arranca si la velocidad lo confirma dentro de una ventana.
- **El conductor manda.** Tras «Parar» no se rearranca solo hasta que el coche desaparezca. «Empezar» funciona siempre, incluso sin consentimiento automático.
- **Umbrales DECLARADOS:** `EXAMPLE_AUTOSTART` (5 m/s, 120 s, 1,5 m/s, 300 s, 60 s) es un **ejemplo sin fuente verificada**, pendiente de calibrar con trayectos reales. Las pantallas lo dicen.

## Señales por plataforma

| Plataforma | Señal | Tipo | Dependencias |
|---|---|---|---|
| Android **base** | Coche vinculado por `CompanionDeviceManager` (Bluetooth del coche). Android 12+: `CompanionDeviceService`; Android 8–11: conexión Bluetooth | Fuerte | Ninguna (solo SDK de Android) |
| Android **play** | Lo anterior + «en vehículo» (Activity Recognition de Google Play Services) | Débil | `play-services-location` |
| iOS | Cambio significativo de ubicación (despierta la app) + CoreMotion «automotive» | Débil | Ninguna (frameworks de Apple) |
| iOS | Audio del coche (`AVAudioSession`, puerto `carAudio`) mientras la app está activa | Fuerte | Ninguna |

La CI comprueba que la versión base de Android **no** contiene clases de Google Play Services ni pide permiso de Internet.

## Lo que está verificado y lo que no

| Afirmación | Estado |
|---|---|
| Las tres implementaciones siguen la misma lógica | **Verificado** con vectores: Java en local y en la CI; Swift solo en la CI de macOS |
| Android 12+ limita arrancar servicios en primer plano desde segundo plano, con excepciones | Verificado en la documentación de Android ([cambios en FGS](https://developer.android.com/develop/background-work/services/fgs/changes), [Android 12](https://developer.android.com/about/versions/12/foreground-services)) |
| Las apps acompañantes pueden arrancar el servicio desde segundo plano con `REQUEST_COMPANION_START_FOREGROUND_SERVICES_FROM_BACKGROUND` | Visto solo en un fragmento de la [documentación de emparejamiento](https://developer.android.com/preview/features/companion-device-pairing.html). **Por verificar en dispositivo** |
| La detección «en vehículo» de Google es una excepción para arrancar el servicio | **No verificado.** Si Android lo niega, la app registra el error y no fuerza nada |
| La presencia de coches con Bluetooth clásico (no BLE) llega por `CompanionDeviceService` | **No verificado**: la documentación habla de BLE. Por probar con coches reales |
| iOS relanza la app con el cambio significativo de ubicación | Solo fuentes de foro ([Apple Developer Forums](https://developer.apple.com/forums/thread/771587)), no documentación oficial. La ventana de ejecución tras el relanzamiento es corta y los foros informan de cortes. **Por verificar en iPhone** |
| Arranque real al subir al coche | **No probado.** Requiere móviles y coches reales |

## Privacidad

- Se guarda **solo en el móvil**: el consentimiento y, en Android, la dirección Bluetooth del coche.
- No se registra ni se envía el recorrido.
- La notificación de Android (botón «Parar») y el indicador de ubicación de iOS están siempre visibles mientras SENDA vigila.
- Para Google Play: `ACCESS_BACKGROUND_LOCATION` exige declarar el uso en la ficha de la tienda (pendiente).

## Siguiente (F2 y F3)

- Hoy la sesión arranca y se cierra sola, pero los avisos por voz siguen en la app web, que solo corre en primer plano. Falta llevar el bus de avisos al servicio nativo (F2).
- Registro de consentimientos granular para el papel de gateway (llevar SOS, compartir velocidades anónimas, cámara) (F3).
