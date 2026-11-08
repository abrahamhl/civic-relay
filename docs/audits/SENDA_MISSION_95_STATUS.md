# SENDA · Estado de la misión 9.5

Fecha: 2026-11-08  
Rama: `mission/senda-95-20261108`  
Estado: **en curso; no alcanza 9,5/10 todavía**.  
Documento base: `docs/audits/SENDA_BASELINE_MISSION_95.md`.

## 1. Resumen ejecutivo

La misión produjo mejoras verificables en reproducibilidad, matemática de incendios, routing DTN, PCI v0.2, identidad ligada a tarjeta y export cifrado de claves. También produjo una conclusión incómoda: la puntuación global sigue lejos de 9,5 porque faltan validación física, calibración independiente, auditoría externa, despliegue verificable de PCI y búsqueda sistemática de prior art. No se maquilla esa brecha.

## 2. Cambios realizados

### 2.1 Reproducibilidad

- `scripts/release-manifest.mjs`: manifiesto con commit, árbol Git, lockfile, hash del árbol fuente, huella de artefacto, comando de build y verificación fail-closed.
- `scripts/release-manifest.test.mjs`: 4 pruebas; árbol sucio, artefacto ausente, hash alterado y modo producción.
- `package.json`: script `manifest`.
- `docs/research/senda-data-sha256.txt`: SHA-256 de los 22 ficheros de datos.

### 2.2 Incendios

- Validación fail-closed en `fire-field.mjs`: malla, dx, elevación, combustible, igniciones, viento, ROS, tiempos, ensemble, máscaras, métricas, cámaras, plumas, parpadeo y sincronización.
- `assessAssets`: sin antena no inventa cobertura ni hora de caída.
- `skillVsNull`: lanza si el modelo nulo es perfecto.
- `fire-audit.test.mjs`: 9 pruebas nuevas.
- Documentación de la diferencia entre `fire-field` (ROS origen) y `wildfire` (media armónica) y del artefacto de vecindad 16.

### 2.3 DTN y EAOR

- `EAOR` integrado: rutas edge-disjoint, confianza, deadline, energía, copias por ruta, fallo de contacto y reapertura de contactos.
- `planEaorRoutes` genera `max(k·3, 8)` candidatos antes de puntuar, para no perder rutas fiables lentas.
- `mulberry32` sustituye al LCG; el LCG daba un primer valor ≈0,624 con semillas consecutivas y sesgaba la simulación de fallos.
- Stats nuevas: `transmissionsPerDelivery`, `redundantTransmissions`, `deliveredBytes`, `reopenedContacts`.
- `eaor-routing.test.mjs`: 5 pruebas.
- `routing-benchmark-v2.mjs`: schema `senda.routing-benchmark/2`, grafos independientes, bootstrap por conglomerados, deltas pareados, Monte Carlo de contactos no fiables, manifiesto de fuente.
- `routing-benchmark-v2.test.mjs`: smoke test del esquema y de la no pseudo-réplica.
- `envelope.mjs`: el formato binario rechaza ciphertext >65535 B en vez de truncar la longitud; prueba nueva en `dtn-hardening.test.mjs`.

### 2.4 Documentación

- `docs/audits/SENDA_BASELINE_MISSION_95.md`
- `docs/audits/SENDA_MISSION_95_STATUS.md`
- `docs/research/SENDA_MATHEMATICAL_VALIDATION.md`
- `docs/research/SENDA_SCIENTIFIC_DATASETS.md`
- `docs/research/SENDA_NOVELTY_AND_PRIOR_ART.md`
- `docs/research/senda-data-sha256.txt`
- `docs/telecom/SENDA_PHYSICAL_VALIDATION_PLAN.md`
- `docs/security/SENDA_ASSURANCE_REVIEW.md`
- `docs/ip/SENDA_TECHNOLOGY_PROTECTION_STRATEGY.md`
- `docs/handoff/SENDA_RESUME_CHECKPOINT.md`
- `evidence/senda/mission-95/README.md`

### 2.5 PCI v0.2

- Nuevo paquete `@senda/pci` v0.2.0 en `packages/senda-pci/`; no es «recuperación» de la v0.1 desplegada y no recuperable.
- Protocolo `senda.pci/1`: JSON canónico determinista, cadena `prev`/`hash`, firma ECDSA P-256/SHA-256 por registro, recibos `RECEIVED` ligados por `transferHash`, acciones `REGISTERED/TRANSFERRED/RECEIVED/VERIFIED/ACCESSED/SEALED`.
- `verifyLedger` exige anclas de confianza externas y falla cerrado con `MISSING_TRUST_ANCHOR`; `appendEvent` solo exige integridad interna autocontenida.
- CLI `senda-pci`: `keygen`, `pub`, `register`, `transfer`, `receive`, `seal`, `verify`, `receipt`, `digest`. `keygen` escribe la clave privada en claro y lo advierte; no es producción.
- 13 pruebas adversariales: cadena completa, recibo, alteración de hash/firma/evidencia, borrado/reordenación/duplicado, transferencia sin recibo, custodio no autorizado, tiempo, anclas de confianza, campos desconocidos, sellado, export/import y canonicalización.
- Humo CLI: 4 registros, sellado, custodio final Bruno, digest `cede45246baacb9065a647cb289da99bb5cd48272ae5febeccb8c429b8a90733`.

### 2.6 Identidad del emisor y claves (F-02/F-05)

- `openMessage` acepta `expectedSender` (tarjeta de contacto o identidad pública) y verifica que la firma y la huella de caja coinciden; falla con `SENDER_NOT_PINNED` o `SENDER_BINDING_MISSING`.
- `sealMessage` usa versión interna 3 por defecto: incluye huella de caja del emisor dentro del plaintext firmado. Los sobres v2 siguen abriéndose sin vinculación y devuelven `fromFingerprint = null`.
- `exportIdentityEncrypted` / `importIdentityEncrypted`: PBKDF2-SHA-256 (210 000 iteraciones por defecto) + AES-256-GCM, AAD `SENDA-identity-v1`, mínimo 12 caracteres. Falla cerrado con frase incorrecta o blob alterado.
- `exportIdentity` en claro sigue existiendo para migración; no hay keystore de hardware, rotación ni revocación. F-05 queda mitigado parcialmente.

## 3. Evidencia

| Evidencia | Comando | Resultado |
|---|---|---|
| Suite SENDA | `cd packages/senda; node --test tests/*.test.mjs` | **266/266 pass** |
| Suite PCI | `cd packages/senda-pci; node --test tests/*.test.mjs` | **13/13 pass** |
| Manifiesto | `node --test scripts/release-manifest.test.mjs` | 4/4 pass |
| Benchmark v2 | `node scripts/routing-benchmark-v2.mjs` | 30 grafos × 20 realizaciones, 2000 bootstrap; `SOURCE_ONLY` |
| Evidencia DTN | SHA-256 del JSON | `c399870d43f121c4739fb9bb4cc5ed7b652436eac99f7b1ce46642cc7ffcd860` |
| Paridad web | `node scripts/sync-web.mjs` + suite | 61 módulos sincronizados |
| Datos | `docs/research/senda-data-sha256.txt` | 22 ficheros hasheados |

### 3.1 Resultado DTN principal (`unreliable-contacts`)

| Estrategia | Entrega | IC 95 % | Latencia (s) | Transmisiones/entrega | Energía/entrega |
|---|---:|---|---:|---:|---:|
| earliest | 0,112 | 0,092–0,132 | 81,5 | 2,00 | 6,00 |
| eaor | 0,977 | 0,965–0,987 | 156,7 | 4,92 | 7,05 |
| adaptive | 0,985 | 0,975–0,993 | 148,2 | 5,52 | 7,46 |
| epidemic | 0,988 | 0,980–0,997 | 140,7 | 5,88 | 8,75 |

Delta EAOR vs earliest: +86,5 pp de entrega (IC 95 %: 84,2–88,8), +75,7 s de latencia, +2,90 transmisiones/entrega, +1,05 energía/entrega. EAOR **no domina** a adaptive/epidemic: entrega algo menos y es más lento, pero consume menos energía y transmisiones. La afirmación defendible es mejora de fiabilidad frente a CGR-like con coste moderado, no optimalidad global.

### 3.2 Incendio

- El modelo sin calibrar era peor que un círculo de igual área (Jaccard 0,131 del círculo; mejor Jaccard 0,04; habilidad −0,077).
- La calibración en muestra alcanza Jaccard 0,383, pero no es validación independiente.
- No hay perímetros oficiales ni validación fuera de muestra.

## 4. Puntuación actual (0–10)

| Dimensión | Antes | Ahora | Motivo |
|---|---:|---:|---|
| Reproducibilidad | 4,0 | 8,5 | Manifiesto, hashes, benchmark con fuente; falta CI/artefacto atestiguado |
| Rigor científico | 4,0 | 7,0 | Bootstrap por grafos, deltas, incertidumbre; sin validación externa |
| Incendios | 6,0 | 7,0 | Fail-closed y documentación; sin calibración oficial |
| DTN | 5,0 | 7,5 | EAOR y benchmark v2; sin trazas reales ni campo |
| PCI | 1,0 | 4,5 | Paquete v0.2 implementado y probado; sin auditoría externa, integración ni despliegue verificable |
| Seguridad | 5,0 | 6,8 | F-02 probado y F-05 mitigado; sin keystore, rotación, revocación ni revisión criptográfica externa |
| PI | 3,0 | 4,0 | Estrategia y prior art exploratorio; sin búsqueda sistemática |
| Documentación | 4,0 | 8,0 | Informes completos y honestos; faltan resultados de campo |
| **Global** | **4,8** | **6,7** | **Todavía no 9,5** |

## 5. Brecha para 9,5

1. **PCI v0.2** implementado y probado localmente; falta auditoría externa, integración en el producto y despliegue identificable por hash.
2. **Validación física DTN** LEVEL-4 con radios reales y energía medida.
3. **Calibración de incendios** fuera de muestra con dos o más incendios independientes y perímetros oficiales.
4. **Auditoría externa** de seguridad, criptografía y revisión científica independiente.
5. **Búsqueda sistemática** de prior art y decisión de PI con abogado.
6. **CI con atestación** de artefacto y despliegue identificable por hash.
7. **Pruebas de carga** del almacén DTN y fuzzing de parsers.
8. **F-05 residual**: keystore de hardware, rotación, revocación y eliminación de exportación en claro.

Sin 1–5, cualquier nota ≥9,5 sería una afirmación sin evidencia.

## 6. Limitaciones declaradas

- El benchmark es simulación; no valida rendimiento en campo.
- La confianza de contacto es declarada, no medida.
- La energía es un proxy del catálogo, no julios.
- El modelo de fuego no está calibrado con datos oficiales.
- La revisión adversarial es interna; los subagentes comparten modelo.
- PCI v0.2 está probado, pero no auditado ni desplegado; la interpretación del acrónimo PCI no está fijada por una especificación externa.
- F-05 no elimina la exportación en claro ni usa keystore de hardware.
- La evidencia se generó desde el commit `3041a52` con árbol limpio (`SOURCE_ONLY`); el JSON se commitea aparte.
- `SOURCE_ONLY` no es un artefacto atestiguado por CI ni una release firmada.
- La licencia MIT ya publicada limita la estrategia de PI.

## 7. Próximos pasos inmediatos

1. Commitear PCI v0.2, F-02/F-05 y estas actualizaciones; pushear al PR #23.
2. Auditar PCI y la criptografía de identidad de forma externa.
3. Integrar PCI en el producto y desplegarlo con hash verificable.
4. Cerrar F-05 residual: keystore, rotación y revocación.
5. Preparar protocolo de validación externa.

## 8. Artefactos

- `evidence/senda/mission-95/routing-benchmark-m95.json` — benchmark v2 desde árbol limpio (`SOURCE_ONLY`).
- `evidence/senda/mission-95/README.md` — índice y estado de la evidencia.
- `packages/senda-pci/` — paquete `@senda/pci` v0.2.0, CLI y 13 pruebas.
- `packages/senda/scripts/routing-benchmark-v2.mjs` — generador.
- `packages/senda/tests/` — 266 pruebas.
