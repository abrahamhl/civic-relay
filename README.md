# OEP / Civic Relay — Offline Emergency Protocol

**Investigación en coordinación descentralizada para emergencias con conectividad degradada.** OEP estudia cómo dispositivos participantes y redes compatibles podrían coordinar avisos sintéticos, almacenar/reintentar mensajes y seleccionar rutas alternativas con consentimiento.

🌐 **[Abrir la web avanzada de OEP — demostración interactiva ES / EN / NL](https://civic-relay-investor.vercel.app)**  
🧪 **[Código oficial integrado en master](https://github.com/abrahamhl/civic-relay/tree/master/investor-next)**  
📋 **[Expediente técnico y estado real](https://github.com/abrahamhl/civic-relay/blob/master/docs/audits/LATEST_ENGINEERING_STATUS.md)**

> **ÚNICO DOMINIO OFICIAL:** https://civic-relay-investor.vercel.app. Todas las páginas públicas y propuestas deben utilizar esta URL con rutas `/`, `/es/` y `/nl/`. El historial de la demo V0.1 existe como código, pero no representa el producto actual. El núcleo de investigación y las correcciones web están en `master`; nuevas mitigaciones de seguridad se revisan por PR antes de fusionar. La producción puede ir por detrás del último commit; las comunicaciones Android↔Android no están validadas físicamente y no existe integración operativa con 112, satélites o radar trans-pared. No usar en emergencias reales.

> **Fuente verificable:** [estado del CTO](docs/audits/LATEST_ENGINEERING_STATUS.md), [registro de evidencias](docs/investor/EVIDENCE_REGISTER.md) y [PR #8 (fiabilidad experimental)](https://github.com/abrahamhl/civic-relay/pull/8). Verificar SHA y CI exactos antes de enviar un dossier.

---

## Transparencia del uso de inteligencia artificial

Civic Relay incluye desarrollo, documentación y pruebas asistidos por IA generativa (entre otras herramientas, ChatGPT y asistentes de programación). Los cambios generados requieren revisión humana, validación automatizada y atribución transparente; los tests green no reemplazan una auditoría independiente. No se presenta código generado como trabajo puramente humano.

**Restricción NLnet:** desde el 20-10-2026, [la política v2.0](https://nlnet.nl/foundation/policies/generativeAI/2.0/) prohíbe redacción, edición y traducción de solicitudes mediante IA generativa (salvo la excepción de accesibilidad declarada) y producir artefactos financiados con GenAI. Por tanto, este repositorio y estos documentos no autorizan una candidatura automatizada a NLnet. Antes de presentarse debe verificarse y declarar el uso previo de IA y establecer un plan de trabajo que cumpla estrictamente las condiciones.

## Archivo de la demo histórica V0.1

## Historical Civic Relay V0.1 demo

Demo ficticia de comunicación en crisis, offline-first y de transporte múltiple, diseñada como ejercicio de ingeniería para entornos de conectividad degradada.

> ⚠️ No es un servicio de emergencias. No hay aval institucional, conformidad ENS ni prestación operativa. Todo el transporte es **simulado en la misma página** y la cola es **en memoria** (se pierde al recargar). No introduzcas datos personales ni emergencias reales.

🌐 **Única web pública recomendada:** https://civic-relay-investor.vercel.app
- **Demostración histórica V0.1:** código conservado en [`apps/web/`](apps/web/) para revisión técnica; no distribuir antiguas URLs como webs oficiales.

## Qué demuestra

- **Transporte múltiple** – un mensaje puede propagarse por varias rutas simuladas.
- **Almacenar y reenviar** – si no hay rutas, el mensaje queda en cola (`QUEUED`) hasta que aparezcan.
- **Canalización** – `MESSAGE → STORE → ROUTE → MULTIPATH → DEDUP → ACK`.
- **Deduplicación real** – el mismo sobre entregado por dos rutas produce **un** mensaje lógico que retiene ambas rutas.
- **Límites honestos** – separa explícitamente lo simulado de lo no probado.

## Ejecutar

### Desarrollo local
```bash
pnpm install --frozen-lockfile
pnpm dev          # Desarrollo en http://localhost:3000
pnpm build        # Build producción
pnpm test         # Tests
pnpm lint         # Type-check
```

### Deploy a Vercel (Producción)
```bash
# Opción 1: CLI (rápido)
npm install -g vercel
vercel            # Deploy preview
vercel --prod     # Deploy producción

# Opción 2: Script automatizado (recomendado)
.\scripts\deploy.ps1           # Windows
./scripts/deploy.sh preview    # Linux/Mac
```


Servir la demo estática desde `apps/web/dist`. La API y el servicio reales **no** se exponen en esta demo.

## Pruebas

`packages/core/tests/*.test.mjs` (runner nativo de Node) cubre:

- escenario dorado offline → mesh → later IP → receptor único → 2 rutas;
- recepción **sin** acknowledgment del receptor → nunca `DELIVERED`;
- TTL caducado rechazado antes de rutar;
- `verificationState=OFFICIAL` forjado, sobre malformado y colisión de ID rechazados;
- mismo mensaje por dos rutas → un mensaje con ambas rutas;
- una ruta que falla no bloquea una ruta sana.

## Límites conocidos

- La cola, el historial y la deduplicación son **de sesión** (memoria).
- No hay cifrado extremo a extremo en el flujo de la demo; las primitivas criptográficas existen pero son experimentales y no están conectadas al despacho.
- No se registra ningún service worker ni PWA; el manifiesto es mínimo.
- No hay backend productivo, autenticación, autorización ni sistema de emergencias.

## Documentación

### Producto, Arquitectura 3D Mission Control y Sector Intelligence (2026-10-22)
- [`docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md`](docs/product/VOICE_VISION_REQUIREMENTS_2026-10-22.md) – transcripción íntegra con marcas temporales (`00:00`–`06:33.59`) de la visión original del fundador, matriz funcional (`V01..V13`, `W01..W03`) y contraste con el código
- [`docs/product/WEBSITE_INFORMATION_ARCHITECTURE.md`](docs/product/WEBSITE_INFORMATION_ARCHITECTURE.md) – tesis de comprensión en 30 segundos, relación `Civic Relay` / `OEP`, arquitectura de 3 superficies (`Descubrir`, `Explorar / Mission Control`, `Investigar / Science`), recorrido causal de 8 escenas y rutas estáticas (`EN`, `ES`, `NL`)
- [`docs/product/INTERACTION_SPEC_AND_STATE_MODEL.md`](docs/product/INTERACTION_SPEC_AND_STATE_MODEL.md) – especificación de interacción 3D (`THREE.Raycaster`, órbitas Tierra/Luna/Marte, máscara continental Natural Earth 1:110m, fallback SVG 2D) y acoplamiento determinista con `runScenario()` y `createStoreForwardEngine()`
- [`docs/product/CAMERA_SECTOR_ARCHITECTURE.md`](docs/product/CAMERA_SECTOR_ARCHITECTURE.md) – arquitectura de **Sector Intelligence & CCTV Coordination** (`El Tiemblo · Ávila`, `Valencia · Turia`, `Arnhem · NL`), catálogo abierto DGT/Rijkswaterstaat vs. telemetría sintética, validación anti-SSRF, RBAC fail-closed, mosaico de privacidad y conos FOV 2.5D no calibrados
- [`docs/product/SCIENTIFIC_TRUTH_MATRIX.md`](docs/product/SCIENTIFIC_TRUTH_MATRIX.md) – matriz de verdad científica (`IMPLEMENTADO`, `SIMULADO`, `EN INVESTIGACIÓN`, `SIN PERMISOS`, `NO FACTIBLE CON WEB ACTUAL`)
- [`docs/product/BEFORE_AFTER_UX_AUDIT.md`](docs/product/BEFORE_AFTER_UX_AUDIT.md) – auditoría antes/después desde 6 perspectivas, 10 deficiencias corregidas y evidencia automatizada en Chromium (`P01..P10`)

### Técnica e Inversión (Dossier 2026)
- [`docs/investor/EXECUTIVE_SUMMARY.md`](docs/investor/EXECUTIVE_SUMMARY.md) – resumen ejecutivo y posicionamiento técnico (TRL 3–4)
- [`docs/investor/ONE_PAGE_PITCH.md`](docs/investor/ONE_PAGE_PITCH.md) – pitch de una página para inversores e instituciones
- [`docs/investor/TECHNICAL_DUE_DILIGENCE.md`](docs/investor/TECHNICAL_DUE_DILIGENCE.md) – guía de due diligence técnica y comandos reproducibles
- [`docs/investor/ARCHITECTURE.md`](docs/investor/ARCHITECTURE.md) – flujo de 8 etapas (`EMERGENCY EVENT → ZONE → HUMAN STATUS → CONSENT → MESSAGE → NETWORK PATH → ACK → EVIDENCE`)
- [`docs/investor/EVIDENCE_REGISTER.md`](docs/investor/EVIDENCE_REGISTER.md) – registro maestro de afirmaciones y niveles de evidencia
- [`docs/investor/DIFFERENTIATION.md`](docs/investor/DIFFERENTIATION.md) – diferenciación frente a SOS satelital, mensajería mesh y alertas broadcast
- [`docs/investor/RISKS_AND_MITIGATIONS.md`](docs/investor/RISKS_AND_MITIGATIONS.md) – matriz de riesgos técnicos, operativos y regulatorios
- [`docs/investor/TRL_AND_VALIDATION_ROADMAP.md`](docs/investor/TRL_AND_VALIDATION_ROADMAP.md) – evaluación TRL y hoja de ruta M0–M4
- [`docs/investor/PILOT_PROPOSAL.md`](docs/investor/PILOT_PROPOSAL.md) – propuesta de piloto controlado de 12 semanas
- [`docs/investor/FUNDING_OPPORTUNITIES.md`](docs/investor/FUNDING_OPPORTUNITIES.md) – convocatorias verificadas UE / Países Bajos (Horizon Europe Cluster 3, NLnet/NGI, RVO WBSO/MIT)
- [`docs/investor/FINANCIAL_SCENARIOS.md`](docs/investor/FINANCIAL_SCENARIOS.md) – escenarios financieros (€50k / €180k / €400k)
- [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) – modelo de amenazas y controles implementados
- [`docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md`](docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md) – auditoría de dependencias y licencias (MIT)
- [`docs/security/DATA_AND_CONSENT_BOUNDARIES.md`](docs/security/DATA_AND_CONSENT_BOUNDARIES.md) – privacidad, consentimiento opt-in y purga local
- [`docs/audits/SIX_ORACLE_INDEPENDENT_REVIEWS_2026.md`](docs/audits/SIX_ORACLE_INDEPENDENT_REVIEWS_2026.md) – revisión independiente de 6 perspectivas de ingeniería
- [`docs/audits/INVESTOR_READINESS_STATUS.md`](docs/audits/INVESTOR_READINESS_STATUS.md) – estado integral de preparación e invariantes verificados
- [`docs/audits/HUMAN_ACTION_REQUIRED.md`](docs/audits/HUMAN_ACTION_REQUIRED.md) – protocolo físico pendiente con 2 teléfonos Android (`PHYSICAL_TEST_PENDING`)
- [`docs/AUDITORIAS_INVERSION_PUBLICA.md`](docs/AUDITORIAS_INVERSION_PUBLICA.md) – cinco auditorías técnicas y delegaciones de responsabilidad
- [`docs/RELEASE_TRUTH_V0_1.md`](docs/RELEASE_TRUTH_V0_1.md) – verificación ejecutada (instalación/build/test/lint) vs. afirmaciones
- [`docs/ASTRA_RED_TEAM.md`](docs/ASTRA_RED_TEAM.md) – revisión adversarial de liberación
- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) – criptografía experimental
- [`docs/WORKWIZE_CASE_STUDY.md`](docs/WORKWIZE_CASE_STUDY.md) – caso para entrevista

## Autor

Abraham Haddioui · AI-native product engineer · proyecto asistido por IA.

## Licencia

MIT.

Este repositorio es una **demo ficticia** para evaluación y aprendizaje. No está pensado para uso en emergencias reales ni para su adquisición operativa en su estado actual.
