# SENDA — MISIÓN ANTIGRAVITY «FINANCIACIÓN EN 7 DÍAS»
## Funciones avanzadas que aseguran el éxito del software + paquete demostrable para inversores y convocatorias

**Fecha de referencia:** 10-11-2026. **Presentación a financiación:** semana del 16-11-2026. **Idioma de trabajo y entregas:** español (código y commits en inglés).
**Repositorio:** https://github.com/abrahamhl/civic-relay · **Web:** https://civic-relay-investor.vercel.app

> Actúa como **CTO principal y jefe de ingeniería científica** de SENDA, con equipo multiagente real cuando el entorno lo permita. Esta misión no es de ideas: es de **ejecución verificable** durante 7 días. Cada día debe cerrar con commits, tests en verde, evidencia con hash y una ficha de continuidad. **Prohibido inventar** resultados, métricas, fuentes, permisos, capacidad satelital, cobertura RF, validaciones de campo o vídeos que no hayas producido. Si falta una credencial, implementa un adaptador desactivado y seguro y regístralo en `docs/continuity/SENDA_BLOCKERS.md`. No pidas confirmaciones innecesarias: toma decisiones técnicas **reversibles y documentadas**. Para producción, `master` o cualquier acción irreversible, comprueba protecciones y **no las eludas**.

---

## 0. ESTADO REAL DE PARTIDA (verificado el 10-11-2026; compruébalo de nuevo en vivo antes de tocar nada)

### 0.1 Ramas y PR
| PR | Rama | Base | Estado |
|---|---|---|---|
| **#31** | `ccr-a6eeda4b-bprwzy` (HEAD `e2d4563`) | `feat/senda-master-integration-20261109` | Draft, **CI verde**. Rama de trabajo más avanzada |
| **#30** | `feat/senda-master-integration-20261109` (`62d2b74`) | `master` | Contiene #18, #24–#29 y la rama GDACS. **No fusionado** |
| #18, #24–#29 | — | — | Incluidos en #30. No volver a fusionarlos |
| `master` | `4c310f7` | — | Producción antigua (último deploy: 08-11-2026) |

Grafo detallado: `docs/integration/SENDA_MERGE_GRAPH_2026-11-10.md`.

### 0.2 Lo que ya está hecho en #31 (no rehacer)
1. **Corrección científica** de `telecom-mathematical-physics.mjs` y `scientific-theorems-physics.mjs`:
   - Cota de Cramér-Rao del radar pasivo (era 2π demasiado optimista; σ_R ≈ 2,7 m, no «submétrico»).
   - Tasa de error del enlace acústico: 16-FSK + RS(104,80) exacta.
   - DTN epidémico corregido y comprobado contra la EDO resuelta con RK4.
   - Deygout de 3 aristas con curvatura terrestre; Epstein-Peterson real.
   - Lluvia según la tabla ITU-R P.838-3; Jacobi converge por tolerancia; subcardioide Q = 2,06.
   - El laboratorio web calcula con el núcleo real, sin constantes inventadas.
2. **Bóveda de defensa** `packages/senda/src/defense/` (`@senda/core/defense`) y ruta web `/defense` (ES/EN/NL, `noindex`). Tests de aislamiento. **Nada militar en las superficies civiles.**
3. **Película M96**:
   - `investor-next/public/media/m96/` (ES 12:07 y EN 11:49, 1080p, −16 LUFS, subtítulos ES/EN/NL, SHA256SUMS).
   - Guion generado por `media/senda-film/build-m96-promo.mjs`, con las cifras extraídas de `estado.json` y del núcleo.
   - Escena nueva `spainmap` con los accidentes en España; diagramas traducidos (`film-i18n.js`).
4. **Motor de Garantía de Entrega** `packages/senda/src/delivery-assurance.mjs`:
   - Fallos correlacionados por causa común; física de lluvia y desvanecimiento Nakagami-m; posterior Beta-Binomial.
   - Optimizador que alcanza el óptimo exacto en 60/60 instancias; certificado SHA-256.
   - Resultado simulado: el plan independiente promete un 99,49 % y entrega un 96,09 %; este motor da un 98,98 % a 0 € y un 99,99 % con 3 € de Iridium.
   - Documentación: `docs/science/DELIVERY_ASSURANCE.md`.
5. **GDACS auditado contra la API real**: 5 bugs corregidos (eventos verdes omitidos, 204, paginación, `episodeid` de 7 cifras, reloj por defecto que tumbaba el endpoint). Linaje por fuente (`SAME_UPSTREAM_NOT_CORROBORATION`). Captura real: 472 registros. Recibo: `evidence/senda/osint/gdacs-live-receipt-2026-11-10.json`.
6. **Tests**: núcleo 382/382 (`node --test packages/senda/tests/*.test.mjs packages/senda/tests/defense/*.test.mjs`), SENDA LIVE 102/102, web 108/108; `pnpm build`, `pnpm type-check` y `pnpm test` en verde.

### 0.3 Pendiente heredado de TU misión 10 (rama local nunca publicada)
La rama `feat/senda-scientific-mission-10-20261109` (HEAD `1391a5e`, `rail-advanced-safety.mjs`, `rail-safety-lab.tsx`, cierres P0) **no existe en GitHub**. Primera acción del día 1: `git push -u origin feat/senda-scientific-mission-10-20261109`, rebase sobre #31 y aplicar estas correcciones de auditoría antes de integrarla:
- **Pandeo térmico**: usar la inercia **lateral** I_z ≈ 512 cm⁴ (UIC 60E1), no la vertical (3.038 cm⁴), que sobrestima P_crit ×2,44 de forma no conservadora. ΔT respecto a la **temperatura neutra**. Añadir el radio de curva (CWR-SAFE de Kish y Samavedam) o declarar «solo vía recta».
- **TTC**: d/(v₁+v₂) solo vale para choque frontal. En alcance, v₁−v₂ (∞ si v₁ ≤ v₂). El criterio de seguridad es d > Σ(v·t_r + v²/2a), no un umbral de TTC.
- **Ondas guiadas**: velocidad de **grupo** del modo a la frecuencia usada (dispersión). Rebajar «>4 km» a «rotura completa, del orden de 1 km entre transductores» salvo ensayo propio. Los PZT de 40 kHz de aire **no** sirven en acero.
- **Trama OEP-RAIL**: CRC-16 no autentica. Añadir MAC truncado (AES-CMAC/HMAC, 4–8 B) + contador anti-replay, aunque haya que rediseñar los 20 bytes.
- **«BLE C-ITS» no existe**: C-ITS es ITS-G5/C-V2X a 5,9 GHz. Los 38 ms son simulados. Corregirlo en código, laboratorio y papers.
- **Seguridad funcional**: nada actúa sobre el frenado. Todo es **aviso** (fuera de SIL4, EN 50126/50128/50129). Cambiar «frenado autónomo» por «propuesta de aviso al gestor».
- **LoRa 868 MHz**: tiempo en el aire SF12 de 20 B ≈ 1,32 s → con el 1 % de ciclo de trabajo, ≈1 trama cada 132 s. Reflejarlo.
- Tests contra soluciones analíticas para cada corrección. Si el código es militar o de doble uso, va a la bóveda `defense/`.

### 0.4 Bloqueos conocidos (`docs/continuity/SENDA_BLOCKERS.md`)
- **NASA FIRMS** necesita `MAP_KEY`, que el fundador debe aportar como secreto. Sin ella no hay adaptador funcional.
- **Copernicus CDSE**: el STAC es público; las descargas requieren cuenta.
- El `fetch` nativo de Node detrás de un proxy HTTPS necesita `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).
- **Ninguna validación física** de RF, CSI, Android Nearby o LoRa. Todo lo de radio es geometría o simulación.

---

## 1. OBJETIVO DE LA SEMANA

Llegar a la reunión de financiación con **tres cosas que nadie puede discutir**:
1. **Un producto desplegado y verificable** (staging → producción por SHA) donde un evaluador pulsa y ve funcionar los flujos clave, también **sin red**.
2. **Un primer dato propio de campo** (pequeño pero real) que alimente el aprendizaje del motor de entrega. Es el inicio del foso de datos.
3. **Un dossier honesto**: qué está demostrado, qué es simulación y qué es hoja de ruta, con TRL por módulo, evidencia con hash y vídeo de demo real.

**Criterio rector:** vale más una función avanzada que funciona, con tests y evidencia, que diez prototipos vistosos. Si algo no se puede cerrar en el plazo, se etiqueta `EN INVESTIGACIÓN` y no se promete.

---

## 2. LAS 7 LÍNEAS DE TRABAJO (ordenadas por impacto en la financiación)

### L1 · Integración, despliegue y prueba pública (días 1–2) — bloqueante
1. Revisar #31 → #30 → `master` **con PR focalizados**; no fusionar sin CI verde en el SHA exacto. Si las protecciones de rama exigen revisión humana, prepararlo todo y dejarlo listo para el fundador; no eludirlas.
2. Desplegar **preview de staging** en Vercel desde la rama integrada. Verificar por SHA:
   - Que `/`, `/es`, `/nl`, `/science`, `/mando`, `/defense` (noindex) y `/senda/*` responden.
   - Que la película M96 se reproduce (ES en `/es`, EN en el resto) con sus subtítulos.
   - Que los vídeos `m95/*.mp4` ignorados por git existen en el deploy, o que sus enlaces se retiran. Sin enlaces rotos.
3. **Prueba offline real**: Playwright con `context.setOffline(true)` sobre la PWA `/senda`: modo fácil, cola de mensajes, mapa en caché. Captura con fecha y SHA.
4. Producción solo tras QA de staging, con rollback probado (`vercel rollback` o promoción del deploy anterior). Documentar URL, SHA y hora.
5. Corregir cualquier afirmación pública que contradiga la evidencia (buscar «submétrico», «validado», «certificado», «garantiza», «en tiempo real», «millones»). Script: `scripts/claims-lint.mjs`, que falla en CI si aparecen sin etiqueta.

### L2 · SENDA-CAL: el aprendizaje continuo que crea el foso de datos (días 2–4) — la función más diferencial
Objetivo: que cada **recibo firmado** de entrega real actualice la fiabilidad por canal y zona, y que el planificador use esa fiabilidad aprendida.
1. **Contrato `DeliveryReceipt v1`**, firmado Ed25519 con el mismo sobre PCI existente:
   - `bearer_id`, `zone_h3` (resolución 7, sin coordenadas finas), `hazard_state` declarado o inferido, `sent_at`, `acked_at`, `outcome`, `fragments`, `k`, `app_version`.
   - **Sin identificadores personales.** Retención limitada y agregación por zona.
2. **Almacén de posteriores** `packages/senda/src/reliability-store.mjs`:
   - Beta(α,β) por (canal, zona, estado de peligro), con *shrinkage* jerárquico hacia el prior global del canal. Usar un modelo Beta-Binomial jerárquico con estimación empírica de Bayes; documentar la fórmula.
   - Olvido exponencial configurable para la no estacionariedad.
   - Persistencia en IndexedDB (cliente) y SQLite (relé). Sincronización entre nodos como CRDT por suma de contadores: los conteos α y β se suman y son conmutativos.
3. **Integración en `planAssuredDelivery`**: opción `receipts` por zona, construida desde el almacén. Modo `effort: 'fast'` en el móvil.
4. **Detección de deriva**: alerta si la tasa observada de un canal cae fuera de su intervalo creíble al 99 % durante N recibos (test secuencial SPRT o CUSUM bayesiano). Ejemplo: «LoRa en la zona X ha caído».
5. **Panel de calibración** en `/science`: curva de fiabilidad (predicha frente a observada), diagrama de fiabilidad y Brier score por canal. **Con datos sintéticos etiquetados `SIMULADO`** hasta que haya recibos reales.
6. Tests:
   - Conjugación exacta.
   - Convergencia del *shrinkage* contra Monte Carlo.
   - Conmutatividad y asociatividad del CRDT.
   - SPRT con tasa de falsa alarma medida en simulación.
   - Privacidad: ningún campo permite reidentificar.

### L3 · Primer dato de campo propio (días 3–5) — lo que convierte simulación en evidencia
Pequeño y real: **mejor 50 recibos auténticos que 50.000 simulados.**
1. **Protocolo** `docs/field/PILOT_PROTOCOL_2026-11.md`:
   - 3 teléfonos Android con la app SENDA (Nearby, BLE y sonido) más, si hay hardware, 2 nodos LoRa Meshtastic.
   - Escenarios: interior, exterior, a través de 1 y 2 paredes, distancias de 2, 10 y 30 m, modo avión con Wi-Fi apagado.
   - Medir: entrega extremo a extremo, latencia, número de saltos y consumo. Registrar dispositivo, versión de Android, hora UTC y condiciones.
   - Consentimiento escrito de los participantes; ningún dato personal.
2. **Herramienta de captura** en la app: exportar recibos firmados (`DeliveryReceipt v1`) a JSON con hash.
3. Ejecutar el piloto si el fundador dispone del hardware; si no, dejar el kit listo (APK firmado de depuración, guion paso a paso y hoja de registro) y marcar `VALIDACION_FISICA_PENDIENTE`.
4. Ingerir los recibos en SENDA-CAL y mostrar la **primera curva de fiabilidad con datos reales** (con su intervalo, aunque sea ancho). Esta gráfica, honesta, vale más en la reunión que cualquier render.

### L4 · OSINT verificable de segunda fuente (días 2–4)
Con el patrón ya validado en GDACS (contrato, fixture real, recibo con SHA, fallo seguro, linaje):
1. **Copernicus EMS Rapid Mapping** (sin clave): activaciones, AOI y productos. Distinguir **activación, producto cartográfico y perímetro observado**. Fixture real y recibo.
2. **Copernicus CDSE STAC** (público): descubrir escenas Sentinel-2 y Sentinel-1 por AOI, fecha y nubes. **Solo metadatos y miniaturas**; nada de «imagen actual» simulada.
3. **NASA FIRMS**: implementar el adaptador **desactivado** con test de contrato sobre un fixture; se activa solo si existe `FIRMS_MAP_KEY`. Un punto caliente **no** es un perímetro.
4. **`SourceEvidence v1`** y **Source Registry** (`packages/senda/calibration/sources.v1.json`, extendiéndolo sin duplicar):
   - Estados `DISCOVERED → SCHEMA_VALIDATED → LIVE_FETCHED → INTEGRATED → HOLDOUT_TESTED → FIELD_VALIDATED`.
   - **Grafo de dependencia** entre fuentes: GDACS-EQ ← USGS NEIC; GDACS-WF ← GWIS ≈ FIRMS/EFFIS; GDACS-FL ← GloFAS (modelo).
5. **Ficha de incidente** exportable en JSON/GeoJSON: línea temporal, fuentes, hashes, linaje, incertidumbre y diff entre actualizaciones.

### L5 · GIS 4D con verdad (días 3–6)
1. **ADR** `docs/adr/ADR-GIS-ENGINE.md`: comparar MapLibre GL JS + deck.gl con CesiumJS en Android de gama media (FPS, memoria, bundle, terreno, licencia y offline). Medir; no opinar.
2. **Barra temporal única** que distinga `observation_time`, `model_run_time`, `forecast_valid_time` y `download_time`. Capas: GDACS (puntos representativos, no áreas), EMS (perímetros si existen), MET Norway (pronóstico, etiquetado), DEM (exageración vertical ×1 por defecto) y nodos/pasarelas.
3. **Capa de garantía de entrega**: mapa de zonas H3 coloreadas por P(entrega) del motor, con el estado de peligro seleccionable (normal, apagón, tormenta) y con incertidumbre. Es la visualización estrella para el inversor: «aquí tu SOS llega con un 99 %; aquí, con un 90 %; y por qué».
4. Fallback 2D sin WebGL. Nada de edificios 3D inventados. `2.5D` si los datos son de superficie.

### L6 · Seguridad y privacidad de nivel convocatoria europea (días 4–6)
1. Actualizar el **threat model** y redactar una **DPIA preliminar** (RGPD), con la tabla `dato / finalidad / consentimiento / cifrado / retención / borrado / quién lo ve`.
2. **CI de seguridad**:
   - Gitleaks (secretos).
   - `npm audit` / OSV (dependencias).
   - Semgrep con reglas OWASP para SSRF, XSS desde fuentes OSINT, inyección GeoJSON, JSON bomb y tamaño de respuesta.
   - SBOM CycloneDX: ya existe en `investor-next-ci.yml`; extenderlo a `packages/senda` y `apps/senda-live`.
3. Firma de releases (Sigstore/cosign) o, como mínimo, `SHA256SUMS` firmados.
4. Revisar que la bóveda de defensa sigue aislada: test `vault-isolation`, `/defense` noindex y nada de defensa en el sitemap.

### L7 · Paquete de financiación (días 5–7) — nada se promete sin evidencia
1. **Matriz de TRL por módulo** `docs/investor/TRL_MATRIX_2026-11.md`: `DATO → MÉTODO → CALIBRACIÓN → HOLDOUT → ESTADO`, con el enlace a cada test o evidencia. Columnas Validado / Experimental / En investigación.
2. **Vídeo demo de 90–120 s con pantalla real** del staging validado: GDACS real, motor de garantía de entrega, modo avión real y la primera curva de calibración (real o etiquetada `SIMULADO`). Usar el pipeline existente:
   - `media/senda-film/`: `node build-m96-promo.mjs` como patrón; `python3 voice.py <guion> es|en`; `JOBS=2 node render.mjs <guion> es|en`.
   - Modelo Kokoro en `~/.cache/kokoro`, que se descarga del release `model-files-v1.0` de `thewh1teagle/kokoro-onnx` en GitHub.
   - Rótulos `VISUALIZACIÓN` / `ESCENARIO SINTÉTICO` en todo lo simulado; capturas reales con fecha y SHA.
3. **One-pager y deck de 10 diapositivas** (ES/EN):
   - Problema, con los accidentes de España y sus fuentes de `docs/video/M96_PROMO_SOURCES.md`.
   - Hueco (`docs/research/PROCUREMENT_GAP_2026.md`), solución, qué funciona hoy, foso de datos (SENDA-CAL), seguridad y privacidad, hoja de ruta a 12 meses, equipo y uso de fondos.
   - **Ninguna valoración ni cifra de mercado sin fuente.**
4. **Encaje con convocatorias**: tabla con requisitos, plazos y elegibilidad **comprobados en la web oficial** y con fecha de consulta (Horizon Europe CL3 en su parte civil, EIC Pathfinder/Accelerator, ayudas nacionales y autonómicas de protección civil e innovación). **Nada de defensa** en estos dossieres civiles; la bóveda es una línea aparte y opcional, con revisión legal (Reglamento (UE) 2021/821).

---

## 3. REGLAS DE INGENIERÍA (no negociables)

- **Gestores de paquetes**: monorepo con `pnpm` (`pnpm install --frozen-lockfile`, `pnpm build`, `pnpm type-check`, `pnpm test`). **`investor-next` usa `npm ci`** según su CI (`.github/workflows/investor-next-ci.yml`). Respeta cada uno.
- **Paridad núcleo-web**: tras tocar `packages/senda/src`, ejecuta `node packages/senda/scripts/sync-web.mjs`. El test `web-parity` falla si divergen.
- **Página de estado**: `node packages/senda/scripts/build-status-page.mjs` regenera `estado.json` ejecutando las pruebas. **Nunca edites cifras a mano.**
- **Vídeos**: las cifras salen de `estado.json` y del núcleo. Si la narración no coincide, el generador falla. Mantén esos guardas.
- **Ciencia**: cada fórmula nueva necesita un test contra solución analítica, Monte Carlo o un caso de referencia publicado. Si citas coeficientes de memoria, márcalo como «verificar con la fuente oficial».
- **Verdad**: usa `OBSERVED / CALCULATED / SIMULATED / INFERRED` (`packages/senda/src/epistemic-ledger.mjs`). Nunca conviertas un estado en otro en la interfaz.
- **Git**: ramas por línea de trabajo, PR en borrador, commits pequeños y descriptivos, **sin force-push** en ramas ajenas y sin fusionar en `master` sin CI verde y revisión.
- **Privacidad**: permisos desactivados por defecto, sin GPS al abrir el mapa y sin datos personales en evidencias ni fixtures.
- **Memoria**: no ejecutes renders de vídeo y la suite completa de tests a la vez en máquinas pequeñas (provocó un OOM documentado).

---

## 4. CRITERIOS DE ACEPTACIÓN (verificables el día 7)

| Línea | Entregable | Cómo se comprueba |
|---|---|---|
| L1 | URL de staging y de producción con SHA | `curl` + Playwright por SHA, offline incluido, sin enlaces rotos |
| L1 | `claims-lint` en CI | Falla con una afirmación de prueba sin etiqueta |
| L2 | `reliability-store.mjs` + integración en el planificador + panel | Tests de conjugación, *shrinkage*, CRDT y SPRT; el panel muestra la etiqueta `SIMULADO` o datos reales |
| L3 | Protocolo + kit + (si hubo piloto) recibos firmados con hash | JSON firmado verificable; primera curva de fiabilidad real o `VALIDACION_FISICA_PENDIENTE` |
| L4 | Adaptador EMS + STAC CDSE + FIRMS desactivado + Source Registry + grafo de dependencias | Fixtures reales con SHA, recibos en vivo y tests de contrato |
| L5 | ADR medido + barra temporal + capa de garantía de entrega | Benchmark con dispositivo y metodología; fallback 2D |
| L6 | Threat model + DPIA + CI de seguridad + SBOM | Jobs de CI en verde; DPIA con su tabla |
| L7 | Matriz TRL + demo de 90–120 s + one-pager + deck + tabla de convocatorias | MP4 con SHA, fuentes enlazadas, fechas de consulta |
| 0.3 | Misión 10 publicada y corregida | Rama en GitHub; tests de inercia lateral, TTC por sentido, MAC y LoRa |

---

## 5. RITMO DIARIO Y CONTINUIDAD

Cada día, al terminar:
1. Commit + push + PR actualizado con CI verde (o el bloqueo exacto).
2. Actualizar `docs/continuity/SENDA_SESSION_HANDOFF.md` (ficha), `docs/continuity/SENDA_EVIDENCE_LEDGER.json` (entradas nuevas con hash y estado) y `docs/continuity/SENDA_BLOCKERS.md`.
3. Entrada en `00_CHANGELOG.md` con el formato existente: Entrada → Procesamiento → Validación.
4. Si se agota el contexto o los créditos: **deja el trabajo guardado y la ficha exacta**, nunca solo una promesa.

**Plan orientativo:**
- Día 1: 0.3 (publicar y corregir la misión 10) + L1.1–L1.2.
- Día 2: L1.3–L1.5 + L2.1–L2.2 + L4.1.
- Día 3: L2.3–L2.6 + L4.2–L4.4 + L3.1–L3.2.
- Día 4: L3.3–L3.4 + L5.1–L5.2 + L6.1.
- Día 5: L5.3–L5.4 + L6.2–L6.4 + L4.5.
- Día 6: L7.1–L7.2 (grabar la demo sobre staging validado).
- Día 7: L7.3–L7.4 + L1.4 (producción si procede) + informe final.

---

## 6. INFORME FINAL (formato obligatorio)

Devuelve **resultados, no intenciones**:
- **Resumen ejecutivo** (≤150 palabras): qué funciona, dónde (URL + SHA) y qué está demostrado.
- **Tabla por línea L1–L7**: estado (`VERIFICADO_POR_CODIGO`, `DATO_REAL_CAPTURADO`, `SIMULADO`, `VALIDACION_FISICA_PENDIENTE`, `BLOQUEADO`), evidencia (ruta + hash) y tests (número exacto, sin inflar).
- **Lo que NO está demostrado** y por qué.
- **Riesgos para la reunión de financiación** y cómo responderlos con honestidad.
- **Siguiente paso de mayor impacto** tras la financiación, con coste estimado y sus supuestos.

**Primera acción ahora mismo:** publica la rama de la misión 10, verifica en vivo el estado de #31/#30/`master`, y empieza por L1 (staging verificable) mientras preparas el contrato `DeliveryReceipt v1` de L2. No envíes otra propuesta antes de la primera ejecución verificable.
