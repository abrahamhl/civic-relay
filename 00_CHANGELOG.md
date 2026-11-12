# Changelog

## SENDA · 12-11-2026 · Mensaje sin red entre países, avisos ciudadanos con triaje 112 e investigación de compras públicas

**Entrada (fundador):** cómo llega un mensaje a su hermano en Holanda sin red y sin nadie con SENDA en medio; red de avisos ciudadanos que alivie el 112 sin emitir avisos sin confirmación oficial; qué software compran los organismos (ES/NL/UE); cámaras y fuentes públicas.

**Procesamiento:**
- `courier.mjs`: emparejamiento previo (ECDH P-256 + HKDF) y mensaje compacto AES-256-GCM con 25 B de sobrecarga (74 B un mensaje corto); primera milla, buzones redundantes en Internet y última milla; fragmentos Reed-Solomon que cambian de forma en cada salto, nunca de contenido; tiempo en el aire LoRa (Semtech AN1200.13) y uso justo de TTN; apagón regional por lado; vías prohibidas (redes Find My) y en claro (APRS) excluidas por código.
- `envelope.mjs`: `sealMessage` rechaza una prioridad no válida (antes creaba un sobre que nadie podía abrir).
- `hazard-reports.mjs`: nivel del agua por toques en la foto, velocidad de subida por mínimos cuadrados, agrupación de reportes en incidentes, contraste con reputación, sensores y fuentes oficiales, zona de reconocimiento previa, cola priorizada para el 112. Aviso público solo con confirmación oficial; si hay riesgo vital, siempre «llama al 112».
- `docs/research/`: compras de software de emergencias ES/NL/UE, vías reales de mensaje sin red ES↔NL, cámaras y fuentes de ríos y fuego.

**Validación:** suite 492/492.

**Límites:** las disponibilidades por país de LoRaWAN/Meshtastic/Wi-Fi son hipótesis. Los agentes no pudieron abrir las páginas oficiales (bloqueo de red): cifras de búsqueda con confianza media. `bearers.SAT_D2C_SMS` no está disponible en ES ni NL (Orange Francia funciona sobre Skylo) y lo usa la afirmación «199/200» de la película: pendiente de decisión.

— Firma: Claude Code (sesión cloud), 12-11-2026.

## SENDA · 12-11-2026 · SENDA Vigía: consenso físico entre sensores baratos

**Entrada (fundador):** producto nuevo y revolucionario con infraestructura mínima y módulos baratos (térmicas, micrófonos, cámaras, dashcams), con un camino claro hacia inversores.

**Procesamiento:**
- `packages/senda/src/vigia.mjs`: focos térmicos en fotogramas de 32×24 (MLX90640), rumbo por columna, cruce de rumbos, consenso tipo RANSAC entre rumbos y tiempos de llegada acústicos con velocidad del sonido según la temperatura, detección de nodos incoherentes, confianza aprendida por nodo, suceso firmado (ECDSA P-256) sin imagen ni audio, CAP 1.2 y balance energético.
- `docs/product/SENDA_VIGIA_2026-11-12.md`: producto, nodos, modelo de negocio y camino a inversores.

**Validación:** `tests/vigia.test.mjs`, 12 pruebas. Monte Carlo con semilla fija: 498/500 confirmados, nodo mentiroso detectado 488/500, p95 20,4 m, falso consenso 0,2 %. Suite completa: 478/478.

**Límites:** solo simulación geométrica; hardware sin montar ni medir; precios sin cotizar. Choques de exportación previos en `index.mjs` (ocultos en silencio): `TEXT_PREFIX`, `ACCESS`, `parseFirmsCsv`, `satVapHpa`.

— Firma: Claude Code (sesión cloud), 12-11-2026.

## SENDA · 12-11-2026 · Desarrollo: app Android real, Centro de Control, operación de incidente y aprendizaje de la red

**Entrada (fundador):**
- «Necesito implementaciones en el código, funcionalidades, desarrollo»: app de verdad (no navegador), panel de control dinámico, todo lo que se dice verificado con pruebas.

**Procesamiento:**
- **App Android autónoma**: `AppActivity` sirve la app web completa desde `assets/` con origen HTTPS propio (`OfflineAssets`, 23 comprobaciones JVM: sin `..`, sin otros orígenes, sin `file://`). Sin permiso de Internet. La CI verifica que el APK lleva la app y el núcleo.
- **Centro de Control** (`/senda/centro`): autodiagnóstico real al arrancar, incendio + lluvia + caída de antenas en el tiempo, canales con física (P.838-3), plan con fallos correlacionados, envío real cifrado y troceado, móvil del residente.
- **Operación de incidente** (`incident-ops.mjs`, 10 pruebas): organismo → credencial ligada a la clave → orden firmada a la zona → cada teléfono la verifica → respuestas → cuadro → parte CAP 1.2 + auditoría encadenada. Rechaza órdenes falsificadas, robadas, alteradas, repetidas y caducadas.
- **Aprendizaje de la red (SENDA-CAL) conectado**: cada intento por canal deja un recibo anónimo; el almacén aprende la fiabilidad por canal y pueblo y el planificador la usa en la orden siguiente (`learnFromDelivery`, `priorsFromCatalog`). Visible en el Centro.
- **Corregidos 3 fallos reales de `reliability-store.mjs`**: (1) la fusión «CRDT» sumaba contadores y no era idempotente (sincronizar dos veces duplicaba la evidencia) → ahora un registro por nodo, gana la mayor secuencia; (2) importaba `node:crypto` y no funcionaba en la app → SHA-256 puro; (3) recibos distintos en el mismo milisegundo tenían el mismo hash → `nonce` por intento, y `recordedAt` fuera del hash.
- `scripts/prove.mjs` + `scripts/film-claims.mjs`: 19 afirmaciones de la película medidas contra el núcleo (nueva: `learning-crdt`, escena v24).

**Validación:**
- `node scripts/prove.mjs --full`: 466/466 pruebas del núcleo, 19/19 afirmaciones. Centro probado en Chromium sin errores de consola.

**Límites:** población de teléfonos y fiabilidades «verdaderas» de la simulación son sintéticas y declaradas; el plan trata los envíos como independientes (cota optimista). La escena v24 dice «recibos **firmados**»: los recibos de aprendizaje llevan hash, no firma (anonimato) — corregir la palabra en el próximo montaje.

— Firma: Claude Code (sesión cloud), 12-11-2026.

## SENDA · 11-11-2026 · Película de inversores v2: explicación completa en escenas 3D

**Entrada (fundador):**
- La v1 «no tiene sustancia»: hay que explicar por qué pasó cada suceso, cómo funciona SENDA, los protocolos y la física, cómo probarlo, la coordinación con emergencias, las integraciones, los sensores, las fuentes de datos y los módulos de hardware. Sin diapositivas: escenas 3D animadas, más luminosas.

**Procesamiento:**
- Guion nuevo de 28 escenas y 12:31 (`build-investor-film.mjs`). Las cifras de física se calculan con el núcleo al construirlo (P.838-3, filo de cuchillo, longitudes de onda, Reed-Solomon 6-de-10 real) y falla si no coinciden.
- 14 escenas 3D nuevas en `cinema/scenes2.js`: valle con crecida, móvil 3D con pantallas reales de la app, dos móviles (sonido, punto de acceso, LoRa), reserva de red, lluvia frente a longitud de onda, difracción sobre una cresta, mapa de Europa con rutas, previsión del apagón, PAS en carretera, terremoto con ondas P y S, zona y orden firmada, red y fuentes, integraciones y módulos. Más la escena de tren a bordo y la fase SOS de carretera en `cinema/scenes.js`.
- Motor: mapa de entorno de estudio (RoomEnvironment), sombras, exposición por escena y rótulos mínimos (sin paneles de texto).

**Validación:**
- `node validate.mjs investor-film en` sin errores; 28 fotogramas de control revisados y corregidos (exposición, destellos, encuadres).

**Límites:** sin metraje real (red bloqueada y regla 6), 3D de tiempo real sin GPU, módulos de radar/sismógrafo/repetidor solo diseñados, pantallas de la app en español, sin neerlandés. Detalle en `docs/video/INVESTOR_FILM.md`.

— Firma: Claude Code (sesión cloud), 11-11-2026.

## SENDA · 11-11-2026 · Película de presentación a inversores (motor 3D `cinema`)

**Entrada (fundador):**
- Vídeo oficial para búsqueda de inversores: narración inglesa con voz femenina, música techno tranquila, simulaciones 3D, subtítulos en español e inglés, y explicación del problema, el planteamiento, la ciencia y el potencial multicampo.

**Procesamiento:**
- `media/senda-film/build-investor-film.mjs` genera `investor-film.json` (15 escenas). Solo reutiliza afirmaciones de guiones ya verificados (M95/M96) y de `docs/science/DELIVERY_ASSURANCE.md`; lee las cifras de pruebas de `estado.json` y cuenta los agentes en `.opencode/agents`. Falla cerrado si no coinciden o si un subtítulo no cabe en 2×42.
- Motor nuevo `media/senda-film/cinema.html` + `cinema/scenes.js` + `cinema/lib.js`: three.js r158 con bloom, grano, viñeta, formato 2.39:1 y transiciones con barrido radial; determinista (`seek(t)`).
- `media/senda-film/music-techno.py`: banda sonora original generada por código (118 BPM), sin muestras de terceros.
- `media/senda-film/render-cinema.mjs`: grabación 1080p, mezcla a −16 LUFS, pistas de subtítulos es/en y `.vtt`.

**Validación:**
- `node validate.mjs investor-film en` sin errores; `check-vtt.mjs` sobre los VTT es/en; fotogramas de control revisados en las 15 escenas.

**Límites declarados (`docs/video/INVESTOR_FILM.md`):**
- Sin metraje real (entorno sin acceso a vídeo con licencia; regla 6 del prompt maestro). Las escenas de hechos publicados son visualizaciones 3D rotuladas como tales.
- 3D de tiempo real, no fotorrealista. Escenas simuladas ilustrativas: no ejecutan `packages/senda`.
- Sin subtítulos en neerlandés: no publicar en producción sin añadirlos. Vídeo no integrado en la web ni desplegado.

— Firma: Claude Code (sesión cloud), 11-11-2026.

## SENDA v0.29 · 10-11-2026 · Panel de Calibración Probabilística (L2.5), Adaptadores Satelitales CDSE/FIRMS (L4.2–L4.4) y ADR GIS 4D (L5.1)

**Entrada (fundador / CTO):**
- Misión Antigravity «Financiación en 7 Días» (Día 2/3): construir el Panel de Calibración Probabilística en `/science` (L2.5), implementar el cliente STAC de Copernicus CDSE (L4.2), el adaptador inactivo seguro de NASA FIRMS (L4.3), el motor de linaje y grafo de dependencias para evitar falsas corroboraciones OSINT (L4.4), y el ADR medido de selección del motor GIS 4D (L5.1).

**Procesamiento:**
- **L2.5 · Panel de Calibración Probabilística (`packages/senda/src/calibration-diagram.mjs` y `investor-next/app/calibration-panel.tsx`):**
  - *Diagrama de fiabilidad (Reliability Diagram):* Binned en 5 intervalos uniformes ([0–0.2], [0.2–0.4], [0.4–0.6], [0.6–0.8], [0.8–1.0]) con intervalos de confianza de Wilson al 95 % para la proporción empírica de éxito en cada celda.
  - *Reglas de puntuación estricta (Proper Scoring Rules):*
    - Brier Score (BS): $BS = \frac{1}{N}\sum (f_i - o_i)^2$.
    - Brier Climatológico de Referencia: $BS_{\text{ref}} = \bar{o}(1 - \bar{o})$.
    - Brier Skill Score (BSS): $BSS = 1 - \frac{BS}{BS_{\text{ref}}}$.
    - Expected Calibration Error (ECE) y Maximum Calibration Error (MCE).
  - *Descomposición de Murphy (1973):* Descompone exactamente el Brier Score binned en:
    $$BS_{\text{binned}} = \text{Reliability} - \text{Resolution} + \text{Uncertainty}$$
    junto al término residual de discretización intra-bin.
  - *Etiquetado epistémico:* Etiqueta explícita `[SIMULADO]` en modo sintético con modelos de desvanecimiento Nakagami-m y atenuación pluviométrica ITU-R P.838, y `[DATO REAL CAPTURADO]` al ingerir recibos del protocolo `PILOT_PROTOCOL_2026-11.md`.
  - Integrado de forma interactiva en la Superficie C (`/science`, `app/surface-view.tsx`).
- **L4.2 · Adaptador Copernicus CDSE STAC (`packages/senda/src/copernicus-cdse.mjs`):**
  - Cliente OGC STAC 1.0.0 sobre la API pública de Copernicus Data Space Ecosystem.
  - Descubrimiento de escenas Sentinel-2 MSI y Sentinel-1 SAR por bounding box, ventana temporal y filtro de nubosidad (`eo:cloud_cover`).
  - *Principio epistémico:* **Solo metadatos y miniaturas (thumbnails)**; prohibida la descarga de imágenes brutas pesadas (archivos SAFE de gigabytes) en terminales de emergencia.
  - Fixture representativo con huellas de Valencia (EMSR765) y Cebreros: `packages/senda/tests/fixtures/cdse-stac-sample-2026.json`.
- **L4.3 · Adaptador Inactivo NASA FIRMS (`packages/senda/src/nasa-firms.mjs`):**
  - Integración protegida para anomalías térmicas activas VIIRS/MODIS.
  - *Protocolo inactivo por defecto:* Sin la presencia de la clave secreta `FIRMS_MAP_KEY` en el entorno, el adaptador devuelve `{ status: 'INACTIVE', reason: 'FIRMS_MAP_KEY_REQUIRED' }` sin lanzar excepciones ni realizar llamadas de red no autorizadas.
  - *Regla epistémica obligatoria:* **Un punto caliente (hotspot) NO es un perímetro quemado** (`HOTSPOT_NOT_BURNT_PERIMETER`).
  - Fixture estático verificado: `packages/senda/tests/fixtures/firms-sample-2026.json`.
- **L4.4 · Grafo de Dependencias Epistémicas y Linaje (`packages/senda/src/source-evidence.mjs`):**
  - Máquina de estados: `DISCOVERED → SCHEMA_VALIDATED → LIVE_FETCHED → INTEGRATED → HOLDOUT_TESTED → FIELD_VALIDATED`.
  - Grafo de procedencia que previene falsas corroboraciones circulares:
    - `GDACS_EQ` depende de `USGS_NEIC` y `EMSC`.
    - `GDACS_WF` depende de `GWIS`, `NASA_FIRMS` y `COPERNICUS_EFFIS`.
    - `GDACS_FL` depende de simulaciones `COPERNICUS_GLOFAS`.
  - La función `checkCorroborationIndependence(A, B)` rechaza corroboración entre fuentes que comparten procedencia upstream (`SAME_UPSTREAM_NOT_CORROBORATION`).
- **L5.1 · ADR de Selección de Motor GIS 4D (`docs/adr/ADR-GIS-ENGINE.md`):**
  - Benchmark medido entre MapLibre GL JS + deck.gl frente a CesiumJS en terminales Android de gama media (Snapdragon 680, 4 GB RAM).
  - Medición objetiva: Bundle JS (363 KB frente a 3.850 KB, factor ×10.6), memoria heap (88 MB frente a 265 MB), tasa de refresco (52 FPS frente a 22 FPS) y soporte PMTiles offline soberano sin dependencias de Cesium ion.
  - Decisión: Selección de MapLibre GL JS + deck.gl con fallback 2D Canvas ante pérdida de contexto WebGL.

**Validación:**
- Núcleo civil: 433/433 tests pasando en `packages/senda` (0 fallos).
- Frontend microsite: 111/111 tests pasando en `investor-next` (0 fallos).
- SSG Next.js Turbopack: 17/17 páginas estáticas compiladas en 1.563 ms.
- Paridad web: 86 módulos civiles sincronizados exactamente entre core y public.
- Truth Gate: PASS (0 sobreafirmaciones no calificadas).
- Estado general: `estado.html` actualizado con hash c1112d2.

---

## SENDA v0.28 · 10-11-2026 · Integración Misión 10, Motor Ferroviario Auditado, SENDA-CAL y Truth Gate

**Entrada (fundador / CTO):**
- Misión Antigravity «Financiación en 7 Días» (Día 1): publicar y rebasar rama de Misión 10 sobre PR #31, corregir auditoría del motor ferroviario (pandeo lateral, TTC en alcance, atenuación Lamb, MAC en baliza, duty cycle LoRa, límites SIL-4) y arrancar L1 (staging/truth gate) y L2 (SENDA-CAL / DeliveryReceipt v1).

**Procesamiento:**
- **Publicación de Misión 10 en GitHub:**
  - Rama remota publicada: `origin/feat/senda-scientific-mission-10-20261109` (commit `1391a5e`).
- **Auditoría física y matemática de `packages/senda/src/rail-advanced-safety.mjs`:**
  - *Pandeo térmico de carril (Kerr/Kish & CWR-SAFE):* Inercia lateral horizontal $I_z = 5,12 \times 10^{-6}\text{ m}^4$ ($512\text{ cm}^4$) sobre carril UIC 60E1 (se rechaza la vertical de $3.038\text{ cm}^4$ que sobrestimaba $P_{\text{crit}} \times 2,44$). $\Delta T$ respecto a temperatura neutra de fijación. Reducción por radio de curva $R$ conforme a Kish & Samavedam (DOT/FRA/ORD-99/11) o declaración explícita `SOLO_VIA_RECTA`.
  - *Interlocking y TTC:* Se discrimina choque frontal ($v_{\text{rel}} = v_1 + v_2$) de colisión por alcance en el mismo sentido ($v_{\text{rel}} = v_1 - v_2$, $\infty$ si $v_1 \le v_2$). Criterio estricto de distancia de parada $d_{\text{safe}} = \sum(v \cdot t_r + v^2 / 2a)$.
  - *Seguridad funcional (EN 50126/50128/50129):* El sistema actúa fuera de la cadena vital SIL-4. Se sustituye «frenado autónomo» por «propuesta de aviso de frenado de emergencia al gestor / cabina».
  - *Ondas guiadas de Lamb en acero:* Velocidad de grupo $c_g = 5.100\text{ m/s}$ (modo longitudinal). Alcance acotado a $\sim 1,2\text{ km}$ para rotura completa; aviso de inoperancia de PZT de 40 kHz de aire en acero por desajuste de impedancia (46 MRayl frente a 400 Rayl).
  - *Baliza OEP-RAIL v2 (28 Bytes autenticados):* Payload binario con HMAC-SHA256 truncado a 4 bytes (32 bits), contador secuencial anti-replay y CRC-16-CCITT.
  - *LoRa 868 MHz y duty cycle:* Tiempo en el aire SF12 de 28 B $\approx 1,32\text{ s}$ $\implies$ intervalo mínimo normativo entre emisiones de $132\text{ s}$ (límite 1% ETSI EN 300 220-1).
  - *C-ITS:* Etiquetado explícito como ITS-G5 5,9 GHz simulado en banco con 38 ms de latencia nominal.
- **SENDA-CAL · Almacén de Fiabilidad Empírica (`packages/senda/src/reliability-store.mjs`):**
  - Contrato `DeliveryReceipt v1` anónimo (sin PII, resolución espacial H3 res 7, hash SHA-256 canónico).
  - Modelo jerárquico Beta-Binomial con Empirical Bayes Shrinkage hacia el prior global del canal.
  - Factor de olvido exponencial configurable para canales no estacionarios.
  - CRDT basado en suma conmutativa y asociativa de contadores para sincronización P2P offline sin servidor central.
  - Test secuencial de Wald (SPRT) para detección temprana de caída/degradación de canal.
  - Integración nativa con `planAssuredDelivery` en `delivery-assurance.mjs`: los recibos empíricos modulan dinámicamente el reparto $k$-de-$n$.
- **Adaptador Copernicus EMS Rapid Mapping (`packages/senda/src/copernicus-ems.mjs`):**
  - Segregación epistémica estricta entre ACTIVATION (declaración administrativa), CARTOGRAPHIC_PRODUCT (delineación o gradación satelital) y OBSERVED_PERIMETER (polígono real de inundación o cicatriz de fuego).
  - Fixture real con la activación EMSR765 (DANA Valencia) y EMSR740 (incendio Cebreros), con hash SHA-256 canónico y recibo en `evidence/senda/osint/cems-live-receipt-2026-11-10.json`.
  - Linaje declarado: ESA Sentinel-1 CSAR / Sentinel-2 MSI y catálogos upstream GLOFAS / EFFIS.
- **Protocolo de Ensayos Físicos de Campo (`docs/field/PILOT_PROTOCOL_2026-11.md`):**
  - Matriz experimental con 5 escenarios (interior LOS 2 m, tabique 5 m, muros de carga 10 m, exterior 30 m y modo avión total).
  - SOP de captura y exportación anónima para 3 terminales Android y 2 nodos LoRa SX1262.
- **Truth Gate (`scripts/claims-lint.mjs`):**
  - Auditoría estática que bloquea sobreafirmaciones sin calificar («submétrico», «100% infalible», «certificado oficial no concedido»).
- **Prueba Offline E2E en Chromium Real (Playwright):**
  - `investor-next/scripts/senda-offline-e2e.mjs` ejecutado con éxito: 49/49 verificaciones pasando y 37 capturas actualizadas sin red en `evidence/senda/`.
- **Laboratorio Web y UI (`investor-next/app/rail-safety-lab.tsx`):**
  - Actualizado con las formulaciones auditadas y montado en Surface C (`/science`).
  - Next.js Turbopack SSG prerenderiza 17/17 páginas sin errores.

**Validación:**
- Núcleo civil: 410/410 tests pasando en `packages/senda`.
- E2E sin red: 49/49 checks pasando en Chromium real (`offline-e2e.json`).
- Relé: 3/3 tests pasando.
- Tests de defensa: 2/2 tests pasando en `tests/defense/`.
- Frontend microsite: 108/108 tests pasando en `investor-next`.
- Claims lint: PASS (0 sobreafirmaciones no calificadas).
- Type check: 0 errores TypeScript (`tsc --noEmit`).

---


**Entrada (fundador):** usar cuánta gente y cuántos vehículos hay en cada zona, como el tráfico de Google Maps o Waze, para que las alertas tengan en cuenta el tráfico real y se reduzcan los tiempos. Conseguir el máximo de datasets de población.

**Procesamiento:**
- **Nuevo `packages/senda/src/exposure.mjs`**:
  - Proyección EPSG:3035 exacta.
  - Residentes por radio sobre la rejilla oficial GISCO 2021.
  - Exposición en tramo por la relación fundamental del tráfico y densidad a partir de la ocupación.
  - Lectores de Digitraffic TMS e Informo Madrid.
  - Plan de aviso adaptativo: zona de peligro con onda de choque LWR, alcance exacto de la cadena de radio en un proceso de Poisson 1D, saltos y retardos calculados en vez de fijos.
  - Priorización por personas afectadas esperadas.
- **Datos reales:**
  - Extracto español de la rejilla Eurostat de 1 km² (111.170 celdas, 47,21 M habitantes) con su procedencia.
  - Recibo en vivo de Digitraffic y Madrid: 988 estaciones y sentidos; la política fija de 3 saltos se queda corta en el 41 %.
- **Errores detectados y corregidos durante el desarrollo:**
  - La métrica «alcanzar a todos» bajaba al subir la penetración. Se sustituyó por la fracción esperada alcanzada, que sí crece.
  - Una cuadratura sesgada (13 puntos) se corrigió hasta coincidir con Monte Carlo.
- **Bloqueo registrado:** el servidor del MITMA (movilidad con teléfonos) rechaza el acceso automatizado. No se ha eludido.
- **Documentación:** `docs/science/EXPOSURE_AND_ADAPTIVE_WARNINGS.md`.

**Validación:** núcleo 391/391.

— Claude Code

## SENDA v0.26 · 10-11-2026 · Motor de Garantía de Entrega: fallos correlacionados, física, aprendizaje bayesiano y decisión certificada

**Entrada (fundador):** hacer la parte física, científica y de computación más avanzada, difícil de replicar e innovadora.

**Procesamiento:**
- **Nuevo `packages/senda/src/delivery-assurance.mjs`**, exportado desde `@senda/core`:
  - Probabilidad exacta de entrega con fallos de causa común (mezcla de estados de peligro + Poisson-binomial agrupada).
  - Física de lluvia (P.838-3) más Nakagami-m convertida en fiabilidad por canal.
  - Posterior Beta-Binomial alimentado por recibos, con planificación por cota inferior creíble.
  - Optimizador multiarranque con movimientos de bloque, búsqueda local iterada y reducción por simetría exacta.
  - Certificado SHA-256 canónico de cada plan.
- **Auditoría del planificador existente:** promete un 99,49 % y entrega un 96,09 % con fallos correlacionados. El motor nuevo da un 98,98 % a 0 € (3,8× menos fallos) y un 99,99 % con 3 € de Iridium; en el peor estado (apagón + tormenta), 90,9 % → 97,6 % → 99,98 %. El precio es más tiempo de aire (22 fragmentos frente a 6), declarado.
- **Durante el desarrollo, los tests contra el óptimo exacto destaparon** que el primer optimizador voraz se quedaba hasta 32 puntos por debajo del óptimo. Se corrigió con movimientos de bloque y búsqueda local iterada hasta lograr el óptimo exacto en 60 de 60 instancias.
- **Corrección del pipeline de vídeo:** `render.mjs` leía las cifras de pruebas de un esquema antiguo de `estado.json` y mostraba 266 en lugar de 350. Las dos películas M96 se volvieron a renderizar.
- **Documentación:** `docs/science/DELIVERY_ASSURANCE.md`. Evidencia reproducible en `evidence/senda/delivery-assurance.json`.

**Validación:** `node --test packages/senda/tests/*.test.mjs packages/senda/tests/defense/*.test.mjs` → 382/382.

— Claude Code

## SENDA v0.25 · 10-11-2026 · Bóveda de defensa aislada y película promocional completa M96

**Entrada (fundador):**
- Mantener la parte militar tal cual, pero categorizada y aislada en una bóveda aparte, en el código y en la web.
- Película promocional completa: qué resuelve SENDA, los accidentes en España que lo motivan, cómo funciona y todas sus funciones, reutilizando y actualizando el material ya publicado.

**Procesamiento:**
- **Bóveda de código (`packages/senda/src/defense/`, `@senda/core/defense`):** `civilian-uav-mesh-radar`, `uav-tactical-science`, `cots-rf-tactical` y `acoustic-beamforming-survival` se mueven sin cambios de contenido. El índice civil deja de reexportarlos. Los tests pasan a `tests/defense/` y se añade `vault-isolation.test.mjs`: ninguna función de defensa se filtra al índice civil y ningún módulo civil importa de la bóveda. `sync-web` publica en `public/senda/core/defense/`, la paridad lo verifica y el CI ejecuta la bóveda.
- **Bóveda web (`/defense`, `/es/defense`, `/nl/defense`, `noindex`):** aviso de doble uso y marco UE (Reglamentos 2021/821, 2019/945 y 2019/947). Contiene los laboratorios antidrón y el material audiovisual de defensa (telediario de radar antidrón, vídeo del modo inversionista y defensa, reels de drones, defensa y centinela), retirados de la portada y de /science. `check:locales` comprueba que nada de defensa aparece en las superficies civiles.
- **Película M96 (`media/senda-film/m96-promo.json`, generada por `build-m96-promo.mjs`):** 29 escenas, unos 12 min. Escenas nuevas: origen del proyecto, mapa animado de accidentes en España (escena `spainmap`), el hueco que nadie cubre y física con cotas honestas. Se reciclan 21 escenas de M95 y 4 de la ruta. Locución ES (`ef_dora`) y EN (`bf_emma`) con subtítulos ES/EN/NL. Fuentes en `docs/video/M96_PROMO_SOURCES.md`.
- **Calidad del material existente:** los diagramas de la película se traducen al español (`film-i18n.js`); antes salían en inglés en la versión española. Se reparan los acentos corrompidos (`n?cleo`, `m?s`…) en `m95-film.json`, `m95-sim-proof.json` y sus VTT publicados. `estado.json` se regenera ejecutando las pruebas (núcleo civil 350/350, antes decía 266).

**Validación:** ver el PR #31.

— Claude Code

## SENDA v0.24 · 10-11-2026 · Auditoría científica: corrección de errores físicos y de afirmaciones públicas antes de financiación

**Entrada (fundador):**
- Cerrar las brechas del handoff de Antigravity (misión 10) y todo lo que no esté al nivel exigible para pedir financiación esta semana.
- Nota: la rama `feat/senda-scientific-mission-10-20261109` (HEAD `1391a5e`, `rail-advanced-safety.mjs`, cierres P0) **no está en GitHub ni en producción**; esta entrada audita y corrige lo que sí está publicado (`feat/senda-master-integration-20261109`, `62d2b74`).

**Procesamiento:**
- **`telecom-mathematical-physics.mjs`:**
  - DTN epidémico: la tasa de contactos es por nodo (β = λ/(N−1)); se añade la capacidad de carga del modelo SIS (I* = N − μ/β). Los percentiles inalcanzables devuelven `Infinity` en lugar de un tiempo ficticio. Validado contra la integración RK4 de la EDO.
  - Deygout: motor compartido de 3 aristas con curvatura terrestre k = 4/3 y umbral J(ν) a −0,78. Se elimina un comentario que anunciaba una corrección que no se aplicaba.
  - Lluvia ITU-R P.838-3: tabla de coeficientes 1–40 GHz con interpolación log-log en lugar de 5 escalones (antes sobrestimaba un 50 % a 12 GHz).
  - PLL LEO: ancho de banda derivado de θ_e = 2π·Ḟ/ω_n² en lugar de una regla sin fuente.
- **`scientific-theorems-physics.mjs`:**
  - Cota de Cramér-Rao del radar pasivo: el ancho de banda RMS era πB/√3 en vez de B/(2√3) y subestimaba σ en un factor 2π. Con DVB-T a 15 dB, **σ_R pasa de "0,43 m submétrico" a 2,7 m**. La velocidad se reporta como biestática (λ·σ_f).
  - Enlace acústico: la tasa de error de trama pasa de un escalón (1e-7 si SNR > 0) a 16-FSK no coherente (125 baudios, coherente con 2 kHz) más RS(104,80) exacta. Se declaran las hipótesis.
  - Jacobi: converge por tolerancia (antes se cortaba en 150 rotaciones) y simetriza la matriz.
  - Deygout frente a Epstein-Peterson: se elimina el factor √(d/D) inventado. EP se calcula de verdad; ahora ambos se acotan entre sí.
  - Se aclara que los "Teoremas" son resultados publicados y que `CANYON_RUBBLE` es un proxy no validado.
- **Otros:** subcardioide Q = 2,06 (antes 1,43); componente sobre la bisectriz en el Doppler biestático; límite de 120 m de la categoría abierta de EASA; el estroboscopio deja de declararse "sin riesgo ocular" y queda como hipótesis sin ensayo.
- **Web (`scientific-theorems-lab.tsx`):** usa el núcleo probado (`public/senda/core`) en lugar de constantes fijas (λ₂ = 0,052/0,842, pérdida de 4,72 dB, θ* tabulado). Se corrigen los textos: "precisión submétrica", "P_FER < 10⁻⁷" y "validación frente a catástrofes reales" pasan a "modelos analíticos pendientes de calibración".

**Validación:**
- `node --test packages/senda/tests/*.test.mjs`: `370/370` pass (4 tests nuevos contra soluciones analíticas).
- `node --test packages/senda/tests-adversarial/*.test.mjs`: `11/11` pass.
- `node --test investor-next/tests/*.test.mjs`: `108/108` pass; `npm run type-check`: 0 errores; `npm run build`: 14 páginas; `check:locales`: pass.

**Pendiente (decisión del fundador):**
- Módulo de señuelos Open Drone ID y estroboscopio anti-dron (`civilian-uav-mesh-radar.mjs` + `civilian-radar-defense-lab.tsx`, publicado en la página de inversores): emitir Remote ID falso no es legal en la UE y compromete la elegibilidad en convocatorias civiles.
- Push de la misión 10 de Antigravity para auditar `rail-advanced-safety.mjs`.

— Claude Code · auditoría científica

## SENDA v0.23 · 08-11-2026 · Suite de vídeos finales de presentación M95 (V1–V5, 1080p, voz en inglés `bf_emma`, subtítulos ES/EN/NL y evidencia de release)

**Entrada (fundador):**
- Crear los vídeos finales de presentación entendiendo bien el proyecto y manteniendo la calidad de los ya existentes (`docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md`).

**Procesamiento:**
- **Guiones y fuentes verificables (`docs/video/M95_VIDEO_SOURCES.md` + `media/senda-film/m95-*.json`):**
  - registro de fuentes para cada cifra dicha o mostrada (`OBSERVED`, `CALCULATED`, `SIMULATED`);
  - `m95-film.json` (22 escenas `s1`…`s13` + nueva escena `s12b` *The proof you can inspect* con `266` pruebas de núcleo, `13` vectores PCI y `0` auditorías externas) y `m95-ruta.json` (12 escenas `r0`…`r11`);
  - 10 guiones derivados (`m95-90s`, `m95-60s`, `m95-30s`, `m95-vertical-45s` y 6 simulaciones explicadas `m95-sim-braking`, `m95-sim-sos`, `m95-sim-wrongway`, `m95-sim-queue`, `m95-sim-visibility`, `m95-sim-proof`).
- **Voz y subtítulos trilingües (`media/senda-film/voice.py` + `media/senda-film/check-vtt.mjs`):**
  - narración inglesa `bf_emma` (`kokoro-onnx==0.6.1`, `en-gb`, `0,95x`, pausas de `350 ms`) con fonética separada en `en_say`;
  - generación simultánea de 36 archivos `.vtt` (`es`, `en`, `nl`) sincronizados con la voz inglesa y verificados automáticamente (`36/36` pass en `check-vtt.mjs`; neerlandés marcado `REVIEW_REQUIRED` en `evidence/video/m95/subtitles-review.md`).
- **Escenario 3D/2D y renderizado (`media/senda-film/film.html`, `sims.js`, `render.mjs`):**
  - restauración y mejora del escenario v5 con Three.js (`drone3d`, `arch3d`), `call`, `howsim`, `hub` y simulaciones de páginas reales a `1920×1080` (`1,5x` DPR, `25 fps`, H.264 High `yuv420p` `+faststart`) y `1080×1920` vertical (limpio y con subtítulos incrustados `en`/`es`/`nl`);
  - internacionalización completa al inglés (`?film=1&lang=en`) en `carretera.html`, `camaras.html`, `paises.html`, `dgt.html` y `kit.mjs` sin alterar la lógica del núcleo;
  - banda sonora ambiental procedural (`media/promo-video/music.py`) con ducking por `sidechaincompress` y normalización a `-16 LUFS` / `-1,5 dBTP`.
- **Integración web, cabeceras y evidencia (`investor-next/` + `evidence/video/m95/`):**
  - publicación de los 53 artefactos en `investor-next/public/media/m95/` preservando los vídeos anteriores (`senda-film-*`, `senda-ruta-*`);
  - integración en `investor-next/app/senda-home.tsx`, `investor-next/public/senda/carretera.html` y `investor-next/public/senda/arquitectura.html`;
  - cabeceras de seguridad (§ 8.4) y caché de medios en `investor-next/vercel.json`;
  - paquete de evidencia completo en `evidence/video/m95/` (`release.json`, `qa-report.md`, `headers.txt`, `subtitles-review.md`, `ffprobe-film.json`, `ffprobe-ruta.json`, `SHA256SUMS.txt` y `screenshots/`) y `docs/video/M95_VIDEO_RELEASE.md`.

**Validación:**
- `node --test packages/senda/tests/*.test.mjs`: `266/266` pass.
- `node --test packages/senda-pci/tests/*.test.mjs`: `13/13` pass.
- `node --test scripts/release-manifest.test.mjs`: `4/4` pass.
- `pnpm --dir investor-next run type-check`, `pnpm --dir investor-next run build` (14 páginas), `pnpm --dir investor-next run check:locales` (`6/6`), `node --test investor-next/tests/*.test.mjs` (`107/107`).
- `node media/senda-film/check-vtt.mjs`: `36/36` VTT válidos (`0` errores).
- `node media/senda-film/verify-web.mjs`: HTTP `206` Range, `text/vtt`, tracks por idioma y `0` errores de consola en Chromium.

**Salida:** suite completa M95 publicada en `investor-next/public/media/m95/` con hashes SHA-256 y evidencia en `evidence/video/m95/`.

## SENDA v0.22 · 08-11-2026 · Modelo RF calibrable, rutas con respaldo y trilateración ponderada

**Entrada (fundador):**
- Afinar, ampliar y calibrar el modelo de `/mando` sin fingir mediciones de campo.
- Aumentar la precisión y el realismo de enlaces, rutas y posicionamiento.
- Añadir valor visible: entornos, incertidumbre, rutas de respaldo y nuevos indicadores.

**Procesamiento:**
- **Modelo `lib/command-surface.ts` v`mando-2.2.0`:**
  - cinco entornos (`OPEN`, `RURAL`, `SUBURBAN`, `URBAN`, `RUBBLE`) con exponente de pérdida, sombra y clutter;
  - 34 activaciones (`ACT-2401`…`ACT-2434`, hasta 899 s), antes 20;
  - presupuesto log-distancia + sombra log-normal + clutter, margen P90 y probabilidad de enlace;
  - alcance máximo despejado con el nuevo presupuesto y limitado por el alcance de planificación del canal;
  - trilateración ponderada por sigma de ancla, GDOP y elipse de incertidumbre al 95 %;
  - routing multicriterio con probabilidad por salto, energía, salto más débil y ruta de respaldo que evita el primer relay;
  - `analyze` añade activaciones con ruta y entrega media a tres intentos;
  - `collectAll` exporta esquema `v2` con entorno, sigma de sombra, modelo, fuentes de calibración, supuestos y rutas.
- **Consola `app/command-surface.tsx` y `app/command-surface.css`:**
  - panel de calibración global con entorno, desviación de sombra y versión del modelo; entorno y sigma alimentan presupuesto, rutas, calor de cobertura y exportación;
  - resultados nuevos: pérdida media, margen P90 y P(enlace);
  - KPIs nuevos: activaciones con ruta y probabilidad media de entrega a tres intentos;
  - capa de calor de cobertura, elipse de posición al 95 % y ruta de respaldo en el mapa;
  - ruta seleccionada con P(enlace), energía y probabilidad por salto;
  - coordenadas y error con precisión acotada; nota explícita de modelo;
  - copy ES/EN/NL para todas las etiquetas nuevas.
- **Pruebas:**
  - `tests/command-surface-model.test.mjs` con 9 pruebas de dataset, entornos, presupuesto, probabilidad, trilateración, rutas, cobertura, entrega y exportación;
  - script `npm run test:command`.
- **Documentación:**
  - `docs/mando/00_INDICE.md`, `docs/telecom/MALLAS_OFFLINE_FISICA_MATEMATICA_2026-11-08.md` y este changelog.

**Validación:**
- `npm run type-check`: sin errores.
- `npm run test:command`: 9/9 pruebas.
- `npm run build`: 14 páginas estáticas; `/mando`, `/es/mando/` y `/nl/mando/` generadas.
- `npm run check:locales`: 6/6 comprobaciones.
- **Límite:** `SIMULATED_VALIDATED`; las fuentes de calibración son estándares y adaptaciones, no mediciones propias. La validación física sigue `PHYSICAL_TEST_PENDING`.

**Salida:** el modelo distingue entorno, incertidumbre y probabilidad, y muestra una ruta de respaldo. Las cifras siguen siendo presupuestos de planificación, no garantías de servicio.

## SENDA v0.21 · 08-11-2026 · Superficie `/mando`: panel multicanal, rutas mesh y presupuesto RF

**Entrada (fundador):**
- Reunir activaciones, taxonomía, seguimiento, rutas y enlaces en una sola superficie de mando.
- Que el panel sea útil para revisión técnica e inversores sin fingir un servicio de emergencia real.
- Completar el modelo, las rutas y la documentación antes de validar en campo.

**Procesamiento:**
- **Nueva superficie `/mando`** en inglés, español y neerlandés:
  - `/mando/`, `/es/mando/` y `/nl/mando/`;
  - metadatos, `canonical` y alternates `en`/`es`/`nl`;
  - navegación «D · Mando / Panel Multicanal» en `SurfaceView`;
  - cuarta tarjeta «D · Mando» en la portada, en las tres lenguas.
- **Modelo `lib/command-surface.ts`:**
  - 3 escenarios (`blackout`, `degraded`, `recovery`), 8 activos, 20 activaciones y 8 canales;
  - cobertura por canal activo, activo compatible y distancia;
  - trilateración 2D por mínimos cuadrados lineales;
  - presupuesto de enlace FSPL + muros, ruido térmico, SNR, margen y Shannon;
  - Dijkstra con coste de latencia, tiempo de aire y distancia; confianza por producto de saltos;
  - modelos de aire para acústico, LoRa, SMS y satélite.
- **Correcciones de v0.21:**
  - `ACT-2416` pasa de un inexistente `CAMERA` a `CELL`, coherente con una cámara DGT;
  - una activación de canal caído ya no cuenta como cubierta;
  - el primer salto de una ruta exige un canal que el candidato también soporte;
  - la carga ilimitada se muestra como `∞`;
  - el HUD del mapa distingue «sin ruta» de «gateway caída».
- **Consola `app/command-surface.tsx` y `app/command-surface.css`:**
  - mapa con capas de activos, cobertura, pistas y rutas;
  - cola filtrable por canal y estado; detalle, trilateración, ruta mesh, calculadora RF, auditoría y exportación;
  - reloj de 0 a 900 s y activación simulada;
  - diseño responsive y respeto a `prefers-reduced-motion`.
- **Pruebas y despliegue estático:**
  - `scripts/finalize-locales.mjs` comprueba `lang` en las tres rutas `/mando`;
  - `test-locales.mjs` verifica contenido, simulación, canonical y alternates de las tres superficies.
- **Documentación:**
  - `docs/telecom/MALLAS_OFFLINE_FISICA_MATEMATICA_2026-11-08.md`;
  - `docs/research/OSINT_MALLAS_OFFLINE_2026-11-08.md`;
  - `docs/mando/00_INDICE.md`.

**Validación:**
- `npm run type-check`: sin errores.
- `npm run build`: 14 páginas estáticas; `/mando`, `/es/mando/` y `/nl/mando/` generadas.
- `npm run check:locales`: 6/6 comprobaciones, incluidas las tres superficies de mando.
- **Límite:** `SIMULATED_VALIDATED`; no hay radios, cámaras, GPS ni dispatch 112 conectados. La validación física sigue `PHYSICAL_TEST_PENDING`.

**Salida:** build estático listo para despliegue; las cifras de alcance, caudal y margen son presupuestos de planificación, no mediciones de campo.

## SENDA v0.20 · 06-11-2026 · Incendios de referencia con satélite real y cruce de coches, cámaras de tráfico y fuego

**Entrada (fundador):**
- Contrastar con otros incendios e investigaciones y entrenar con ellos una base de referencia propia.
- Datos reales en lugar de sintéticos, también las cámaras abiertas del catálogo de *God's Eye View*.
- Sobre todo: coches, cámaras de tráfico y cruzar esos datos.

**Procesamiento:**
- **Datos reales nuevos** (`scripts/datos-reales/goes_hrrr_incendio.py`): detecciones GOES-16/18 FDC cada 5–10 min y viento HRRR para siete incendios:
  - Camp 2018;
  - Palisades 2025;
  - Eaton 2025;
  - Marshall 2021;
  - Smokehouse Creek 2024;
  - East Troublesome 2020;
  - Creek 2020.
- **Núcleo `fire-cases.mjs`** (6 pruebas):
  - base de 14 incendios con fuentes, «verificado» o «pendiente de verificar»;
  - progresión a sotavento y tramos por programación dinámica + BIC;
  - modelos de ROS y validación dejando fuera un incendio entero;
  - regla del 10 % calibrada con intervalos de Student y su cobertura fuera de muestra;
  - aproximación del fuego a lugares.
- **Núcleo `traffic-fusion.mjs`** (5 pruebas):
  - modelo de celdas de Daganzo con humo (distancia de parada) y salidas de Rayleigh;
  - exposición, cierres y último aviso seguro;
  - umbral dinámico de aviso;
  - filtro de Kalman por conjuntos con capacidad oculta (logit) y operador de flujo del CTM;
  - ruido de cámara a partir de conteos reales.
- **Cámaras reales:**
  - 12 cámaras de TfL en Londres (catálogo de 890);
  - 13 de Caltrans en los corredores de evacuación de Camp, Palisades y Eaton: vídeo HLS en hora punta e historial de 3 h;
  - analizadas con el nuevo `packages/senda-vision/camera_flow.py`: cruces, ocupación, velocidad aproximada y detección de «Temporarily Unavailable».
- **Registro de cámaras** de 10 a 32 fuentes (23 PASIVO, 5 CONVENIO, 4 NUNCA) a partir de *God's Eye View* (MIT). Se añade ALPR como NUNCA.
- **Web:**
  - `/senda/referencias` y `/senda/evacuacion`;
  - tarjetas en la portada (es, en, nl), nodos y escenario en la arquitectura;
  - service worker `senda-campo-v21`.
- **Paper** ampliado (métodos 3.7–3.8, resultados 4.8–4.9, nota 68/100) y documento de investigación `docs/research/REFERENCIAS_COCHES_CAMARAS_2026-11-06.md`.
- **Entorno de la sesión `civic-relay`** (aprobado por el fundador): permite los catálogos oficiales de cámaras.

**Validación:**
- **Camp:** GOES mide 8,0 km/h en los primeros 90 min; NIST, ≈ 7,5 km/h. En Pentz Rd el fuego queda a ≤ 3 km a las 08:17 y a ≤ 2 km a las 08:37; NIST: 08:30.
- **Eaton:** el umbral dinámico avisa a Altadena oeste a las 18:31, 8,5 h antes de la orden real (después de las 03:00).
- **Entrenamiento:** con 7 tramos de 5 incendios, la regla publicada gana en error puntual. Se aprenden su sesgo (×1,43) y su dispersión (σ = 0,88); la cobertura del 80 % es del 71 % fuera de muestra.
- **Gemelos simulados del filtro:** el atasco de Chico se detecta en 7 min y el bloqueo de Palisades Dr se localiza en 8 min.
- **Pruebas:** 234/234 del núcleo y el relé; E2E 49/49 sin red, con accesibilidad en 28 pantallas; web 98/98.

**Salida:** ver `entrega/` regenerada y las páginas nuevas en producción.

## SENDA v0.19 · 05-11-2026 · Incendio en 3D con datos reales: masa de aire, viento 3D, pluma, cámaras, coches-estación y paper

**Entrada (fundador):**
- Subir el nivel matemático, físico y de telecomunicaciones del seguimiento de incendios.
- Masas de aire, densidades y flujos en 3D, con vista cenital, inclinada u horizontal y gestos de dos dedos como en Google Maps.
- Simulación determinista con todos los datos de la zona, incluidas las descargas de los aviones.
- Dashcams, coches y cámaras de seguridad como estación meteorológica; triangulación con cámaras y cartografía topográfica.
- Un paper científico, los huecos del 112 y los canales ciudadanos.
- Confluencia de canales que no se hablan entre sí, y Países Bajos.

**Procesamiento:**
- **Datos reales descargados de AWS Open Data** (scripts en `scripts/datos-reales/`):
  - terreno Copernicus GLO-30;
  - 4 escenas Sentinel-2 (16-07, 24-07, 29-07, 08-08) con color natural, cicatriz dNBR por fecha y combustible por NDVI;
  - meteorología NOAA GFS del 23-07-2026, de 12 a 00 UTC.
  - **Calibración radiométrica corregida:** los metadatos indican un desfase que daría reflectancias negativas.
- **Masa de aire real a las 15 UTC en el km 57 de la M-501:** 36,3 °C, 7 % HR, 23 km/h de 228° (racha 36), capa de mezcla 1946 m, densidad 1,040 kg/m³ e **índice de Haines 6**.
- **Núcleo `atmos3d.mjs`** (9 pruebas):
  - termodinámica: densidad, θ, N², punto de rocío, LCL y Haines;
  - perfiles GFS en cualquier punto y altura;
  - interpolación óptima con Cholesky;
  - OBD-II (PID 0x33 y 0x46);
  - anemometría de flota por rueda libre;
  - barómetros con sesgo por Kalman;
  - **viento 3D con conservación de masa** (Poisson variacional, malla MAC y SOR);
  - pluma de Briggs impuesta, con aspiración emergente;
  - estelas de avión, chorro de rotor y energía de una descarga;
  - partículas de humo y pavesas.
- **Núcleo `fire-field.mjs`** (7 pruebas):
  - llegada del fuego con viento variable en el espacio y el tiempo;
  - conjunto Monte Carlo;
  - Jaccard, Sørensen y habilidad frente al círculo;
  - cámaras: proyección, línea de visión con el DEM, triangulación 3D e inversión del calor desde la columna;
  - parpadeo de llama y sincronización por destellos.
- **`utm.mjs`:** fórmulas de Snyder; error frente a pyproj menor de 1 cm.
- **Corrección importante:** la propagación descartaba frentes por comparar en 64 bits valores guardados en 32 bits. Detectado por las pruebas antes de publicar resultados.
- **Experimento reproducible con datos reales** (`fire3d-real.mjs`):
  - **sin asimilar, el modelo no supera a un círculo** (Jaccard ≤ 0,064 frente a 0,131). Se publica tal cual;
  - **asimilando la cicatriz del 24-07** (giro del viento de 60°, velocidad ×0,35, inicio a las 15:00): Jaccard **0,352** con área ×1,21, dentro de muestra;
  - conjunto: la cicatriz cae en P ≥ 50 % en el 74 % de su superficie sin asimilar y en el 100 % tras asimilar;
  - cámaras en cumbres reales: ninguna ve la base del fuego, pero la columna se triangula a 42 m y la cima a 19 m;
  - flota de 32 coches: viento a 0,96 m/s;
  - barómetros: de 0,39 a 0,15 hPa.
- **Web `/senda/fuego3d`** (three.js, sin conexión):
  - terreno real con la imagen Sentinel-2 de cada fecha;
  - cicatrices reales, gravedad dNBR, frente calibrado y probabilidad antes y después de asimilar;
  - **viento 3D resuelto en el teléfono**, pluma, humo, pavesas y corte vertical de la masa de aire;
  - vista desde cada cámara (se ve la oclusión);
  - coches-estación, pasada de un CL-415 y helicóptero;
  - mapa sinóptico de isobaras reales.
  - **Gestos tipo Google Maps:** un dedo mueve, dos dedos acercan, giran e inclinan; con teclado, flechas, + y −, Q y E, W y S; botones Cenital, 3D, Horizonte, Norte y Fuego.
- **Paper científico** (`docs/paper/`, md, html y pdf, más `/senda/paper`): generado desde los resultados, sin cifras escritas a mano. Incluye métodos con ecuaciones, resultados negativos y positivos, ética y legalidad, madurez honesta (64/100) y el camino a ≥ 80.
- **Investigación** `docs/research/CANALES_SENSORES_Y_HUECOS_112_2026-11-05.md`:
  - accesibilidad del 112 (EAA, texto en tiempo real);
  - 017 de INCIBE, Burgernet y natuurbrandrisico;
  - KNMI con licencia CC BY 4.0;
  - barómetros de móviles (Mass y Madaus, 2014);
  - un evento canónico para unir CAP, DATEX II, C-ITS, OBD-II y satélite.
- **`platforms.mjs`:** 10 integraciones nuevas, cada una con su modo de acceso. Las cámaras privadas solo entran si su titular las cede (CONVENIO), distinto de las cámaras sin permiso (NUNCA).

**Validación:**
- núcleo + relé 223/223;
- **E2E en Chromium 47/47 sin red** (accesibilidad en 26 pantallas);
- web: compilación, idiomas y 98/98.

**Límites:**
- combustible aproximado por NDVI;
- ajuste dentro de muestra (falta validar con otra fecha y su meteorología);
- velocidad terminal y tiempo de combustión de las pavesas supuestos;
- anomalía de presión sintética;
- marco legal de la recepción ADS-B pendiente de verificar;
- sin ensayo de campo.

## SENDA v0.18 · 05-11-2026 · Seguimiento de incendio, entrega para Hostinger y ronda de financiación

**Entrada (fundador):**
- Preparar la ronda de financiación: qué busca un inversor, convocatorias y campañas abiertas, y qué ajustar en el software.
- Una carpeta autocontenida con todos los zips y la web lista para salir de Vercel y subirla a Hostinger por FTP, porque las exportaciones de la sesión no se entienden.
- Seguir con imágenes reales y fuentes públicas.
- Integrar la web de la Comunidad de Madrid con fuegos y cámaras para perimetrar, seguir el avance, la meteorología, la virulencia y la criticidad, y conectarlo con los coches.
- Que satélites, sensores del móvil y todo lo demás funcionen juntos.

**Procesamiento:**
- **Núcleo `fire-watch.mjs` (9 pruebas):**
  - columna de humo situada **cruzando rumbos** de torres, cámaras orientables y la **brújula del móvil** (fórmula W3C DeviceOrientation), con elipse de error y **rechazo de rumbos incoherentes**: < 400 m en 6 semillas, y la brújula descalibrada descartada en 5 de 6;
  - **perímetro por satélite** (envolvente de píxeles VIIRS/MODIS, cota superior), potencia radiativa y biomasa (0,368 kg/MJ, Wooster 2005), y **avance entre pasadas** (25 m/min medido frente a 25 reales);
  - **meteorología del incendio:** 30-30-30, déficit de presión de vapor (Magnus), HDW (Srock 2018), Fosberg con la humedad de equilibrio de Simard e ISI del sistema canadiense FWI;
  - **comportamiento:** intensidad de Byram, longitud de llama y clase de ataque (Andrews y Rothermel);
  - **criticidad** (criterio SENDA, no oficial);
  - **pueblos y carreteras** que alcanzará, y cuándo: corte propuesto por punto kilométrico, tramas HAZARD.FIRE de 24 bytes para los coches, velocidad segura con humo y riesgo de que un coche en llamas inicie un incendio;
  - **fuentes con su modo de acceso:**
    - PASIVO: FIRMS, EFFIS, Sentinel-2, AEMET, ASEM 112 y la brújula del móvil;
    - CONVENIO: las torres del INFOMA y los coches por la Ley de Datos;
    - NUNCA: escuchar las radios de emergencia (TETRA cifrado), volar drones sobre el incendio y las cámaras privadas.
- **Caso real con fuentes:** incendio de San Martín de Valdeiglesias (23-07-2026), iniciado por un coche en llamas en la calzada de la M-501 (km 57), que se unió al de Almorox. La reconstrucción sobre su geografía real va marcada como ilustrativa.
- **Web `/senda/fuego`:**
  - mapa operativo animado: frente, humo, rumbos, elipse, focos de 375 m, perímetro y previsión;
  - la M-501 se corta según avanza el fuego y los coches avisados se detienen antes del tramo;
  - criticidad, calculadora meteorológica, prueba con la brújula del móvil, el caso real y la web de la Comunidad de Madrid (lo verificable y lo que falta).
- **Integración:**
  - arquitectura con el sensor «Brújula y orientación», el núcleo «Seguimiento de incendio», la app y el escenario «Incendio desde la carretera»;
  - 3 fases nuevas en el plan de incendio y el evento `valdeiglesias-2026`;
  - 5 integraciones nuevas en `platforms.mjs`;
  - tarjeta en la portada (es/en/nl);
  - service worker v19;
  - el lector FIRMS conserva el instrumento y el tamaño de píxel.
- **Entrega `entrega/`:**
  - 7 zips **deterministas**, generados por un escritor ZIP propio sin dependencias: web para Hostinger, las dos películas, código, documentación, evidencias y visión;
  - `.htaccess` que replica a Vercel: URL limpias, MIME de `.mjs`, `.vtt` y `.webmanifest`, service worker sin caché, HTTPS y caché inmutable de `_next/static`;
  - `LEEME_PRIMERO` (md y html) paso a paso para hPanel y FileZilla, `MANIFIESTO.json` y `SHA256SUMS.txt`;
  - dominio configurable con `SITE_URL`.
- **Financiación:** `docs/financiacion/RONDA_FINANCIACION_2026-11-05.md`, con convocatorias abiertas y próximas con fecha y fuente, qué mira un inversor, ajustes del software P0-P2, riesgos con respuesta, índice del data room y plan de 90 días.

**Validación:**
- núcleo + relé 207/207;
- E2E en Chromium 46/46, sin red, con accesibilidad en 25 pantallas;
- **la misma E2E contra la exportación servida por Apache con el `.htaccess`**;
- web: compilación, idiomas y 98/98;
- zips verificados con `unzip -t`.

**Límites:**
- La red de la sesión bloquea FIRMS, Worldview, Open-Meteo, AEMET, EFFIS y comunidad.madrid, así que no hay imagen de satélite real del incendio de julio.
- La web de la Comunidad de Madrid que recuerda el fundador sigue sin localizarse: hace falta su URL.
- Coeficientes de combustible y del error de las brújulas, supuestos.
- Sin ensayo de campo.

## SENDA v0.17 · 05-11-2026 · Visión con vídeo real, coches conectados, fusión de posición y renders realistas

**Entrada (fundador):**
- Simuladores y renders menos infantiles.
- Proyectos de Python que siguen vehículos en cámaras: probar con imágenes reales cuánto tráfico hay por minuto, en qué tramo y cuándo se acerca.
- Integrar coches conectados y eléctricos (datos a los fabricantes, acuerdos con marcas, módulos de emergencia) con el resto de puntos (aerogeneradores, Wi-Fi, otros coches, Waze, Google Maps, radares, satélite).
- Diseñar el backend de conexión.

**Procesamiento:**
- **`packages/senda-vision/` (Python, nuevo):**
  - detector **YOLOX-s en ONNX (Apache 2.0)** sin PyTorch y seguimiento **ByteTrack** (supervision 0.26.1, MIT);
  - dibujo sobrio: esquinas, etiquetas, estelas y panel con la tipografía Inter;
  - `track_fixed.py`: conteo por sentido en una línea y ritmo por minuto;
  - `track_dashcam.py`, el coche como sensor:
    - tiempo hasta alcanzarlo sin calibrar, por la altura de la caja;
    - distancia estimada por la altura de un turismo;
    - vehículos de la calzada contraria contados como contactos del SOS;
    - filtros de artefactos (cajas en el borde, acercamientos de más de 25 m/s).
  - Ultralytics se descarta para el producto por su licencia AGPL-3.0.
- **Vídeos reales procesados y publicados** en `/media/vision/`:
  - cámara a bordo (Udacity, MIT): 12 vehículos seguidos en 36 s, 15 contactos por minuto de la calzada contraria y ningún falso «¡Frena!»;
  - cámara fija (Intel, CC BY 4.0): 1 vehículo en 30 s en un aparcamiento, presentado como dato real.
- **Núcleo `vehicle-link.mjs` (6 pruebas):**
  - fuentes con su base legal: Ley de Datos de la UE (art. 5), DFRS/SRTI, OBD-II, Android Automotive, cámaras, aforos, V16 y Waze; el eCall y la reidentificación son NUNCA;
  - 8 categorías SRTI y eventos del coche → avisos;
  - **k-anonimato** por celda de vía y franja de tiempo;
  - velocidad por tramo con **Kalman** y varianza que crece con la edad del dato;
  - **posición por mínimos cuadrados con GNSS, vía, rumbo a un aerogenerador, Wi-Fi con tiempo de vuelo y otro coche**: de ~10 m a **0,3–2,1 m** en 6 semillas;
  - puentes entre la visión y el núcleo.
- **Render:** el kit de lienzos dibuja coches y camiones con volumen (sombra, degradado, lunas, retrovisores, faros, pilotos de freno con brillo), asfalto con textura y marcas viales, choque vectorial y personas sin rasgos.
  - Aplicado a la cadena de frenadas, el sentido contrario, la escena PAS, la retención de la DGT y el rood kruis.
  - Fuera los emojis de las animaciones de carretera.
- **Web:** `/senda/trafico` (vídeos reales con sus métricas y cómo se conecta todo) y `/senda/vehiculos` (fuentes, fusión de posición paso a paso, velocidad por tramo, privacidad y arquitectura). Además, arquitectura (2 piezas y 2 aplicaciones), portada (es/en/nl), service worker v18 y E2E.
- **Documento:** `docs/architecture/BACKEND_VEHICULOS_Y_FUSION_2026-11-05.md`.

**Validación:** núcleo + relé 198/198 · E2E en Chromium 45/45, sin red (accesibilidad en 24 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- No hay vídeo real de autovía con cámara fija y licencia libre accesible desde esta sesión: el conteo de alta densidad queda para las cámaras públicas reales.
- Distancias aproximadas (±30 %).
- Carril propio marcado a mano.
- Adaptadores reales de fabricantes, DFRS y Android Automotive pendientes de convenio y de verificar.
- La escena 3D de la frenada sigue pendiente.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.16.1 · 05-11-2026 · Vídeo «ruta» publicado en español e inglés

**Entrada (fundador):**
- Grabar y publicar el vídeo `ruta` en español, ya validado.
- Hacer la versión inglesa con las mismas cifras y la misma honestidad: «synthetic image», «invented road», «SENDA never replaces 112».
- Enlazarlos en la portada y en `/senda/arquitectura` sin quitar los vídeos existentes.

**Procesamiento:**
- Máquina: kokoro-onnx 0.6.1, modelos `kokoro-v1.0.onnx` y `voices-v1.0.bin` (lanzamiento `model-files-v1.0`) y ffmpeg.
- Español: `CORE=192 E2E=43 ./make.sh ruta es publicar` → `investor-next/public/media/senda-ruta-es.mp4` (3:29, 8,2 MB), `.vtt` y póster.
- Inglés: `title.en`, `en` y `en_say` en las 12 escenas de `ruta.json`, con el mismo número de frases que `es`. Voz `bf_emma` (en-gb), 3:38.
  - Los rótulos dibujados en los lienzos de la app siguen en español. Por eso la narración inglesa dice en voz alta lo que en español solo aparece en pantalla: «In this simulation» (SOS sin cobertura), «The road shown is invented» (PK) e «In this example» (aforos).
- Web:
  - **Portada (es/en/nl):** bloque nuevo `#ruta` bajo la película. Muestra el vídeo del idioma (en `nl`, el inglés con subtítulos neerlandeses por defecto) y el otro idioma desplegable, cada uno con sus propias pistas de subtítulos.
  - **`/senda/arquitectura`:** tarjeta nueva tras la del vídeo de capacidades, con el vídeo español y el inglés desplegable.
  - **`/senda/carretera`, visualización `sos`:** ciclo de 20 → 24 s. La escena inglesa dura 22,2 s y el contador volvía a «minuto 0,8» justo antes del corte; ahora mantiene el resultado final («SOS fuera de la zona sin red a los 7,4 min»). El vídeo español no cambia: todos sus fotogramas caen antes del segundo 20.
  - Service worker `senda-campo-v18`, para que quien ya tenga la app instalada reciba `arquitectura` y `carretera` nuevas.
- **Integración con el commit paralelo `692a3a8`**, que hizo la misma tarea mientras tanto:
  - se conservan sus subtítulos `nl`, alineados con este audio inglés solo donde el contenido cambia (simulación, carretera inventada, imagen sintética, «vervangt nooit 112», un carril por sentido, Guardia Civil y DGT), y su sección de vídeos en `/senda/carretera`;
  - el texto inglés y los MP4 son los de esta entrada: el inglés remoto no decía «synthetic image», «invented road» ni «SENDA never replaces 112», y su render no mostraba los emojis de los lienzos;
  - `senda-ruta-nl.vtt` se ha regenerado con los tiempos de esta voz inglesa (23 cues, mismos tiempos que `en`). El commit `692a3a8` sigue en el historial.
- Kit de vídeo:
  - `make.sh` publica también `senda-<guion>-nl.vtt` cuando `voice.py` lo acaba de generar.
  - `validate.mjs` ya no marca como promesa prohibida un aviso **negado** («SENDA never replaces 112», «nunca sustituye al 112»). La afirmación sigue bloqueada (probado con un guion de prueba).
  - `voice.py` solo genera subtítulos `nl` si todas las escenas los traen (antes fallaba con `ruta.json` en inglés).
  - Guía: `--stills` necesita `SCRIPT=<guion>`.

**Validación:**
- `validate.mjs ruta es|en` sin errores; `script` y `features` siguen validando.
- Subtítulos es/en: 23 cues cada uno, idénticos a las frases leídas y sin fonética (comprobación automática).
- Fotogramas sueltos de las 12 escenas (arranque, mitad y final en 3 de ellas): sin pantallas en blanco ni textos cortados; `verify` muestra 192/192 y 43/43.
- La voz publicada es idéntica bit a bit a la revisada; el MP4 publicado frente al revisado da un PSNR de 47 dB.
- Núcleo + relé 192/192 · E2E en Chromium 43/43, sin red (accesibilidad en 22 pantallas) · web: compilación, idiomas (es/en/nl) y 98/98.
- Portada (es/nl) y `/senda/arquitectura` compiladas: cada vídeo nuevo, su póster y su `.vtt` responden 200; capturas en escritorio y en móvil (390 px) sin solapes.

**Límites:**
- En el vídeo inglés, los rótulos de los lienzos de las páginas de la app están en español (los títulos, la escena 3D, `verify` y el cierre sí salen en inglés).
- En r5, r7, r8 y r9 la animación de la página vuelve a empezar dentro de la escena, en los dos idiomas: es el bucle normal de cada página. Ya estaba así en el español validado.
- Quedan pequeños solapes en los lienzos de la app: «tú» sobre «EST-1» (`dgt`), «Ana · coordina» pegado a «Luis» (`carretera`, escena) y la línea de la calzada sobre «en sentido contrario».
- La lista «lo que falta» de la escena `verify` es la genérica de `film.html` (pilotos, auditoría, certificación) y no la que se narra (ensayos en carretera, app nativa, convenios con la DGT).

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.16 · 05-11-2026 · Infraestructura de la DGT validada y traspaso completo con kit de vídeo

**Entrada (fundador):**
- Seguir con los últimos toques de la DGT.
- Comprobar si los puntos móviles y los radares de la DGT, como posibles pasarelas o emisores, pueden sumarse a SENDA.
- Redactar el traspaso completo para otras IA, con la capacidad de hacer los vídeos 3D con una IA más barata.

**Validación de la idea (con fuentes):**
- **Ningún equipo de la DGT en la vía es una pasarela utilizable** (radares, paneles, cámaras, aforos, postes SOS, balizas V16). Cada uno habla con la DGT por un canal propio y cerrado; usarlo para transmitir sería entrar en un sistema ajeno.
- La única vía oficial es **DGT 3.0 por convenio**.
- **Detectar radares está prohibido desde 2014** (multa y 3 puntos; la cuantía es de 200 o 500 € según la fuente, pendiente del BOE) e **inhibirlos se sanciona con hasta 6.000 € y 6 puntos**.
- **Avisar de la ubicación publicada de un radar fijo es lícito**, como hacen los navegadores.
- Los postes SOS: la DGT anunció en 2010 la retirada de la mayoría y dejar los de zonas sin cobertura; no hay listado actual.

**Procesamiento:**
- Núcleo `dgt-infra.mjs`:
  - catálogo de 10 equipos con lo que emiten, si son pasarela, lo que suman a SENDA, el permiso y la nota legal;
  - zona de control publicada con deceleración hasta el límite;
  - radar de tramo con la media y el aviso; nunca sugiere superar el límite;
  - aforos → final de la retención y su onda de choque;
  - texto de los paneles (es/nl) → aviso.
- `datex2.mjs`: medidas de estaciones de aforo (MeasuredDataPublication) y paneles, con ejemplos construidos según el esquema.
- `platforms.mjs`: integraciones de radares publicados y aforos o paneles (PASIVO) y detección de radares o controles móviles (NUNCA).
- 4 pruebas nuevas.
- Web `/senda/dgt`: equipo por equipo, aforos → cola (modo película), radares publicados con el límite y paneles. Además, arquitectura, portada (es/en/nl), service worker v17 y E2E.
- Vídeo:
  - `media/senda-film/validate.mjs` comprueba el guion antes de gastar CPU;
  - `make.sh` hace todo de un comando: validar, voz, imagen, mezcla y publicación;
  - nuevo guion `ruta.json` (12 escenas, 3:29), con la voz ya generada y fotogramas de muestra revisados.
- Traspaso:
  - `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md`: estado, mapa, principios, procedimiento, despliegue, bloqueos, decisiones y mensaje de arranque;
  - `docs/handoff/07_VIDEOS_3D_RUNBOOK.md`: guía de vídeo para una IA más barata.

**Validación:** núcleo + relé 192/192 · E2E en Chromium 43/43, sin red (accesibilidad en 22 pantallas) · web: compilación, idiomas y 98/98 · guion `ruta.json` validado, voz generada y fotogramas correctos.

**Límites:**
- La red de esta sesión bloquea los portales de la DGT y de NDW: aforos y paneles, probados con ejemplos construidos según el esquema.
- Vídeos `senda-ruta-es.mp4` y `senda-ruta-en.mp4` (con subtítulos `es`, `en` y `nl`) grabados y publicados en `investor-next/public/media/`.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.15 · 05-11-2026 · Situaciones al volante, V16 + SENDA, cámaras públicas y exportación a Países Bajos

**Entrada (fundador):**
- La V16 conectada siempre está activa y con SIM: SENDA le da el sentido que le falta.
- Cubrir todas las situaciones al volante.
- Integrar los datos de la DGT y de Países Bajos (carriles cortados, desvíos, obras, Waze) como primera exportación.
- Un módulo de cámaras públicas (DGT y otras fuentes, repositorios abiertos).
- Mi opinión sobre el proyecto y cómo acotarlo.

**Procesamiento (núcleo: 3 módulos nuevos, 16 pruebas más):**
- `drive-cases.mjs`: catálogo de 20 situaciones, cada una con su señal, acción, fuente, estado y permiso.
  - **Sentido contrario:** lo detecta el propio móvil con tres posiciones contra la calzada, y calcula el tiempo hasta cruzarse.
  - **Final de retención:** onda de choque de Lighthill-Whitham-Richards (−14,3 km/h en el ejemplo) y punto de encuentro.
  - **Niebla y firme:** velocidad para parar dentro de lo que se ve (50 m: 64 km/h en seco, 53 en mojado) y distancias con el rozamiento.
  - **Curvas:** radio exacto desde la geometría y velocidad AASHTO; la horquilla de 40 m da 30 km/h.
  - Fatiga, caída de motorista y agua en la calzada (umbrales del servicio meteorológico de EE. UU.).
  - **V16 + SENDA (`v16Fusion`):** la baliza dice dónde y SENDA dice qué pasa. Un choque sin baliza pide encenderla.
- `datex2.mjs`:
  - lector DATEX II (v2 y v3, con o sin prefijos) para cualquier Punto de Acceso Nacional (Reglamento Delegado (UE) 2022/670);
  - conversión a avisos SENDA y pasillo de la ruta;
  - **señales de carril neerlandesas (rood kruis)** con aviso en neerlandés, español e inglés;
  - nuevo `scripts/datex-pack.mjs` para que el relé descargue DGT o NDW.
- `cameras.mjs`:
  - fuentes con licencia y permiso; las cámaras sin permiso, los agregadores tipo «Ojo de Dios» y la biometría quedan en NUNCA, y Rijkswaterstaat solo por convenio;
  - **visibilidad en metros** por canal oscuro y ley de Koschmieder, con un error menor del 15 % y del lado prudente;
  - índice de nieve.
- `road-guard.mjs`: tipos nuevos de peligro (carril cerrado, sentido contrario, puente abierto, inundación, incendio) y relevancia del sentido contrario.
- `platforms.mjs`:
  - **perfiles de país España y Países Bajos** y `countryPlan`;
  - integraciones: feed de Waze y NDW, cámaras abiertas, cámaras sin permiso (NUNCA) y SIM de la V16 (NUNCA).

**Web:**
- `/senda/camaras`: visibilidad medida en una cámara (modo película), prueba con la cámara del teléfono y fuentes con su permiso.
- `/senda/paises`: perfil por país, rood kruis hablado (modo película), lector DATEX II en el navegador y lista para el piloto neerlandés.
- `/senda/carretera`: V16 + SENDA, retención en un diagrama espacio-tiempo (modo película), sentido contrario (modo película), catálogo de situaciones y calculadoras.
- Arquitectura: 3 piezas, 2 aplicaciones y el escenario «Países Bajos».
- Portada (es/en/nl) y service worker v16.

**Validación:** núcleo + relé 188/188 · E2E en Chromium 42/42, sin red (accesibilidad en 21 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- La red de este entorno bloquea `nap.dgt.es` y `*.ndw.nu`. El lector se ha probado con una publicación construida según el esquema, no con datos reales.
- El formato exacto del feed de señales de NDW está pendiente.
- Las imágenes de cámaras deben leerse desde el relé (el navegador no puede leer píxeles de otro dominio) y cada cámara necesita calibrar su referencia.
- Datos de la V16 (cada 100 s, conectividad) según fabricantes y prensa.

**Decisiones del fundador:** las del documento `docs/evaluacion/FOCO_Y_ACOTACION_2026-11-05.md`.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.14 · 05-11-2026 · Ruta protectora: carretera, frenadas, SOS sin cobertura y coordinador de escena

**Entrada (fundador):** el escenario de los accidentes de coche. SENDA como «senda protectora» que va contigo en el viaje, con permisos al instalar. Integración con Waze y Google Maps y mapas sin conexión. Posición con GPS, telemetría y aerogeneradores. Aviso automático de «frena» si el coche de delante frena de golpe. Avisos de carretera más fáciles. Coordinador ciudadano del accidente con puntos cívicos.

**Procesamiento (núcleo: `road-guard.mjs`, 14 pruebas, más 1 de plataformas):**
- **Frenada brusca** por la velocidad Doppler del GNSS, ajustada por mínimos cuadrados en una ventana de 1,5 s. No depende de cómo vaya colocado el móvil. Por encima de ~13 m/s² ya no es una frenada (un coche frena hasta ~1 g): se trata como golpe.
- **Choque de coche**: el detector de `rail-incident.mjs` con umbrales de coche y cuenta atrás humana.
- **Trama de aviso de 24 bytes**: con las cabeceras suma 31 bytes, un anuncio Bluetooth LE clásico. Lleva relés con tope de saltos.
- **Relevancia del aviso**: mismo sentido, delante y en el mismo carril. Con geometría de la vía se mide la distancia por carretera.
- **Consejo de frenada**: a = v²/2(d − v·t − margen). «¡Frena!» por encima de 3,4 m/s² (deceleración de diseño de AASHTO).
- **Columna de coches con cinemática exacta.** Con 1,2 s entre coches a 120 km/h y niebla:
  - sin SENDA, choque en cadena de 5 coches (hasta 90 km/h de impacto);
  - con SENDA, solo choca el de justo detrás;
  - con 2 s de separación no choca nadie.
- **SOS sin cobertura**: probabilidad de contacto al cruzarse y entrega por los coches que pasan (Poisson). Simulación determinista de una carretera de montaña de 24 km con 18 km sin red y un 10 % de coches con SENDA:
  - el SOS sale en 7,4 min;
  - los que se acercan con SENDA se enteran a una mediana de 6,5 km, gracias al tráfico contrario.
- **PK y sentido sin red**: encaje en la vía, interpolación entre hitos, referencia visible más cercana con su lado («300 m después del aerogenerador AE-12, a la derecha») y estima en túneles.
- **Pasillo de mapas de la ruta**: Madrid–Valencia ocupa 62 MB frente a 951 MB del rectángulo (6,5 %).
- **Avisos de un toque** con creencia bayesiana que se apaga sola, y exportación al formato CIFS de Waze (solo con convenio; campos por validar).
- **SMS de SOS** de 160 caracteres como máximo y guion para el 112.
- **Coordinador de escena PAS**:
  - nadie se confirma a sí mismo;
  - el traspaso solo va a una credencial institucional verificada;
  - los **puntos cívicos** quedan en un libro encadenado por SHA-256 que delata cualquier alteración.
- `platforms.mjs`:
  - plataforma «Coche particular»;
  - integraciones: enlaces a Waze y Google Maps y NAP DGT (PASIVO); DGT 3.0 y Waze CIFS (CONVENIO); leer navegadores (NUNCA);
  - plan «Accidente de carretera» con salvaguarda;
  - hecho «carreteras-2025».

**Web:**
- `/senda/carretera`, con cuatro simulaciones en modo película: cadena de frenadas, SOS que viaja, PK en el idioma del 112 y escena con puntos.
- Sensores reales del teléfono (GPS y acelerómetro) con el mismo detector y aviso por voz.
- Botones reales a Waze y Google Maps y tabla de accesos.
- Avisos de un toque con su trama y su CIFS.
- Arquitectura: pieza «Ruta protectora», aplicación «Carretera» y escenario «Accidente de carretera». El sensor GNSS deja de estar en la hoja de ruta.
- Portada (es/en/nl), SENDA Campo y service worker v15.

**Validación:** núcleo + relé 172/172 · E2E en Chromium 39/39, sin red (accesibilidad en 19 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- No lee datos de Waze ni de Google Maps, porque no hay API pública para ello. Les hace llegar avisos por DGT 3.0 o por Waze for Cities, con convenio.
- La difusión Bluetooth entre coches necesita la app nativa: la web no puede anunciar.
- Umbrales y alcance de radio entre coches pendientes de medir en ensayo real.
- Carretera, hitos y aerogeneradores de la demostración son inventados.
- Nunca sustituye la atención del conductor, la distancia de seguridad, el eCall ni el 112.

**Decisión pendiente del fundador:** qué reconocen los puntos cívicos y si hay clasificación pública (por defecto, no).

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.13 · 05-11-2026 · Batería de Internet: reserva de red, biblioteca de vecinos y puntos de rebote

**Entrada (fundador):** que los móviles que ya tienen SENDA guarden una especie de batería, pero de Internet (~1 GB), y la usen como si fuera la red; además, gateways y puntos de rebote para cuando no hay cobertura.

**Procesamiento (núcleo, 3 módulos nuevos, 11 pruebas):**
- `net-reserve.mjs`: catálogo por zona y riesgo y mochila 0/1 exacta por valor y frescura. 1 GB cubre el 95,7 % del valor y lo esencial cabe en 200 MB. Incluye semivida de lo urgente, recarga por densidad en ventanas cortas, recarga por difusión y cola de intenciones.
- `swarm-cache.mjs`: paquete común repartido con Reed-Solomon k-de-n entre vecinos (6 GB entre 40 vecinos: 462 MB por móvil, 99,2 % de recuperación). Inventario con filtro de Bloom (2000 piezas en 2,4 KB) y piezas nombradas por SHA-256, con ida y vuelta real verificada.
- `coverage-memory.mjs`: huellas de cobertura agrupadas por antena, supervivencia sin luz, Tobler y tiempo esperado hasta enviar. Elige un cerro con antena de grupo electrógeno frente a la plaza (antenas agotadas) y frente a esperar al satélite.
- `platforms.mjs`: integraciones OpenCellID, Kiwix, huellas propias (PASIVO) y difusión (CONVENIO); plan «Días sin red».

**Web:**
- `/senda/reserva`: batería animada; **almacenamiento real del dispositivo** (`storage.estimate`, `storage.persist`, batería y tipo de conexión); botón que llena de verdad la reserva con la app; biblioteca de vecinos y puntos de rebote con modo película.
- Arquitectura: 3 piezas nuevas y el escenario «Tres días sin red».
- Portada (es/en/nl), SENDA Campo, service worker v14.

**Validación:** núcleo + relé 157/157 · E2E en Chromium 38/38 (accesibilidad en 18 pantallas) · web: compilación, idiomas y 98/98.

**Límites:**
- Sin red no se puede consultar contenido nuevo de Internet: se usa lo guardado y lo nuevo se encola.
- Mapas detallados, albergues y hospitales necesitan el servidor de contenidos de SENDA (pendiente).
- El transporte de fragmentos entre vecinos y la recogida de huellas reales requieren la app nativa.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.12 · 05-11-2026 · Arquitectura multiplataforma, sentidos ampliados, riadas, triaje, monte y dron casa por casa

**Entrada (fundador):**
- Auditoría desde 5 perspectivas.
- Preparar SENDA para varias plataformas (móvil, ordenador, dron, ferrocarril), también sin acceso a sistemas de terceros.
- Tener en cuenta las tragedias recientes de España y Europa.
- Más «sentidos» reales (dron casa por casa, respiración por Wi-Fi).
- Más escenarios: terremoto, maremoto, conflicto, evacuación de heridos, monte, riadas.
- Infraestructura e ideas de inversión.
- Arquitectura primero; después la web y los vídeos.

**Procesamiento (núcleo, 6 módulos nuevos, 21 pruebas):**
- `platforms.mjs`: plataformas donde corre SENDA, integraciones con modo de acceso (PASIVO = legal hoy · CONVENIO · NUNCA), planes por escenario (8) con planificador de cobertura y lecciones de catástrofes reales con fuente.
- `flood-watch.mjs`: hidrograma de Nash, embalse y alarma por subida aguas arriba. En el escenario sintético, 2 h 30 y 3 h 40 de margen en pueblos donde caen 3 mm. Maremoto con √(g·h) y evacuación vertical.
- `triage.mjs`: START para varias víctimas, RCP para una sola (Consejo Europeo de Resucitación 2021), qué hacer ya, servicios (112 primero) y parte ≤ 160 caracteres. Nunca declara fallecidos.
- `geo-offline.mjs`: resección con rumbos a marcas conocidas (aerogeneradores con luces de balizamiento, antenas, campanarios) con elipse de error, detección de pasos, estima por pasos y tamaño de mapas sin conexión.
- `senses.mjs`: escucha coral (golpes localizados con 5 móviles y relojes desfasados, < 0,5 m tras el pitido de sincronía) y modo detector de avalancha para la baliza Bluetooth.
- `house-sweep.mjs`: dron casa por casa, con orden de visita (vecino más cercano + 2-opt), salidas por batería con reserva y tablero de prioridad (personas probables × daño EMS-98).

**Web (5 pantallas nuevas, con «modo película» `?film=1&viz=` grabable desde la app real):**
- `/senda/sentidos`, `/senda/agua`, `/senda/triaje`, `/senda/monte`, `/senda/barrido`.
- `/senda/arquitectura`: 12 piezas nuevas, 3 escenarios nuevos (riada, monte, múltiples víctimas) y la sección «Plataformas, permisos y planes por escenario» con planificador interactivo.
- Portada (es/en/nl), SENDA Campo, service worker v13.

**Correcciones honestas registradas:**
- Los NOAA con imagen APT se dieron de baja en 2025.
- La respiración por Wi-Fi a través de muros no tiene validación independiente.
- Interrogar aerogeneradores u otra infraestructura ajena queda en NUNCA; usarlos como marcas visibles es PASIVO.

**Vídeo de capacidades (español, 4:13):** grabado fotograma a fotograma desde las propias páginas en modo película (`media/senda-film/features.json`); publicado en `/senda/arquitectura` con subtítulos.

**Auditoría:** `docs/evaluacion/AUDITORIA_5_PERSPECTIVAS_2026-11-05.md` (TRL por capacidad, 5 perspectivas simuladas, huecos, multiplataforma, infraestructura, modelo de negocio, 90 días).

**Validación:** núcleo + relé 146/146 · E2E en Chromium 37/37 (accesibilidad en 17 pantallas) · web: compilación, idiomas y 98/98.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.11 · 04-11-2026 · Malla de voz, despliegue físico y película v5 con simulaciones y 3D

**Entrada (fundador):**
- Seguir creando una arquitectura nueva, pero real, funcional y llevable al plano físico.
- Rehacer la película (inglés y español) incluyendo lo nuevo.
- Que la película se centre en cómo funcionan las simulaciones, los renders 3D, la arquitectura y la app, y en lo fácil que es usarla.

**Procesamiento:**
- `voice-mesh.mjs` (núcleo, nuevo): cadena y sala de voz entre teléfonos que no se alcanzan todos entre sí.
  - Árbol de repetidores con los saltos mínimos.
  - Quien tiene poca batería participa pero nunca repite.
  - Turno de palabra tipo walkie-talkie: 1 flujo por enlace sea cual sea el tamaño de la sala.
  - Replanificación por batería con aviso de quién queda aislado.
  - 5 pruebas.
- `/senda/llamada`: nueva sección «Cadena de voz».
  - Edificio con el árbol elegido y botón «Iker se queda sin batería».
  - Demo real A → B → C en una pestaña con cuatro conexiones WebRTC: C oye el tono de 440 Hz de A (441 Hz medidos) a través de B, y el chat llega reenviado.
- `/senda/arquitectura`: añadidos la pieza «Malla de voz», el escenario «Cadena de voz» y la tabla «Del plano al mundo físico», que dice para cada pieza qué existe hoy y qué falta.
- Película v5 (español 8:36, inglés 8:22; subtítulos es/en/nl): la v4 íntegra más 4 escenas calculadas con el núcleo real (`media/senda-film/sims.js`).
  1. Llamar sin Internet: el código de 91 bytes se convierte en su partitura real de tonos, la conexión es directa y sigue la cadena de voz.
  2. Censo con dron en 3D (three.js): edificio, dron, anuncios Bluetooth y panel con direcciones frente a teléfonos y personas.
  3. Arquitectura en 3D: las 5 capas con el estado real de cada pieza y paquetes recorriendo 4 escenarios.
  4. «Cada imagen es el código real»: código del núcleo ejecutándose, pruebas automáticas, render determinista y «un toque».
- Subtítulos sin fonética: el texto que se pronuncia (`<lang>_say`) va separado del que se lee. Por ejemplo, la voz dice «Rid Sólomon» y el subtítulo muestra «Reed-Solomon».

**Validación:** núcleo 123/123 + relé 2/2 · E2E en Chromium 32/32 (incluida la cadena de voz real) · web: compilación, idiomas y 98/98.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.10 · 04-11-2026 · SENDA como canal de comunicación: llamadas sin Internet, censo radio con dron y arquitectura visible

**Entrada (fundador):** que la app no sea solo sonido sino un canal de comunicación de verdad (llamar y comunicarse en general), que use los sensores del teléfono y de los drones (estimar por radio cuántas personas hay en un edificio), centrarse en la arquitectura del sistema de forma visual y funcional, e inventar tecnología nueva.

**Procesamiento:**
- `sdp-compact.mjs` (núcleo, nuevo): señalización WebRTC compacta. Plantilla común (Opus + canal de datos) y solo lo variable en binario: claves ICE, huella SHA-256 DTLS, rol y candidatos host (IPv4 o mDNS). Oferta 79–103 bytes (~20 veces menos que el SDP), transmitible por el módem acústico en 8–10 s o como código de texto. 4 pruebas.
- `/senda/llamada`: llamada de voz y chat cifrados (DTLS-SRTP) entre dos teléfonos de la misma red local o punto de acceso, sin Internet ni servidor: crear/responder, enviar y escuchar el código por sonido, copiar/compartir, pulsar para hablar, colgar, ida y vuelta, pérdidas, kbit/s y botón «Estoy atrapado». Incluye una **llamada de prueba en un solo dispositivo** (sin micrófono) con la «partitura» de tonos del código.
- `rf-census.mjs` (núcleo, nuevo): censo radio por planta. Planta por RSSI mediano; teléfonos = máximo de direcciones simultáneas por familia (inmune a la rotación de direcciones BLE); personas por **inferencia bayesiana exacta** (0/1/2 teléfonos por persona, hipótesis 12 %/8 % pendiente de calibrar) con mediana e intervalo del 90 %; «0 teléfonos» = «0, quizá 1». Solo recuentos. Escenario sintético realista (personas sin móvil o con dos; generador mulberry32). 8 pruebas.
- `/senda/dron`: fachada en vivo con el dron y los anuncios Bluetooth, tabla por planta (direcciones vs teléfonos vs personas vs verdad simulada), línea de tiempo «cada fila un dispositivo, cada segmento una dirección», distribución posterior, el dron como plataforma de sensores con estado honesto, y privacidad/ley.
- `/senda/arquitectura`: 5 capas (sensores y radios → portadores → núcleo → aplicaciones → destinos), 35 piezas con estado real (navegador / simulación / app Android / app nativa / hoja de ruta), 6 escenarios animados paso a paso (llamada, atrapada tras un sismo, dron, satélite, incendio, vía), ficha de cada pieza con código y enlace, matriz de sensores Android con interfaz y permiso, y fuentes.
- Investigación: `docs/research/SENSORES_Y_CANALES_ANDROID_2026-11-04.md` (Science 2025 sobre alertas sísmicas Android, Wi-Fi Aware, límite de 200 Hz de Android 12, BarcodeDetector, Wi-Fi RTT; infrarrojos descartado como canal).
- Integración: tarjetas nuevas en la portada (es/en/nl), accesos desde SENDA Campo, service worker v11 con las tres pantallas precargadas, E2E ampliada.

**Validación:** núcleo + relé 120/120 · E2E en Chromium 31/31 con las nuevas comprobaciones (llamada con oferta por onda acústica real, voz y chat, cero peticiones de red durante la llamada; demo en un dispositivo; dron; arquitectura; accesibilidad en 12 pantallas). Límite declarado: la emulación «offline» de Chromium también bloquea WebRTC local, así que la llamada se prueba sin ningún servidor y con cero peticiones; falta ensayo con dos teléfonos físicos.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.9 · 04-11-2026 · Corrección de rumbo: portada restaurada, Ojo de SENDA, incendio cartográfico y película v4

**Entrada (fundador):** la v0.8 bajó el nivel. Volver a la portada anterior con sus explicaciones largas; que «ver como» cambie la página de verdad; explicar el globo (satélites, casos y módulos); película con introducción, en inglés y español, al nivel de la v3.

**Procesamiento:**
- Portada restaurada tal como estaba (todas las secciones). Retirados la portada condensada, `/lab`, los cuadros de demos y la película/reels v0.8.
- `audience-filter.tsx`: «Ver la página como» Todo · Ciudadanía · Coordinación · Ingeniería · Inversión. Cada perfil ve su recorrido completo (9–13 secciones, con sus explicaciones) y «Todo» la página entera (20).
- `/senda/ojo` (spec 03): globo en tiempo real con Iridium (66, LEO), Galileo (24, MEO) y QO-100 (GEO), 7 casos reales con fuente y módulos, ruta del aviso caso → satélite → relé → 112 con elevación, distancia y latencia, plan k-de-n con los canales que quedan; terminador día/noche exacto. Incrustado en la portada con explicación en es/en/nl.
- `/senda/incendio`: relieve sombreado, curvas de nivel, vegetación continua, frente con resplandor y humo, isócronas por marching squares, antenas con cobertura, línea de tiempo y explicación larga con fuentes. Paisaje sintético con manchas de combustible continuas (antes, ruido por celda).
- Película v4 = v3 íntegra + 4 escenas (Ojo de SENDA, ver lo que no se ve, vías, incendio) con capturas reales y voz Kokoro de precisión completa (fp32) en es y en; subtítulos es/en/nl.

**Validación:** núcleo + relé 108/108 · E2E sin red 27/27 (Ojo e incendio incluidos, accesibilidad en 9 pantallas) · web: compilación, idiomas y 98/98.

**Lección registrada:** «acortar» no es «sustituir»; antes de retirar contenido, preguntar.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.8 · 04-11-2026 · Portada en vivo por niveles, incendio forestal, película y reels

**Entrada:** web más corta e inmersiva, con demostraciones en vivo de cada innovación; foco en incendios, vías, comunicación sin red, seguridad y satélite; material audiovisual para inversión.

**Procesamiento:**
- `wildfire.mjs` (núcleo): tiempo mínimo de llegada del fuego (Dijkstra, elipse de viento, pendiente con forma de Rothermel), FIRMS, y cruce con antenas: si la antena de un pueblo cae antes de su hora límite de aviso, la alerta sale antes o por portadores sin red (`planMultiBearer`). 7 pruebas. Corregido un fallo de precisión Float32 en el montículo que detenía la propagación sin viento.
- `investor-next/public/senda/home/demos.mjs`: 7 demos deterministas `render(t)` sobre el núcleo (malla, k-de-n, cifrado WebCrypto real, fusión, incendio, vía, órbitas con costas Natural Earth). Las mismas demos alimentan la web y los vídeos.
- Portada nueva `senda-experience.tsx` (es/en/nl): selector de nivel (ciudadanía, coordinación, ingeniería, inversión), 6 capítulos con demo en vivo, película y reels, algoritmo, inversión y verdad declarada. El laboratorio anterior completo pasa a `/lab` (en/es/nl) sin perder nada.
- `media/senda-promo`: guiones, voz Kokoro local, compositor `promo.html`, render por tramos, publicación. Película para inversores (16:9) y 3 reels (9:16) en es/en.

**Validación:** núcleo + relé 108/108; E2E sin red; web: compilación, idiomas y 98/98; capturas de control de escritorio, móvil y fotogramas de vídeo.

**Salida:** `/` `/es/` `/nl/` nuevas; `/lab/`; `public/media/promo/*`.

**Siguiente:** combustibles reales (SIOSE/CORINE) y AEMET para el incendio; TLE reales en la demo orbital; medición Lighthouse de la portada nueva.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## SENDA v0.7 · 04-11-2026 · Motor de fusión de evidencias, visión por capas y vigilancia ferroviaria

**Entrada:** convertir «una cámara que vea a través de las paredes no existe» en algo construible y verificable; prevenir accidentes ferroviarios con datos que ya existen.

**Procesamiento:**
- `occupancy.mjs`: fusión bayesiana por persona + OR ruidoso por vivienda; intervalo por rango de parámetros; traza en decibanes; «≥98 %» solo con dos familias independientes; prioridad = probabilidad × riesgo EMS-98.
- `rescue-scenario.mjs`: verdad conocida para medir calibración (Brier, fiabilidad) y adaptador al edificio 14.
- `sensor-fabric.mjs`: catálogo de 17 dispositivos con permiso legal; barometría diferencial; planificador de la siguiente medida por bits/minuto.
- `vision-layers.mjs`: capas sobre la cámara (probabilidad, espectro, estructura, topografía, térmica real) y puntos calientes térmicos.
- `rail-watch.mjs` + `/senda/via`: escalones en circuitos de vía (patrón Adamuz), geometría con móviles de viajeros, transiciones de velocidad sin supervisión (Angrois), muros con lluvia (Gelida).
- `/senda/edificios`: pestaña «Visión por capas» con «dónde buscar primero» y «siguiente medida».

**Validación:** núcleo + relé 101/101 · E2E sin red 25/25 (2 comprobaciones nuevas y `/senda/via` en la auditoría de accesibilidad) · web: compilación, idiomas y 98/98. Calibración en 200 escenarios: Brier 0,107 frente a 0,124; insignia «≥98 %» acertada en 1.149/1.149 (619/619 con parámetros erróneos). Error de diseño detectado por la propia medición y corregido (doble conteo de detecciones compartidas).

**Salida:** `docs/architecture/MOTOR_FUSION_EVIDENCIAS.md`, `docs/research/ACCIDENTES_GRAVES_Y_PREVENCION_2026-11-04.md`, `evidence/senda/{fusion-calibration,rail-watch}.json`, capturas `e2e-14`, `e2e-15`.

**Siguiente:** piloto de calibración con bomberos/UME; convenio de datos de circuitos de vía con un gestor; Wi-Fi RTT y cámara térmica en la app Android.

— Registrado por el asistente de orquestación (Claude Code), bajo la dirección de Abraham Haddioui.

## V0.1 (demo ficticia, endurecida, publicada)

- Publicada en GitHub Pages: `https://abrahamhl.github.io/civic-relay/` (repo `abrahamhl/civic-relay`).
- Reproducibilidad: se eliminan `*.tsbuildinfo` versionados; CI `install -> build -> type-check -> test`.
- Carga limpia verificada y CI verde (28 s).

- Core: `Dispatcher`/`MessageStore` separan aceptación de entrega; `DELIVERED` solo con ACK del receptor.
- Core: `demo.ts` conecta el flujo real (router/store/dedup) al escenario dorado.
- Core: TTL comprobado antes de rutar; caducados y `OFFICIAL` forjado rechazados; colisiones de ID rechazadas.
- Crypto: claves Ed25519 (firma) y X25519/XSalsa20-Poly1305 (cifrado experimental) separadas; sin E2E en el flujo.
- Tests: 21 pruebas con `node:test` (`pnpm test`).
- Web: build con `base: /civic-relay/`, tipos restringidos a la demo, manifiesto mínimo, identidad/GPS ficticios.
- Verdad: retirado "ENS Alto Compliant / Ready for Pilot / 93%"; tenantes con dominios `*.example`; README y docs nuevos.
- Auditorías: `AUDITORIAS_INVERSION_PUBLICA.md`, `ASTRA_RED_TEAM.md`, `RELEASE_TRUTH_V0_1.md`, `WORKWIZE_CASE_STUDY.md`.

## Antes

- HEAD `3f1c398`: higiene básica restaurada (lockfile, CI `master`), pero core sin escenario dorado verificado, crypto incompatible y documentación con exceso de afirmaciones.
