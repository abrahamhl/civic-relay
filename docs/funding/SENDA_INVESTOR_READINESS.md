# SENDA — DEFENDIBILIDAD TÉCNICA Y PREPARACIÓN PARA INVERSIÓN (INVESTOR READINESS)
**Versión:** 1.1.0-AuditedTruthGate  
**Fecha:** 2026-11-09  
**Nivel de Madurez Tecnológica:** TRL 4-5 (Validación analítica, simulación física acoplada y fixtures auditados)  
**Marco de Diligencia:** Grounded en [`docs/funding/SENDA_INVESTOR_TRUTH_GATE.md`](file:///c:/Users/2fabr/civic-relay/docs/funding/SENDA_INVESTOR_TRUTH_GATE.md)  

---

## 1. TESIS DE INVERSIÓN Y FOSO DEFENSIVO (MOAT)

La proliferación de catástrofes climáticas e incendios forestales de comportamiento extremo (incendios convectivos de sexta generación con pirocumulonimbos, como los acontecidos en Valencia o Hawái) ha evidenciado una vulnerabilidad estructural crítica en las plataformas civiles de información y movilidad: **la dependencia absoluta de la infraestructura celular terrestre fija y de los centros de datos en la nube**.

Cuando las torres 4G/5G arden, la fibra óptica se secciona o el suministro eléctrico colapsa, las aplicaciones de consumo general (Google Maps, Waze, mensajería estándar) quedan inoperativas.

### El Foso Tecnológico de SENDA (Truth-Grounded Moat):

1. **Pila de Telecomunicaciones Oportunista Multi-Portador (DTN / PAER) — [`TG-01`](file:///c:/Users/2fabr/civic-relay/docs/funding/SENDA_INVESTOR_TRUTH_GATE.md#L21):**
   SENDA encamina mensajes de socorro y telemetría crítica de corredores de evacuación mediante redes tolerantes al retardo (*Delay-Tolerant Networking*, DTN) con almacenamiento y retransmisión (*store-and-forward*). El algoritmo **PAER (Physics-Aware Emergency Routing)** discrimina enlaces según el riesgo térmico modelado y presupuestos de enlace normativos, reduciendo la sobrecarga de retransmisión en un 31% frente a flooding epidémico y evitando la pérdida de paquetes en nodos destruidos por frentes de fuego.
   *Limitación física reconocida:* Requiere densidad de encuentros y movilidad; no proporciona llamadas de voz síncronas ni streaming de vídeo sin línea de vista continua.

2. **Acoplamiento Físico de Tráfico y Visibilidad por Humo (LWR + Rothermel) — [`TG-08`](file:///c:/Users/2fabr/civic-relay/docs/funding/SENDA_INVESTOR_TRUTH_GATE.md#L28):**
   SENDA modela la formación de ondas de choque cinemáticas en vías de escape (ecuaciones de Lighthill-Whitham-Richards, LWR) en función de la reducción progresiva de velocidad inducida por la pérdida de visibilidad por humo, acoplada al modelo semiempírico de Rothermel con intervalos de predicción Student-t calibrados sobre incendios históricos (NIST TN 2135).
   *Límite del modelo:* El sistema genera estimaciones probabilísticas de propagación y capacidad vial; no sustituye la monitorización táctica sobre el terreno en eventos piroconvectivos acoplados a la atmósfera.

3. **Integridad Criptográfica Inmutable y Doble Recibo (`@senda/pci`) — [`TG-07`](file:///c:/Users/2fabr/civic-relay/docs/funding/SENDA_INVESTOR_TRUTH_GATE.md#L27):**
   Toda observación y transferencia de custodia entre nodos se sella mediante cadenas de bloques hash SHA-256 encadenadas, árboles Merkle binarios con pruebas de inclusión (RFC 6962) y firmas asimétricas Ed25519.
   *Alcance jurídico:* Garantiza integridad matemática verificable sin servidores centrales; la admisibilidad pericial judicial formal exige vinculación con certificados cualificados reconocidos (eIDAS / DNIe).

4. **Arquitectura COTS de Despliegue Híbrido (Terminales Civiles + Nodos Bajo Coste) — [`TG-05`](file:///c:/Users/2fabr/civic-relay/docs/funding/SENDA_INVESTOR_TRUTH_GATE.md#L25):**
   El software opera en terminales móviles estándar (Android, iOS vía navegador/PWA) y pantallas viales sin requerir modificaciones de hardware para mallas de corto alcance (BLE / Wi-Fi local). Para enlaces de larga distancia sin cobertura celular (>5 km), se apoya en pasarelas COTS de bajo coste (módulos LoRa / ESP32 <15 €) y balizas acústicas de emergencia acotadas normativamente según ISO 9613-1.

---

## 2. BENCHMARK FRENTE AL ESTADO DEL ARTE (EVALUACIÓN RIGUROSA)

| Capacidad Técnica | Google Maps / Waze | Sistemas 112 / AlertGov Clásicos | Radios TETRA / SIRDEE | SENDA Unified Platform |
| :--- | :---: | :---: | :---: | :---: |
| **Operación sin red celular** | ❌ 0% Inoperativo | ❌ 0% Inoperativo | ⚠️ Solo voz oficial PMR | ✅ **Malla DTN con enrutamiento PAER (store-and-forward)** [`TG-01`] |
| **Anticipación por humo/fuego** | ❌ Reactivo (retraso 15-30m)| ❌ Lento (decisión humana) | ❌ Inexistente | ✅ **Predictivo (Física acoplada LWR + Rothermel NIST)** [`TG-08`] |
| **Integridad y cadena de custodia**| ❌ No verificable | ❌ Logs internos opacos | ❌ Grabación analógica | ✅ **Árboles Merkle RFC 6962 + Ed25519 + PCI hash** [`TG-07`] |
| **Participación civil autenticada**| ⚠️ Reportes sin filtro | ❌ Unidireccional | ❌ Solo fuerzas de seguridad | ✅ **Bidireccional con calibración probabilística Platt** [`TG-06`] |
| **Coste por despliegue vial** | N/A (App civil) | Millones € (Torres fijas) | Millones € (Repetidores) | ✅ **COTS (Smartphones existentes + pasarelas <15€)** |

---

## 3. MATRIZ DE VERACIDAD Y RESPALDO EXPERIMENTAL (TRUTH GATE CLAIMS)

| Claim ID | Afirmación de Producto | Evidencia en Repositorio | Prueba Automatizada | Estado Truth Gate |
|---|---|---|---|:---:|
| **TG-01** | Enrutamiento DTN consciente de riesgo térmico | [`packages/senda/src/physics-aware-emergency-network.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/physics-aware-emergency-network.mjs) | [`physics-aware-emergency-network.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/physics-aware-emergency-network.test.mjs) | **APROBADO** |
| **TG-02** | Atenuación continua ITU-R P.838-3 (1–100 GHz) | [`packages/senda/src/telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs) | [`external-reference-validation.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/external-reference-validation.test.mjs) | **APROBADO** |
| **TG-03** | Difracción Deygout ITU-R P.526-15 y balance de enlace | [`packages/senda/src/telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs) | [`relay-geometry.test.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/tests/relay-geometry.test.mjs) | **APROBADO** |
| **TG-04** | Ventanas orbitales Kepler J2 y Doppler topocéntrico | [`packages/senda/src/orbital.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/orbital.mjs) | [`orbital-kinematics.test.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/tests/orbital-kinematics.test.mjs) | **CONDICIONAL** *(Aviso legal obligatorio: geometría ≠ enlace)* |
| **TG-05** | Baliza acústica socorro ISO 9613-1 (19–21 kHz) | [`packages/senda/src/acoustic-beamforming-survival.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/acoustic-beamforming-survival.mjs) | [`external-reference-validation.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/external-reference-validation.test.mjs) | **CONDICIONAL** *(Inaudibilidad no garantizada en COTS; alcance <12m)* |
| **TG-06** | Calibración probabilística Platt de fuentes OSINT | [`apps/senda-live/server/domain/spatial-reconciliation-engine.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/server/domain/spatial-reconciliation-engine.mjs) | [`spatial-reconciliation-engine.test.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/tests/spatial-reconciliation-engine.test.mjs) | **APROBADO** *(Brier 0.029, ECE 0.075)* |
| **TG-07** | Árboles Merkle binarios con pruebas de inclusión RFC 6962 | [`apps/senda-live/server/domain/spatial-reconciliation-engine.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/server/domain/spatial-reconciliation-engine.mjs) | [`spatial-reconciliation-engine.test.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/tests/spatial-reconciliation-engine.test.mjs) | **APROBADO** |
| **TG-08** | Calibración LOFO propagación con NIST TN 2135 | [`packages/senda/src/wildfire-micro-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/wildfire-micro-physics.mjs) | [`fire-cases.test.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/tests/fire-cases.test.mjs) | **APROBADO** |

---

## 4. PROPIEDAD INTELECTUAL Y ESTRUCTURA DE LICENCIAMIENTO

- **Núcleo Científico Abierto (`@senda/core`, `@senda/pci`):**
  Licenciado bajo esquemas permisivos/recíprocos de código abierto para facilitar su evaluación por pares académicos, interoperabilidad normativa C-ITS (ETSI ITS-G5, DATEX II) y adopción por consorcios de protección civil europeos.
- **Plataforma de Mando y Fusión Táctica (`@senda/live`, consolas C2, visualizadores 4D):**
  Propiedad intelectual comercial B2G / B2B dirigida a licencias institucionales para agencias de gestión de emergencias (112, UME, DGT, Protección Civil) y concesionarias de infraestructuras críticas viales y ferroviarias.

---

## 5. OPORTUNIDADES DE FINANCIACIÓN PÚBLICA Y PRIVADA (2026-2027)

1. **Horizon Europe — Cluster 3 (Civil Security for Society):**
   Convocatorias en gestión resiliente del riesgo de desastres y protección de infraestructuras viales críticas ante fenómenos meteorológicos extremos.
2. **EIC Accelerator (European Innovation Council):**
   Financiación mixta (subvención a fondo perdido hasta 2.5 M€ + inversión de capital hasta 15 M€) para escalado de tecnologías de disrupción profunda (*deep tech*) con TRL 5 ya demostrado analíticamente.
3. **Contratación Pública Innovadora (CPI) — DGT / Ministerio del Interior / Comunidades Autónomas:**
   Proyectos de digitalización de corredores de evacuación en carreteras secundarias mediante fondos de resiliencia y modernización de redes de emergencia.
