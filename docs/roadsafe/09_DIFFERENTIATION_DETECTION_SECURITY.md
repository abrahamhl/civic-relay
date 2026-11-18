# RoadSafe · Qué existe ya, cómo nos diferenciamos, detección de accidentes y blindaje

**Fecha:** 2026-11-18. Las fuentes se consultaron en esta sesión. Lo marcado «no verificado» no se pudo confirmar.

## 1. Qué existe ya (y sus límites conocidos)

| Solución | Qué hace | Límite documentado | Fuente |
|---|---|---|---|
| Detección de choques de Apple (iPhone/Watch) | Detecta impactos con los sensores y **llama sola** a emergencias | Falsos positivos documentados: esquí, montañas rusas, motos de nieve; centros 911 de Colorado/Utah con avisos sin incidente | [Hackaday](https://hackaday.com/2023/02/09/ski-season-sees-apples-crash-detection-system-fire-deluge-of-false-positives) · [TechSpot](https://www.techspot.com/news/96262-iphone-14-crash-detection-inadvertently-triggering-roller-coasters.html) · [Tom's Guide](https://www.tomsguide.com/news/iphone-crash-detection-fooled-again-this-time-by-winter-activity) · [Intego](https://www.intego.com/mac-security-blog/is-apples-crash-detection-causing-too-many-false-positives/) |
| Detección de choques de Google Pixel | Equivalente en Android | Funcionamiento y precisión **no verificados** en esta sesión | — |
| WreckWatch (académico) | Detección con móvil y filtro por contexto | El móvil puede caerse y no está unido al vehículo | [Vanderbilt](https://www.dre.vanderbilt.edu/~schmidt/PDF/wreckwatch.pdf) |
| V16 conectada → DGT 3.0 | La baliza envía su posición a la plataforma | Según la DGT, **no** se reenvía automáticamente a Google Maps o Waze: los Centros de Gestión de Tráfico filtran antes. La prensa no es concluyente | [Motor.es](https://www.motor.es/noticias/dgt-baliza-v16-conectada-cobertura-total-telecos-garantizan-2025111419.html) · [Que.es](https://www.que.es/2026/01/22/baliza-v16-ubicacion-google-maps-waze/) · [Adslzone](https://www.adslzone.net/e-movilidad/noticias-tecnologia/mapa-balizas-v16-activadas-google-maps-waze/) |
| Mapas no oficiales de V16 | Muestran balizas activas | No integran avisos en los navegadores | [mapadebalizasv16.com](https://mapadebalizasv16.com/) |
| Talking Traffic (Países Bajos) | Avisos en tiempo real de colas, vehículos detenidos y tiempo, por V2X/IoT; 1,2 M de usuarios **en su lanzamiento** | Artículo de hace ~8 años: cobertura actual no verificada | [Traffic Technology Today](https://www.traffictechnologytoday.com/news/incident-detection/netherlands-launches-first-real-time-talking-traffic-services-for-1-2-million-road-users.html) |
| C-ITS «Day 1»: aviso de vehículo detenido | Mensajes de evento mientras dura el peligro | Requiere vehículos y estaciones equipados | [arXiv 1609.03876](https://arxiv.org/pdf/1609.03876) |
| Waze (avisos de usuarios) | Colaborativo | Sin API pública de lectura; feed de socios para publicar | `01_INTEROP_MATRIX.md` |

## 2. Cómo se diferencia SENDA (defendible, sin reivindicar patentes)

1. **Foco en el accidente secundario, con datos de cinco países.** Los accidentes **en el arcén** son en proporción el doble de mortales (FR OR 2,04; GB OR 2,44) y la oscuridad multiplica la gravedad ≈1,5–1,7 en los cinco países. SENDA prioriza exactamente esa situación: vehículo detenido, personas fuera, de noche, esperando grúa.
2. **Detección que no inunda el 112.** Frente a la llamada automática:
   - un pico de aceleración no basta: hace falta una caída de velocidad del vehículo y que esté sobre una vía conocida;
   - la caída libre previa (móvil caído) y la reanudación de la marcha cuentan en contra;
   - con datos dudosos, SENDA **pregunta**; nunca llama sola.

   En trazas sintéticas separa choques de caídas del móvil, baches, frenadas, esquí, montañas rusas y portazos. **Es una verificación de la lógica, no una medida de precisión.**
3. **Una sola verdad del incidente.** V16 → DGT 3.0 → navegador y la declaración del afectado cuentan como **una** fuente. Es el mismo problema que la DGT resuelve con sus filtros, pero hecho explícito y auditable.
4. **Estados que no mienten y custodia firmada.** «Recibido» no es «enviado», y una llamada declarada no es una llamada recibida. La cadena de auditoría lleva una firma ECDSA, útil ante aseguradoras y juzgados.
5. **Sin conexión y de código abierto.** Rutas guardadas, guía de emergencia, ubicación por SMS y recuento de ocupantes, todo sin red. Licencia MIT.
6. **Coordinación de la escena, no solo detección.** El taxi o la grúa anuncian su parada; hay plan de zona, servicios con autorización y ocupantes y móviles perdidos.

## 3. Detección de accidentes (`roadsafe-crash-detect.mjs`)

| Evidencia | Dirección | Por qué |
|---|---|---|
| Caída brusca de la velocidad del **vehículo** (GNSS/OBD) | a favor | Distingue un choque de un golpe al móvil |
| Forma de pulso compatible (30–300 ms) | a favor | Los impactos tienen una duración típica; un golpe al móvil, menos |
| Caída libre previa | **en contra** | Firma de móvil que se cae |
| Vehículo detenido después | a favor | Tras un choque no se sigue circulando |
| Reanudación de la marcha | **en contra** | Bache o frenada fuerte |
| Sobre una vía conocida / lejos de toda vía | a favor / **en contra** | Corta los falsos positivos de esquí y parques de atracciones |
| Airbag (si hay contrato con el fabricante) | a favor muy fuerte | Señal del propio vehículo |
| Cambio brusco de orientación | a favor | Vuelco o móvil despedido |

Los estados posibles son NO_EVENT, CHECK_USER, LIKELY_CRASH y ABSTAIN. **Sin velocidad** (túnel), un pulso fuerte nunca se descarta: se pregunta.

Las razones de verosimilitud **no tienen valores por defecto**: se declaran. `EXAMPLE_DETECTION_CONFIG` está marcado como «sin calibrar». **Calibración pendiente:** trazas reales etiquetadas (pruebas de choque, colaboración con flotas o aseguradoras) y medir sensibilidad y especificidad con intervalo de confianza (`evaluateDetector`).

## 4. Blindaje (`roadsafe-guard.mjs` y cambios transversales)

| Amenaza | Medida |
|---|---|
| Fuga de datos personales del expediente | AES-256-GCM con clave por incidente derivada con HKDF-SHA-256. El incidente y el propósito van como datos asociados, así que un sobre no se puede trasplantar a otro incidente. |
| Manipulación posterior del registro | Firma ECDSA P-256 de la cabeza de la cadena SHA-256: cualquier añadido o borrado se detecta. |
| Ataques de tiempo sobre MAC | Comparación en tiempo constante (también en ocupantes: código de invitación y orden de búsqueda del móvil). |
| Tramas BLE falsificadas o repetidas | Cápsula P-256 firmada, claves inscritas y revocables, caché de repetición. Sin firma, como máximo ADVISORY. |
| Inundación de avisos o bots | Límite de ritmo por identidad, detección de ráfagas y de saltos físicamente imposibles. El aviso sospechoso se degrada a pista no verificada; nunca se borra en silencio. |
| Rastrear personas o a la policía | Vistas públicas difuminadas y sin identificadores. Las posiciones de servicios solo las ven los coordinadores. El manifiesto de ocupantes es local y caduca. |
| Datos de entrenamiento envenenados | Ficheros oficiales con SHA-256 en el manifiesto y validación de esquema (0 rechazos en 652 224). |
| Afirmaciones infladas | Regla de veracidad: los simuladores exigen un escenario declarado y etiquetan su salida como `SIMULATION`; los modelos sin calibrar lo dicen. |

## 5. Optimización

- El dataset de 5 países (652 224 accidentes) se construye en ~19 s con Node sin dependencias.
- La detección es O(n) sobre la ventana de sensores. La envolvente Monte Carlo es configurable (n).
- El paquete de ruta sin conexión ocupa menos de 20 KB.
- Los agregados web pesan unos 12 KB.
