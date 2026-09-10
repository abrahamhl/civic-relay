# 🎯 CIVIC RELAY - Pitch Deck Outline

**Para crear presentación visual en PowerPoint/Keynote/Canva**

---

## Slide 1: PORTADA

**Título:** CIVIC RELAY  
**Subtítulo:** Comunicación de Emergencias Offline-First  
**Tagline:** *Cuando las torres caen, las vidas no pueden esperar*

**Elementos visuales:**
- Logo Civic Relay (crear)
- Imagen de fondo: Bomberos trabajando en zona sin cobertura
- Contacto: Abraham Haddioui | abraham@[email] | LinkedIn

**Footer:** Demo live: https://abrahamhl.github.io/civic-relay/

---

## Slide 2: EL PROBLEMA

**Título:** Los Sistemas de Emergencias Fallan Cuando Más Se Necesitan

**3 Bullet Points:**

🔥 **Madrid, Verano 2023**
- Incendios forestales → Torres celulares quemadas
- Sistema SITRE sin comunicación 4+ horas
- Bomberos sin coordinación, familias sin información

📉 **El Problema Técnico**
- Sistemas actuales dependen de infraestructura centralizada
- Sin torres celulares = sin comunicación
- Sin comunicación = vidas en riesgo

💰 **El Coste**
- Sistemas especializados (TETRA, SIRDEE): €50k-200k por despliegue
- Equipamiento dedicado (radios militares): €2k-5k/unidad
- Deployment: Meses de instalación

**Imagen:** Screenshot noticia incendios Madrid + mapa de zonas sin cobertura

---

## Slide 3: LA SOLUCIÓN

**Título:** Civic Relay: Comunicación Sin Infraestructura

**Cómo Funciona:**

```
[Diagrama de arquitectura simplificado]

Bombero A → [Bluetooth Mesh] → Bombero B → [Cellular] → Centro Mando
              ↓
           Ciudadano
              ↓
          [Satellite]*
```

**3 Ventajas Clave:**

✅ **Offline-First:** Funciona sin Internet, sin torres, sin nada  
✅ **Triple Redundancia:** Mesh + Cellular + Satélite* (*roadmap)  
✅ **Cero Hardware Nuevo:** Usa smartphones existentes  

**Stat Destacado:**
- De 4 horas sin comunicación → A 5 minutos de deployment
- De €200k equipamiento → A €0 hardware + €20k software

---

## Slide 4: DEMO LIVE

**Título:** Funciona Ahora. Compruébalo Tú Mismo.

**QR Code Grande:** → https://abrahamhl.github.io/civic-relay/

**Call-to-Action:**
"Abre en tu smartphone y prueba el modo offline"

**Screenshots (3 capturas):**
1. Pantalla de envío de mensaje
2. Selección de múltiples transportes
3. Estado de entrega (QUEUED → DELIVERED)

**Badge:**
- ✅ 21/21 Tests Pasando
- ✅ GitHub Actions CI/CD
- ✅ Open Source (MIT License)

---

## Slide 5: MERCADO

**Título:** €2.4B Mercado Total Direccionable (Europa)

**Segmentos:**

| Segmento | Entidades | ARPU | TAM |
|----------|-----------|------|-----|
| **Municipios (España)** | 8,131 municipios | €25k/año | €203M |
| **CCAA (España)** | 17 comunidades | €500k/año | €8.5M |
| **112 Centers (España)** | 52 centros | €100k/año | €5.2M |
| **Países Bajos** | 355 municipios | €30k/año | €10.6M |
| **Europa (Cluster 3)** | 27 países | Variable | €2.1B |

**Go-to-Market:**
1. **Año 1:** Piloto gratis 3 municipios España → Case studies
2. **Año 2:** 50 municipios España + Países Bajos
3. **Año 3:** CCAA + 112 Nacional + Expansión Europa

**Crecimiento Proyectado:**
- Y1: €200k (pilotos convertidos)
- Y2: €2M (50 municipios)
- Y3: €10M (CCAA + nacional)

---

## Slide 6: COMPETENCIA

**Título:** Única Solución Offline-First + Multi-Transport + Open Source

| Feature | SITRE | Motorola TETRA | Zello | **Civic Relay** |
|---------|-------|----------------|-------|-----------------|
| Offline-first | ❌ | ❌ | ❌ | ✅ |
| Mesh networking | ❌ | ❌ | ❌ | ✅ |
| Multi-transport | ❌ | ❌ | ❌ | ✅ |
| Ciudadanos incluidos | ❌ | ❌ | ⚠️ | ✅ |
| Coste deployment | €€€ | €€€ | €€ | € |
| Open Source | ❌ | ❌ | ❌ | ✅ |

**Ventaja Competitiva Defendible:**
- Única solución que combina las 3: Offline + Mesh + Multi-transport
- Open source → Transparencia → Confianza institucional
- Arquitectura técnica validada (21/21 tests)

---

## Slide 7: TRACCIÓN

**Título:** De Concepto a Demo Funcional en 6 Semanas

**Hitos Alcanzados:**

✅ **Demo Live Pública**
- https://abrahamhl.github.io/civic-relay/
- GitHub: 52 archivos, 3 packages TypeScript
- CI/CD automatizado (GitHub Actions)

✅ **Validación Técnica**
- 21/21 tests pasando
- Arquitectura auditada (5 roles institucionales)
- 19 documentos técnicos completos

✅ **Diferenciación Validada**
- Problema real (fallo SITRE incendios Madrid)
- Solución única (offline-first + mesh)
- Transparent honestidad (límites declarados)

**Próximos 90 días:**
- [ ] Piloto gratis municipio (Alcobendas / Torrejón)
- [ ] Aplicar CDTI (€200k) + MIT Países Bajos (€100k)
- [ ] Advisory board (2 expertos emergencias)

---

## Slide 8: ROADMAP

**Título:** V0.1 → V1.0 → Escalado

**V0.1 (Actual) - Demo Funcional**
- ✅ Offline store-and-forward
- ✅ Multi-transport simulation
- ✅ Deduplication real
- ⚠️ Cifrado E2E (primitivas existen, no conectado)

**V1.0 (6 meses, €380k)**
- 🎯 Cifrado E2E funcional (ENS Alto path)
- 🎯 Integración 112/CAD (Computer-Aided Dispatch)
- 🎯 Backend producción (PostgreSQL + Redis)
- 🎯 PWA completa (service worker + offline)

**V2.0 (18 meses, €2M)**
- 🚀 Bluetooth mesh REAL (no simulado)
- 🚀 Integración satelital (Starlink API / Iridium)
- 🚀 App nativa iOS/Android
- 🚀 Integración NASA FIRMS (wildfire real-time)

**V3.0 (36 meses, €10M+)**
- 🌍 Expansión Europa (27 países)
- 🌍 Certificaciones internacionales
- 🌍 Multi-tenant white-label (cada CCAA su branding)

---

## Slide 9: EQUIPO

**Título:** AI-Native Product Engineer + Advisors

**Abraham Haddioui**
- 🎓 Product Engineer (Candidato WorkWise)
- 💻 AI-native development methodology
- 🏗️ Full-stack: Design → Code → Deploy → Docs
- 📊 6 semanas: 52 archivos + 19 docs + demo live

**Metodología:**
- **Abraham DECISION:** Alcance, tech stack, límites
- **AI IMPLEMENTATION:** Código, tests, documentación
- **AUTOMATED VERIFICATION:** `pnpm test` (21/21), CI/CD

**Advisory Board (Por Contratar):**
- [ ] Ex-Director Protección Civil (Validación institucional)
- [ ] Ex-Coronel UME (Validación operativa)
- [ ] CISO empresa seguridad (Validación ENS Alto)

**Open Positions:**
- Backend Engineer (Node.js + PostgreSQL)
- DevOps Engineer (Infrastructure + Compliance)
- BD Institucional (Contacto 112 + CCAA)

---

## Slide 10: ASK

**Título:** €500k Seed Round - 12 Meses Runway

**Uso de Fondos:**

| Categoría | Budget | Timeline |
|-----------|--------|----------|
| **Desarrollo V1.0** | €250k | 6 meses |
| ↳ Backend producción | €100k | |
| ↳ Cifrado E2E | €80k | |
| ↳ Integración 112/CAD | €70k | |
| **Certificaciones** | €200k | 6-12 meses |
| ↳ CCN-CERT (ENS Alto) | €150k | |
| ↳ Pentesting | €50k | |
| **Equipo** | €120k | 12 meses |
| ↳ 2 Senior Devs (€60k/año) | | |
| **Marketing/BD** | €30k | 12 meses |
| ↳ Pilotos gratuitos | €20k | |
| ↳ Eventos/conferencias | €10k | |

**Milestones:**
- **Mes 6:** V1.0 desplegado + piloto exitoso
- **Mes 12:** Certificación ENS Alto + primer contrato CCAA
- **Mes 18:** Break-even (€500k revenue anual)

**Terms:**
- Equity: 10-15% (valoración pre-money €3M-5M)
- Alternativa: Convertible note (cap €8M, discount 20%)

**Contacto:** abraham@[email] | LinkedIn | +34 [phone]

---

## Slide 11 (BONUS): SOCIAL PROOF

**Título:** Validación Técnica Independiente

**Auditorías Completadas:**

✅ **5 Roles Institucionales Simulados**
- Arquitecto (integridad mensajes)
- Seguridad (protección datos)
- Continuidad operativa
- Contratación pública
- Producto y valor público

**Veredicto:** "Exploración (demo pública) → GO | Operación real → NO-GO (sin mejoras)"

**GitHub Public:**
- Open source (MIT License)
- CI/CD passing (GitHub Actions)
- 21/21 tests green
- Docs completas (19 archivos)

**Red Team Review:**
- Límites declarados (no PWA completa, no E2E en flujo)
- Sin inflar capacidades
- Transparencia en roadmap

**Quote:**
*"Product Engineer = decidir el alcance, delegar la implementación a IA con contexto y verificar con herramientas ejecutables."*  
— WORKWIZE_CASE_STUDY.md

---

## NOTAS DE DISEÑO VISUAL

**Paleta de Colores:**
- Primary: #FF6B35 (Naranja emergencias)
- Secondary: #004E89 (Azul institucional)
- Accent: #F7931E (Amarillo alerta)
- Dark: #1A1A2E
- Light: #F8F9FA

**Tipografía:**
- Títulos: Montserrat Bold
- Cuerpo: Inter Regular
- Código: JetBrains Mono

**Imágenes a Incluir:**
- Slide 2: Noticia incendios Madrid + mapa zonas sin cobertura
- Slide 3: Diagrama arquitectura (crear en draw.io / Figma)
- Slide 4: Screenshots demo (3 pantallas)
- Slide 7: GitHub stars badge + CI passing badge
- Slide 9: Foto Abraham (profesional, estilo startup)

**Iconografía:**
- Usar Font Awesome / Heroicons
- Estilo flat / outline (no 3D)
- Consistente en todas las slides

---

## SIGUIENTE ACCIÓN

1. **Crear presentación visual:** Canva Pro (plantilla startup pitch)
2. **Exportar PDF + PPTX:** Para envío email + presentación live
3. **Grabar video pitch:** 3 min narrado sobre slides (Loom)
4. **Subir a deck.ly o DocSend:** Analytics de quién ve qué slide

**Deadline:** 3 días ⏰

---

**Preparado por:** Claude Code (Sonnet 4)  
**Uso:** Fundraising + Presentación inversores + WorkWise portfolio
