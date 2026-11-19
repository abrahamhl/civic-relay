# RoadSafe · Plan de piloto institucional (España → Países Bajos) y dossier de financiación

> Cifras de coste = **estimaciones de orden de magnitud** para planificación, no presupuestos. Confianza baja-media; validar con proveedores.

## 1. TRL por subsistema (defendible a 2026-11-17)

| Subsistema | TRL | Justificación |
|---|---|---|
| Endurecimiento P0 (tramas, DATEX II, estados 112) | 4 | Validado en laboratorio con pruebas adversariales |
| Frame trust (cápsula firmada) | 3–4 | Criptografía real (WebCrypto P-256); sin PKI de inscripción ni prueba de radio |
| Correlación causal vial | 3 | Banco sintético; sin datos etiquetados reales |
| Gemelo digital del incidente | 4 | FSM, auditoría y vistas probadas; sin integración real |
| Riesgo secundario + política de aviso | 2–3 | Física contrastable; umbrales sin validación de factores humanos |
| Orquestador de asistencia | 3–4 | Contrato + simulador con fallos; sin proveedor real |
| Pasarela 112 | 3 | Expediente y reglas; sin PSAP |
| Interop CIFS / DATEX II | 4 | Validación de campos frente a especificación; sin feed aceptado |
| DENM / SRTI | 2 | Mapeo semántico |
| Consola RoadSafe | 4 | Chromium móvil/escritorio, ES/EN/NL, sin red externa |

## 2. Diferenciación (sin reivindicar novedad patentable)

1. **Honestidad verificable de estados** (transporte ≠ proveedor ≠ realidad; llamada declarada ≠ recibida) con auditoría encadenada: lo que una aseguradora o una administración puede auditar.
2. **Linaje causal de fuentes viales**: evita la corroboración falsa por reflejos V16 → DGT 3.0 → navegadores.
3. **Política de abstención de avisos** con controles negativos reproducibles.
4. Todo **Open Source (MIT)**, sin dependencias, ejecutable offline.

## 3. Piloto España (12 meses, propuesto)

| Fase | Meses | Contenido | Puerta de salida | Acuerdo necesario |
|---|---|---|---|---|
| P0 Alta técnica | 1–2 | Solicitud DGT 3.0 (entorno de pruebas), IP fija, certificado X.509 | Conexión de prueba REST/MQTT | Alta DGT 3.0 |
| P1 Lectura | 2–4 | Consumo de eventos V16 + NAP DATEX II; medición de latencia p50/p95 real | Latencia medida y publicada | — |
| P2 Asistencia | 3–6 | Integración con **una** asistencia en carretera o aseguradora (sandbox) | 0 estados sin respaldo en 200 expedientes de prueba | Contrato con proveedor |
| P3 Factores humanos | 4–8 | Estudio en simulador de H-ROAD-1 con universidad | Decisión preregistrada sobre WARNING vs ADVISORY | Convenio universitario + comité ético |
| P4 Campo limitado | 8–12 | Flota voluntaria (p. ej. taxis/grúas) en un tramo; solo ADVISORY | Informe de seguridad independiente | DGT/titular de vía + proveedor |
| P5 112 | en paralelo | Mesa técnica con un 112 autonómico para formato de expediente (sin integración en producción) | Formato aceptado por escrito | 112 autonómico |

**Ampliación Países Bajos:** NDW (DATEX II, MSI) ya soportado por el lector; socio potencial de gestión de tráfico (Rijkswaterstaat/NDW) y asistencia (p. ej. organizaciones de auxilio en carretera) — **contactos no establecidos**.

## 4. Costes estimados (orden de magnitud)

| Partida | Estimación | Nota |
|---|---|---|
| Ingeniería (2 FTE × 12 meses) | 120–180 k€ | Mercado España |
| Estudio de simulador (universidad) | 40–90 k€ | Depende de n y equipamiento |
| Infraestructura (IP fija, servidores, HSM/PKI de inscripción) | 10–25 k€/año | |
| Auditoría de seguridad independiente | 15–40 k€ | |
| Asesoría jurídica (RGPD, contratos) | 10–25 k€ | |
| **Total piloto** | **≈195–360 k€** | Confianza baja-media |

## 5. Acuerdos pendientes (bloqueos externos)

DGT 3.0 (alta) · socio Waze (Partner Hub; normalmente vía administración) · una aseguradora/asistencia · universidad con simulador · 112 autonómico (mesa técnica) · NDW (NL).

## 6. Mensajes defendibles ante financiadores

- «Reduce la probabilidad de afirmar una ayuda que no existe a cero en el banco de pruebas» — **sí** (H-ROAD-3, banco).
- «Elimina la corroboración falsa por fuentes derivadas en el banco sintético» — **sí** (H-ROAD-2).
- «Reduce accidentes» — **NO demostrado**. Solo simulación; requiere P3–P4.
