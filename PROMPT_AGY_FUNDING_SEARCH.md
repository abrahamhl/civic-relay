# 🤖 Prompt para Agy: Búsqueda de Oportunidades de Financiación

**Contexto:** Eres un agente especializado en búsqueda de subvenciones, licitaciones y oportunidades de financiación para proyectos tecnológicos de emergencias y protección civil.

**Proyecto:** CIVIC RELAY — Sistema de comunicación de crisis offline-first con mesh networking, store-and-forward y multipath routing.

**Tu misión:** Encontrar y analizar oportunidades ACTIVAS de financiación en España y UE, generar estrategia de presentación optimizada por oportunidad.

---

## 📋 INSTRUCCIONES PARA AGY

### FASE 1: Búsqueda de Oportunidades Activas (30 min)

Busca en estas fuentes (prioridad descendente):

#### 🇪🇸 España (Nacional y CCAA)

1. **CDTI (Centro para el Desarrollo Tecnológico Industrial)**
   - URL: https://www.cdti.es/
   - Programas: I+D+i, Misiones Ciencia e Innovación, Proyectos Colaborativos
   - Buscar: "comunicaciones emergencias", "protección civil", "ciberseguridad"
   - **Deadline próximo:** Convocatorias trimestrales (ene/abr/jul/oct)

2. **Ministerio del Interior (Protección Civil)**
   - URL: https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/ayudas-y-subvenciones/
   - Buscar: Subvenciones equipamiento, infraestructura crítica
   - **Deadline:** Anual (suele abrir marzo-abril)

3. **Red.es (Agenda Digital)**
   - URL: https://red.es/es/convocatorias
   - Programas: Ciudades Inteligentes, Administración Digital
   - Buscar: "gobierno digital", "servicios públicos digitales"

4. **Fondos Next Generation EU (España)**
   - URL: https://planderecuperacion.gob.es/
   - Componentes relevantes:
     - C13: Impulso a la PYME
     - C15: Conectividad digital
     - C11: Modernización AAPP
   - **Deadline:** Convocatorias abiertas hasta 2026

5. **CCAA (Comunidades Autónomas)**
   Buscar en:
   - Comunidad de Madrid: madrid.org (I+D+i, Protección Civil)
   - Generalitat Catalunya: gencat.cat (ACCIÓ)
   - Junta Andalucía: juntadeandalucia.es
   - **Keyword:** "innovación emergencias" / "transformación digital"

#### 🇪🇺 Unión Europea

6. **Horizonte Europa (Horizon Europe)**
   - URL: https://ec.europa.eu/info/funding-tenders/opportunities/portal/
   - Programas relevantes:
     - Cluster 3: Civil Security for Society
     - Cluster 4: Digital, Industry and Space
   - **Keywords:** "disaster resilience", "crisis management", "mesh networks"
   - **Deadline:** Convocatorias anuales (feb-mar)

7. **FEDER (Fondo Europeo de Desarrollo Regional)**
   - URL: https://ec.europa.eu/regional_policy/
   - Programas: Infraestructuras críticas, ciberseguridad
   - Canalizado por CCAA → buscar convocatorias autonómicas

8. **Mecanismo de Protección Civil UE (UCPM)**
   - URL: https://civil-protection-humanitarian-aid.ec.europa.eu/
   - Programas: rescEU, prevención desastres
   - **Deadline:** Convocatorias bianuales

9. **Digital Europe Programme**
   - URL: https://digital-strategy.ec.europa.eu/en/activities/digital-programme
   - Work Programme: Cybersecurity, Digital Skills
   - **Keywords:** "public sector digitalization", "resilient infrastructure"

10. **EIC Accelerator (European Innovation Council)**
    - URL: https://eic.ec.europa.eu/
    - Para startups deep-tech
    - Grant: €2.5M + equity investment hasta €15M
    - **Deadline:** Open calls (continuo)

#### 🏛️ Licitaciones Públicas

11. **Plataforma de Contratación del Sector Público (España)**
    - URL: https://contrataciondelestado.es/
    - Filtros:
      - Tipo: Servicios
      - CPV: 48000000 (Software), 72000000 (Servicios TI)
      - Palabras clave: "emergencias", "protección civil", "112", "comunicaciones"
    - **Monitorizar:** Licitaciones > €100k

12. **TED (Tenders Electronic Daily - UE)**
    - URL: https://ted.europa.eu/
    - Licitaciones internacionales UE
    - Filtros: "emergency communications", "crisis management systems"

---

### FASE 2: Análisis de Oportunidades (15 min por oportunidad)

Para cada oportunidad encontrada, genera un **análisis estructurado**:

#### Plantilla de Análisis

```markdown
## [NOMBRE CONVOCATORIA]

**Organismo:** [CDTI / Ministerio / UE / etc.]
**Programa:** [Nombre específico]
**Budget disponible:** €[cantidad] (total convocatoria)
**Budget por proyecto:** €[min] - €[max]
**Tipo:** Subvención / Préstamo / Licitación
**Deadline:** [fecha exacta]
**URL:** [link oficial]

### Criterios de Elegibilidad
- [ ] Empresa española / UE ✅/❌
- [ ] Tamaño: PYME / Startup / Gran empresa
- [ ] Sector: TIC / Seguridad / Emergencias
- [ ] TRL requerido: [1-9]
- [ ] Consorcio: Requerido Sí/No

### Match con CIVIC RELAY (Score: X/10)

**Fortalezas (por qué encajamos):**
1. [Criterio convocatoria] → [Feature CIVIC RELAY]
2. ...

**Debilidades (gaps a cubrir):**
1. [Requisito no cumplido] → [Cómo mitigar]
2. ...

### Probabilidad de Éxito
- **Competencia estimada:** Alta / Media / Baja
- **Fit proyecto:** [1-10]
- **Madurez requerida:** [prototipo / MVP / producto]
- **Probabilidad adjudicación:** [%]

### Estrategia de Presentación

**Narrativa óptima:**
[2-3 frases posicionando CIVIC RELAY para esta convocatoria específica]

**Partners recomendados:**
- [Entidad 1]: [razón por qué]
- [Entidad 2]: [razón por qué]

**Presupuesto sugerido:**
€[cantidad] desglosado:
- I+D: €X
- Personal: €X
- Equipamiento: €X
- Otros: €X

**Documentos clave a preparar:**
1. [Memoria técnica / Business plan / etc.]
2. ...

### Acción Inmediata
- [ ] Registrar en portal (si aplica)
- [ ] Contactar gestor convocatoria (nombre: [X])
- [ ] Preparar documentación (plazo: [días])
- [ ] Partner search (si consorcio requerido)
```

---

### FASE 3: Priorización de Oportunidades (10 min)

Genera una **tabla resumen** con todas las oportunidades encontradas:

| Convocatoria | Organismo | Budget | Deadline | Match /10 | Prob % | Prioridad |
|--------------|-----------|--------|----------|-----------|--------|-----------|
| [Nombre 1] | CDTI | €200k | 2027-03-15 | 9/10 | 75% | 🔴 ALTA |
| [Nombre 2] | H2020 | €3M | 2027-06-30 | 7/10 | 45% | 🟠 MEDIA |
| ... | ... | ... | ... | ... | ... | ... |

**Criterios de priorización:**
1. Match proyecto (peso: 40%)
2. Probabilidad éxito (peso: 30%)
3. Ratio esfuerzo/retorno (peso: 20%)
4. Timeline deadline (peso: 10%)

**Recomendación TOP 3:**

1. **[Convocatoria X]** (Prioridad 🔴)
   - Por qué: [razones]
   - Próximos pasos: [acción concreta]
   - Deadline: [días restantes]

2. ...

3. ...

---

### FASE 4: Plan de Acción (5 min)

Genera un **Gantt simple** de preparación para las TOP 3 oportunidades:

```
Semana 1:
- [ ] Registrar portales (CDTI, Horizonte)
- [ ] Contactar gestores convocatorias
- [ ] Solicitar modelos formularios

Semana 2:
- [ ] Redactar memoria técnica Convocatoria #1
- [ ] Partner search (si consorcio)
- [ ] Presupuesto detallado

Semana 3:
- [ ] Revisión legal (abogado)
- [ ] Validación técnica (ingeniero senior)
- [ ] Mockups / demos preparados

Semana 4:
- [ ] Envío convocatoria #1
- [ ] Inicio trabajo convocatoria #2
- [ ] ...
```

---

## 🎯 OBJETIVOS DE ÉXITO PARA AGY

Al finalizar, debes haber generado:

1. ✅ **Mínimo 10 oportunidades** identificadas
2. ✅ **Análisis detallado** de TOP 5
3. ✅ **Priorización justificada** (tabla)
4. ✅ **Plan de acción** (4 semanas)
5. ✅ **Contactos clave** (nombres, emails si públicos)

---

## 📊 FORMATO DE ENTREGA

Genera un **único documento Markdown** con esta estructura:

```markdown
# 🎯 Oportunidades de Financiación — CIVIC RELAY
**Fecha búsqueda:** [YYYY-MM-DD]
**Búsqueda realizada por:** Agy (ChatGPT)

## Resumen Ejecutivo
- Total oportunidades: [N]
- Budget potencial total: €[suma]
- TOP 3 recomendadas: [nombres]

## 1. Oportunidades España
### 1.1 CDTI
[análisis según plantilla]

### 1.2 Ministerio Interior
[...]

## 2. Oportunidades UE
### 2.1 Horizonte Europa
[...]

## 3. Licitaciones Activas
[tabla]

## 4. Priorización
[tabla resumen]

## 5. Plan de Acción
[Gantt]

## Anexos
- Links útiles
- Contactos gestores
- Templates formularios
```

**Archivo output:** `FUNDING_OPPORTUNITIES_[YYYY-MM-DD].md`

---

## 🔍 KEYWORDS DE BÚSQUEDA (Optimizadas)

### Español
- "comunicaciones emergencias"
- "protección civil tecnología"
- "sistemas crisis"
- "mesh network desastres"
- "resiliencia infraestructura"
- "112 innovación"
- "ciberseguridad crítica"
- "offline-first emergencias"

### Inglés
- "emergency communications"
- "disaster resilience"
- "crisis management system"
- "mesh networking disaster"
- "offline-first critical"
- "public safety technology"
- "civil protection innovation"
- "resilient infrastructure"

---

## ⚠️ IMPORTANTE: Restricciones

1. **Solo oportunidades ACTIVAS** (deadline > hoy + 30 días)
2. **Verificar URLs** (asegurar links no rotos)
3. **Presupuestos realistas** (no inflar expectativas)
4. **Probabilidades honestas** (no optimismo injustificado)
5. **Partners sugeridos** (solo si contacto real posible)

---

## 🚀 BONUS: Si Tienes Tiempo (Opcional)

### Análisis Competencia

Para cada oportunidad TOP 3, identifica:
- ¿Quién más podría aplicar? (empresas competidoras)
- ¿Han ganado antes convocatorias similares?
- ¿Qué ventaja diferencial tenemos?

### Red de Contactos

Buscar en LinkedIn:
- Gestores de las convocatorias
- Empresas ganadoras anteriores
- Potenciales partners consorcio

**Output:** Lista de 10 contactos clave (nombre + LinkedIn URL)

---

## 📧 ENTREGA FINAL PARA ABRAHAM

**Formato:** 1 documento Markdown + 1 Excel (tabla priorización)

**Ubicación sugerida:**
```
C:\Users\2fabr\civic-relay\funding\FUNDING_OPPORTUNITIES_[DATE].md
C:\Users\2fabr\civic-relay\funding\FUNDING_PRIORITY_TABLE.xlsx
```

**Timeline:** Completar en máximo 2 horas de trabajo efectivo

---

## ✅ CHECKLIST VALIDACIÓN ANTES DE ENTREGAR

- [ ] Todas las URLs verificadas (no 404)
- [ ] Deadlines confirmados (página oficial)
- [ ] Budget ranges verificados (no estimaciones vagas)
- [ ] Match scores justificados (no arbitrarios)
- [ ] Priorización coherente (criterios aplicados consistentemente)
- [ ] Plan de acción realista (4 semanas ejecutable)
- [ ] Documento bien formateado (Markdown válido)
- [ ] Sin errores tipográficos críticos

---

**Prompt preparado por:** Abraham Haddioui (con Claude Code)  
**Para:** Agy (ChatGPT en modo agente)  
**Versión:** 1.0  
**Última actualización:** 2026-09-09

---

## 🎬 CÓMO USAR ESTE PROMPT

### Opción A: ChatGPT Web (chat.openai.com)

1. Copiar este prompt completo
2. Pegar en nuevo chat ChatGPT (modelo o1 o GPT-4)
3. Añadir contexto adicional si necesario:
   ```
   Contexto adicional:
   - Empresa: [nombre]
   - Sede: Madrid, España
   - Tamaño: Startup <10 personas
   - Sector: GovTech / EmergencyTech
   - TRL actual: 5 (prototipo funcional)
   ```

4. Esperar output (15-30 min si Agy trabaja bien)
5. Descargar Markdown generado

### Opción B: ChatGPT API (automatizado)

```python
import openai

prompt = open('PROMPT_AGY_FUNDING_SEARCH.md').read()

response = openai.ChatCompletion.create(
    model="gpt-4-turbo",
    messages=[
        {"role": "system", "content": "Eres un experto en búsqueda de subvenciones para proyectos tecnológicos de emergencias."},
        {"role": "user", "content": prompt}
    ],
    max_tokens=4000
)

output = response.choices[0].message.content
with open(f'FUNDING_OPPORTUNITIES_{date.today()}.md', 'w') as f:
    f.write(output)
```

### Opción C: Agy + Browser Plugin

1. Usar Agy con acceso web (WebPilot / Browsing)
2. Permitir búsqueda activa en URLs
3. Verificación automática deadlines
4. Output más preciso (URLs verificadas)

---

**¡Buena suerte, Agy! 🚀**
