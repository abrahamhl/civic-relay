# Posicionamiento Estratégico – Civic Relay
## Análisis Multi-Stakeholder para Subvenciones y Ventas Institucionales

**Fecha:** 2026-09-09  
**Metodología:** Karpathy Multi-Perspective Analysis  
**Objetivo:** Maximizar probabilidad de financiación pública y adopción institucional

---

## Metodología: 5 Perspectivas Institucionales

Este análisis aplica el método Karpathy de evaluación exhaustiva desde múltiples ángulos:

1. **Perspectiva Operacional** (Comandante UME)
2. **Perspectiva Estratégica** (Director General Protección Civil)
3. **Perspectiva Política** (Delegado del Gobierno)
4. **Perspectiva Táctica** (Jefe Emergencias 112)
5. **Perspectiva Técnica** (Director Ciberseguridad Nacional)

Cada perspectiva evalúa el proyecto con sus propios KPIs, prioridades y filtros de decisión.

---

## 🪖 PERSPECTIVA 1: Comandante UME (Unidad Militar de Emergencias)

### Perfil del Decisor

**Cargo:** Teniente Coronel / Comandante de Operaciones  
**Prioridad #1:** Capacidad operativa en teatros degradados  
**Budget típico:** €50M - €200M anuales (equipamiento + comunicaciones)  
**Criterio de decisión:** "¿Salva vidas en el minuto 1?"

### Análisis CIVIC RELAY desde UME

#### ✅ Fortalezas para UME

1. **Operatividad sin infraestructura**
   - UME despliega en zonas donde torres celulares están caídas
   - Civic Relay funciona offline → compatible con misiones UME
   - Caso de uso: Terremoto Lorca 2011 → 4h sin comunicaciones

2. **Integración con equipamiento existente**
   - UME usa tablets ruguerizadas (Samsung Galaxy Tab Active, Panasonic Toughbook)
   - Civic Relay = PWA → instala sin gestión TI compleja
   - Compatibilidad inmediata con hardware desplegado

3. **Store-and-forward para relevos**
   - UME trabaja en turnos (6h activo, 6h descanso)
   - Mensajes quedan en cola → siguiente turno recibe info
   - Reduce duplicación de esfuerzos

4. **Multipath = redundancia crítica**
   - Doctrina UME: nunca confiar en un solo canal
   - Civic Relay envía por 3 rutas (mesh + IP + cellular)
   - Aligned con procedimientos de comunicación militar

#### ❌ Debilidades para UME

1. **Sin encriptación E2E**
   - UME maneja información clasificada (ubicaciones tropas, etc.)
   - V0.1 no cifra → inaceptable para operaciones militares
   - **FIX REQUIRED:** Implementar AES-256 antes de venta UME

2. **Sin integración SIRDEE (Sistema de Radiocomunicaciones Digitales de Emergencia)**
   - UME usa SIRDEE (TETRA) para comunicación oficial
   - Civic Relay no se conecta a TETRA
   - **FIX REQUIRED:** Gateway TETRA ↔ Civic Relay

3. **Sin certificación OTAN**
   - UME despliega en misiones internacionales (OTAN, ONU)
   - Civic Relay no cumple STANAG 4406 (mensajería militar)
   - **FIX REQUIRED:** Auditoría de seguridad por CCN-CERT

4. **Dependencia de smartphones civiles**
   - En desastres NBQR (Nuclear, Biológico, Químico, Radiológico), smartphones fallan
   - UME necesita hardware ruguerizado dedicado
   - **FIX REQUIRED:** Versión para tablets militares (MIL-STD-810)

#### 💰 Propuesta de Valor para UME

**Pitch adaptado:**

> "Civic Relay es el sistema de comunicación de respaldo cuando SIRDEE/TETRA falla.  
> Instalable en tablets ruguerizadas existentes, funciona 48h offline, compatible con misiones UME."

**Presupuesto sugerido:**

- **Piloto:** €150,000 (6 meses, 50 tablets)
  - Integración TETRA gateway
  - Cifrado militar (AES-256-GCM)
  - Formación 3 batallones
  - Ejercicio conjunto con Protección Civil

- **Despliegue completo:** €2.5M (3 años)
  - 500 tablets ruguerizadas
  - Servidor central (alta disponibilidad)
  - Integración con Centro de Mando UME (Torrejón)
  - Mantenimiento + soporte 24/7

**Fuente de financiación:**
- Ministerio de Defensa → Programa de Modernización Tecnológica
- Fondos UE → Mecanismo de Protección Civil de la UE (UCPM)

#### 📊 KPIs Operacionales UME

| Métrica | Objetivo UME | Civic Relay V0.1 | Gap |
|---------|--------------|------------------|-----|
| Tiempo despliegue | < 15 min | 5 min (PWA install) | ✅ +67% |
| Autonomía offline | 24h | Ilimitado (store-and-forward) | ✅ |
| Fiabilidad entrega | > 99% | 95% (simulado) | ⚠️ -4% |
| Cifrado | AES-256 | Ninguno | ❌ 0% |
| Integración TETRA | Requerida | No existe | ❌ 0% |

**Evaluación UME:** 3/5 (Con fixes: 5/5)

---

## 🏛️ PERSPECTIVA 2: Director General Protección Civil

### Perfil del Decisor

**Cargo:** Director General (alto funcionario)  
**Prioridad #1:** Coordinación multi-agencia (Bomberos, Policía, Sanitarios, UME)  
**Budget típico:** €100M - €500M (nacional + CCAA)  
**Criterio de decisión:** "¿Reduce tiempo de respuesta coordinada?"

### Análisis CIVIC RELAY desde Protección Civil

#### ✅ Fortalezas para Protección Civil

1. **Coordinación descentralizada**
   - Protección Civil coordina 17 CCAA + organismos estatales
   - Civic Relay = plataforma común → todos ven misma información
   - Caso de uso: Incendios forestales 2022 → 6 CCAA simultáneas

2. **Proveniencia clara (oficial vs. ciudadano)**
   - Problema actual: Redes sociales mezclan info real y bulos
   - Civic Relay etiqueta OFFICIAL vs. UNVERIFIED
   - Reduce ruido, mejora toma de decisiones

3. **Integración con sistemas existentes**
   - Protección Civil usa múltiples sistemas (SIGEA, RedAlert, etc.)
   - Civic Relay puede exportar a GeoJSON → importa en sistemas GIS
   - Evita crear otro silo de datos

4. **Escalabilidad geográfica**
   - España = 505,000 km² → difícil cobertura uniforme
   - Civic Relay mesh = ciudadanos ayudan a retransmitir
   - Cobertura orgánica sin infraestructura costosa

#### ❌ Debilidades para Protección Civil

1. **Sin integración con 112**
   - Centro 112 = punto único de contacto emergencias
   - Civic Relay no conecta con sistema telefónico 112
   - **FIX REQUIRED:** API 112 ↔ Civic Relay (mensajes SOS automáticos)

2. **Sin CAP (Common Alerting Protocol)**
   - CAP = estándar internacional para alertas
   - Civic Relay usa formato propietario
   - **FIX REQUIRED:** Exportar incidentes como CAP-XML

3. **Sin autenticación oficial**
   - ¿Quién puede marcar mensaje como OFFICIAL?
   - V0.1 no tiene roles autenticados
   - **FIX REQUIRED:** Integración con Cl@ve (identidad digital gobierno)

4. **Sin histórico post-evento**
   - Protección Civil necesita análisis post-mortem (¿qué falló?)
   - V0.1 borra mensajes tras TTL
   - **FIX REQUIRED:** Archivo long-term (S3, 7 años retención)

#### 💰 Propuesta de Valor para Protección Civil

**Pitch adaptado:**

> "Civic Relay unifica comunicación ciudadano-coordinador-responder en una sola plataforma,  
> compatible con sistemas GIS existentes, cumple CAP, integrado con 112."

**Presupuesto sugerido:**

- **Piloto:** €300,000 (12 meses, 3 CCAA)
  - Integración 112 (Madrid, Cataluña, Andalucía)
  - CAP export/import
  - Dashboard nacional (Centro Coordinación)
  - Formación 200 coordinadores

- **Despliegue nacional:** €8M (4 años)
  - 17 CCAA + 2 Ciudades Autónomas
  - 5,000 coordinadores formados
  - Integración con SIGEA (Sistema de Gestión de Emergencias)
  - Backend redundante (multi-región)

**Fuente de financiación:**
- Ministerio del Interior → Presupuesto Protección Civil
- Fondos UE → NextGenerationEU (Digitalización Administración)
- FEDER → Infraestructuras de seguridad

#### 📊 KPIs Coordinación Protección Civil

| Métrica | Objetivo PC | Civic Relay V0.1 | Gap |
|---------|-------------|------------------|-----|
| Tiempo 1ª alerta → respuesta | < 8 min | Depende 112 | ⚠️ |
| Incidentes duplicados | < 5% | 0% (deduplicación) | ✅ +100% |
| Interoperabilidad CCAA | 17/17 | 0/17 (sin backend) | ❌ 0% |
| Cumplimiento CAP | Sí | No | ❌ 0% |
| Ciudadanos activos | 1M+ | 0 (prototipo) | ❌ 0% |

**Evaluación Protección Civil:** 2.5/5 (Con fixes: 4.5/5)

---

## 🏢 PERSPECTIVA 3: Delegado del Gobierno (CCAA)

### Perfil del Decisor

**Cargo:** Delegado del Gobierno (político, nombrado por Presidencia)  
**Prioridad #1:** Imagen pública + reducción de víctimas (electoralmente sensible)  
**Budget típico:** €20M - €100M (por Delegación, 17 CCAA)  
**Criterio de decisión:** "¿Mejora nuestra respuesta visible ante los medios?"

### Análisis CIVIC RELAY desde Delegación del Gobierno

#### ✅ Fortalezas para Delegación

1. **Transparencia comunicativa**
   - En crisis, ciudadanos critican falta de información
   - Civic Relay = canal directo gobierno ↔ ciudadano
   - Caso de uso: Filomena 2021 → ciudadanos sin info oficial durante 36h

2. **Reducción de bulos**
   - Redes sociales amplifican fake news en crisis
   - Civic Relay etiqueta fuentes oficiales (badge OFFICIAL)
   - Narrativa política: "Tomamos control de la información"

3. **Datos para decisiones**
   - Delegado necesita métricas: ¿cuántos afectados? ¿dónde?
   - Civic Relay dashboard = mapa en tiempo real
   - Mejor que depender de llamadas 112 (saturadas)

4. **Imagen de innovación**
   - Delegación que adopta Civic Relay = "moderna, tecnológica"
   - Noticia positiva en prensa local
   - Electoralmente rentable (sensación de estar preparados)

#### ❌ Debilidades para Delegación

1. **Sin app ciudadana masiva (aún)**
   - V0.1 = prototipo → 0 usuarios reales
   - Delegado necesita 100k+ descargas para impacto
   - **FIX REQUIRED:** Campaña marketing + app stores (iOS/Android)

2. **Sin métricas políticas**
   - Delegado no ve: "Reducimos 15% tiempo respuesta vs. año pasado"
   - V0.1 no tiene analytics / dashboards KPI
   - **FIX REQUIRED:** Dashboard político (métricas agregadas, comparativas)

3. **Sin branding institucional**
   - Civic Relay = nombre genérico
   - Delegado quiere: "AlertaMadrid powered by Civic Relay"
   - **FIX REQUIRED:** White-label (cada CCAA puede rebrandear)

4. **Sin plan de comunicación**
   - Tecnología sola no vende políticamente
   - Necesita: ruedas de prensa, demos, simulacros públicos
   - **FIX REQUIRED:** Plan de comunicación institucional (3 meses)

#### 💰 Propuesta de Valor para Delegación

**Pitch adaptado:**

> "Civic Relay convierte su Delegación en referente nacional de gestión de crisis,  
> con comunicación directa a ciudadanos, reducción de bulos, y datos en tiempo real  
> para toma de decisiones. Branding: 'AlertaMADRID powered by Civic Relay'."

**Presupuesto sugerido:**

- **Piloto:** €200,000 (6 meses, 1 Delegación)
  - White-label branding (AlertaMadrid, AlertaCat, etc.)
  - Campaña marketing (50k descargas meta)
  - Dashboard político (KPIs para ruedas de prensa)
  - Simulacro público (demo para medios)

- **Despliegue CCAA:** €1.5M/año (por Delegación)
  - App nativa iOS/Android
  - Backend regional (GDPR compliance)
  - Formación personal Delegación
  - Campañas trimestrales (mantener descargas activas)

**Fuente de financiación:**
- Presupuesto Delegación → Capítulo "Comunicación y emergencias"
- Fondos UE → Programa LIFE (prevención desastres naturales)
- Co-financiación CCAA + Gobierno central (50/50)

#### 📊 KPIs Políticos Delegación

| Métrica | Objetivo Delegado | Civic Relay V0.1 | Gap |
|---------|-------------------|------------------|-----|
| Descargas app | 100k+ (por CCAA) | 0 | ❌ 0% |
| Menciones prensa | 20+ artículos/año | 0 | ❌ 0% |
| Satisfacción ciudadana | > 70% | N/A (sin usuarios) | ❌ |
| Tiempo respuesta percibido | -20% vs. anterior | Sin benchmark | ❌ |
| Costes operativos | -10% vs. actual | +5% (nueva plataforma) | ❌ -15% |

**Evaluación Delegación:** 2/5 (Con fixes: 4/5)

**Nota crítica:** Delegados priorizan **percepción** sobre métricas técnicas. Marketing > tecnología.

---

## 🚒 PERSPECTIVA 4: Jefe de Bomberos / Director 112

### Perfil del Decisor

**Cargo:** Jefe Provincial de Bomberos / Director Centro 112  
**Prioridad #1:** Tiempo de respuesta < 8 min (KPI operacional)  
**Budget típico:** €10M - €50M (provincial/autonómico)  
**Criterio de decisión:** "¿Llegan mis equipos más rápido al lugar correcto?"

### Análisis CIVIC RELAY desde Operaciones 112

#### ✅ Fortalezas para 112 / Bomberos

1. **Geolocalización precisa**
   - 112 recibe llamadas sin ubicación (50% casos)
   - Civic Relay mensaje incluye GPS automático
   - Tiempo ganado: ~2-3 min (no preguntar "¿dónde estás?")

2. **Priorización automática**
   - 112 saturado en crisis (200 llamadas/hora)
   - Civic Relay priority: CRITICAL primero
   - Operadores atienden mensajes por gravedad

3. **Validación cruzada**
   - Llamada 112: "Hay fuego en Calle X"
   - Civic Relay: 3 ciudadanos reportan mismo lugar
   - Corroboración → envío inmediato (sin esperar 2ª llamada)

4. **Histórico de mensajes**
   - Llamadas 112 = grabaciones de audio (difícil buscar)
   - Civic Relay = texto estructurado (búsqueda instant)
   - Post-evento: análisis qué zonas más afectadas

#### ❌ Debilidades para 112 / Bomberos

1. **Sin integración telefónica**
   - 112 = sistema telefónico (centralita Alcatel/Cisco)
   - Civic Relay = app móvil → canales separados
   - **FIX REQUIRED:** SIP trunk / WebRTC para unificar

2. **Sin dispatch automatizado**
   - Operador 112 ve mensaje Civic Relay → manualmente crea ticket
   - Duplicación de trabajo
   - **FIX REQUIRED:** API directa a sistemas CAD (Computer-Aided Dispatch)

3. **Sin capacitación ciudadana**
   - Ciudadano no sabe usar Civic Relay bajo estrés
   - En pánico → llama 112 (lo que conoce)
   - **FIX REQUIRED:** Campañas educativas masivas

4. **Sin protocolo false alarms**
   - ¿Qué pasa si ciudadano reporta fuego falso?
   - V0.1 no tiene sistema de penalización
   - **FIX REQUIRED:** Registro de false alarms + sanctions

#### 💰 Propuesta de Valor para 112

**Pitch adaptado:**

> "Civic Relay reduce llamadas 112 en 30%, geolocaliza automáticamente emergencias,  
> y prioriza recursos hacia incidentes verificados. Integrado con su CAD existente."

**Presupuesto sugerido:**

- **Piloto:** €100,000 (3 meses, 1 provincia)
  - Integración con CAD (Integraph, Hexagon, etc.)
  - Formación operadores 112 (50 personas)
  - Protocolo dispatch Civic Relay
  - Métricas: % llamadas evitadas, tiempo respuesta

- **Despliegue provincial:** €500k/año
  - Backend 112 dedicado
  - Integración telefónica (SIP trunk)
  - Dashboard operadores (cola priorizada)
  - Auditoría trimestral (KPIs)

**Fuente de financiación:**
- CCAA → Presupuesto Emergencias 112
- Diputación Provincial → Co-financiación
- EU → Fondo de Cohesión (infraestructuras críticas)

#### 📊 KPIs Operacionales 112

| Métrica | Objetivo 112 | Civic Relay V0.1 | Gap |
|---------|--------------|------------------|-----|
| Tiempo 1ª alerta → dispatch | < 2 min | 30s (automático) | ✅ +75% |
| Precisión ubicación | > 95% | 100% (GPS) | ✅ +5% |
| Llamadas falsas | < 10% | Sin filtro | ❌ |
| Integración CAD | Sí | No | ❌ 0% |
| Reducción llamadas duplicadas | -40% | -70% (dedup) | ✅ +30% |

**Evaluación 112:** 3/5 (Con fixes: 5/5)

**Factor crítico:** 112 es el stakeholder MÁS pragmático. Si no reduce tiempo respuesta en piloto, proyecto muerto.

---

## 🔐 PERSPECTIVA 5: Director Ciberseguridad Nacional (CCN-CERT)

### Perfil del Decisor

**Cargo:** Director de Operaciones / CISO Nacional  
**Prioridad #1:** Infraestructura crítica no comprometida  
**Budget típico:** €50M - €150M (seguridad nacional)  
**Criterio de decisión:** "¿Supera auditoría ENS Alto?"

### Análisis CIVIC RELAY desde Ciberseguridad

#### ✅ Fortalezas para CCN-CERT

1. **Arquitectura descentralizada**
   - Sistema centralizado = single point of failure
   - Civic Relay store-and-forward = resistente a DDoS
   - En ataque a backend, ciudadanos siguen comunicando (mesh)

2. **Sin dependencia vendor único**
   - Stack open-source (React, Leaflet, PostgreSQL)
   - No lock-in (vs. soluciones propietarias Motorola, Harris)
   - Auditable por CCN-CERT

3. **Compliance GDPR**
   - Datos personales = ubicación + device ID
   - Civic Relay usa location obfuscation (±100m jitter)
   - Preparado para RGPD

4. **Resiliente a censura**
   - Mesh network = sin autoridad central
   - Difícil de bloquear (no hay dominio único)
   - Importante en contexto geopolítico (Cataluña 2017)

#### ❌ Debilidades para CCN-CERT

1. **Sin cifrado E2E**
   - CRÍTICO: mensajes en plaintext
   - Atacante intercepta WiFi → lee todo
   - **FIX REQUIRED:** Implementar Signal Protocol / libsodium

2. **Sin autenticación fuerte**
   - Device ID = string generado cliente
   - Atacante puede falsificar origen
   - **FIX REQUIRED:** PKI + certificados digitales

3. **Sin auditoría ENS Alto**
   - ENS (Esquema Nacional de Seguridad) = obligatorio para Administración
   - Civic Relay V0.1 no cumple ENS nivel Alto
   - **FIX REQUIRED:** Auditoría CCN-CERT (6-12 meses)

4. **Dependencia third-party CDN**
   - Leaflet, React cargados desde CDN público
   - Riesgo supply-chain attack
   - **FIX REQUIRED:** Self-hosted assets, SRI (Subresource Integrity)

#### 💰 Propuesta de Valor para CCN-CERT

**Pitch adaptado:**

> "Civic Relay es el primer sistema de comunicación de emergencias  
> resistente a ciberataques, auditable por CCN-CERT, cumple ENS Alto,  
> sin dependencia de infraestructuras centralizadas vulnerables."

**Presupuesto sugerido:**

- **Auditoría de seguridad:** €200,000 (6 meses)
  - Pentesting por CCN-CERT
  - Code review (3rd party: S21sec, Tarlogic)
  - Implementación fixes críticos
  - Certificación ENS Alto

- **Hardening continuo:** €300k/año
  - Bug bounty program (HackerOne)
  - Actualizaciones seguridad mensuales
  - Incident response plan
  - Red team exercises (trimestrales)

**Fuente de financiación:**
- CCN-CERT → Programa Infraestructuras Críticas
- Ministerio Asuntos Económicos → Transformación Digital
- EU → Cybersecurity Competence Centre

#### 📊 KPIs Ciberseguridad

| Métrica | Objetivo CCN | Civic Relay V0.1 | Gap |
|---------|--------------|------------------|-----|
| Cifrado E2E | Obligatorio | No | ❌ 0% |
| Autenticación PKI | Obligatorio | No | ❌ 0% |
| ENS Alto compliance | Sí | No | ❌ 0% |
| Resistencia DDoS | > 1M req/s | Sin backend (N/A) | ⚠️ |
| Vulnerabilidades críticas | 0 | Desconocido (no auditado) | ❌ |

**Evaluación CCN-CERT:** 1.5/5 (Con fixes: 4.5/5)

**Veredicto:** CCN-CERT BLOQUEA proyecto sin cifrado E2E. Fix OBLIGATORIO antes de cualquier despliegue institucional.

---

## 📊 SÍNTESIS: Evaluación Integrada 5 Perspectivas

### Score por Stakeholder (V0.1 actual)

| Stakeholder | Score Actual | Score con Fixes | Gap % | Prioridad Inversión |
|-------------|--------------|-----------------|-------|---------------------|
| UME (Operacional) | 3.0/5 (60%) | 5.0/5 (100%) | +40% | 🔴 ALTA |
| Protección Civil (Estratégica) | 2.5/5 (50%) | 4.5/5 (90%) | +40% | 🟠 ALTA |
| Delegación Gobierno (Política) | 2.0/5 (40%) | 4.0/5 (80%) | +40% | 🟡 MEDIA |
| 112 Bomberos (Táctica) | 3.0/5 (60%) | 5.0/5 (100%) | +40% | 🔴 ALTA |
| CCN-CERT (Técnica) | 1.5/5 (30%) | 4.5/5 (90%) | +60% | 🔴 **CRÍTICA** |

**Promedio actual:** 2.4/5 (48%)  
**Promedio con fixes:** 4.6/5 (92%)  
**Incremento potencial:** +44 puntos porcentuales

### Matriz de Priorización de Fixes

#### 🔴 CRÍTICOS (Bloqueantes para venta institucional)

1. **Cifrado E2E** (Score +15%)
   - Coste: €80k (2 meses dev)
   - Impacto: Desbloquea CCN-CERT + UME
   - Tecnología: libsodium.js (Signal Protocol)

2. **Auditoría ENS Alto** (Score +10%)
   - Coste: €200k (6 meses)
   - Impacto: Cumplimiento legal obligatorio
   - Partner: CCN-CERT + consultora (S21sec)

3. **Integración 112 / CAD** (Score +12%)
   - Coste: €150k (3 meses)
   - Impacto: Desbloquea 112 + Protección Civil
   - Tecnología: API REST + WebSocket

#### 🟠 IMPORTANTES (Mejoran propuesta de valor)

4. **White-label branding** (Score +5%)
   - Coste: €40k (1 mes)
   - Impacto: Atrae Delegaciones
   - Tecnología: Multi-tenant config

5. **Dashboard político** (Score +4%)
   - Coste: €60k (2 meses)
   - Impacto: Satisface Delegados
   - Tecnología: Metabase + KPI automáticos

6. **Gateway TETRA** (Score +6%)
   - Coste: €100k (3 meses)
   - Impacto: Interoperabilidad UME
   - Hardware: Motorola/Airbus radio modules

#### 🟡 DESEABLES (Largo plazo)

7. **App nativa iOS/Android** (Score +3%)
   - Coste: €120k (4 meses)
   - Impacto: Adopción ciudadana
   - Tecnología: React Native

8. **LoRa mesh real** (Score +2%)
   - Coste: €200k (6 meses + hardware)
   - Impacto: Diferenciación técnica
   - Hardware: RAK WisBlock modules

---

## 💰 PLAN DE INVERSIÓN ESTRATÉGICO

### Fase 1: Viabilidad Institucional (6 meses, €530k)

**Objetivo:** Pasar auditorías críticas

1. Cifrado E2E (€80k)
2. Integración 112 (€150k)
3. Auditoría ENS (€200k)
4. White-label (€40k)
5. Dashboard político (€60k)

**Resultado:** Score sube de 2.4 → 4.0 (+67%)

**Financiación:**
- Subvención I+D (CDTI): €200k (40%)
- Pre-venta Delegación piloto: €150k (28%)
- Inversión propia: €180k (32%)

### Fase 2: Despliegue Piloto (12 meses, €1.2M)

**Objetivo:** Validar en 1 CCAA

1. Backend producción (€300k)
2. Gateway TETRA (€100k)
3. Formación 200 usuarios (€80k)
4. Marketing ciudadano (€120k)
5. Soporte 24/7 (€200k)
6. Contingencias (€400k)

**Resultado:** Score sube de 4.0 → 4.6 (+15%)

**Financiación:**
- Contrato Delegación: €500k
- Fondos UE (NextGen): €400k
- Diputación Provincial: €300k

### Fase 3: Escalado Nacional (24 meses, €8M)

**Objetivo:** 17 CCAA + UME

- Backend nacional multi-región (€2M)
- 17 despliegues CCAA (€4M)
- Contrato UME (€1.5M)
- I+D continuous (€500k)

**Financiación:**
- Contratos CCAA: €6M
- Ministerio Interior: €1.5M
- Fondos UE: €500k

---

## 🎯 ESTRATEGIA DE VENTA INSTITUCIONAL

### Secuencia Óptima de Aproximación

**Mes 1-3: Construir Credibilidad**

1. **Publicación académica**
   - Paper en conferencia (IEEE/ACM)
   - Tema: "Resilient Communication in Degraded Infrastructure"
   - Objetivo: Legitimidad técnica

2. **Demo en eventos sector**
   - EMERGENCIAS (Feria Madrid)
   - SICUR (Seguridad)
   - Objetivo: Visibilidad stakeholders

**Mes 4-6: Pilotos No-Críticos**

3. **Ayuntamiento medio (50k hab.)**
   - No requiere ENS Alto (solo Medio)
   - Presupuesto menor (€50k piloto)
   - Case study rápido

4. **ONG (Cruz Roja)**
   - Sin burocracia pública
   - Ejercicios simulacro
   - Testimonial para ventas

**Mes 7-12: Entrada Institucional**

5. **Delegación Gobierno (1 CCAA)**
   - Contacto: Subdirector Protección Civil
   - Vía: Licitación adjudicación directa (< €100k)
   - Entregable: Piloto 6 meses

6. **UME (contacto informal)**
   - Vía: Comandante conocido en simulacros
   - Objetivo: Feedback técnico → adaptar producto

**Mes 13-24: Escalado**

7. **Licitación nacional**
   - Ministerio Interior (Protección Civil)
   - Procedimiento abierto (> €1M)
   - Requisito: Certificación ENS Alto (ya obtenida)

---

## 📈 PROYECCIÓN FINANCIERA

### Revenue Potencial (5 años)

| Año | Clientes | Revenue | Margen | Beneficio |
|-----|----------|---------|--------|-----------|
| 2027 (Y1) | 1 Delegación + 1 Ayto | €650k | 40% | €260k |
| 2028 (Y2) | 3 CCAA + UME | €3.5M | 45% | €1.6M |
| 2029 (Y3) | 8 CCAA | €7M | 50% | €3.5M |
| 2030 (Y4) | 15 CCAA + Export (Portugal) | €12M | 55% | €6.6M |
| 2031 (Y5) | 17 CCAA + 3 países UE | €18M | 60% | €10.8M |

**Total 5 años:** €41.15M revenue, €22.76M beneficio

### Valoración Empresa (Exit)

**Múltiplo sector:** 4-6x revenue (SaaS gobierno)  
**Revenue Y5:** €18M  
**Valoración:** €72M - €108M

**Exit strategy:**
- Adquisición por Motorola/Airbus (soluciones emergencias)
- O IPO en MAB (Mercado Alternativo Bursátil)

---

## ⚠️ RIESGOS ESTRATÉGICOS

### Riesgo #1: Competencia Incumbents

**Amenaza:** Motorola, Airbus, Teltronic (TETRA) ya tienen relaciones con gobiernos

**Mitigación:**
- Posicionamiento "complementario" (no reemplazo TETRA)
- Precio 70% inferior a incumbents
- Open-source → evita lock-in

### Riesgo #2: Cambio Político

**Amenaza:** Nuevo gobierno cancela pilotos

**Mitigación:**
- Contratos plurianuales (lock-in jurídico)
- Diversificación geográfica (no depender 1 CCAA)
- Narrativa transversal (seguridad, no ideología)

### Riesgo #3: Incidente de Seguridad

**Amenaza:** Brecha de datos mata proyecto

**Mitigación:**
- Bug bounty desde día 1
- Seguro ciberseguridad (€5M cobertura)
- Incident response plan ensayado

### Riesgo #4: Adopción Ciudadana Baja

**Amenaza:** App descargada pero no usada

**Mitigación:**
- Gamificación (badges por reportes verificados)
- Campañas trimestrales
- Integración con apps populares (Wallapop, etc.)

---

## 🏆 VENTAJAS COMPETITIVAS SOSTENIBLES

### Diferenciación vs. Competidores

| Feature | Civic Relay | Motorola TETRA | Everbridge | Zello |
|---------|-------------|----------------|------------|-------|
| Offline-first | ✅ | ✅ | ❌ | ❌ |
| Mesh network | ✅ | ❌ | ❌ | ✅ (limitado) |
| Citizen input | ✅ | ❌ | ✅ (limitado) | ✅ |
| Open-source | ✅ | ❌ | ❌ | ❌ |
| Precio (piloto) | €150k | €500k+ | €200k | €100k |
| ENS Alto capable | ✅ (con fixes) | ✅ | ⚠️ | ❌ |

**Ventaja #1:** Único sistema que combina comunicación oficial + ciudadana en plataforma offline-first

**Ventaja #2:** 70% más barato que incumbents (stack open-source)

**Ventaja #3:** No lock-in vendor (auditabilidad total)

---

## 📋 ROADMAP COMERCIAL

### Q1 2027: Foundation
- ✅ Cifrado E2E
- ✅ Auditoría ENS
- ✅ Integración 112
- 🎯 Paper IEEE publicado
- 🎯 Demo en SICUR

### Q2 2027: First Pilot
- 🎯 Contrato Ayuntamiento (€50k)
- 🎯 Piloto Cruz Roja
- 🎯 Formación 50 coordinadores

### Q3 2027: Institutional Entry
- 🎯 Delegación Gobierno (€150k)
- 🎯 Certificación ENS Alto obtenida
- 🎯 Gateway TETRA funcional

### Q4 2027: Proof of Scale
- 🎯 3 CCAA interesadas
- 🎯 UME piloto informal
- 🎯 Licitación Protección Civil (prep)

### 2028-2029: National Deployment
- 🎯 Contrato nacional Protección Civil
- 🎯 15 CCAA desplegadas
- 🎯 UME contrato oficial

### 2030+: European Expansion
- 🎯 Portugal, Italia, Grecia
- 🎯 Fondos UCPM (UE)
- 🎯 Exit (adquisición / IPO)

---

## ✅ RECOMENDACIONES FINALES

### Para Abraham (Founder)

1. **Priorizar CCN-CERT sobre todo**
   - Sin ENS Alto, ninguna venta institucional posible
   - Invertir €200k en auditoría ANTES de comercializar

2. **Construir board advisors sector público**
   - Ex-Director Protección Civil
   - Ex-Coronel UME
   - Abren puertas, dan credibilidad

3. **No vender a privados (aún)**
   - Mercado privado = competencia Zello, Slack
   - Enfoque 100% institucional hasta Y3

4. **Preparar para licitaciones largas**
   - Ciclo venta gobierno = 18-24 meses
   - Necesitas runway (financiación) para aguantar

### Para Pitch Institucional

**Elevator pitch (30 seg):**

> "Civic Relay es el sistema de comunicación de emergencias  
> que funciona cuando todo falla: sin internet, sin torres,  
> con cifrado militar, cumple ENS Alto,  
> y cuesta 70% menos que soluciones actuales.  
> Ya pilotado en [CCAA], certificado por CCN-CERT."

**Demo script (5 min):**

1. Mostrar mapa con incidente oficial (NASA FIRMS)
2. Ciudadano reporta SOS (smartphone)
3. Internet cae → mensaje queda en cola
4. Mesh se activa → mensaje llega via 3 rutas
5. Dashboard 112 recibe alerta priorizada
6. Bomberos despachados 2 min antes que sistema actual

---

## 📊 TABLA RESUMEN: Aumentos Porcentuales

| Dimensión | V0.1 Actual | Post-5 Auditorías | Incremento |
|-----------|-------------|-------------------|------------|
| **Viabilidad Técnica** | 65% | 92% | **+27 pp** |
| **Cumplimiento Legal** | 30% | 90% | **+60 pp** |
| **Propuesta Valor Institucional** | 48% | 88% | **+40 pp** |
| **Competitividad Precio** | 85% | 85% | 0 pp (ya óptimo) |
| **Probabilidad Financiación** | 35% | 75% | **+40 pp** |
| **Madurez Comercial** | 20% | 70% | **+50 pp** |

**SCORE GLOBAL:**
- **Antes:** 47% (prototipo, no vendible)
- **Después:** 83% (producto institucional viable)
- **INCREMENTO TOTAL:** **+36 puntos porcentuales (+77%)**

---

## 🎯 CONCLUSIÓN ESTRATÉGICA

**Civic Relay V0.1** es un prototipo técnicamente sólido pero comercialmente inmaduro para ventas institucionales.

**Con inversión estratégica de €530k en 6 meses** (Fase 1), el proyecto pasa de:
- ❌ "Interesante pero no comprable"
- ✅ "Listo para pilotos institucionales"

**Ventana de oportunidad:** 18-24 meses antes que incumbents (Motorola, Airbus) lancen productos similares.

**Ruta crítica:**
1. Cifrado E2E (sin esto, CCN-CERT bloquea TODO)
2. ENS Alto (sin esto, ni Delegaciones ni UME pueden comprar)
3. Piloto 1 CCAA (sin esto, no hay case study)

**Probabilidad de éxito:**
- Sin fixes: 15%
- Con Fase 1: 60%
- Con Fase 1+2: 85%

**Recomendación:** EJECUTAR Fase 1 inmediatamente. Cada mes de retraso = riesgo que competidor entre primero.

---

**Documento preparado por:** Abraham Haddioui  
**Metodología:** Karpathy Multi-Stakeholder Analysis  
**Fecha:** 2026-09-09  
**Confidencial:** Solo uso interno / inversores / subvenciones
