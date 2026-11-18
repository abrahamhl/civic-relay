# SENDA RoadSafe — H-ROAD-RRE-1 / H-ROAD-COVER-1 (2026-11-18)

**Alcance y madurez**: hipótesis de ingeniería de SENDA, implementada con pruebas software y experimentos sintéticos. No equivale a un nuevo descubrimiento físico, calibración de campo, verificación de un conductor, autorización para conducir, ni servicio del 112.

## Motivación: evitar la colisión secundaria

El peligro más temprano puede ser **el final de la retención móvil**, no el vehículo inmovilizado al que apunta la V16. El conductor debe ser considerado con incertidumbre de posicionamiento y tiempo de aviso, no mediante una distancia constante a un punto nominal. Los datos de Waze y DGT pueden ser fundamentales para cobertura federada, pero requieren acuerdos, tiempos de propagación y pruebas reales; un feed para socios Waze puede incorporar varios minutos de latencia antes de aparecer al usuario [S1]. Los BLE en segundo plano están limitados por sistema operativo [S2, S3].

## H-ROAD-RRE-1: envolvente robusta del final de cola

Sean `s1 ± ε1` y `s2 ± ε2` dos observaciones fechadas del mismo final de cola, georreferenciadas al mismo sentido y calzada, `Δt > 0`. En una coordenada curvilínea orientada según el sentido **validado** de la vía:

- `w_min = ((s2 − ε2) − (s1 + ε1)) / Δt`
- `w_max = ((s2 + ε2) − (s1 − ε1)) / Δt`
- Proyección `s_tail(now) ∈ [s2 − ε2 + w_min·age, s2 + ε2 + w_max·age]`, solo dentro de una ventana explícita de validez temporal.
- Distancia relativa `d ∈ [s_tail,min − (s_driver + ε_driver), s_tail,max − (s_driver − ε_driver)]`.
- Velocidad de cierre `c ∈ [v_driver,min − w_max, v_driver,max − w_min]`; `w<0` significa retroceso de la cola hacia el conductor.
- Distancia requerida bajo parámetros declarados: `D_req,max = m + c_max·(lat_max+react_max) + c_max²/(2 a_min)`. Los extremos del frenado y el movimiento de la frontera son **hipótesis acotadas**; no son instrucciones de conducción.
- `TIMING_ROBUST_IN_MODEL` únicamente si `d_min >= D_req,max`; `TIMING_TOO_LATE_IN_MODEL` si incluso el caso favorable no alcanza el espacio requerido; en el intervalo intermedio, `TIMING_INDETERMINATE`.

El resultado siempre tiene `canWarnDrivers=false`. Rechaza mapas sin concordancia, calzadas/sentidos incompatibles, envejecimiento, posición solapada, velocidad de cierre no positiva, datos incompletos y overflow. Los límites son **intervalos de contención**, no intervalos estadísticos de confianza. El resultado depende de la hipótesis de velocidad constante de cola y es solo válido en el dominio modelado.

### Comprobación teórica LWR

El valor opcional `w_LWR = (q_downstream−q_upstream)/(k_downstream−k_upstream)` en km/h (convertir /3,6 a m/s) deriva de conservación de vehículos, ya conocida como teoría Lighthill–Whitham–Richards [S4]. El comprobador se abstiene con `|Δk|` casi cero o si difiere de la onda de cola observada más que una tolerancia **declarada**. La hipótesis de flujo estacionario/localmente homogéneo **no** está validada para nudos, incorporaciones o varios carriles. No se calibran parámetros reales de frenado por defecto.

## H-ROAD-COVER-1: fiabilidad sin independencia imaginaria

Para cada ruta/canal autorizado se exige registro de `DESTINATION_ACK`, mismo estrato de medición, cuenta de ensayos, caducidad de evidencia y medición de latencia p95. No se mezclan iOS bloqueado, Android en primer plano, cambios de versión OS, tipos de carretera o diferentes temporadas sin separar estratos. `CUSTODY_ACK` no es entrega al destinatario; un ACK del destinatario no demuestra que la persona haya percibido un aviso.

Cada proporción de éxitos usa Wilson 95 % **condicionado** a muestreo Bernoulli representativo e independiente, suposición sin validar físicamente. En ausencia de dependencia conjunta, la desigualdad de Fréchet da una banda exploratoria para la unión: `max(P_i) <= P(al menos uno) <= min(1, Σ P_i)`; NO se usa `1−Π(1−P_i)` para garantizar seguridad. El intervalo que mostramos al usar extremos Wilson de canales individuales **no tiene cobertura conjunta del 95 %**. Toda salida se etiqueta `RESEARCH_BOUNDS_ONLY` y `canWarnDrivers=false`.

La interfaz `assessCoverageAtQueueDeadline` compone el margen de tiempo hasta la cola con los p95 empíricos por canal, pero no habilita transmisión; comparaciones p95 con un evento individual no prueban puntualidad ni percepción humana. Sin evidencia de campo: **ABSTAIN_NO_CALIBRATED_CHANNEL**.

## Prueba falsable predefinida: 4.000 escenarios sintéticos

Comando: `node packages/senda/scripts/roadsafe-reachability-experiment.mjs`.

- Semilla fija `20261118`, PRNG xorshift32, 4.000 escenarios; perturbaciones de localización generadas *dentro* de las incertidumbres declaradas; velocidades, latencias, reacción y desaceleración escogidas también dentro de los intervalos.
- Baseline **intencionadamente simple y no normativo**: distancia fija de 500 m. En esta distribución sintética se declara suficiente en 2.507 casos, pero 6 carecen de separación real según el propio modelo.
- SENDA conservador declara `TIMING_ROBUST_IN_MODEL` en 1.946 casos, y presenta **0 falsos márgenes** contra los parámetros internos de esta simulación. Hay 2.008 casos indeterminados.
- **Interpretación estricta:** 0/4.000 es un test de invariantes bajo hipótesis construidas para contener la verdad, no demuestra 0% de colisiones, reducción real, superioridad práctica, especificidad ni calibración. Comprobar tasas de abstención y falsos avisos con muestras independientes de tráfico real es necesario.

Archivo de evidencia reproducible: `evidence/roadsafe/reachability-synthetic-20261118.json`. Cualquier cambio del algoritmo necesita repetir benchmark y pruebas de intervalo; no cambiar semilla/distribución para elegir el mejor resultado sin registro.

## Auditoría de seguridad adicional

El bus canónico anterior elegía la observación *más reciente* para una misma raíz. Un mensaje no autenticado que reutilizase `rootId` podía eclipsar el evento oficial. Ahora el orden de selección es **verificación de origen comprobada → fecha → severidad**. Si dos editores verificados reclaman la misma raíz con identidad de editor incompatible, el grupo se pone en cuarentena (`CONFLICTING_VERIFIED_ROOT_OWNERSHIP`). Esto limita la suplantación y duplicación de la raíz, pero **no sustituye** la verificación de firmas/certificados en la entrada institucional.

## Pruebas y criterios de promoción

- Nuevos tests unitarios y adversariales: `tests/roadsafe-queue-reachability.test.mjs`; se agregan dos P0 en `tests/roadsafe-road-alert-network.test.mjs`.
- 4.000 escenarios deterministas verifican que el método conservador no afirma margen donde su propia verdad simulada lo niega. Comparación con baseline 500 m marcada **no reglamentaria**.
- Evaluación independiente necesaria: CCTV con licencia y seguimiento manual anotado de cola, loops/aforos reales con `q,k`, ground truth por carril, validación temporal con datos sin filtración futura, calibración de intervalos y latencias p50/p95/p99 por SO, estudio de ergonomía humana en pista cerrada/autorizada.
- Ensayo controlado sugerido: 2 Android y 2 iPhone con manifestaciones explícitas de restricciones de foreground/background y sin emitir mensajes públicos; datos de recepción/latencia y acuses de destino firmados.
- No migrar a emergencia real ni redes de terceros sin DPIA, acuerdos, validación de HMI, autoridades competentes y homologación cuando proceda.

### Referencias de contraste externo

[S1] Waze Partner feed: https://developers.google.com/waze/data-feed/constructing-a-partner-feed

[S2] Android Developers — Communicate in the background (BLE): https://developer.android.com/develop/connectivity/bluetooth/ble/background

[S3] Apple — Core Bluetooth Background Processing: https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html

[S4] LWR conservations/traffic flow: https://www.civil.iitb.ac.in/tvm/nptel/541_Macro.html

[S5] US FHWA Active Traffic Management — queue warning: https://ops.fhwa.dot.gov/publications/fhwahop17056/chap1.htm

[S6] DGT 3.0 integration and V16: https://www.dgt.es/muevete-con-seguridad/tecnologia-e-innovacion-en-carretera/forma-parte-de-la-dgt-3.0/

[S7] Waze Partner feed: https://developers.google.com/waze/data-feed/overview