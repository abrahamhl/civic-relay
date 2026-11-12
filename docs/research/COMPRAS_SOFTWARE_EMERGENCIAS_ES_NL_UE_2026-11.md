# Qué compran de verdad los organismos públicos: software y sistemas de emergencias en España, Países Bajos y la UE

Fecha: 2026-11-12 · Tipo: investigación documental (sin cambios de código)
Objetivo: saber, con contratos reales, **qué funciones pagan los compradores públicos** y dónde podría encajar SENDA.

---

## 0. Método y limitaciones (léase primero)

- **Herramienta usada:** búsqueda web (WebSearch), que devuelve títulos, URL y fragmentos de las páginas.
- **Bloqueado:** la descarga directa de páginas (WebFetch) falló por DNS/lista de dominios permitidos en esta sesión para
  `www.boe.es`, `www.eldiario.es`, `www.escudodigital.com`, `www.elespanol.com` y `www.indragroup.com`
  (error `getaddrinfo ENOTFOUND … outside the session's allowed network domains`). Por tanto **no se ha abierto ningún
  anuncio oficial completo**. Las cifras proceden de los fragmentos que la búsqueda muestra de BOE, TED, portales
  autonómicos y prensa. Para elevar la confianza hay que abrir cada URL y comprobar el importe de adjudicación
  (no el de licitación) y el adjudicatario.
- **Regla aplicada:** si el importe no aparece en la fuente, se escribe **«no publicado»** (en el fragmento consultado).
  No se ha inventado ningún valor.
- **Confianza por fila:**
  - **Alta**: cifra y objeto en un anuncio oficial (BOE/TED/op.europa.eu/portal autonómico) visible en el fragmento.
  - **Media**: cifra en prensa especializada o nota de la empresa, coherente con otras fuentes; sin anuncio oficial visto.
  - **Baja**: fuente única, fecha incierta o vínculo con el contrato no confirmado.
- Importes: se indica si son con o sin IVA cuando la fuente lo dice; si no, «IVA no indicado».

---

## 1. Comprobación de la afirmación «España gastó 164 millones en un sistema de comunicación de emergencias ferroviario que no funcionaba»

**Resultado: la cifra existe, pero el sistema NO es de comunicación de emergencias.**

| Campo | Dato |
|---|---|
| Qué es | **ERTMS/ETCS** (sistema europeo de señalización y protección del tren: control de velocidad y autorización de movimiento), línea **Ourense–Santiago** (eje atlántico). No es un sistema de comunicaciones de emergencia ni de avisos. |
| Entidad | ADIF (Ministerio de Fomento, hoy Transportes) |
| Adjudicatario | UTE **Thales, Dimetronic (Siemens), Cobra y Antalis** (instalación y mantenimiento) |
| Importe | **163,9 M€** (≈164 M€) gastados en el despliegue 2010–2011, según elDiario.es |
| Estado reportado | Tras el accidente del Alvia (Angrois, 24-07-2013) elDiario.es lo describió como inversión «prácticamente inutilizada»: problemas de interoperabilidad entre equipos de vía (Thales/Dimetronic/Cobra) y embarcados (Bombardier); el ERTMS **no cubría los últimos 7,5 km** hasta Santiago, donde ocurrió el descarrilamiento. Otro artículo: «sigue sin funcionar diez meses después del accidente». |
| Estado actual | **No verificado**: no se encontró fuente reciente sobre el estado operativo actual de ese tramo. |
| Fuentes | https://www.eldiario.es/sociedad/adif-renfe-fomento-ertms-orense-santiago-accidente_1_5759028.html · https://www.eldiario.es/economia/accidente-santiago-alvia-ertms-adif-renfe-bombardier-thales_1_4881883.html · https://www.eldiario.es/sociedad/ertms-ave-alvia-descarrilamiento-siemens-thales-ansaldo-cobra_1_5764557.amp.html |
| Confianza | **Media** (prensa; varios artículos coherentes; no abiertos por bloqueo de red) |

**Cómo decirlo correctamente:** «En 2010–2011 ADIF gastó unos 164 M€ en el sistema de seguridad ERTMS de la línea
Ourense–Santiago, que según la prensa estaba prácticamente sin usar cuando ocurrió el accidente de Angrois en 2013.»
**No** decir «sistema de comunicación de emergencias», porque no lo es.

**Lo que sí existe en comunicaciones ferroviarias (GSM-R, la radio del tren):**
- Mantenimiento, operación y renovación de los sistemas centrales GSM-R de alta velocidad: **181,26 M€ (sin IVA)**
  autorizado por el Consejo de Ministros; anuncio de licitación en BOE (agosto 2026). Adjudicación **no publicada** en lo consultado.
- GSM-R Cercanías Madrid C-5 (Móstoles–Humanes, ~52 km + 4 años de mantenimiento): licitación **11,26 M€** (oct. 2026), exp. 4.26/27507.0211.
- Piloto FRMCS/ACS (sucesor de GSM-R): **6 M€** adjudicados (primera fase).
- Ninguno de ellos aparece en las fuentes como «sistema que no funcionó».
- Contexto 2026: tras Adamuz (18-01-2026) y Toledo, la prensa informa de retrasos del ERTMS Madrid–Sevilla (puesta en servicio aplazada a 2027) y de que la AESF endureció la comunicación de incidentes; no se encontró un contrato de comunicación de emergencias fallido de 164 M€.

---

## 2. Tabla de contratos encontrados

Leyenda de estado: **Adj.** = adjudicado/formalizado · **Lic.** = en licitación · **Aut.** = gasto autorizado · **Proy.** = proyecto/estimación.

### 2.1 España

| # | Entidad | Sistema / producto | Proveedor | Importe (EUR) | Año | Estado | Funciones cubiertas | Fuente | Conf. |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Ministerio del Interior (SGTIC) | **SIRDEE** – red de radio digital de emergencia del Estado (TETRA) para FCSE | Telefónica | **328,18 M€ (IVA incl.)** | 2026 | Adj. | Gestión, mantenimiento y modernización de la red TETRA; cobertura de grandes eventos | https://forbes.es/?p=991194 · https://www.escudodigital.com/empresas/interior-adjudica-a-telefonica-la-red-de-radiocomunicaciones-de-emergencias-del-estado-por-328-millones.html | Media |
| E2 | Ministerio del Interior | SIRDEE – mantenimiento (contrato anterior) | Telefónica Móviles | **204,88 M€** | fecha no confirmada (prob. 2021–2022) | Adj. | Mantenimiento red TETRA | https://dplnews.com/?p=177583 · https://boe.es/boe/dias/2023/01/02/pdfs/BOE-B-2023-43.pdf | Media |
| E3 | DG Protección Civil y Emergencias | **RAN-PWS / ES-Alert** (avisos a la población por cell broadcast, EU-Alert) | SIA (Grupo Indra) | **≈2,73 M€** | 2021 | Adj. | Envío de alertas geolocalizadas a móviles por cell broadcast (EU-Alert/art. 110 CECE) | https://www.elespanol.com/invertia/empresas/tecnologia/20211026/sia-indra-recibira-millones-implantar-sistema-nacional/622188503_0.amp.html · https://www.indragroup.com/en/news/implement-national-public-warning-system · https://boe.gob.es/boe/dias/2021/10/25/pdfs/BOE-B-2021-43382.pdf | Media |
| E4 | Agencia de Seguridad y Emergencias Madrid 112 | Administración y mantenimiento de la **plataforma tecnológica del 112** (CAD/gestión de llamadas) | **no publicado** en el fragmento | Valor estimado **12.784.073,10 € (sin IVA)**; adjudicación no publicada | formalizado 05-11-2024 | Adj. | Operación y mantenimiento de la plataforma de atención y despacho 112 | https://ted.europa.eu/es/notice/677304-2024/pdfs · https://ted.europa.eu/es/notice/556525-2023/pdfs | Media (valor estimado, no de adjudicación) |
| E5 | Generalitat Valenciana (AVSRE) | Servicio de atención 112 CV (operadores) | Ilunion Emergencias | **30,8 M€** (2023–2027) | 2023 | Adj. | Atención de llamadas 112 | https://www.eldiario.es/comunitat-valenciana/generalitat-compensa-medio-millon-euros-subcontrata-112-avalancha-llamadas-dana_1_12109207.html | Media |
| E6 | Generalitat Valenciana | Compensación por avalancha de llamadas de la DANA (29-10-2024) | Ilunion | **424.782,73 €** | 2025 | Adj. | Capacidad extra de atención (pico de demanda) | misma fuente que E5 | Media |
| E7 | Generalitat Valenciana | Explotación y mantenimiento del **CoordCom G5** (CAD del 112 CV; producto de Hexagon/Intergraph) | **no publicado** en el fragmento | **no publicado** | 2018 | Lic./Adj. | CAD: gestión de incidentes y comunicaciones | https://boe.es/boe/dias/2018/03/13/pdfs/BOE-B-2018-16142.pdf | Media |
| E8 | Junta de Andalucía | **Plataforma integral de gestión de emergencias 112 Andalucía** (CPV 72212517 desarrollo de software) | **no publicado** | **no publicado** | 2023 | Lic./Adj. | Plataforma integral 112 (CAD) | https://ted.europa.eu/en/notice/486617-2023/pdf | Baja |
| E9 | Junta de Andalucía (EPES 061) | Sistemas de información del Centro de Emergencias Sanitarias 061 | Minsait (Indra) | **5,8 M€** | 2026 | Adj. | Sistemas de despacho/gestión sanitaria urgente | https://www.indragroup.com/cms-content/2026/09/260902-NP-Minsait-adjudicacion-061-en-ergencias-Andalucia.pdf | Media (nota de empresa) |
| E10 | Junta de Andalucía (INFOCA) | **Sistema integral para la gestión y dirección de incendios forestales** | no publicado | **2,5 M€** (cifra cortada en el fragmento) | 2024 | Aut. | Dirección de extinción, gestión de medios | https://ws040.juntadeandalucia.es/webconsejos/cgobierno/transparencia/240604/documentos/4Acuerdo.pdf | Baja |
| E11 | Junta de Andalucía (INFOCA) | **Sistema de monitorización de medios aéreos** del Plan INFOCA | no publicado | no publicado (24 meses + 12 de prórroga) | 2026 | Lic. | Seguimiento en tiempo real de aeronaves de extinción (AVL) | portal de contratación Junta de Andalucía (memoria justificativa; URL de la búsqueda en `pdc_sirec_documentacion`) | Baja |
| E12 | Generalitat de Catalunya (CAT112) | Soporte y mantenimiento técnico presencial 112 Catalunya (exp. 112-2025-5) | no publicado | **529.920 € (sin IVA)** | 2024 | Lic. | Mantenimiento plataforma 112 | https://cido.diba.cat/contractacio/17837432/ | Media |
| E13 | Generalitat de Catalunya (CAT112) | Mantenimiento plataforma **ECS** (almacén de llamadas 112) | no publicado | **8.000 €** (6 meses) | 2024 | Lic. | Registro/almacenamiento de llamadas | https://tendios.com/en/tenders/672cc7e699c25a995f77cf78 | Media |
| E14 | Generalitat de Catalunya (Mossos) | **Cámaras corporales** (800 unidades + software de gestión en servidor externo) | no publicado | no publicado | 2024 | Lic. | Grabación de actuaciones, gestión de evidencias | https://ted.europa.eu/en/notice/020314-2024/pdf | Media |
| E15 | Generalitat de Catalunya (Mossos) | **Comisaría virtual** (Plan de Transformación Digital 2030) | no publicado | **9.655.800 €** (presupuesto) | 2023 | Aut. | Denuncia y trámite digital ciudadano | https://www.esmartcity.es/2023/06/09/aprobada-puesta-funcionamiento-comisaria-virtual-mossos-desquadra | Media |
| E16 | Ministerio del Interior (DG Policía) | **Cámaras personales (bodycams)** Policía Nacional | Telefónica Ingeniería de Seguridad | **10,3 M€ (IVA incl.)** | fecha no confirmada | Adj. | Grabación y custodia de vídeo policial | https://www.vozpopuli.com/espana/interior-10-millones-camaras-personales-policia-ley-mordaza.html | Baja-media (fuente única) |
| E17 | Ministerio del Interior | Bodycams piloto Policía Nacional y Guardia Civil (≥300 unidades) | Telefónica (única oferta) | **>178.000 €** | 2019 | Adj. | Grabación de vídeo | https://www.merca2.es/2019/10/08/telefonica-camaras-guardia-civil-194933/ · https://boe.es/boe/dias/2019/10/08/pdfs/BOE-B-2019-42329.pdf | Media |
| E18 | Guardia Civil | **SIVE** (Sistema Integrado de Vigilancia Exterior: radares, cámaras optrónicas, centro de mando) – mantenimiento integral | Escribano Mechanical & Engineering | **61,7 M€** (techo 90,1 M€; 3 años) | fecha no confirmada (≈2025–2026) | Adj. | Vigilancia costera: radar, EO/IR, mando y control | https://www.escudodigital.com/empresas/interior-pone-en-manos-de-una-sola-empresa-la-vigilancia-de-toda-la-costa-espanola-por-617-millones.html | Media |
| E19 | Guardia Civil | Modernización del SIVE (negociado con publicidad, 4 ofertas) | no publicado | no publicado | 2025 | Adj. | Renovación de sensores y mando | https://boe.es/boe/dias/2025/04/16/pdfs/BOE-B-2025-14136.pdf | Media |
| E20 | Ministerio de Defensa (para Guardia Civil) | **Equipos portátiles antidrón (C-UAS, inhibición)** | no publicado | no publicado (precio 90 %) | 2025 | Lic. | Detección/inhibición de drones | https://www.boe.es/boe/dias/2025/04/26/pdfs/BOE-B-2025-15267.pdf | Media |
| E21 | Guardia Civil | Reposición de flota de drones (UAS) | no publicado | **488.599,64 €** (valor estimado) | 2025 | Lic. | Vigilancia aérea | https://boe.es/boe/dias/2025/11/14/pdfs/BOE-B-2025-41611.pdf | Media |
| E22 | Policía Nacional (DET) | UAS de vigilancia + cámaras térmicas (Unidad Aérea) | no publicado | no publicado | 2025 | Adj. | Vigilancia aérea, térmica | https://boe.es/boe/dias/2025/10/09/pdfs/BOE-B-2025-36386.pdf | Media |
| E23 | Policía Nacional (DET) | Sistema antidrón | Eurofesa | **17.000 € (sin IVA)** | fecha no confirmada | Adj. | Neutralización de drones | https://www.defensa.com/homeland-security/eurofesa-suministrara-sistema-antidron-policia | Media |
| E24 | Policía Nacional | Servicio contradrones Cumbre OTAN Madrid | Telefónica | no publicado | 2022 | Adj. | Detección/neutralización C-UAS para evento | https://www.elindependiente.com/espana/2022/07/01/la-policia-contrato-a-telefonica-el-servicio-de-contradrones-para-proteger-la-cumbre-de-la-otan/amp/ | Media |
| E25 | Gobierno Vasco (Ertzaintza) | Reforma del sistema de seguridad de la central de Erandio | Ikusi SIS | **588.211,19 €** | 2015 | Adj. | Integración de seguridad/vídeo en centro de mando | https://www.boe.es/boe/dias/2015/12/26/pdfs/BOE-B-2015-38603.pdf | Alta |
| E26 | Gobierno Vasco (Ertzaintza) | Reforma de la central de Oiartzun | Ikusi SIS | **590.749,13 €** | 2016 | Adj. | Ídem | https://www.boe.es/boe/dias/2016/10/03/pdfs/BOE-B-2016-47113.pdf | Alta |
| E27 | Ministerio de Defensa (UME) | Mantenimiento SECOMSAT terminales satélite; terminales satélite multibanda (5) | no publicado | no publicado | 2023 | Adj./Lic. | Comunicaciones satelitales de emergencia | https://www.boe.es/boe/dias/2023/05/11/pdfs/BOE-B-2023-13850.pdf · https://boe.gob.es/boe/dias/2023/08/08/pdfs/BOE-B-2023-23452.pdf | Media |
| E28 | Ministerio de Defensa (UME) | Mantenimiento del sistema de gestión de emergencias de la UME | Indra Sistemas | **115.702,48 € (neto)** | 2015 | Adj. | CAD / gestión de emergencias militar | https://www.boe.es/boe/dias/2015/08/25/pdfs/BOE-B-2015-26421.pdf | Media |
| E29 | Confederación Hidrográfica del Guadiana (MITECO) | Mantenimiento y explotación de la red integrada **SAIH/SAICA/ROEA**/piezometría | no publicado | **14.381.808 €** (valor estimado) | fecha no confirmada | Aut. | Sensores hidrológicos, telemetría, alerta de crecidas | https://www.iagua.es/noticias/ministerio-transicion-ecologica/gobierno-autoriza-14-millones-red-integrada-informacion | Media |
| E30 | Confederación Hidrográfica del Segura | Evolución del **SAIH**: GMAO + **SCADA único** | no publicado | no publicado | 2025 | Lic./Adj. | Telemetría, SCADA, mantenimiento | https://www.boe.es/boe/dias/2025/03/29/pdfs/BOE-B-2025-11476.pdf · https://www.chsegura.es/export/sites/chs/descargas/informaciongeneral/comunicacion/noticias/docsdescarga/Nota-de-Prensa-SCADA_rev.pdf | Baja |
| E31 | ADIF | Sistemas core **GSM-R** alta velocidad (mantenimiento, operación, renovación) | no publicado | **181,26 M€ (sin IVA)** | 2026 | Aut./Lic. | Radio ferroviaria crítica | https://www.diaridetarragona.com/espana/266993/181-millones-mantenimiento-alta-velocidad-actuaciones-tarragona.html · https://www.boe.es/boe/dias/2026/08/25/pdfs/BOE-B-2026-27771.pdf | Media |
| E32 | ADIF | GSM-R Cercanías C-5 Madrid | no publicado | **11,26 M€** (licitación) | 2026 | Lic. | Radio ferroviaria + 4 años mant. | https://www.moncloa.com/2026/10/11/cercanias-c5-madrid-gsm-r-adif-3446461/ | Media |
| E33 | ADIF | Piloto **FRMCS + ACS** (sucesor del GSM-R) – fase 1 | no publicado | **6 M€** | 2025–2026 | Adj. | Banda ancha crítica ferroviaria 5G | https://forbes.es/?p=776314 | Baja-media |
| E34 | ADIF | ERTMS Ourense–Santiago (ver §1) | UTE Thales/Dimetronic/Cobra/Antalis | **163,9 M€** | 2010–2011 | Adj. (infrautilizado según prensa) | Señalización/ATP, **no** comunicaciones de emergencia | ver §1 | Media |

### 2.2 Países Bajos

| # | Entidad | Sistema / producto | Proveedor | Importe (EUR) | Año | Estado | Funciones | Fuente | Conf. |
|---|---|---|---|---|---|---|---|---|---|
| N1 | Rijksoverheid (Min. Justicia y Seguridad / BZK según fuente) | **NL-Alert** – centro de alerta pública híbrido + cell broadcast | Everbridge (one2many) | **no publicado** | 2021 | Adj. | Cell broadcast, centro de envío, multicanal; alcance ~94 % de la población | https://www.everbridge.com/newsroom/article/everbridge-awarded-contract-to-power-countrywide-public-warning-system-in-the-netherlands/ · https://dutchitchannel.nl/684144/rijksoverheid-kiest-everbridge-toepassingen-voor-nl-alert.html · https://www.telecompaper.com/nieuws/rijk-sluit-contracten-af-voor-nl-alert-alarmdienst--746748 | Media |
| N2 | Min. Justicia y Seguridad / IFV | **WAS** (sirenas) – renovación vs. retirada | — | Estimaciones: **≥56 M€** (IFV), **~100 M€ inversión + ~6 M€/año** (portavoz JenV), **≥160 M€ hasta 2040**; retirada prevista 2028 por falta de fondos (2026) | 2024–2026 | Proy. | Sirenas exteriores; debate sobre depender solo de NL-Alert | https://www.vnog.nl/sites/default/files/2024-03/10.%20Uitfasering%20Waarschuwings-%20en%20Alarmeringssysteem.pdf · https://nltimes.nl/2026/05/19/air-raid-siren-disappear-2028-due-lack-funds-new-system · https://www.hartvannederland.nl/politiek/beleid/artikelen/luchtalarm-blijft-toch-defensie-betaalt-mee-aan-nieuw-netwerk | Media (cifras contradictorias entre fuentes) |
| N3 | Min. Seguridad y Justicia | **Renovación C2000** (TETRA): T2000 voz, P2000 paging, radiobediening sala | Hytera Mobilfunk; 2WAY; Eurofunk Kappacher | **no publicado** por lote | 2015 | Adj. (tras litigio KPN/Motorola/K&H) | Red TETRA, paging, consolas de radio en sala | https://www.dutchitchannel.nl/news/42722/c-netwerk-wordt-vernieuwd-door-hytera-mobilfunk-way-en-eurofunk-kappacher · https://www.criticalcommunicationsreview.com/ccr/news/31000/kpn-motorola-solutions-and-koning-en-hartman-to-lose-c2000-court-case | Media |
| N4 | Estado NL | Coste total histórico C2000 | — | **765 M€** al entregar; +86 M€ explotación; renovación **200,6 M€** (análisis AG Connect/Binnenlands Bestuur 2023) | 2023 (análisis) | — | Red de radio de emergencias | https://www.binnenlandsbestuur.nl/digitaal/de-tien-duurste-overheidsprojecten-c2000-en-icas | Media |
| N5 | LMS / Politie | **NMS** (Nationaal Meldkamer Systeem, sucesor del CAD GMS) | — | no publicado | 2023 | **Cancelado/aplazado**; se recomendó nueva licitación | CAD nacional multidisciplinar | https://www.computable.nl/2023/10/03/plannen-voor-nationaal-meldkamer-systeem-afgebrand · https://landelijkemeldkamer.org/binaries/content/assets/klmo/11-06-2024-factsheet-nms.pdf | Media |
| N6 | IFV (Instituut Fysieke Veiligheid) | **LCMS 2.0** (sistema nacional de gestión de crisis) | Capgemini, Esri, Geodan, KPN | no publicado («aún no se ha pagado mucho», 2012) | 2011 | **Rescindido 2012** | Imagen operativa común (netcentrisch werken), GIS | https://www.binnenlandsbestuur.nl/digitaal/energietransitie/nieuw-crisismanagementsysteem-gestaakt | Media |
| N7 | IFV / NIPV | LCMS actual (puente) y consultas de mercado 2018/2021; plan 2025: pasar «de sistema a plataforma» | Multioperations / Han Dataport (prórroga) | no publicado | 2012–2025 | Vigente | Gestión de crisis, imagen común | https://nipv.nl/documenten/jaarplan-lvcb-2025 · TenderNed pub. 146835 | Media |
| N8 | NIPV (para varias Veiligheidsregio's) | Acuerdo marco **CRS** (plataforma de crisis; licencias + formación por región) | no publicado | no publicado | ≈2023–2024 | Lic. | Plataforma de crisis regional | TenderNed pub. 232750 (https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties/232750/documenten/7376978/content) | Baja |
| N9 | Politie | Vídeo de helicópteros policiales en tiempo real a 8 salas | SAIT Zenitel | **2,7 M€** (10 años) | fecha no confirmada | Adj. | Transmisión de vídeo aéreo HD a salas | https://www.telecompaper.com/news/sait-zenitel-zet-helikopterbeelden-door-naar-politie--863899 | Baja-media |
| N10 | Ministerie van Defensie | Sensores portátiles de detección de drones (C-UAS), ~910 unidades | no publicado | no publicado | 2026 | Adj. | Detección de drones | https://ted.europa.eu/en/notice/30894-2026/html | Media |
| N11 | Politie | Acuerdo marco cámaras en espacio público (obra, sustitución, mantenimiento) | no publicado | no publicado | 2023 | Lic./Adj. | Videovigilancia | TenderNed (ver búsqueda) | Baja |

### 2.3 Unión Europea

| # | Entidad | Sistema / producto | Proveedor | Importe (EUR) | Año | Estado | Funciones | Fuente | Conf. |
|---|---|---|---|---|---|---|---|---|---|
| U1 | Comisión (JRC) | **Copernicus EMS Rapid Mapping** (contrato marco) | consorcio liderado por e-GEOS | **12,8 M€ (sin IVA)** | 2014 | Adj. | Cartografía satelital de emergencia en horas | https://ted.europa.eu/en/notice/031539-2015/pdf | Alta |
| U2 | Comisión (JRC) | Copernicus EMS Rapid Mapping | e-GEOS SpA | **27 M€** | 2019 | Adj. | Ídem | https://op.europa.eu/en/web/public-procurement/procurement-details/-/procurement/d9da695b-dd0e-39ce-b4b6-e7f64362c500 | Media-alta |
| U3 | Comisión (JRC) | Copernicus EMS Rapid Mapping (JRC/IPR/2022/OP/0310), 2 ofertas | adjudicatario no visible en el fragmento | **36 M€** | 2023 | Adj. | Ídem | https://ted.europa.eu/en/notice/83028-2023/html | Alta (valor) |
| U4 | Comisión (JRC) | Copernicus EMS Risk & Recovery Mapping | e-GEOS SpA | **8 M€** | — | Adj. | Cartografía de riesgo y recuperación | https://www.stotles.com/explore/notices/2cb1a6d4-a1c7-43ee-aa5c-c504d9d2c1b8/framework-contract-for-copernicus-emergency-management-risk-and-recovery | Media |
| U5 | Comisión (JRC) | Bloques de servicio vinculados a **EFFIS** (incendios forestales), 2 lotes | no publicado | **5.022.673,88 € (sin IVA)** | 2015 | Adj. | Información de incendios forestales | https://op.europa.eu/en/web/public-procurement/procurement-details/-/procurement/0d25849b-e231-3ef9-9443-5910e5121aef | Media-alta |
| U6 | Comisión (JRC) | Centro de cálculo **EFAS** (alerta de inundaciones) y centro hidrológico CEMS | no publicado | no publicado | 2015 / posterior | Adj. | Previsión hidrológica, análisis y difusión | https://ted.europa.eu/en/notice/328532-2015/pdf · https://www.stotles.com/explore/notices/dabd670d-9a78-4496-a98c-d227a84c211d/ | Media |
| U7 | DG ECHO | Infraestructura TIC de ECHO + administración del sistema OMT (4 lotes) | no publicado | **13,2 M€ (estimado, sin IVA)** | 2015 | Adj. | Infraestructura y soporte TIC (no es CECIS) | https://ted.europa.eu/en/notice/283349-2015/pdf | Media |
| U8 | DG ECHO | IaaS bajo contrato marco | IBM | no publicado | 2015 | Adj. | Nube/infraestructura | https://ted.europa.eu/en/notice/374750-2015/pdf | Media |

---

## 3. Las 10 filas más relevantes para SENDA

1. **E1 SIRDEE 328,18 M€ (Telefónica, 2026)** – el mayor gasto: resiliencia de comunicaciones críticas (TETRA).
2. **E3 ES-Alert ≈2,73 M€ (SIA/Indra, 2021)** – el aviso a la población es *barato* comparado con la radio; el valor está en el canal (cell broadcast) que operan las telecos.
3. **N1 NL-Alert (Everbridge, 2021, importe no publicado)** – mismo patrón: centro de envío + cell broadcast.
4. **N2 Sirenas WAS NL (56–160 M€ estimados, retirada 2028)** – el debate «¿un solo canal (móvil) basta?» es exactamente el hueco de SENDA (multicanal sin red).
5. **E4 Plataforma 112 Madrid (12,78 M€ valor estimado, 2024)** – los 112 compran mantenimiento de su CAD, no lo sustituyen.
6. **E5/E6 112 CV (30,8 M€ + 424.782,73 € por la DANA)** – pago extra por saturación de llamadas: demanda real de **descongestión/triaje previo**.
7. **N5 NMS cancelado / N6 LCMS 2.0 rescindido** – los grandes CAD/crisis nacionales fracasan; los compradores desconfían de reemplazos totales → mejor **complementar** que sustituir.
8. **E18 SIVE 61,7 M€** – mando y control con fusión de sensores (radar + EO/IR).
9. **U1–U3 Copernicus EMS 12,8 → 27 → 36 M€** – cartografía satelital rápida crece; SENDA ya consume sus activaciones.
10. **E34 ERTMS 163,9 M€** – la cifra del fundador es real, pero es señalización, **no** comunicación de emergencias.

---

## 4. «Funciones por las que los compradores pagan» (deduplicado)

Columna SENDA: **Encaja** = SENDA ya tiene un módulo relacionado (prototipo, ver nota) · **Complementa** = SENDA podría aportar una capa adicional sin sustituir el sistema comprado · **No** = fuera de alcance razonable.

> Nota de honestidad: según `docs/PRODUCT.md`, SENDA v0.1 usa transporte IP real y malla/celular **simulados**; BLE/LoRa/satélite están planificados. Los módulos citados existen en `packages/senda/src/` pero no son productos certificados ni desplegados en un 112.

### 4.1 Despacho (112 / CAD)
| Función pagada | Evidencia | SENDA |
|---|---|---|
| Plataforma CAD 112: recepción, creación de incidentes, asignación de recursos | E4, E7, E8, E28, N5 | **Complementa** (`incident-ops.mjs`, exporta CAP a la sala; no es un CAD) |
| Mantenimiento/soporte 24x7 de la plataforma | E4, E12, E13 | No (servicio, no producto) |
| Capacidad de atención en picos (avalancha de llamadas) | E6 (DANA) | **Complementa**: autoinforme ciudadano estructurado (SAFE/SOS/MEDICAL), triaje START (`triage.mjs`) antes de llamar |
| Registro/almacenamiento de llamadas y auditoría | E13 | **Encaja** parcialmente (registro de auditoría encadenado en `interop.mjs`) |
| Despacho sanitario (061) | E9 | Complementa (triaje) |

### 4.2 Aviso a la población
| Función | Evidencia | SENDA |
|---|---|---|
| Cell broadcast geolocalizado (EU-Alert: ES-Alert, NL-Alert) | E3, N1 | **Complementa**: recibir/retransmitir alertas CAP cuando la red cae (malla, planificada) |
| Centro de envío multicanal | N1 | Complementa |
| Sirenas exteriores / canal independiente del móvil | N2 | **Complementa** (canal alternativo sin red; aún simulado) |

### 4.3 Conciencia situacional y mando
| Función | Evidencia | SENDA |
|---|---|---|
| Imagen operativa común / plataforma de crisis | N6, N7, N8 | **Encaja** en parte (tablero de incidentes con procedencia: oficial/corroborado/no verificado) |
| Mando y control con fusión de sensores (radar, EO/IR) | E18, E19 | No (militar/fronteras) |
| Dirección de extinción de incendios forestales | E10 | **Complementa** (`fire-watch.mjs`, `wildfire.mjs`) |
| Seguimiento de medios aéreos (AVL) | E11 | Complementa (sin integración real hoy) |
| Cartografía satelital rápida | U1–U4 | **Encaja** como consumidor (`copernicus-ems.mjs`, `nasa-firms.mjs`) |

### 4.4 Sensores y vídeo
| Función | Evidencia | SENDA |
|---|---|---|
| Bodycams + gestión de evidencias | E14, E16, E17 | No |
| Videovigilancia / CCTV / vídeo a salas | E25, E26, N9, N11 | Complementa solo con cámaras públicas de tráfico/paisaje (`cameras.mjs`), nunca de personas |
| Drones de vigilancia (UAS, térmica) | E21, E22 | Complementa (`drone.mjs`: Open Drone ID, dron como mula de datos) |
| Antidrón (C-UAS) detección/inhibición | E20, E23, E24, N10 | **No** (inhibición = RF no autorizada; fuera de principios de SENDA). Como mucho, detección pasiva Remote ID |
| Telemetría hidrológica / SCADA (SAIH) | E29, E30 | **Complementa** como consumidor de datos (`flood-watch.mjs`) |

### 4.5 Resiliencia de comunicaciones
| Función | Evidencia | SENDA |
|---|---|---|
| Red de radio crítica TETRA (SIRDEE, C2000) | E1, E2, N3, N4 | **Complementa** (capa para ciudadanos/voluntarios que no tienen TETRA; no lo sustituye) |
| Radio ferroviaria GSM-R / FRMCS | E31–E33 | No (sistema ferroviario certificado); `rail-incident.mjs` solo como capa de aviso cruzado |
| Comunicaciones por satélite de emergencia | E27 | Complementa (catálogo `satellites.mjs`; integración real planificada) |
| Cobertura de grandes eventos | E1 | Complementa |

### 4.6 Estándares de interoperabilidad
| Estándar | Dónde aparece | SENDA |
|---|---|---|
| **CAP 1.2** (OASIS) | Base de EU-Alert, Meteoalarm, plataformas 112 | **Encaja** (`interop.mjs` exporta CAP 1.2) |
| **EMSI** (ISO/TR 22351) | Intercambio entre organismos | **Encaja** en parte (`interop.mjs` lo menciona) |
| EDXL (DE/RM/SitRep) | Sin evidencia de compra en esta búsqueda | Hueco |
| **TETRA** | SIRDEE, C2000 | No (solo pasarela, si un organismo lo autoriza) |
| **NG112 / AML / eCall** | Sin contrato encontrado en esta búsqueda | Hueco a investigar |
| EU-Alert / cell broadcast (3GPP) | E3, N1 | Complementa (recepción) |
| GSM-R / FRMCS | E31–E33 | No |

### 4.7 Analítica y predicción
| Función | Evidencia | SENDA |
|---|---|---|
| Previsión de inundaciones (EFAS, SAIH) | U6, E29 | **Complementa** (`flood-watch.mjs`, alerta por subida aguas arriba) |
| Información de incendios (EFFIS) | U5 | Complementa (`fire-watch.mjs`, FIRMS) |
| Predicción de caída de la red móvil | sin contrato encontrado | **Diferencial** (`blackout.mjs`), no hay comprador identificado todavía |

---

## 5. Huecos principales (lo que NO se pudo confirmar)

1. **Descarga de documentos bloqueada** (boe.es, eldiario.es, escudodigital.com, elespanol.com, indragroup.com). Hay que abrir cada anuncio para pasar de confianza media a alta.
2. **Adjudicatario e importe final del 112 Madrid (E4)** y del **112 Andalucía (E8)**: solo hay valor estimado o nada.
3. **Contrato CAD de 112 Catalunya**: no se encontró la adjudicación de la plataforma de despacho (solo mantenimientos pequeños).
4. **Importe de NL-Alert (Everbridge)** y de la **renovación C2000 por lote**: no publicados en lo consultado.
5. **Sucesor de C2000** (banda ancha crítica) y **nueva licitación del NMS**: sin anuncio encontrado.
6. **Ertzaintza/SOS Deiak**: no se encontró CAD ni plataforma de mando reciente; solo reformas de centrales (2015–2016).
7. **Meteoalarm (EUMETNET)** y **CECIS (DG ECHO)**: no se encontró contrato con importe.
8. **NG112, EDXL, comunicaciones por satélite civiles (Protección Civil + Starlink/Hisdesat)**: sin contratos encontrados.
9. **Afirmación de los 164 M€**: confirmada como ERTMS (señalización), no como comunicación de emergencias; estado actual del tramo no verificado.

## 6. Conclusión práctica para la venta

- Los grandes presupuestos van a **redes de radio críticas** (cientos de millones) y a **mantener** los CAD existentes (millones al año). SENDA no debe competir ahí.
- El aviso a la población cuesta **poco en software** (≈2,7 M€ ES-Alert) y depende de las telecos: SENDA aporta **canal de respaldo cuando cae la red** y **retorno ciudadano estructurado**, algo que ninguno de los contratos encontrados compra explícitamente.
- Señales de demanda reales: pago extra por saturación del 112 en la DANA (E6), debate neerlandés sobre depender solo de NL-Alert (N2), y fracasos de sistemas nacionales «todo en uno» (N5, N6). La propuesta más creíble es una **capa complementaria que hable CAP/EMSI** con el CAD existente, no un sustituto.
- Próximo paso: permitir los dominios bloqueados y verificar las filas E1, E3, E4, E5, E18, N1, N3 y U3 contra el anuncio oficial antes de citarlas en material comercial.
