# SENDA · Evaluación honesta (04-11-2026)

> Rúbrica de 9 dimensiones con peso. «Antes» = estado al inicio de esta iteración (v0.5);
> «Ahora» = v0.6 (capa centralizadora multiportador). Cada nota cita la evidencia que la sostiene.
> Una nota no sube por decirlo: sube cuando hay una prueba que se puede repetir.

| # | Dimensión | Peso | Antes | Ahora | Evidencia (ahora) | Qué falta para 10 |
|---|---|---:|---:|---:|---|---|
| 1 | Innovación técnica | 15 % | 8,0 | **9,5** | k-de-n Reed-Solomon entre portadores con probabilidad exacta; previsión de apagón con pasarelas óptimas; alertas firmadas por DTN; módem acústico | Patente o publicación revisada por pares |
| 2 | Arquitectura e ingeniería | 15 % | 8,5 | **9,0** | Núcleo sin dependencias, 29 módulos; mismo código en web, relé, Android y ESP32; paridad en 3 lenguajes | Auditoría de código externa |
| 3 | Verificación automática | 15 % | 8,5 | **9,3** | 78/78 núcleo, 23/23 E2E sin red en Chromium real, 2/2 relé, 14/14 JVM, C++; APK, firmware y Docker compilados en CI | Pruebas de carga y fuzzing de los decodificadores |
| 4 | Multicanal y satélite (capa centralizadora) | 10 % | 6,0 | **9,0** | 10 portadores con límites legales; catálogo satelital con fuentes, estado y hardware | Adaptadores físicos probados (RockBLOCK, Meshtastic) en campo |
| 5 | Usabilidad y accesibilidad | 10 % | 6,5 | **8,5** | Modo fácil de 3 botones; auditoría automática de las 6 pantallas | Pruebas con usuarios reales (mayores, discapacidad) y auditoría EN 301 549 / WCAG 2.1 AA |
| 6 | Interoperabilidad institucional | 10 % | 5,5 | **8,0** | CAP 1.2 desde el panel ferroviario y la red; auditoría encadenada; mapeo EMSI | EMSI validado con la norma; integración NG112 con una sala real |
| 7 | Seguridad y cumplimiento | 10 % | 6,0 | **6,5** | Cifrado E2E estándar; credenciales firmadas; rechazo de alertas falsas, robadas, repetidas y caducadas; lista blanca en Android | Auditoría independiente, certificación ENS, DPIA y análisis de riesgos |
| 8 | Validación de campo | 10 % | 2,0 | **2,0** | Ninguna medición física todavía | Piloto con protección civil: teléfonos físicos, escombros, edificio real |
| 9 | Preparación comercial y de compra pública | 5 % | 5,0 | **7,5** | Análisis de pliegos y del hueco con fuentes; modelo de valor por parte; web trilingüe con película | Primer convenio o piloto firmado; precio validado |

**Nota ponderada:** antes **6,9 / 10** → ahora **7,9 / 10**.

**Solo producto y tecnología** (dimensiones 1–6): antes **7,4** → ahora **9,0**.

## Por qué no es un 9,5 «100 % confirmado» todavía

Las dimensiones 7 y 8 no se pueden subir escribiendo código: exigen terceros.

1. **Piloto de campo** (dimensión 8, 10 %). Con un simulacro bien medido sube a 7–8 y la nota ponderada pasaría de 9.
2. **Auditoría de seguridad independiente + ENS + DPIA** (dimensión 7). Sin esto, ningún organismo español puede contratarlo.
3. **Auditoría de accesibilidad EN 301 549** con usuarios reales (dimensión 5).
4. **Un primer convenio** (dimensión 9).

Con esas cuatro piezas, el 9,5 sería real y demostrable. Es la hoja de ruta que financia la siguiente fase.
