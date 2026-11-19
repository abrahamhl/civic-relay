# SENDA RoadSafe — Road Alert Fabric, horizonte y cobertura verificable
**Fecha:** 2026-11-18  
**Rama:** fix/senda-roadsafe-alert-coverage-20261118  
**Dependencia apilada:** PR #49 (BLE/HMI) → PR #48 (RoadSafe) → PR #47.  
**Estado:** investigación y software de ensayo; NO apto para avisos viales operativos ni servicios 112.

## 1. Resultado comprobable
- Nuevo módulo portable: packages/senda/src/roadsafe-road-alert-network.mjs. Espejo web byte a byte: investor-next/public/senda/core/roadsafe-road-alert-network.mjs.
- Contrato canónico de entrada: reportId, incidentKey, hazardType, severity, observedAtMs, expiresAtMs, road (roadId, carriagewayId, direction, chainageM, uncertaintyM, mapMatched), provenance (rootId, publisherId, independenceFamily, verification, proofId).
- Una copia por DGT/DATEX/BLE conserva su rootId. El número de retransmisiones NO aumenta el número de testigos.
- Una afirmación AUTHORITY_VERIFIED o PARTNER_ATTESTED no tiene efecto privilegiado sin atestación verificada externamente, ligada a la raíz, emisor, familia y vigencia. acceptedAttestations es una interfaz de **dependencia de confianza**, no un verificador; solo un subsistema criptográfico confiable debe suministrarlo.
- Una escena requiere identidad común de incidente y peligro, misma vía y calzada, dirección compatible y coherencia espacial; no se fusionan accidentes distintos solo por cercanía.
- Avisos SIMULATED o DISPUTED se rechazan en el bus operacional. La vista de ensayo genera datos UNVERIFIED sintéticos claramente señalizados; no pueden activar voz.
- Horizonte: map matching explícito; rechaza calzada contraria, eventos detrás, caducados y sentido desconocido. La incertidumbre geográfica afecta intervalo de distancia/ETA. No emite indicaciones de maniobra.
- Salida: SCREEN, VOICE, SMS, BLE_PEER, DTN_RELAY, DGT30, DATEX2, WAZE_CIFS, DENM, PMV, CAP, TAXI_PARTNER e INSURER_PARTNER. El método planRoadAlertDistribution solo compone un **plan**, nunca envía nada. Las comprobaciones de consentimiento, autorización, fuente y enlace son fail-closed.
- Se usa el HMI Arbiter de PR #49 para diferenciar el listado visual y los avisos de voz; este último sigue bloqueado por falta de aprobación de despliegue.

## 2. Corrección de defectos heredados
### corridor-connectors.mjs
- Sin confianza: confidence=null; sin precisión: uncertaintyRadiusM=null; sin validación declarada: VALIDATION_NOT_ESTABLISHED / UNVERIFIED.
- MONIBAS desconocido: no se asignan coordenadas inventadas de Arnhem; se descarta la estación sin georreferenciación.
- DGT NAP: no se inventa fecha, tramo N-403, severidad ni score de confianza; se diferencia observación abierta de fuente verificada; datos sin fecha y sin geometría no crean incidentes.
- MQTT: no contiene token autorizado por defecto. Metadatos no suministrados no se rellenan con puntuaciones hipotéticas.

### corridor-fabric.mjs
- Siempre normaliza; un observationId proporcionado por el emisor no evita controles.
- Fuente no cualificada o sin confianza >0,5: no suma evidencias positivas ni negativas. Si solo existen esas observaciones, devuelve ABSTAIN_INSUFFICIENT_EVIDENCE en lugar de NORMAL_CORRIDOR_FLOW.
- La antigua "uncertaintyInterval90" no era un IC calibrado. Ahora devuelve null y etiqueta el score como HEURISTIC_SCORE_NOT_CALIBRATED_PROBABILITY.
- Falta de precisión geográfica: no se crea radio de 25 m por defecto.
- Un canal sin authorizationState explícito queda UNVERIFIED; sin calidad o disponibilidad estimada explícita no se selecciona.
- Tokens del piloto B son efímeros (crypto.randomUUID). Valores de disponibilidad de A/B se pasan explícitamente como *hipótesis de demostración*, etiquetadas isSimulatedOrEmulated, no como datos de red real.

## 3. Puerta de promoción a piloto y financiación
| Capacidad | Estado | Prueba exigida |
|---|---|---|
| Bus/deduplicación/horizonte | Código con tests locales para módulo nuevo | CI completo, fuzzing, replay, piloto con cartografía real y control de versiones de origen |
| Relé BLE sentido contrario | Fórmula condicional + Monte Carlo en PR #49 | ≥2 Android y ≥2 iPhone reales, ensayos de segundo plano, barreras, lluvia, latencia y tasas observadas con intervalos |
| Voz contextual y carga cognitiva | Árbitro de planificación sin audio real autorizado | Estudio de factores humanos, distracción, falsas alarmas, nivel acústico y cumplimiento HMI |
| DGT 3.0 / V16 / DATEX II | Modelado de datos/prototipo | Credenciales, alcance legal, esquema XSD, acuerdo de intercambio y trazabilidad de incidentes |
| Waze/Google Maps | Deep link de navegación; CIFS prototipo | Convenio Waze y validación feed. Google Maps URLs no permite inyectar incidencias |
| Taxi, grúa, aseguradoras, 112 | Simulaciones/contratos de API | Convenios reales, casos de extremo a extremo, acuses autenticados y roles de responsabilidad |
| PMV/CAP/DENM | Mapeos semánticos | Autorización institucional, certificado/estación C-ITS, pruebas de interoperabilidad y revisión normativa |

## 4. Prioridades posteriores (P0 → P2)
1. **P0:** Conectar la atestación de origen al verificador criptográfico independiente. No tomar decisiones de aviso público por datos de un único sensor local.
2. **P0:** Validar el orden de peligros con geometría real de calzada, rampas, nudos y carriles; estudiar final de cola móvil. Un PK nominal no prueba sentido físico.
3. **P0:** Distinguir permanentemente estado QUEUED, CUSTODY_ACK, DESTINATION_ACK y AVISO_HUMANO_RECIBIDO. La recepción de red no prueba que el conductor haya prestado atención.
4. **P0:** Pruebas negativas: carril opuesto, reflejos BLE, repetición de firmas, eventos caducados, doble origen del mismo V16, falsos positivos de sensores y cambio brusco de longitud de cola.
5. **P1:** Medir adopción, RSSI, rendimiento Android/iOS bloqueados, propagación DTN y latencia p95 con 2+2 dispositivos; recoger *todos* los fracasos y versiones de SO.
6. **P1:** Validar DATEX II con esquemas oficiales y separar feed de lectura y de escritura; integrar tráfico observado solo donde exista licencia explícita.
7. **P1:** Ensayar la cadena completa de avería → asistencia/seguro/taxi → coordinación con operador → final de cola → cierre y revocación del aviso, incluyendo ausencia de cobertura y vehículos que frenan.
8. **P2:** Estimar exposición (veh-km), tasas regionales y "puntos negros" con normalización por clase de vía, periodo y completitud de geocodificación. No atribuir tasas de STATS19/AADF a España.
9. **P2:** La Instrucción española 8.3-IC para señalización de obras no puede usarse como tabla de distancias operativas de averías de vehículos sin validación jurídica y vial específica.

## 5. Ejecución y trazabilidad
- Ejecutar el grupo nuevo: node --test packages/senda/tests/roadsafe-road-alert-network.test.mjs packages/senda/tests/roadsafe-corridor-p0.test.mjs
- Revalidar los tests previos: npm --prefix packages/senda test; npm --prefix packages/senda run test:adversarial.
- Ejecutar paridad: npm --prefix packages/senda run sync-web y comprobar git diff --exit-code.
- Ejecutar CI RoadSafe Chromium con la ruta /senda/roadsafe.html y verificar que la pestaña Carretera carga, recalcula y no declara avisos operativos.
- Los outputs de PR #49 (14/14) son de software, no ensayos BLE físicos. No comunicar métricas de éxito físico hasta obtenerlas.
- No fusionar ni desplegar automáticamente. Mantener revisión humana de seguridad para material de financiación.

**Principio de diseño:** SENDA complementa Waze/Google Maps como capa de prevención y coordinación; no presume inyección de alertas en esos servicios, ni en V16/112, sin contrato, homologación y evidencia reproducible.
