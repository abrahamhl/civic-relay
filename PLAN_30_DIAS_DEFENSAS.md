# 🛡️ PLAN 30 DÍAS - IMPLEMENTACIÓN DEFENSAS ANTI-INCUMBENTS

**Objetivo:** Construir 7 moats defensivos ANTES que Motorola/Airbus detecten  
**Timeline:** 10 Sep - 10 Oct 2026 (30 días)  
**Responsable:** Abraham Haddioui  
**Prioridad:** 🔴 CRÍTICA - No postponer

---

## 📅 CALENDARIO EJECUTIVO

### Semana 1 (10-16 Sep): Defensas Legales
**Objetivo:** Proteger IP y marca antes de visibilidad pública

### Semana 2 (17-23 Sep): Oscuridad Operativa
**Objetivo:** Reducir visibilidad para retrasar detección

### Semana 3 (24-30 Sep): Pilotos Estratégicos
**Objetivo:** Tracción early para network effects

### Semana 4 (1-7 Oct): Financiación Acelerada
**Objetivo:** Cerrar primeros €100k-200k para runway

---

## 🗓️ SEMANA 1: DEFENSAS LEGALES (10-16 Sep)

### Día 1-2 (Lun 10 - Mar 11 Sep): Contributor License Agreement

**Acción:** Implementar CLA en GitHub

**Pasos:**
1. Crear `CONTRIBUTING.md` con CLA terms
2. Integrar CLA Assistant (GitHub App)
3. Todo contributor debe firmar antes de merge PR
4. Abraham firma como "original author"

**CLA Template:**
```markdown
## Contributor License Agreement

Al contribuir a Civic Relay, aceptas:
1. Otorgar a Abraham Haddioui/Civic Relay derechos comerciales sobre tu código
2. Tu código es MIT para uso open source
3. Civic Relay puede usar tu código en versión Enterprise (commercial)
4. Retienes copyright de tu contribución

Firma: [CLA Assistant auto-firma]
```

**Costo:** €0 (CLA Assistant gratis)  
**Tiempo:** 4 horas  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ CLA live en GitHub
- ✅ 0 contributors pueden hacer PR sin firmar
- ✅ Abraham retiene derechos comerciales

---

### Día 3-4 (Mié 12 - Jue 13 Sep): Trademark Registration

**Acción:** Registrar "Civic Relay"® en España + UE

**Pasos:**
1. **España (OEPM):**
   - Online: https://www.oepm.es/
   - Clase 38 (Telecomunicaciones)
   - Clase 42 (Software)
   - Costo: €150
   - Timeline: 6-12 meses aprobación

2. **UE (EUIPO):**
   - Online: https://euipo.europa.eu/
   - Mismas clases
   - Costo: €850
   - Timeline: 4-6 meses aprobación

**Abogado IP (Opcional):**
- Consultar: Pons IP (Madrid) o Clarke Modet
- Costo: €500-1,000 (revisión + filing)
- **Recomendación:** DIY primero, abogado si objeción

**Costo total:** €1,000-2,000  
**Tiempo:** 8 horas (research + filing)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ Trademark filed España
- ✅ Trademark filed UE
- ✅ Certificado de solicitud (provisional protection)

**Defensa:** Motorola puede fork código, pero NO puede usar nombre "Civic Relay"

---

### Día 5 (Vie 13 Sep): Patent Defensive Pool

**Acción:** Evaluar si patentar 2-3 claims específicos

**Claims candidatos:**
1. "Store-and-forward routing with multi-path deduplication"
2. "Mesh network message propagation with TTL-based expiry"
3. "Cross-transport envelope verification with provenance tracking"

**Decisión:**
- **SI patentar:** Si budget >€10k y quieres defensa fuerte
- **NO patentar:** Si budget limitado y confías en CLA + Trademark

**Costo (si patentamos):**
- Búsqueda prior art: €2k
- Redacción patent attorney: €5k-8k
- Filing España: €500
- Filing EPO (Europa): €3k
- **Total:** €10k-15k

**Recomendación Abraham:**
- **NO patentar ahora** (budget limitado)
- Priorizar CLA + Trademark + velocidad
- Patentar en Serie A (cuando tengas €500k)

**Resultado esperado:**
- ⏸️ Patent postponed hasta Serie A
- ✅ Decision documented

---

## 🗓️ SEMANA 2: OSCURIDAD OPERATIVA (17-23 Sep)

### Día 6-7 (Lun 17 - Mar 18 Sep): GitHub Privado (Temporal)

**Acción:** Mover repo a privado durante 6-12 meses

**Decisión crítica:**
- **Pros privado:** Motorola no puede fork fácilmente
- **Cons privado:** Menos contributors, peor para fundraising ("demo código")

**Estrategia híbrida (RECOMENDADA):**
1. Demo pública: abrahamhl.github.io/civic-relay/ (mantener)
2. Repo privado: github.com/abrahamhl/civic-relay (private)
3. Docs públicas: docs/ folder público (arquitectura, APIs)
4. **Mensaje:** "Código privado durante desarrollo early, se abrirá en Serie A"

**Pasos:**
1. GitHub → Settings → Danger Zone → Change visibility → Private
2. Actualizar README.md público (solo docs):
   ```markdown
   # Civic Relay
   Demo: https://abrahamhl.github.io/civic-relay/
   Docs: https://abrahamhl.github.io/civic-relay/docs/
   Código: Privado (beta). Se abrirá en Q1 2027.
   ```
3. Website estático mantener público (demo funciona)

**Costo:** €0  
**Tiempo:** 2 horas  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ Repo privado
- ✅ Demo funcional público
- ✅ Docs arquitectura públicas
- ❌ Motorola no puede ver código fuente

---

### Día 8-9 (Mié 19 - Jue 20 Sep): NDAs para Pilotos

**Acción:** Preparar NDA template para municipios piloto

**Contenido NDA:**
1. Civic Relay es "confidential information"
2. Municipio NO puede compartir con terceros (incluye Motorola reps)
3. Duración: 24 meses
4. Penalidad: €10k por breach

**Template NDA:**
```markdown
ACUERDO DE CONFIDENCIALIDAD

Entre: Civic Relay (Abraham Haddioui)
Y: [Municipio]

1. INFORMACIÓN CONFIDENCIAL incluye:
   - Código fuente Civic Relay
   - Arquitectura técnica
   - Roadmap de producto
   - Pricing y términos comerciales

2. MUNICIPIO se compromete a:
   - NO compartir con terceros
   - NO reverse-engineer
   - NO usar para desarrollar competidor

3. DURACIÓN: 24 meses desde firma

4. PENALIDAD: €10,000 por breach

Firma: ________________
```

**Abogado (Opcional):**
- Consultar si quieres NDA más robusto
- Costo: €500-1,000

**Costo:** €0-1,000  
**Tiempo:** 4 horas  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ NDA template listo
- ✅ 3 municipios firman NDA antes de piloto

---

### Día 10 (Vie 20 Sep): LinkedIn/Social Media Audit

**Acción:** Eliminar menciones públicas de "Motorola" o "Airbus"

**Pasos:**
1. Buscar en Google: `site:linkedin.com/in/abraham-haddioui "Motorola"`
2. Editar posts que mencionan competencia
3. Nuevos posts: NO mencionar incumbents
4. **Mensaje:** Hablar de "sistemas actuales" (genérico), no nombres

**Posts PERMITIDOS:**
- "Civic Relay funciona offline"
- "Demo live: abrahamhl.github.io/civic-relay"
- "Buscamos pilotos municipales"

**Posts NO PERMITIDOS:**
- "Alternativa a Motorola TETRA"
- "10x más barato que Airbus"
- "Disrumpiendo mercado emergency comms"

**Costo:** €0  
**Tiempo:** 2 horas  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ 0 menciones públicas de competidores
- ✅ Perfil LinkedIn "low-key"

---

## 🗓️ SEMANA 3: PILOTOS ESTRATÉGICOS (24-30 Sep)

### Día 11-13 (Lun 24 - Mié 26 Sep): Contactar 3 Municipios

**Acción:** Email frío a 3 municipios target

**Municipios target:**
1. **Alcobendas** (118k hab, Madrid Norte)
   - Email: proteccioncivil@aytoalcobendas.org
   - Contacto: Concejal Seguridad

2. **Torrejón de Ardoz** (132k hab, Madrid Este)
   - Email: emergencias@ayto-torrejon.es
   - Contacto: Jefe Protección Civil

3. **Getafe** (183k hab, Madrid Sur)
   - Email: proteccioncivil@ayto-getafe.es
   - Contacto: Director Seguridad

**Email template:**
(Usar `funding/EMAIL_TEMPLATES.md` #3)

**Follow-up:**
- Día 3: "Hola, ¿recibiste mi email?"
- Día 7: "Adjunto one-pager con más info"
- Día 14: "Última oportunidad, tenemos 2 plazas piloto"

**Costo:** €0  
**Tiempo:** 6 horas (research + emails + follow-ups)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ 3 emails enviados
- 🎯 1-2 calls agendadas
- 🎯 1 piloto confirmado (realistic)

---

### Día 14-15 (Jue 27 - Vie 28 Sep): Preparar Piloto Kit

**Acción:** Documentación lista para piloto

**Contenido Piloto Kit:**
1. **Setup Guide** (1 página)
   - Cómo instalar app (QR code)
   - Cómo configurar (5 pasos)
   - Cómo reportar emergencia (screenshots)

2. **Training Slides** (10 slides)
   - Qué es Civic Relay
   - Cómo funciona offline
   - Escenarios de uso
   - FAQ

3. **Evaluation Template** (1 página)
   - "¿Funcionó offline? Sí/No"
   - "¿Facilidad de uso 1-10?"
   - "¿Lo recomendarías? Sí/No"
   - Espacio para feedback

4. **NDA** (pre-firmado, listo)

**Costo:** €0  
**Tiempo:** 8 horas (crear docs)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ Piloto Kit completo
- ✅ Listo para enviar a municipio en 24h

---

## 🗓️ SEMANA 4: FINANCIACIÓN ACELERADA (1-7 Oct)

### Día 16-18 (Lun 1 - Mié 3 Oct): Aplicar CDTI Grant

**Acción:** Completar solicitud online CDTI

**Formulario:** https://www.cdti.es/

**Info necesaria:**
- Descripción proyecto (500 palabras)
- Presupuesto desglosado (€200k)
- Timeline (12 meses)
- Equipo (Abraham + 2 devs)
- Impacto esperado (€2M revenue Y2)

**Documentos adjuntos:**
- Pitch deck PDF
- Presupuesto Excel
- CV Abraham
- Carta compromiso (financiación match)

**Costo:** €0  
**Tiempo:** 12 horas (llenar formulario)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ CDTI application submitted
- 🎯 Respuesta en 2-3 meses (Dec 2026)
- 🎯 €200k grant (probabilidad 75%)

---

### Día 19-21 (Jue 4 - Sáb 6 Oct): Aplicar MIT (Países Bajos)

**Acción:** Completar solicitud MIT Innovation Credit

**Formulario:** https://www.rvo.nl/subsidies-financiering/mit

**Info necesaria:**
- Innovation description (English)
- Budget breakdown (€100k)
- Market potential (Netherlands + EU)
- Team (Abraham + advisors)

**Documentos adjuntos:**
- Pitch deck (English version)
- Business plan
- Financial projections

**Costo:** €0  
**Tiempo:** 10 horas (traducir + llenar)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ MIT application submitted
- 🎯 Respuesta en 6-8 semanas (Nov 2026)
- 🎯 €100k grant (probabilidad 70%)

---

### Día 22-23 (Dom 7 - Lun 8 Oct): Email 10 VCs

**Acción:** Outreach a VCs GovTech-focused

**VCs target:**
1. **Nauta Capital** (Barcelona, GovTech)
2. **Seaya Ventures** (Madrid, Impact)
3. **Kfund** (Madrid, Early-stage)
4. **JME Ventures** (Madrid, DeepTech)
5. **Antai Venture Builder** (Barcelona, GovTech)
6. **Samaipata** (Barcelona, B2B)
7. **TheVentureCity** (Madrid/Miami, Global)
8. **Speedinvest** (Vienna, GovTech)
9. **Earlybird** (Berlin, DeepTech)
10. **Cavalry Ventures** (Berlin, B2B SaaS)

**Email template:**
(Usar `funding/EMAIL_TEMPLATES.md` #4)

**Adjuntar:**
- ONE_PAGER_COMERCIAL.pdf
- Link demo: abrahamhl.github.io/civic-relay

**Costo:** €0  
**Tiempo:** 4 horas (research + emails)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ 10 VCs contactados
- 🎯 3-4 respuestas (30-40% open rate)
- 🎯 1-2 calls agendadas

---

### Día 24-25 (Mar 9 - Mié 10 Oct): Advisory Board Confirmación

**Acción:** Conseguir 2 advisors confirmados

**Candidatos:**
1. **Ex-Director Protección Civil** (prioridad #1)
   - Buscar en LinkedIn: "Director General Protección Civil" + "jubilado"
   - Contacto: Email frío (usar template #5)

2. **Ex-Coronel UME** (prioridad #2)
   - Buscar en LinkedIn: "Coronel UME" + "retirado"
   - Contacto: LinkedIn InMail

3. **CISO empresa seguridad** (prioridad #3)
   - Para ENS Alto guidance
   - Buscar: S21sec, Tarlogic, ElevenPaths

**Oferta advisors:**
- Equity: 0.5-1% (4 años vesting)
- Retribución: €1k-2k/mes (según disponibilidad)
- Commitment: 4-6 horas/mes (1 call mensual)

**Costo:** €0 ahora (equity futuro)  
**Tiempo:** 8 horas (research + outreach)  
**Dueño:** Abraham

**Resultado esperado:**
- ✅ 3 candidatos contactados
- 🎯 1 advisor confirmado (realistic)
- 🎯 2 advisors "interesado, hablamos"

---

## 📊 MÉTRICAS DE ÉXITO 30 DÍAS

### Defensas Legales
- [ ] CLA implementado en GitHub
- [ ] Trademark filed España
- [ ] Trademark filed UE
- [ ] NDA template listo

### Oscuridad Operativa
- [ ] Repo GitHub privado
- [ ] 0 menciones públicas de Motorola/Airbus
- [ ] 3 NDAs firmados con municipios

### Pilotos Estratégicos
- [ ] 3 municipios contactados
- [ ] 1 piloto confirmado
- [ ] Piloto Kit completo

### Financiación Acelerada
- [ ] CDTI application submitted
- [ ] MIT application submitted
- [ ] 10 VCs contactados
- [ ] 1 advisor confirmado

**Score de éxito:**
- 12/12 items = 🏆 Perfecto (100%)
- 9/12 items = ✅ Excelente (75%)
- 6/12 items = 🟡 Aceptable (50%)
- <6/12 items = ❌ Re-priorizar

---

## 💰 PRESUPUESTO 30 DÍAS

| Item | Costo | Obligatorio | Opcional |
|------|-------|-------------|----------|
| **CLA GitHub** | €0 | ✅ | |
| **Trademark España** | €150 | ✅ | |
| **Trademark UE** | €850 | ✅ | |
| **Abogado IP** | €500-1k | | 🟡 |
| **NDA template** | €0 | ✅ | |
| **Abogado NDA** | €500-1k | | 🟡 |
| **GitHub Private** | €0 | ✅ | |
| **LinkedIn audit** | €0 | ✅ | |
| **Piloto Kit docs** | €0 | ✅ | |
| **CDTI application** | €0 | ✅ | |
| **MIT application** | €0 | ✅ | |
| **VC outreach** | €0 | ✅ | |
| **Advisory board** | €0 | ✅ | |
| **TOTAL OBLIGATORIO** | **€1,000** | | |
| **TOTAL CON OPCIONAL** | **€3,000** | | |

**Recomendación Abraham:**
- **Mínimo:** €1,000 (solo trademarks)
- **Ideal:** €3,000 (con abogados)

---

## 🚨 RIESGOS Y CONTINGENCIAS

### Riesgo #1: Municipios no responden emails

**Probabilidad:** 60%  
**Impacto:** Medio (sin pilotos, sin tracción)

**Mitigación:**
- Follow-up agresivo (día 3, 7, 14)
- Llamar por teléfono (no solo email)
- Contactar via LinkedIn (Concejal personal)
- Ofrecer "Demo live en su oficina"

---

### Riesgo #2: CDTI/MIT rechazan grants

**Probabilidad:** 30%  
**Impacto:** Alto (sin grants, necesita más equity VC)

**Mitigación:**
- Aplicar simultáneamente a ambos (hedge)
- Si rechazan, aplicar NextGenerationEU (€2M-5M)
- VC backup (10 contactados, 1-2 interesados)

---

### Riesgo #3: Advisors no se comprometen

**Probabilidad:** 50%  
**Impacto:** Bajo (nice-to-have, no bloqueante)

**Mitigación:**
- Contactar 5-6 candidatos (funnel)
- Ofrecer equity generoso (1% vs. 0.5%)
- Posicionar como "founding advisor" (prestigio)

---

### Riesgo #4: Motorola detecta AHORA (antes de 30 días)

**Probabilidad:** 5%  
**Impacto:** Crítico (perdemos ventana)

**Mitigación:**
- GitHub privado ASAP (día 6)
- 0 menciones públicas (día 10)
- NDAs firmados (día 8-9)
- Acelerar pilotos (conseguir 1 en 30 días)

---

## ✅ CHECKLIST DIARIO

**Copiar este checklist y marcar cada día:**

### Semana 1
- [ ] Día 1: CLA template creado
- [ ] Día 2: CLA live en GitHub
- [ ] Día 3: Trademark España filed
- [ ] Día 4: Trademark UE filed
- [ ] Día 5: Patent decision documented
- [ ] Día 6: (Semana 2 empieza)

### Semana 2
- [ ] Día 6: GitHub privado
- [ ] Día 7: README público actualizado
- [ ] Día 8: NDA template creado
- [ ] Día 9: NDA revisado (abogado opcional)
- [ ] Día 10: LinkedIn audit completo
- [ ] Día 11: (Semana 3 empieza)

### Semana 3
- [ ] Día 11: 3 municipios contactados
- [ ] Día 12: Follow-up emails día 3
- [ ] Día 13: 1 call municipio agendada
- [ ] Día 14: Piloto Kit creado
- [ ] Día 15: Piloto Kit revisado
- [ ] Día 16: (Semana 4 empieza)

### Semana 4
- [ ] Día 16: CDTI application started
- [ ] Día 17: CDTI docs attached
- [ ] Día 18: CDTI submitted
- [ ] Día 19: MIT application started
- [ ] Día 20: MIT submitted
- [ ] Día 21: 10 VCs emailed
- [ ] Día 22: Advisory board outreach
- [ ] Día 23: 1 advisor call agendada

---

## 🎯 SIGUIENTE PASO INMEDIATO

**AHORA MISMO (próximas 2 horas):**

1. **Crear CLA** (30 min)
   - Copiar template de este documento
   - Pegar en `CONTRIBUTING.md`
   - Push a GitHub

2. **Aplicar Trademark España** (1 hora)
   - Ir a: https://www.oepm.es/
   - Registrar cuenta
   - Llenar formulario "Civic Relay"
   - Pagar €150

3. **GitHub privado** (15 min)
   - Settings → Change visibility → Private
   - Confirmar

4. **Email primer municipio** (15 min)
   - Alcobendas: proteccioncivil@aytoalcobendas.org
   - Subject: "Propuesta Piloto Gratuito - Sistema Comunicación Emergencias"
   - Cuerpo: Template #3 de EMAIL_TEMPLATES.md
   - Enviar

**Total tiempo:** 2 horas  
**Total costo:** €150  
**Impact:** 🔥 Máximo (defensas críticas + primer piloto outreach)

---

**Preparado por:** Claude Code (Sonnet 4)  
**Uso:** Plan de ejecución 30 días + Checklist diario  
**Clasificación:** INTERNO - Abraham execution roadmap

---

**🚀 EMPIEZA HOY. CADA DÍA CUENTA EN LA VENTANA DE 18 MESES.**
