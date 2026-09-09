# Plan de Implementación MVP Institucional
## Civic Relay V0.1 → V0.5 (MVP Defendible)

**Objetivo:** Convertir prototipo en MVP presentable a instituciones en 6 semanas  
**Inversión:** €180k (recursos propios) + €200k (CDTI solicitado)  
**Timeline:** 6 semanas (sprint intensivo)

---

## 🎯 6 Mejoras Críticas Priorizadas

### Mejora #1: Cifrado E2E (Seguridad)
**Stakeholders:** CCN-CERT (bloqueante), UME, Protección Civil  
**Coste:** €80k  
**Tiempo:** 2 semanas (Sprint 1-2)

#### Tareas
1. **Implementar libsodium.js**
   - Generar keypair Ed25519 por dispositivo
   - Cifrado X25519 + ChaCha20-Poly1305
   - Firma digital de mensajes

2. **Key management**
   - LocalStorage encrypted (Web Crypto API)
   - Backup seguro (12-word mnemonic)
   - Rotación de claves (mensual)

3. **UI cambios**
   - Badge "🔒 Cifrado E2E" en mensajes
   - Verificación huella digital (QR codes)
   - Warning si mensaje no cifrado (degraded mode)

#### Entregable
- ✅ 100% mensajes cifrados
- ✅ Documentación crypto (para auditoría CCN-CERT)
- ✅ Tests unitarios (libsodium correctness)

#### Archivos afectados
```
packages/core/src/crypto.ts (nuevo)
packages/schemas/src/message.ts (añadir encrypted: boolean)
apps/web/src/components/MessageQueue.tsx (badge cifrado)
```

---

### Mejora #2: Integración 112/CAD (Operacional)
**Stakeholders:** 112, Bomberos, Protección Civil  
**Coste:** €150k  
**Tiempo:** 2 semanas (Sprint 3-4)

#### Tareas
1. **API REST /api/cad**
   - Endpoint: POST /api/cad/dispatch
   - Payload: MessageEnvelope → CAD ticket
   - Auth: API key + IP whitelist

2. **Webhook incoming**
   - Endpoint: POST /api/messages/from-112
   - Permite 112 enviar mensajes a ciudadanos
   - Autenticación JWT

3. **Mock CAD para demo**
   - Simular Integraph / Hexagon CAD
   - Dashboard fake "112 Operator Console"
   - Mostrar mensaje llegando en tiempo real

#### Entregable
- ✅ API REST documentada (OpenAPI spec)
- ✅ Mock CAD funcional (para demos)
- ✅ Video demo (2 min, mensaje SOS → dispatch 112)

#### Archivos afectados
```
packages/api/ (nuevo package)
packages/api/src/cad-integration.ts
packages/api/src/routes.ts
apps/web/src/components/CADMockDashboard.tsx (demo)
```

---

### Mejora #3: White-label Branding (Comercial)
**Stakeholders:** Delegaciones Gobierno, CCAA  
**Coste:** €40k  
**Tiempo:** 1 semana (Sprint 5)

#### Tareas
1. **Multi-tenant config**
   - Archivo `config/tenants/{tenant-id}.json`
   - Branding: logo, colores, nombre app
   - Dominio custom (alertamadrid.com, alertacat.cat)

2. **UI adaptable**
   - Cargar tenant config en runtime
   - CSS variables (colores primarios, secundarios)
   - Logo reemplazo (header, splash screen)

3. **Ejemplos tenants**
   - AlertaMadrid (Comunidad de Madrid)
   - AlertaCat (Generalitat Catalunya)
   - EmergencyCV (Comunitat Valenciana)

#### Entregable
- ✅ 3 demos branded funcionando
- ✅ Guía configuración tenant (5 min setup)
- ✅ Screenshots para propuestas comerciales

#### Archivos afectados
```
config/tenants/alertamadrid.json (nuevo)
config/tenants/alertacat.json (nuevo)
apps/web/src/config/tenant.ts (loader)
apps/web/src/App.css (CSS variables)
```

---

### Mejora #4: Dashboard Político (Presentación)
**Stakeholders:** Delegados Gobierno, Directores Protección Civil  
**Coste:** €60k  
**Tiempo:** 1 semana (Sprint 6)

#### Tareas
1. **KPIs agregados**
   - Total mensajes / día
   - Tiempo medio respuesta
   - % mensajes verificados
   - Mapa calor (zonas más activas)

2. **Comparativas**
   - Mes actual vs. mes anterior
   - CCAA vs. CCAA (ranking)
   - Tipo incidente más frecuente

3. **Export reports**
   - PDF automático (mensual)
   - Excel export (datos raw)
   - Gráficos para ruedas de prensa

#### Entregable
- ✅ Dashboard político (URL: /dashboard/political)
- ✅ Mockups con datos simulados (impresionantes)
- ✅ Video demo (3 min, "números para rueda prensa")

#### Archivos afectados
```
apps/web/src/pages/PoliticalDashboard.tsx (nuevo)
packages/core/src/analytics.ts (agregaciones)
apps/web/src/components/KPICard.tsx (visualización)
```

---

### Mejora #5: Preparación ENS Alto (Documentación)
**Stakeholders:** CCN-CERT, todas las AAPP  
**Coste:** €50k (prep docs, no auditoría completa)  
**Tiempo:** Continuo (paralelo a otros sprints)

#### Tareas
1. **Documentación ENS**
   - Análisis de riesgos
   - Plan de seguridad
   - Procedimientos operacionales
   - Registro de activos

2. **Compliance checklist**
   - ENS Categoría ALTO (checklist)
   - RGPD compliance (DPO designado)
   - Ley 39/2015 (Procedimiento Administrativo)

3. **Security hardening**
   - HTTPS obligatorio (HSTS)
   - CSP headers
   - Rate limiting
   - Logs auditoría

#### Entregable
- ✅ Documento ENS (80 páginas, template CCN-STIC)
- ✅ Checklist compliance (Excel, 200 items)
- ✅ Security.txt (RFC 9116)

#### Archivos afectados
```
docs/ENS_COMPLIANCE.md (nuevo)
docs/RISK_ANALYSIS.md (nuevo)
docs/SECURITY_PROCEDURES.md (nuevo)
SECURITY.txt (raíz repo)
```

---

### Mejora #6: GitHub Deployment + CI/CD (Profesional)
**Stakeholders:** Todos (credibilidad técnica)  
**Coste:** €0 (GitHub Actions gratis)  
**Tiempo:** 3 días (dentro Sprint 6)

#### Tareas
1. **GitHub repo público**
   - Licencia: MIT (open-source)
   - README impecable (badges, screenshots)
   - CONTRIBUTING.md
   - CODE_OF_CONDUCT.md

2. **CI/CD pipeline**
   - GitHub Actions: build on push
   - Tests automatizados (cuando Jest config)
   - Deploy preview (Vercel / Netlify)
   - Release automático (tags)

3. **GitHub Pages demo**
   - Demo live: civic-relay.github.io
   - Actualiza automáticamente (main branch)
   - Analytics (plausible.io, privacy-friendly)

#### Entregable
- ✅ Repo público: github.com/civic-relay/civic-relay
- ✅ Demo live funcionando
- ✅ Badge "build passing" en README

#### Archivos afectados
```
.github/workflows/ci.yml (nuevo)
.github/workflows/deploy.yml (nuevo)
README.md (actualizar con badges)
CONTRIBUTING.md (nuevo)
```

---

## 📅 Cronograma Sprint (6 Semanas)

### Semana 1-2: Seguridad (Sprint 1-2)
- Día 1-3: Implementar libsodium.js
- Día 4-7: Key management + UI
- Día 8-10: Tests + documentación crypto
- **Entregable:** Cifrado E2E funcional

### Semana 3-4: Operaciones (Sprint 3-4)
- Día 11-14: API REST /api/cad
- Día 15-17: Mock CAD + webhook
- Día 18-20: Video demo integración 112
- **Entregable:** Integración 112/CAD lista

### Semana 5: Comercial (Sprint 5)
- Día 21-23: Multi-tenant config
- Día 24-25: 3 demos branded
- **Entregable:** White-label funcional

### Semana 6: Presentación (Sprint 6)
- Día 26-28: Dashboard político
- Día 29-30: GitHub deployment + CI/CD
- **Entregable:** MVP completo

**Paralelo (semanas 1-6):** Documentación ENS (1h/día, acumulado)

---

## 💰 Presupuesto Detallado

| Mejora | Dev | QA | Docs | Total |
|--------|-----|----|----- |-------|
| #1 Cifrado E2E | €60k | €10k | €10k | €80k |
| #2 Integración 112 | €100k | €30k | €20k | €150k |
| #3 White-label | €30k | €5k | €5k | €40k |
| #4 Dashboard político | €45k | €10k | €5k | €60k |
| #5 Prep ENS | €0 | €0 | €50k | €50k |
| #6 GitHub CI/CD | €0 | €0 | €0 | €0 |
| **TOTAL** | **€235k** | **€55k** | **€90k** | **€380k** |

**Fuentes financiación:**
- Recursos propios: €180k (47%)
- CDTI (solicitado): €200k (53%)

---

## 🎯 Organización por Stakeholder

### Para UME (Comandante)
**Mejoras prioritarias:** #1 (Cifrado), #2 (112)  
**Documentos entregar:**
- Video demo: Mensaje cifrado E2E → llegada 112
- Documento: "Integración SIRDEE/TETRA (Roadmap)"
- Presupuesto piloto: €150k (6 meses, 50 tablets)

### Para Protección Civil (Director General)
**Mejoras prioritarias:** #2 (112), #4 (Dashboard)  
**Documentos entregar:**
- Dashboard político (KPIs CCAA)
- Documento: "Interoperabilidad con sistemas existentes"
- Presupuesto piloto: €300k (12 meses, 3 CCAA)

### Para Delegación Gobierno (Delegado)
**Mejoras prioritarias:** #3 (Branding), #4 (Dashboard)  
**Documentos entregar:**
- Mockup "AlertaMadrid" branded
- PDF: "Impacto mediático de adopción tecnológica"
- Presupuesto piloto: €200k (6 meses, 1 Delegación)

### Para 112 (Jefe Bomberos)
**Mejoras prioritarias:** #2 (112)  
**Documentos entregar:**
- API docs (OpenAPI spec)
- Video demo: SOS → dispatch automático 112
- Presupuesto piloto: €100k (3 meses, 1 provincia)

### Para CCN-CERT (Director Ciberseguridad)
**Mejoras prioritarias:** #1 (Cifrado), #5 (ENS)  
**Documentos entregar:**
- Documento ENS compliance (80 páginas)
- Análisis de riesgos
- Solicitud auditoría oficial CCN-CERT (€200k)

---

## 📊 Matriz de Impacto Mejoras × Stakeholders

|  | UME | PC | Delegación | 112 | CCN-CERT |
|--|-----|----|-----------|----|----------|
| #1 Cifrado E2E | 🔴 | 🟡 | 🟢 | 🟡 | 🔴 |
| #2 Integración 112 | 🔴 | 🔴 | 🟡 | 🔴 | 🟢 |
| #3 White-label | 🟢 | 🟡 | 🔴 | 🟢 | 🟢 |
| #4 Dashboard político | 🟢 | 🔴 | 🔴 | 🟡 | 🟢 |
| #5 Prep ENS | 🟡 | 🟡 | 🟢 | 🟡 | 🔴 |
| #6 GitHub CI/CD | 🟡 | 🟡 | 🟢 | 🟢 | 🟡 |

🔴 = Crítico (bloqueante para venta)  
🟡 = Importante (mejora propuesta)  
🟢 = Nice-to-have (diferenciación)

---

## 🚀 Siguientes Pasos Inmediatos

### Esta Semana (Semana 0: Preparación)

**Día 1-2: Setup técnico**
- [ ] Crear branches feature/* para cada mejora
- [ ] Setup GitHub Actions (CI/CD básico)
- [ ] Instalar libsodium.js + dependencias

**Día 3-4: Fundraising**
- [ ] Solicitud CDTI (formulario €200k)
- [ ] Reunión CFO (confirmación €180k internos)
- [ ] Contratar freelancers (2 devs senior)

**Día 5-7: Kickoff**
- [ ] Sprint planning (Jira / Linear)
- [ ] Asignación tareas (dev team)
- [ ] Daily standups (9am)

### Próxima Semana (Semana 1: Sprint 1)
- Cifrado E2E (libsodium implementation)

---

## 📈 KPIs de Éxito (Post-6 Mejoras)

| KPI | V0.1 Actual | Meta V0.5 | Medición |
|-----|-------------|-----------|----------|
| Score viabilidad institucional | 47% | 83% | 5 auditorías |
| Cumplimiento ENS Alto | 30% | 85% | Checklist CCN |
| Demos branded | 0 | 3 | Functional |
| Integración 112 | No | Sí (mock) | API docs |
| Cifrado E2E | No | Sí (100%) | Tests pass |
| GitHub stars | 0 | 100+ | Organics |

---

## 🎬 Hitos de Presentación

### Hito 1: Demo Técnico (Semana 2)
**Audiencia:** CTOs, ingenieros  
**Contenido:** Cifrado E2E funcionando  
**Duración:** 15 min

### Hito 2: Demo Operacional (Semana 4)
**Audiencia:** Jefes 112, coordinadores  
**Contenido:** Integración CAD mock  
**Duración:** 20 min

### Hito 3: Demo Comercial (Semana 5)
**Audiencia:** Delegados, directores  
**Contenido:** 3 tenants branded + dashboard político  
**Duración:** 10 min (pitch style)

### Hito 4: Presentación Institucional (Semana 6)
**Audiencia:** Todos stakeholders  
**Contenido:** MVP completo + GitHub público  
**Duración:** 45 min (Q&A included)

---

## 📋 Checklist Pre-Presentación Institucional

**Técnico:**
- [ ] Build passing (CI green)
- [ ] 0 vulnerabilidades críticas (npm audit)
- [ ] HTTPS everywhere
- [ ] Demo live accesible públicamente

**Documentación:**
- [ ] README actualizado (badges, screenshots)
- [ ] Docs ENS (80 páginas) listos
- [ ] API docs (OpenAPI) publicados
- [ ] Videos demos (3 × 2-3 min) subidos YouTube

**Comercial:**
- [ ] 3 propuestas personalizadas (UME, PC, Delegación)
- [ ] Presupuestos detallados (Excel)
- [ ] Slide deck (30 slides, brand professional)
- [ ] Mockups impresos (A4, color)

**Legal:**
- [ ] Licencia MIT (confirmada)
- [ ] CONTRIBUTING.md (community guidelines)
- [ ] SECURITY.txt (disclosure policy)
- [ ] Terms of Service (template, no final)

---

## 🏆 Definición de "MVP Defendible"

**Criterios mínimos para presentación institucional:**

1. ✅ **Seguridad:** Cifrado E2E + documentación ENS
2. ✅ **Operatividad:** Integración 112 (mock funcional)
3. ✅ **Presentación:** 3 demos branded + dashboard político
4. ✅ **Credibilidad:** GitHub público + CI/CD + docs completas
5. ✅ **Viabilidad:** Presupuestos detallados por stakeholder
6. ✅ **Cumplimiento:** Checklist ENS 85% completo

**Si falta 1 de estos 6 → NO presentar aún (riesgo reputacional)**

---

## 💡 Lecciones de Proyectos Similares

### Caso 1: Zello (Push-to-Talk)
**Éxito:** Adoptado por bomberos USA (Huracán Harvey)  
**Clave:** Demo funcionando en desastre real  
**Lección:** Buscar oportunidad piloto en emergencia pequeña

### Caso 2: Everbridge (Mass Notification)
**Éxito:** Contrato con 1,000+ gobiernos  
**Clave:** Cumplimiento legal desde día 1  
**Lección:** ENS Alto no es opcional, es requisito

### Caso 3: PulsePoint (Respuesta Cardiac Arrest)
**Éxito:** 4,000+ agencies, salvó vidas documentadas  
**Clave:** Métricas impacto (vidas salvadas)  
**Lección:** Dashboard político con "X vidas salvadas" vende

---

## 🎯 Objetivo Final (Post-6 Mejoras)

**Estado actual:** Prototipo impresionante, no vendible  
**Estado objetivo:** MVP defendible, listo para pilotos institucionales

**Probabilidad venta institucional:**
- Antes 6 mejoras: 15%
- Después 6 mejoras: 60%
- Después piloto exitoso: 85%

**Timeline hasta primer contrato:**
- Hoy: Semana 0 (preparación)
- +6 semanas: MVP listo
- +3 meses: Piloto acordado (Delegación)
- +9 meses: Primera venta confirmada (€300k-€500k)

---

**Documento preparado por:** Abraham Haddioui  
**Para:** Ejecución interna + presentación inversores  
**Próxima revisión:** Semana 6 (post-implementación)  
**Confidencial:** Uso interno
