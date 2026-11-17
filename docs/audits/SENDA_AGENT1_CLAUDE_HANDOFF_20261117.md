# SENDA / Civic Relay — Relevo técnico reproducible para Claude
**17-11-2026 · Agente 1 (validación e investigación) · Rama draft · No se ha fusionado ni desplegado**

## Árbol de dependencias y repositorio
- Repositorio público: https://github.com/abrahamhl/civic-relay
- Claude PR #32: `claude/promotional-video-prompts-p5vzh8` a partir de `feat/senda-funding-mission-day1`, SHA de Claude `632e9de69e330dbdd4a6b21f8146c5d54de9e41e`. Conserva nuevos motores `flood-isolation`, `radio-planner`, `water-nl`, reportes Ed25519, CAP experimental, Atlas y Android.
- Seguridad P0 PR #39: `audit/senda-pr32-safety-gates-20261117`, SHA `d7ed6bd80a0500f12b71f54c805bee5733291700`. Bloquea `CAP Actual` desde entrada ciudadana y comprueba semántica de reportes firmados; mantiene paridad core/web.
- Investigación matemática **PR #42**: `audit/senda-robust-scenario-uncertainty-20261117` (rama actual), depende del PR #39. No modifica el motor original `delivery-assurance.mjs`.
- Investigación anterior #34 -> #35 -> #38: independiente, pensada para laboratorio Node, no integrar el journal Node en el Android nativo que ya tiene `LabPersistentQueue.java`. Revisar cherry-picks evitando duplicados.
- `master`/Vercel seguía en `b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40` en la comprobación inicial; las ramas draft **NO son producción**.

## Ingeniería añadida (H11–H13) y justificación
**H11: probabilidades de fallos de causa común desconocidas.**
- `robust-scenario-risk.mjs`: LP exacto para `min_{q in box-simplex} Σ q_s p_s`, intervalos de masa por estado, sin fiabilidad inventada.
- `robust-assurance-audit.mjs`: usa `correlatedDeliveryProbability` del motor Claude para la probabilidad puntual; calcula cota adversarial diferente.
- `dependency-agnostic-shards.mjs`: límites válidos con **dependencia arbitraria entre paquetes** por esperanza, Boole/Fréchet y umbral k-de-n. Aun con dos rutas diferentes no se multiplica probabilidad automáticamente. 250 casos LP con HiGHS/SciPy independientes verificados en CI previa; no es una afirmación de originalidad científica.

**H12: construir intervalos del riesgo desde episodios y no desde retransmisiones.**
- `scenario-frequency-evidence.mjs`: Hoeffding + cota de la unión por número de **bloques causales declarados independientes**. Exige `incidentKey`, `independentBlockId`, `scenarioId`, `sourceId`, `evidenceSha256`; evita duplicados identificables; 30+ episodios.
- Categoría `UNKNOWN` obligatoria, incluso cuando hay cero muestras observadas; su intervalo superior no es cero. La variante `attachConservativeResearchHazards` asigna fiabilidad garantizada cero a todo portador en `UNKNOWN`. **No significa que un SHA con formato correcto valide contenido**.
- No se pueden demostrar independencia estadística ni representatividad futura por el nombre de dos claves; requiere revisión humana/geográfica de causalidad (ej. DANA multiciudad = un solo macroevento).

**H13: Shared Risk Link Groups (SRLG), física de infraestructura.**
- `shared-risk-topology.mjs`: inventario de enlaces y riesgos comunes por torre, alimentación, operador, gateway o backhaul. Aun si dos rutas usan tecnologías distintas, compartir un dominio las vuelve estructuralmente dependientes. Un enlace sin información es `UNKNOWN_TOPOLOGY` universal, no un conjunto vacío independiente.
- Ruta disyunta declarada no es independencia estadística verificada; devuelve `physicalIndependenceValidated:false` y `mayTransmit:false`. El criterio de selección del laboratorio aplica declaraciones de autorización, consentimiento, energía y coste, no autorizaciones externas.

## Validación reproducible
```sh
node --test packages/senda/tests/robust-scenario-risk.test.mjs packages/senda/tests/robust-assurance-audit.test.mjs packages/senda/tests/dependency-agnostic-shards.test.mjs packages/senda/tests/scenario-frequency-evidence.test.mjs packages/senda/tests/shared-risk-topology.test.mjs
node --test packages/senda/tests/*.test.mjs
node --test packages/senda/tests-adversarial/*.test.mjs
python packages/senda/scripts/verify-robust-lp.py
python packages/senda/scripts/verify-dependence-bounds.py
```
- La CI por SHA está en https://github.com/abrahamhl/civic-relay/actions/workflows/senda-robust-risk-ci.yml; matrix Node 22/24, **250 LP de optimización robusta y 160 LP de distribuciones conjuntas adversariales independientes** mediante SciPy/HiGHS y pruebas del núcleo. [Ejecución verde con 0 violaciones y 627+11 tests](https://github.com/abrahamhl/civic-relay/actions/runs/44010379558) en SHA `6ddd4dc2cbb2edb483c2337d070d1a6ee278694e`.
- **Prueba ya verificada en `ef12c7dbba7253f56e69dd1ac6d3c3a92b2c18d9`:** CI robusta, laboratorio, Android y QA Chromium GREEN; matriz Node 22 informó 608 núcleo + 11 adversariales y optimizador independiente 250 casos. Ese SHA precede H12/H13; revisar **el SHA HEAD actual** al retomar, nunca asumir que un CI verde antiguo cubre cambios recientes.
- La suite de paridad compara `packages/senda/src/*.mjs` con `investor-next/public/senda/core/*.mjs`: si se edita core, sincronizar exactamente la versión web para evitar fallo de CI. Mejor futuro: generarlo automáticamente en build desde una sola fuente.
- No se ha hecho ensayo radio real ni prueba 112 ni despliegue autorizado.

## P0 sin cerrar y ejecución recomendada
1. **CI exacto de HEAD** de PR #42, ver fallos por job/step, arreglar solo en rama draft. Verificar pruebas nuevas H12/H13 y paridad web.
2. **Seguridad/identidad:** `assessIncident` sigue aceptando etiquetas `official` de entrada sin verificar cadena de confianza institucional. El CAP ciudadano `Actual` está bloqueado, pero todo permiso de aviso público necesita adaptador de autoridad real y pruebas adversariales.
3. **Hardware y radios:** dos móviles Android + dos radios LoRa EU868 propios/autorizados; en campo medir PER/latencia p50-p95/consumo/rutas caídas, consentimientos, BLE Nearby, recuperaciones tras SIGKILL y reinicios, relojes GNSS/UTC y duplicados. Acordar escenarios seguros con voluntarios sin enviar llamadas oficiales de emergencia.
4. **SRLG real:** conseguir inventario verificable de alimentación, backhaul, torre y gateways autorizados; contrastar contra fallos históricos independientes. Nadie puede inferir que dos operadores/radios sean física o estadísticamente independientes por el nombre.
5. **Calibración H12:** muestrear crisis por *evento causal* independiente; etiquetar UNKNOWN, origen, versiones, licencias, caducidad, holdout por zona/temporada y escenarios omitidos. Validar cobertura de intervalos y Brier, comparar baseline FIFO/contact graph/Claude delivery-assurance vs DRO/SRLG sin dar más aire, energía ni infraestructura a un competidor. Publicar resultados negativos.
6. **Orbital:** resolver issue #37 con datos de efemérides auténticas OMM/TLE y propagador SGP4 contrastado; vista de satélite no equivale a autorización de servicio NTN ni capacidad directa del teléfono. Mantener disclosure sintético hasta prueba.
7. **Financiación:** dossier verificable para un piloto de 12 semanas con test plan, control de licencias, threat model y cartas de interés exploratorias. Exponer TRL por módulo; no prometer producto certificado.

## Arquitectura que sí podría diferenciarse comercialmente (condicionada a evidencia)
Diseñar y **probar** una capa de asesoramiento que combine:
`Evidence(event/block, dataset hash, uncertainty)`
→ `Shared Risk Topology (SRLG)`
→ `Contact & Time & Energy Feasibility`
→ `Dependent k-of-n Bounds`
→ `Scenario Distribution Robust Optimization`
→ `Human/Institutional Authorization`
→ `Signed Receipt & Auditable Export`.

Ningún eslabón permite deducir acceso físico, autoridad pública o garantía total. La originalidad potencial requiere comparación sistemática con estado del arte, no bautizar como teorema nuevo una desigualdad conocida.

**No arrancar Agente 2 ni fusionar a `master` mientras Agente 1 permanezca bloqueado por hardware/autorización.**
