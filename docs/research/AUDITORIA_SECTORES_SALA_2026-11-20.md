# Auditoría: cómo convencer a cada sector con pruebas (20-11-2026)

> Entrada: petición del fundador («cómo sorprender a un bombero… al CNI»). Procesamiento: para cada sector,
> qué mira hoy, qué le falta, qué le enseña SENDA en pantalla y qué prueba lo respalda. Validación: solo se
> afirma lo que hace el código del repositorio o lo que dice una fuente citada; lo no verificado se marca.
> Salida: diseño de `/senda/sala` (Sala de decisión) sobre datos reales de la DANA de l'Horta Sud.

## Tesis
Las redes ya son rápidas y los sistemas de cada cuerpo, potentes. Lo que falta es **la capa de arriba**:
la que junta lo que ven todos, **no toca ningún sistema**, prepara la decisión (¿es real?, ¿a quién afecta?,
¿por dónde llega?, ¿quién va?) y deja el borrador de alerta listo para que **una persona con autoridad** lo firme.
Lo que más sorprende a un profesional no es una animación: es ver **su propio trabajo de horas hecho en segundos,
con la procedencia de cada dato y sin que el sistema decida por él**.

## Caso de prueba común: DANA de Valencia, l'Horta Sud (datos reales del repositorio)
| Dato | Valor | Origen |
|---|---|---|
| Hora del evento | 29-10-2024 14:30 UTC | Copernicus EMS, activación EMSR773 (`data/dana2024/emsr773.json`) |
| Activación de Copernicus | 16:40 UTC | ídem |
| Envío de ES-Alert | 20:11 hora peninsular (19:11 UTC) | prensa citada en `PROCUREMENT_GAP_2026.md` (El Debate) |
| Población en la zona del evento | 81 080 | estadística oficial EMSR773 |
| Calles con agua observada | 489,5 de 1 227,3 km | cálculo SENDA sobre agua CEMS + OSM (`dana_horta_sud_resultado.json`) |
| Bolsas aisladas | 66 (escenario «toca») | ídem |
| Servicios esenciales bajo el agua | 9 de 57 | ídem |
| Tramos de puente cortados | 141 | ídem |
Límite: la red viaria es OSM actual, no la de 2024; los edificios son un indicador de dónde hay gente, no población.

## Matriz por sector
| Sector | Qué mira hoy (genérico) | Qué le falta | Qué le enseña la Sala | Prueba en el repo | Por validar |
|---|---|---|---|---|---|
| Bomberos | Avisos de la sala, radio y mapas propios | Saber qué calles y puentes siguen siendo transitables y qué bolsas están aisladas | Puentes cortados, bolsas aisladas, parques de bomberos con acceso | `flood-isolation.mjs`, resultado DANA | Rutas con su callejero operativo |
| Guardia Civil / tráfico | Incidencias de tráfico y radio | Dónde cortar y desviar con datos | Tramos con agua por tipo de vía, cortes de autovía y nacional | resultado DANA + OSM | Integración con su sistema de gestión (sin convenio) |
| Policía local | Avisos vecinales por teléfono | Separar el rumor de lo real | Notas de comunidad con credibilidad auditable | `hazard-reports.mjs` (pruebas) | Calibración con incidentes reales |
| UME / militar | Mando propio, cartografía | Logística hacia las bolsas aisladas | Número y tamaño de bolsas; dron mula; caminos sin infraestructura | `drone.mjs`, `bearers.mjs` | Ensayo de campo |
| Protección civil / 112 | Paneles CAD y decisión de alerta | Delimitar, estimar afectados y redactar la alerta rápido y con trazabilidad | Polígono, afectados, canales con probabilidad honesta y **borrador CAP 1.2 firmado y encadenado** | `interop.mjs` (CAP, auditoría SHA-256), `delivery-assurance.mjs` | Credencial institucional real (hoy solo ejercicio) |
| Sanitarios (SVA) | Llamadas y geolocalización | Saber qué centros quedan bajo el agua y cuánto se alarga el acceso | Centros de salud y hospitales con agua; distancia media 1 062 → 1 144 m; peor caso +3 020 m | resultado DANA | Tiempos reales de ambulancia |
| Hospitales | Su propio sistema | Prever accesos cortados | Hospitales alcanzables y aislados | resultado DANA | Ocupación (no hay datos: no se muestra) |
| Vecino | El móvil y la radio | Que la alerta sirva para algo más que leerla | Alerta que se responde (Bien / Ayuda / Puedo ayudar / Veo) | `/senda/explica`, firma ECDSA | Piloto con usuarios |
| Desarrollador | Código | Estándares abiertos, sin dependencias, probado | Núcleo de 159 módulos sin dependencias, 883 pruebas | `packages/senda` | Revisión externa |
| Ciberseguridad / OSINT | Procedencia y cadena de custodia | Saber de dónde sale cada dato y que nadie lo ha tocado | Huella SHA-256 de cada capa calculada en el navegador, licencia, cadena de auditoría verificable, límites declarados (Sybil, sensores sin autenticar) | `interop.mjs`, `hazard-reports.mjs` | Auditoría independiente |
| Gobierno / política | Titulares y coste | Valor real para la ciudadanía y soberanía | Cronología real (14:30 → 16:40 → 20:11) y qué parte del trabajo previo a la alerta se automatiza sin quitar la decisión humana | EMSR773 + fuentes | Piloto con un organismo |
| Plataformas de datos e integradores (tipo Palantir, proveedores públicos) | Integración de datos para clientes | Una capa abierta que hable los estándares de emergencias | Interoperabilidad CAP 1.2, mapeo EMSI, DATEX II, CEMS, OSM, GTFS; núcleo abierto | `interop.mjs`, `datex2.mjs`, `copernicus-ems.mjs` | Conectores con sus productos (no verificado) |
| Inteligencia (CNI) | No verificado: no se describe su trabajo | — | Solo lo que es público y comprobable: procedencia, integridad, código abierto auditable | — | Ninguna afirmación sobre su uso |

## Reglas de diseño derivadas
1. Una sola pantalla de operador, no un folleto: rejilla densa, tipografía de interfaz (Inter + IBM Plex Mono autoalojadas), sin emojis ni pastillas.
2. Mapa con datos reales dibujados por el navegador; cada capa con su fuente, licencia y huella.
3. El flujo de decisión en 5 pasos (Señal → Verificación → Afectación → Caminos → Alerta), con la persona firmando al final.
4. Lentes por sector: la misma verdad, lo que cada uno necesita primero.
5. Nada decide solo: SENDA prepara, el responsable firma. Estado «Ejercicio» siempre visible.
