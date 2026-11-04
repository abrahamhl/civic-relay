# Certificaciones, autorizaciones y financiación pública (hoja de ruta)

> Cada norma debe verificarse en su texto oficial (BOE, EUR-Lex, CCN, AESA) antes de usarla en un
> documento externo. Responsables: agente A6 (seguridad y cumplimiento), A4 (legal), A9 (drones),
> A7 (radio), A5 (financiación).

## 1. Para vender a la Administración española

| Requisito | Norma / organismo | Qué exige | Estado SENDA |
|---|---|---|---|
| **Esquema Nacional de Seguridad** | RD 311/2022 · CCN | Categorización (media/alta), declaración de aplicabilidad, auditoría de conformidad | Por hacer. Exigido en pliegos (✅ Murcia 2025) |
| **Esquema Nacional de Interoperabilidad** | RD 4/2010 | Estándares abiertos e intercambio | CAP 1.2 hecho; EMSI pendiente |
| **Productos de seguridad TIC** (si se ofrece como producto de seguridad) | Catálogo CPSTIC del CCN | Cualificación del producto | Valorar más adelante |
| **Protección de datos** | RGPD (art. 35, DPIA) · LOPDGDD | DPIA, registro de actividades, base jurídica, minimización | DPIA por hacer (A6) |
| **Accesibilidad** | RD 1112/2018 · EN 301 549 (WCAG 2.1 AA) | Declaración de accesibilidad y auditoría | Auditoría automática hecha; falta la auditoría experta y con usuarios |
| **Ciberseguridad de servicios esenciales** | Directiva NIS2 (UE) 2022/2555 y su transposición | Gestión de riesgos y notificación de incidentes | Por hacer cuando opere un servicio |
| **ISO/IEC 27001** (opcional, valorado) | ISO | SGSI certificado | Por hacer |

## 2. Hardware y radio

| Requisito | Norma | Para qué |
|---|---|---|
| Marcado CE de equipos radio | Directiva 2014/53/UE (RED) | Kits de pasarela y accesorio ESP32 que se comercialicen |
| Dispositivos de corto alcance a 868 MHz | ETSI EN 300 220 · CNAF (Cuadro Nacional de Atribución de Frecuencias) | LoRa/Meshtastic: potencia y ciclo de trabajo |
| Bluetooth | Bluetooth SIG (Company ID; cualificación) | Sustituir el ID de pruebas 0xFFFF |
| Radioaficionado | Licencia del Ministerio para la Transformación Digital | Voluntarios en APRS y QO-100 (sin cifrado) |
| Iridium | Contrato con un proveedor de servicio (p. ej. Ground Control) | Pasarelas SBD |

## 3. Drones

| Requisito | Norma | Nota |
|---|---|---|
| Operaciones en categoría «específica» | Reglamento (UE) 2019/947 · AESA (SORA) | Barrido de fachadas, pasarela aérea |
| Identificación remota | Open Drone ID (ASTM F3411 / EN 4709-002) | Decodificador hecho |
| Vuelos en emergencias e incendios | AESA + coordinación con el director de extinción | **Prohibido** interferir con medios aéreos; solo con autorización |
| Normativa nacional de UAS | Real decreto vigente sobre UAS (verificar número y fecha en el BOE) | A9 |

## 4. Financiación pública y compra innovadora (verificar convocatorias vigentes)

| Vía | Para qué | Nota |
|---|---|---|
| Horizon Europe · Cluster 3 (seguridad civil) | Consorcio con protección civil y universidades | La web cita HORIZON-CL3-2026-01-SSRI-04 |
| EIC Accelerator | Empresa con tecnología disruptiva | Subvención + capital |
| CDTI (NEOTEC, PID) | Empresa de base tecnológica en España | |
| Compra Pública de Innovación (CPI/CPP) | Que un organismo compre el desarrollo de una solución que no existe en el mercado | Encaje directo con el hueco detectado |
| ESA BIC / programas de la ESA | Componente satelital | |
| Fondo Europeo de Defensa | Doble uso civil y militar (emergencias, UME) | Con socios industriales |

## 5. Orden recomendado

1. DPIA y modelo de amenazas (A6). Sin esto, no hay piloto con datos reales.
2. Piloto con un ayuntamiento o una unidad de protección civil en un **convenio de prueba** (datos sintéticos o consentidos).
3. Auditoría de seguridad externa y pentest.
4. Preparación ENS (categoría media) con un auditor acreditado.
5. Accesibilidad EN 301 549 con usuarios.
6. CE de los kits y AESA para los drones.
7. Solicitudes de financiación con la evidencia del piloto.
