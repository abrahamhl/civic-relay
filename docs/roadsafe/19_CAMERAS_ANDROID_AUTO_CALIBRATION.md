# SENDA · Cámaras de vehículos, cámaras públicas, Android Auto y calibración de golpes (2026-11-18)

**Petición del fundador:** afinar la detección de golpes con los sensores del móvil; integrar Android Auto; usar las cámaras de los coches (p. ej. Tesla) con detección en Python; interconectarlo con las cámaras públicas de la DGT y el resto de avisos.

## 1. Lo que es posible de verdad (investigado)

| Fuente | ¿Accesible para SENDA? | Estado en SENDA |
|---|---|---|
| **Lo que «reconoce» la visión de Tesla u otros fabricantes** | **No.** No se ha encontrado ningún acceso público a las detecciones de la visión artificial del coche | `NOT_AVAILABLE` |
| **Tesla Fleet API, permiso «Live Camera»** | El permiso existe entre los comandos del vehículo ([Tesla Developer](https://developer.tesla.com/docs/fleet-api)). **No verificado** qué entrega a terceros, ni sus condiciones o coste (la API es de pago por uso desde 2025) | `NOT_INTEGRATED` |
| **Vídeos de TeslaCam en la memoria USB del propio coche** | **Sí, para su dueño.** Tesla documenta las carpetas `TeslaCam/RecentClips`, `SavedClips` y `SentryClips`, con un vídeo por cámara y un `event.json` «con información del evento» ([manual del propietario](https://www.tesla.com/ownersmanual/modely/en_ie/GUID-F311BBCA-2532-4D04-B88C-DBA784ADEE21.html)). **No publica los campos** de `event.json`: se leen de forma defensiva | `OWNER_FILES` · `vehicle_camera_scan.py` |
| **Cualquier dashcam o la cámara del móvil** | Sí, procesando el vídeo del usuario (posición y hora declaradas) | `OWNER_FILES` |
| **Ley de Datos de la UE** (Reglamento 2023/2854) | Aplicable desde el 12-09-2025: el usuario puede pedir los datos de su vehículo y cederlos a un tercero ([Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/key-provisions-of-the-eu-data-act-take-effect), [Garrigues](https://www.garrigues.com/en_GB/garrigues-digital/new-guidance-vehicle-data-and-data-act-challenges-and-opportunities)). **Si cubre imágenes o detecciones: no verificado** | `NOT_INTEGRATED` (vía legal) |
| **Cámaras de la DGT** | Conjunto «Cameras DGT - Real Time» en el [Punto de Acceso Nacional](https://nap.dgt.es/en/dataset/groups/camaras-dgt). **Licencia concreta de las imágenes: no verificada** | `PUBLIC_LICENSED` (cameras.mjs) |
| **Android Auto** | Solo apps de categorías aprobadas: navegación, POI, IoT, VoIP y tiempo ([Android for Cars](https://developer.android.com/design/ui/cars/guides/app-types/other-apps), [Google I/O 2025](https://android-developers.googleblog.com/2025/05/android-for-cars-google-io-2025.html)). Las apps de navegación pueden avisar de «tráfico por delante» ([requisitos UX](https://developers.google.com/cars/design/create-apps/ux-requirements/templated-apps)) | Car App Library 1.7.0 en la versión play; **categoría POI provisional** |

**Conclusión honesta:** un Tesla que pasa por la zona **no puede** enviar hoy a SENDA lo que ve su ordenador de a bordo. Lo que sí funciona es que su dueño (o cualquier dueño de una dashcam) procese sus clips con SENDA y comparta **eventos** (qué, dónde, cuándo), nunca imágenes.

## 2. Lo construido

### 2.1 Contrato y fusión (`packages/senda/src/vehicle-camera-link.mjs`)
- Esquema `senda-camera-event/1` con registro de accesos reales (`CAMERA_ACCESS`).
- **Privacidad por diseño:** se rechaza cualquier evento con imagen, fotograma, matrícula, cara, VIN o identidad.
- **Consentimiento:** un evento de cámara de vehículo exige `consent.share`.
- El dispositivo se identifica con un **seudónimo**: el script nunca lee el VIN.
- **Sin probabilidades inventadas:** `score` es la salida del detector. En la fusión (`roadsafe-correlation`) las cámaras cuentan como **avistamiento independiente** (una raíz por vehículo o cámara), pero su fiabilidad es `null` hasta calibrarla: **no suben la confianza ni bastan para corroborar**. Varios clips del mismo coche cuentan como uno.
- `crossCheck` cruza eventos de cámaras con V16, BLE, DATEX II y conductores por zona y ventana declaradas.

### 2.2 Escáner Python (`packages/senda-vision/vehicle_camera_scan.py`)
- Entrada: memoria USB de TeslaCam (`SavedClips`/`SentryClips`) o un vídeo con posición y hora declaradas.
- Detector YOLOX (Apache-2.0, ya en el repo) + heurísticas **sin validar**:
  - vehículo atravesado (caja ancha en el carril propio);
  - vehículo detenido delante (tiempo hasta el impacto por crecimiento de la caja);
  - persona en la calzada (sin identificar).
- Umbrales **declarados** en `example_scan_config.json` (ejemplo sin validar).
- Sin posición en `event.json` → no hay evento. Sin zona horaria declarada → no hay evento. No se inventan.
- Pruebas: 11 con detector simulado y vídeos sintéticos.
- **Prueba de humo con el modelo real** sobre un vídeo a bordo abierto (Udacity CarND, MIT; 60 s, 420 fotogramas analizados):
  - 753 detecciones, 751 de coches;
  - 2 «personas» falsas en plena autopista, descartadas por el filtro de fotogramas consecutivos;
  - 0 eventos: ningún coche entró en el carril propio. Es correcto, y **no es una medida de precisión** (n = 1 vídeo).
- Propiedad documentada: el tiempo hasta el impacto por diferencias hacia atrás va ~1 paso de muestreo por detrás del real.

### 2.3 Detección de golpes con el móvil
- **Nueva evidencia `spinAfter`:** giro total tras el impacto medido con el giroscopio (∫‖ω‖dt, independiente de cómo esté colocado el móvil). Motivada por el trompo del caso real del doc 18. Su razón de verosimilitud queda **sin declarar** hasta calibrarla.
- **Arnés de calibración** (`packages/senda/scripts/crash-calibrate.mjs`): ajusta cada razón de verosimilitud en train y evalúa en test con intervalo de Wilson.
  - La **previa no se ajusta** con el dataset, porque su proporción de choques está enriquecida por el muestreo.
  - Avisa si la licencia es no comercial.
- **Conversor** (`packages/senda/calibration/vzcrash_to_jsonl.py`): exige declarar las columnas y separa train/test **por evento**.

## 3. Datos para calibrar (licencias verificadas en su ficha)

| Dataset | Qué trae | Licencia y acceso | Uso posible |
|---|---|---|---|
| [VZCrash](https://huggingface.co/datasets/vzc-research-chapter/VZCrash) ([artículo](https://arxiv.org/pdf/2606.06074)) | ~190 000 eventos, >31 000 choques verificados; acelerómetro (g, 100 Hz), giroscopio (°/s), velocidad GPS (km/h, 1 Hz) | **CC BY-NC 4.0** (no comercial) y **acceso restringido**: hay que aceptar sus condiciones con una cuenta | Investigación y validación. **No** para parámetros de un producto comercial sin permiso. Ojo: IMU de dashcam fija, no de móvil suelto |
| Nexar Collision Prediction ([artículo](https://arxiv.org/pdf/2503.03848)) | Vídeo de dashcam con colisiones y cuasi colisiones | En Hugging Face solo aparecen réplicas con licencia «other» y acceso restringido; el original no aparece. **Licencia no verificada** | Validar las heurísticas de vídeo, cuando se confirme la licencia |
| [SimRa](https://www.github.com/simra-project/dataset) | Cuasi accidentes de bicicleta con sensores del móvil | CC BY-NC 4.0 | Solo referencia (bicicleta) |

## 4. Decisiones pendientes del fundador

1. **VZCrash:** aceptar sus condiciones con una cuenta de Hugging Face y asumir que es **no comercial**.
2. **Categoría de Android Auto:** POI es provisional; Google podría rechazar un servicio de avisos sin guiado.
3. **Tesla Fleet API:** darse de alta como desarrollador para verificar qué ofrece «Live Camera» y a qué coste.
4. **Licencia de las imágenes de la DGT:** confirmarla en la ficha del conjunto o con la DGT antes de procesarlas a escala.

## 5. Límites

- Ninguna heurística de vídeo está validada; los umbrales son ejemplos.
- La voz y el bus de avisos siguen en la app web (F2): la pantalla de Android Auto lo dice.
- El escáner es diferido (clips ya grabados), no en tiempo real.
