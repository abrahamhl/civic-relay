# Civic Relay / OEP — Estrategia España + Países Bajos, protección del nombre y foco

**Fecha:** 2026-11-05 · Complementa `RUTAS_FINANCIACION_Y_PROMOCION_2026-11.md`. Estrategia de trabajo: no es asesoramiento jurídico ni una solicitud enviada. Nivel real del producto: TRL ≈ 3, 0 % de validación física.

## 1. El momento ferroviario: qué es verificable y cómo usarlo

**Hechos (fuentes de prensa; cifras de víctimas discrepan entre medios, verificar en comunicados oficiales antes de citarlas):**
- Adamuz (Córdoba), 18-ene-2026; Urda (Toledo), 28-oct-2026 (un tren detenido embestido por otro).
- 9-feb-2026: acuerdo Gobierno-sindicatos de 25 puntos (mantenimiento, plantilla, financiación de Adif 2026-2030). El Gobierno defiende un plan 2025-2030 de 8.000 M€.
- Tras Urda, el presidente admite carencias y se anuncian investigaciones y ayudas a afectados; el PP anuncia una comisión de investigación en el Senado.

**Corrección importante de la hipótesis “va a haber una inyección de capital”:** lo que aparece en las fuentes es inversión en **mantenimiento e infraestructura** (vía, personal, financiación de Adif), no un fondo identificable para continuidad de comunicaciones de emergencia. No he encontrado ninguna convocatoria de 2026 de Adif para startups ni un fondo de emergencias de ese tipo. Es una oportunidad **política y de agenda**, no una partida que se pueda solicitar hoy.

**Encaje honesto del producto:** OEP **no previene accidentes** (eso es señalización, mantenimiento, ERTMS). Su hipótesis es la **continuidad de comunicaciones y coordinación después** de un incidente (túneles, zonas sin cobertura, saturación de red, localización de equipos y estado de personas con consentimiento). Se plantea como *escenario simulado S09 “incidente ferroviario”*, no como solución probada.

**Reglas de tono (importantes para reputación y para el truth gate):**
- No usar imágenes, nombres ni cifras de víctimas en material promocional; no “aprovechar” la tragedia. Mensaje: respeto + “cómo mejorar la coordinación”.
- No decir que OEP habría cambiado el resultado de Adamuz o Urda.
- No contactar a víctimas ni a investigaciones en curso; dirigirse a gestores (Adif, Protección Civil, ADIF/RIH, universidades).

## 2. Cómo evitar que te “quiten el nombre” o se adelanten

**Lo que no te protege hoy:** el repositorio público con commits fechados es *prueba de anterioridad* (útil), pero en España/UE los derechos de marca se adquieren **registrando** (primero en solicitar). La licencia **MIT** permite a cualquiera copiar el código y venderlo; no protege el nombre.

**Qué he comprobado (búsqueda web, no es una búsqueda oficial de anterioridades):**
- No encontré un producto o marca exacta “Civic Relay”. Sí hay nombres cercanos: *Relay* (Relay Software, app de reportes no urgentes) y *CivicReady* (CivicPlus, notificaciones de emergencia), y dos solicitudes USPTO de software de emergencias de titular no identificado.
- **“OEP” es una sigla corta y genérica**: riesgo alto de colisión; no la uses como única marca.
- **Dominios libres hoy** (consulta de registro, sin reservar nada): `civicrelay.eu`, `civicrelay.es`, `civicrelay.nl`, `civicrelay.app`, `civic-relay.eu`, `oep-protocol.eu`. **Ocupados:** `civicrelay.com`, `civicrelay.org`. Hoy el dominio “oficial” es un subdominio de vercel.app, que resta credibilidad y no es tuyo.

**Plan de protección (orden por coste/beneficio):**
1. **Esta semana:** búsqueda de anterioridades en TMview / EUIPO / OEPM / BOIP (gratuita) y comprar `.eu` + `.es` + `.nl` (coste bajo; decisión y pago tuyos).
2. **Registrar la marca** “Civic Relay” (denominativa; clases a confirmar con un agente de la propiedad industrial, probablemente 9, 38 y 42). OEPM: ~125 € primera clase por vía telemática según un despacho (verificar en la tabla oficial 2026). EUIPO: marca UE y **SME Fund**, bono de hasta 700 € para marcas hasta el **4-dic-2026** o fin de fondos, pero exige ser pyme de la UE y la OEPM avisa de que el Bono 2 está cerrado temporalmente: verificar. Se puede solicitar a título personal y ceder después a la sociedad.
3. **Depósito fechado y citable:** `CITATION.cff` (incluido) + archivo de la versión en Zenodo/Software Heritage (necesita que lo actives tú desde tu cuenta de GitHub/Zenodo).
4. **Política de marca** (`TRADEMARKS.md`, borrador incluido): el código es libre; el nombre y logotipo no.
5. **Licencia (decisión tuya, no la he cambiado):** las versiones ya publicadas con MIT seguirán siendo MIT para siempre. Para las nuevas, opciones: (a) mantener MIT + política de marca (máxima adopción, compatible con fondos abiertos); (b) Apache-2.0 (añade concesión de patentes); (c) AGPL-3.0 en gateway/servidor + licencia comercial dual (frena que una gran empresa lo cierre como SaaS). Recomendación provisional: (b) o (c) para lo que vayas a comercializar, tras consultar a un abogado.
6. **Autoría y IA:** el repo declara que se generó con ayuda de IA. En la UE la protección por derecho de autor exige originalidad humana; guarda registros fechados de tu autoría (visión, decisiones, transcripción de voz, revisiones). Consultar a un abogado.

## 3. Foco: una frase, un comprador, un piloto

El riesgo de dispersión es real: 20 módulos, 8 escenarios, globo 3D, cámaras, satélites, drones. Para financiadores, el mensaje debe caber en 10 segundos.

- **Frase:** *“Civic Relay mantiene coordinadas a las personas y equipos cuando la red falla, con evidencia verificable de cada mensaje.”*
- **Un comprador inicial:** gestor de emergencias local (Protección Civil/ayuntamiento en España; veiligheidsregio en NL) en un **simulacro** con datos sintéticos.
- **Un piloto:** 12 semanas, 3–5 móviles, ≥30 intentos, informe firmado por un tercero (`docs/investor/PILOT_PROPOSAL.md`).
- **En portada:** problema → demo de 60 s → piloto pedido. Los 20 módulos pasan a anexo (“hoja de ruta”).
- **Qué no hacer:** vender ferroviario, satélite, drones o cámaras como capacidad. Son escenarios o contratos, no producto.

## 4. Quién pone el dinero para pruebas físicas y auditorías

No he encontrado **ninguna convocatoria abierta** que financie exactamente “pruebas físicas de comunicaciones de emergencia de un fundador individual”. Lo más cercano:

| Vía | Qué es | Estado verificado | Acción |
|---|---|---|---|
| **Universidad como socio de ensayo** (UPV, UPM, UC3M, TU Delft, Twente, TNO…) | Contrato de I+D o proyecto conjunto; el centro aporta equipo, bancos de pruebas e informe independiente | Sin contacto aún | Vía más rápida a pruebas + auditoría creíble. Un contrato universidad-empresa en España suele articularse con el art. 83 LOU (verificar) |
| **CDTI — Compra Pública Innovadora** | Compra pre-comercial de prototipos y demostradores (CDTI prevé ~75 M€ en 2026 según una fuente) | No hay convocatoria concreta de emergencias; requiere un organismo comprador | Pedir a un ayuntamiento/Protección Civil que lance un reto |
| **CDTI Misiones / Neotec** | Subvenciones I+D | Edición 2026 cerrada; la siguiente no publicada; exigen entidad | Preparar para 2027 |
| **Ecosistema ferroviario** (Adif, Railway Innovation Hub Málaga, Plataforma Tecnológica Ferroviaria, Renfe-Wayra) | “Retos tecnológicos” y aceleración | No hay convocatoria 2026 confirmada; hay un protocolo Adif-RIH con retos | Contactar al RIH/PTFE para saber si hay reto abierto de comunicaciones o emergencias |
| **Europe’s Rail JU** | I+D ferroviario UE | Las convocatorias 2026 cerraron (7-may; 11-feb); la próxima, no publicada | Vigilar; solo como socio |
| **Países Bajos** | **Digital Trust Center** subvención de ciberresiliencia (hasta 150 k€, para colaboraciones); **CIF-NL** (60–100 k€, cerró 10-feb-2026); WBSO/MIT | Sin convocatoria 2026 confirmada para el primero; el Consejo de Ciberseguridad publicó “Communication under Pressure” el 10-jul-2026 (gancho temático para NL) | Contactar con Twente (el prof. Hesselman contribuyó a ese asesoramiento) y con DTC |
| **Privado** | Ángeles govtech/dual-use, corporaciones (Wayra-Telefónica ya acelera para Renfe), seguros, patrocinio | Sin contactos | Solo con prueba física y vídeo |

**Estimación mía (sin presupuestos reales) de la fase de validación:** móviles ~0,8–1,2 k€; informe de pruebas independiente 5–15 k€; pentest 5–15 k€; DPIA/jurídico 2–4 k€; marca 0,1–0,7 k€. Total ≈ **15–40 k€**, coherente con el escenario A de `FINANCIAL_SCENARIOS.md`. Es una cifra ilustrativa, no un compromiso.

## 5. Plan paralelo España → Países Bajos → modelo exportable

| Semana | España | Países Bajos | Común |
|---|---|---|---|
| 1 | Búsqueda de marca; contactar PTFE/RIH y un ayuntamiento | Contactar Twente/DTC; revisar WBSO/MIT con RVO | Comprar dominios; ejecutar prueba con 3 móviles |
| 2–4 | Pedir 1 LOI a Protección Civil/ayuntamiento y 1 a una universidad | Pedir 1 LOI a una veiligheidsregio/universidad | Decidir licencia + marca; escenario S09 ferroviario (simulado) |
| 5–8 | Preparar CPI/Neotec 2027; EUIPO SME Fund antes del 4-dic si hay pyme | Preparar Eurostars-3 (abre 17-dic) con socio ES + NL | Reel v2 con metraje de la prueba real |
| 9–12 | Piloto/simulacro | Piloto/simulacro | Informe externo → ronda ángel/pre-seed |

Eurostars-3 es ideal para el modelo ES+NL (pyme líder + ≥2 organizaciones independientes; reverificar condiciones en RVO).

## 6. Decisiones que solo tú tomas (no he hecho nada de esto)
Comprar dominios; registrar marca (a título personal o con sociedad); cambiar la licencia; contactar a terceros; activar Zenodo.

**Confianza: ~70 %.** Alta en hechos del repo, dominios y fechas de convocatorias; media en cifras de prensa (víctimas, inversión) y tasas citadas por despachos; baja en las estimaciones de coste, que son mías.

## Fuentes (2026-11-05)
- Accidentes y plan ferroviario: https://www.expreso.ec/actualidad/mundo/espana-pacta-mejoras-en-la-seguridad-ferroviaria-tras-dos-accidentes-y-una-huelga-273874.html · https://www.poresto.com/internacional/2026/10/28/pedro-sanchez-promete-investigar-choque-trenes-espana-negligencias-sabra.amp.html
- SME Fund EUIPO/OEPM: https://oepm.es/es/zona-pyme/lo-que-necesitas-saber/como-conseguir-ayudas-y-subvenciones/Fondo_de_ayudas_SME_Fund
- Tasas OEPM: https://oepm.es/es/tasas-y-precios-publicos/tasas-de-marcas-y-nombres-comerciales/
- CDTI Misiones 2026: https://www.cdti.es/ayudas/misiones-ciencia-e-innovacion-2026
- Adif/RIH/Renfe-Wayra: https://capital-riesgo.es/es/articles/renfe-de-la-mano-de-wayra-lanza-una-aceleradora-de-startups-para-impulsar-su-transformaci-n-digital/
- Europe’s Rail 2026: https://fasi.eu/en/articles/in-evidence/29741-eu-funds-for-innovative-and-sustainable-railways-the-eu-rail-2026-call-for-proposals.html
- NL (DTC, CIF-NL, Consejo de Ciberseguridad): https://digitaltrustcenter.nl/strengthening-cyber-resilience-subsidy-scheme-encourages-partnerships · https://english.rvo.nl/subsidies-financing/cif-nl
