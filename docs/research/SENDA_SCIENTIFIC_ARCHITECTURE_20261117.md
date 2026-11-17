# SENDA — Arquitectura científica actualizada · 17 noviembre 2026

> **Estado:** investigación y simulación. Nada de este documento es validación de campo, certificación ni prueba de entrega.
> Rama `ccr-ea048c78-86gcio`, apilada sobre PR #38 (`74631c0`). Experimento, cifras y veredicto: `SENDA_ARR_HYPOTHESIS_REGISTER_20261117.md`.
> Etiquetas usadas en todo el texto: **OBSERVADO** (dato de un organismo), **SIMULADO** (generado por nuestro código), **PREDICHO** (salida de un modelo con incertidumbre), **HIPÓTESIS** (aún sin contraste).

## 1. Estado real del repositorio (inspección previa)

| Línea | Dónde vive | Estado comprobado |
|---|---|---|
| `master` (`b8360c9`) | `packages/core`, `packages/transports`, `investor-next`, `experimental/android-nearby` | Demo web desplegada, router por puntuación de transporte, cola en memoria, laboratorio Android Nearby con cola persistente y ACK P-256 (JVM). Sin ensayo con dos teléfonos. |
| PR #34 → #35 → #38 (drafts, apilados sobre `master`) | `experimental/senda-route-truth/` | Puerta de autorización de rutas, dos procesos aislados, cola durable de laboratorio, enumerador de contactos con cota de Boole. 31 tests pasan en esta rama. |
| PR #25–#32 (`feat/senda-*`, `ccr-a6eeda4b-bprwzy`, `mission/*`, `wip/consolidation`) | `packages/senda` (82 módulos), `apps/senda-live`, `packages/senda-pci`, `apps/command-center` | **Historias Git sin ancestro común con `master`** (`git merge-base` vacío). Contienen el motor SENDA más amplio: CGR, enrutado oportunista, garantía de entrega con causa común para portadores en paralelo, órbitas Kepler+J2, incendios con GOES/HRRR, DEM, PCI. No se pueden fusionar en `master` sin una decisión explícita de consolidación. |

**Divergencias y duplicaciones detectadas**

1. Cuatro enrutadores con semánticas distintas: `packages/core/src/router.ts` (elige transporte), `investor-next/lib/emergency-routing.mjs` (Dijkstra en unidades virtuales), `packages/senda/src/router.mjs` + `opportunistic-routing.mjs` (CGR, solo en ramas huérfanas) y `experimental/senda-route-truth` (puerta + enumerador).
2. `routeMessage` (rama huérfana) calcula `1 − Π(1 − confianza_ruta)`: supone rutas independientes. `delivery-assurance.mjs` ya corrige la causa común, pero solo para **portadores en paralelo con fragmentos k-de-n**, no para rutas multisalto que comparten relés o zona de peligro. Ese hueco es el que aborda este trabajo.
3. Tres implementaciones de canonicalización/criptografía (`packages/core/crypto.ts`, `packages/senda-pci`, `apps/command-center/src/security`).
4. Dos modelos orbitales: geometría ilustrativa en `investor-next/lib/live-protocol-node.mjs` (ya etiquetada como sintética en #38) y Kepler+J2 en `packages/senda/src/orbital.mjs`.

**Decisión de continuidad tomada aquí:** no se reimplementa nada de lo anterior. El módulo nuevo vive aislado en `experimental/senda-arr/`, reutiliza la semántica de elegibilidad y de tiempos de #34/#38 y lo demuestra con tests diferenciales contra `assessModelRoute` y `planHypotheticalContacts`.

## 2. Matriz inicial de investigación

| # | Problema | Hipótesis | Evidencia existente | Incertidumbre | Potencial innovador | Dificultad de validación |
|---|---|---|---|---|---|---|
| A | Elegir réplicas multisalto cuando los fallos comparten causa | Planificar con un conjunto de escenarios de peligro mejora entrega y calibración frente a suponer independencia | Este PR: experimento retenido + 3 incendios observados | Media: topología simulada, sin radio | Medio (combinación aplicada de piezas conocidas) | Baja en simulación, alta en campo |
| A' | Planes estáticos quedan lejos del techo epidémico | Replanificar en cada custodio cierra la brecha con una fracción de las transmisiones | Brecha medida aquí | Alta | Medio-alto | Media |
| B | Estimar calidad de enlace sin tocar dispositivos ajenos | Señales de difusión recibidas legalmente (C/N0 GNSS, RSSI propio) reducen el error de predicción frente a solo relieve | Ninguna medida propia; física en §4 | Alta | Medio | Alta: requiere hardware y campaña |
| C | Pronóstico de peligro con incertidumbre útil para rutas | Asimilar perímetros observados en los pesos del conjunto mejora la calibración de pérdida de nodos | Prior sin asimilación implementado; error medido en el registro | Media | Medio | Baja: datos públicos |
| D | Recibos y autorización con relojes imprecisos | Contador monótono + identificador de arranque + ventana acotada evita repeticiones sin reloj fiable | Cola durable (#38), ACK P-256 Android (JVM) | Media | Bajo (primitivas estándar; el valor es la integración probada) | Media |
| E | Ventanas satelitales | Separar cinco niveles (geometría → enlace → terminal → contrato → ACK) evita sobreafirmar | Etiquetado sintético (#38); Kepler+J2 en rama huérfana | Alta sin terminal | Bajo-medio | Alta: requiere terminal y convenio |

## 3. Arquitectura propuesta: SENDA Adaptive Resilience Routing (ARR)

```
 fuentes OBSERVADAS            modelos PREDICHOS                 decisión (MODELO)                 evidencia
 perímetros, meteo,   ──►  conjunto de escenarios de   ──►  rutas candidatas sobre grafo   ──►  plan de ≤K réplicas
 recibos firmados          peligro  {muerte de nodo,         temporal de contactos              + probabilidad, cotas,
                            factor por contacto, peso}        (solo contactos autorizados)       traza, banderas falsas
                                                                      │
                               puerta de autorización (#34): consentimiento, energía, radio, rol,
                               ACTIVE_RADIO, autorizado, habilitado, ciclo de trabajo  — falla cerrado
```

- **Grafo**: multigrafo temporal dirigido. Un contacto = `{from, to, [inicio, fin], tasa, handshake, energía, p, portador}`. BLE, Wi-Fi Direct/Aware, LoRa, IP y pasarelas son contactos con parámetros distintos; el almacenamiento y reenvío es la espera entre ventanas.
- **Peligro**: mezcla finita de escenarios `m` con peso `w_m`. Dentro de un escenario los contactos fallan de forma independiente; la correlación nace de mezclar escenarios. Es la misma estructura que `delivery-assurance.mjs`, extendida de portadores en paralelo a rutas serie-paralelo en el tiempo.
- **Fiabilidad exacta de un conjunto de rutas R** en el escenario `m` (inclusión–exclusión, ≤ 2^K − 1 términos):
  `P_m(R) = Σ_{∅≠S⊆R} (−1)^{|S|+1} · 1[todas las rutas de S sobreviven a m] · Π_{c ∈ ∪S} p_c·f_{m,c}`; `P(R) = Σ_m w_m P_m(R)`.
- **Selección**: `P(·)` es monótona y submodular (probabilidad de una unión de sucesos), así que la selección voraz con límite de cardinalidad garantiza `≥ (1 − 1/e)` del óptimo (Nemhauser, Wolsey y Fisher, 1978). Con presupuesto de energía se ejecuta además la variante ganancia/energía y se conserva el mejor plan.
- **Aversión al riesgo (opcional)**: `(1−λ)·media + λ·CVaR_α`. CVaR es el peor caso sobre re-ponderaciones de los miembros con razón de verosimilitud ≤ 1/α (Rockafellar y Uryasev, 2000).
- **Cotas que acompañan a cada plan**: cota de muestreo de Hoeffding (válida solo si los miembros son muestras i.i.d. del peligro real) y cota de contaminación `(1−ε)·cota` (válida si la realidad es `(1−ε)`·pronóstico + `ε`·cualquier cosa). Ambas se publican junto a lo que afirmaría la independencia.
- **Complejidad**: candidatas `O(B · H · |C|)` (B búsquedas ≤ 400, H saltos ≤ 12); selección `O(K · N_cand · M · 2^K · L)`. Tiempos medidos en el registro.
- **Invariantes** (tests): ningún salto no autorizado, sin bucles, plazo y saltos respetados, presupuesto de energía, determinismo ante reordenación de entradas, resultado inmutable, `physicalDeliveryVerified = recipientAcknowledged = satelliteAccessVerified = operationallySafe = false` siempre.

**Comparadores implementados**: llegada más temprana tipo CGR, k rutas por exclusión de contactos (réplica de `planRoutes`), top-k por fiabilidad marginal, voraz con independencia (ablación), inundación epidémica (techo de entrega) y spray-and-wait binario.

## 4. Línea B — «efecto SENDA / rebote»: qué permite la física

Cuatro fenómenos que no deben confundirse:

| Fenómeno | Qué es | Qué NO implica |
|---|---|---|
| Detectar una señal | Medir potencia/portadora en un receptor propio | Que su emisor sea un nodo ni que acepte tráfico |
| Reflejar energía | Un objeto redistribuye el campo incidente | Que cree, almacene o reenvíe paquetes |
| Recibir información | Demodular y decodificar con SNR suficiente y protocolo compatible | Que haya permiso para usar ese sistema |
| Reenviar activamente | Un nodo cooperativo retransmite con su propia energía | Solo existe con consentimiento, radio activa y autorización |

Órdenes de magnitud (868 MHz, λ ≈ 0,345 m):
- Enlace directo (Friis): `P_r = P_t G_t G_r (λ / 4πd)²`.
- Reflector pasivo (ecuación radar biestática): `P_r = P_t G_t G_r λ² σ / ((4π)³ d₁² d₂²)`. Una placa plana de 1 m² orientada idealmente tiene `σ = 4πA²/λ² ≈ 105 m²`. La pérdida crece con el **producto** `d₁²·d₂²`, no con `(d₁+d₂)²`: un reflector pasivo solo ayuda cuando no hay visión directa y el reflector es grande y está cerca de un extremo. No añade información ni recibos.
- Primera zona de Fresnel: `r₁ = √(λ d₁ d₂ / (d₁+d₂))`; a 5 km y punto medio, `r₁ ≈ 20,8 m`. La difracción por arista (ITU-R P.526) penaliza `J(ν) ≈ 6,9 + 20·log₁₀(√((ν−0,1)²+1) + ν − 0,1)` dB para `ν > −0,78`.
- Superficies reconfigurables (RIS): la ganancia coherente crece con `N²` elementos, pero exige hardware instalado, control de fase, estimación de canal y permiso. No convierte paredes ni equipos ajenos en relés.

**Mejoras obtenibles sin interactuar con terceros (HIPÓTESIS H4):** usar como sondas del entorno señales que el terminal ya recibe legítimamente — `C/N0` por satélite GNSS (máscara de cielo y obstrucción), RSSI/SNR de tramas de la propia red, y balizas propias — para corregir la predicción de calidad de enlace de un modelo de relieve. Es estimación pasiva de canal, no comunicación. Queda fuera: interceptar tráfico privado, usar dispositivos ajenos como relé, emitir fuera de norma.

En ARR esto se traduce en una regla dura ya probada: un contacto con `kind ≠ ACTIVE_RADIO` o un nodo fuera de la lista de consentimiento **nunca** entra en una ruta; la observación ambiental solo puede modificar `p` o los factores del conjunto.

## 5. Línea C — inferencia espacio-temporal

Contrato de toda predicción: `{valor, horizonte, incertidumbre, fuente y fecha del dato, condiciones de invalidez}`.

- Implementado: pronóstico causal de llegada del frente a cada nodo (`fireForecastEnsemble`): velocidad de cabeza log-normal con mediana tomada **solo** de perímetros anteriores al instante de planificación, rumbo uniforme y excentricidad uniforme. Es un prior deliberadamente simple, no un modelo de propagación (no usa viento, combustible ni pendiente).
- Siguiente paso (H2): asimilación tipo filtro de partículas — re-ponderar los miembros por la verosimilitud del perímetro observado más reciente y remuestrear; añadir viento HRRR/Open-Meteo como covariable del rumbo. Métrica: Brier/CRPS de la pérdida de nodos en incendios retenidos.
- Fuentes candidatas con procedencia ya identificada en el repositorio: GOES-R FDC y HRRR (NOAA, dominio público), EFFIS/Copernicus EMS, EONET, MET Norway, USGS. Cada una necesita su ficha de licencia, resolución y latencia antes de entrar en un experimento.

## 6. Línea D — seguridad ciberfísica (solo primitivas estándar)

| Necesidad | Primitiva recomendada | Estado |
|---|---|---|
| Identidad y recibos | Ed25519 o ECDSA P-256; recibo = firma sobre `(id_mensaje, hash_carga, emisor, receptor, contador, reto)` | P-256 en Android (JVM); pendiente de dos dispositivos |
| Integridad/procedencia en tránsito | BPSec (RFC 9172) sobre BPv7 (RFC 9171) si se adopta DTN estándar | No implementado |
| Autorización revocable | Credenciales de vida corta firmadas por la autoridad del ejercicio; lista de revocación compacta difundida por la propia malla | Diseño |
| Anti-repetición sin reloj fiable | `(emisor, id_arranque, contador monótono)` + ventana deslizante; caducidad por reloj monótono local, nunca por hora de pared recibida | Parcial (#38) |
| Privacidad | Identificadores rotatorios por ejercicio; mínimos datos en claro; sin posición salvo opt-in | Diseño |
| Recuperación | Diario con escritura atómica y deduplicación idempotente | Laboratorio Node (#38), Android JVM |

ARR no introduce criptografía. Su aportación a la seguridad es de **veracidad**: salidas inmutables, banderas de evidencia siempre falsas, fallo cerrado ante configuración hostil (tests adversariales).

## 7. Línea E — satélites y ventanas de contacto

Escalera obligatoria, cada peldaño con su propia evidencia:

1. **Visibilidad geométrica** — elementos OMM/GP + SGP4, máscara de horizonte, fecha de los elementos. PREDICHO.
2. **Enlace físicamente posible** — balance de enlace Tierra-espacio (ITU-R P.618), banda, potencia y antena del terminal. PREDICHO.
3. **Terminal compatible** — módem y firmware homologados. Hecho verificable.
4. **Servicio disponible por contrato** — operador, país, plan. Hecho verificable.
5. **Entrega confirmada** — recibo firmado del destinatario. OBSERVADO.

Un paso de satélite predicho solo acredita el peldaño 1. En ARR un contacto satelital solo puede existir con `authorized = true` si 3 y 4 están atestados por el operador del ejercicio; `satelliteAccessVerified` permanece `false` en cualquier salida del planificador. CelesTrak no fue accesible desde este entorno (sin respuesta), así que no se ha calculado ninguna ventana real en esta iteración.

## 8. Simulación y visualización

- `experimental/senda-arr/viewer/index.html`: prototipo aislado que ejecuta **el mismo motor** en el navegador (no reproduce resultados grabados). Mapa con perímetros OBSERVADOS, nodos SIMULADOS coloreados por pérdida PREDICHA, control de tiempo, semilla, ρ, K, método, traza del voraz, distribución por miembro del conjunto y gráfico de resultados retenidos con IC 95 %.
- Integración con los visualizadores 4D navegables (ramas huérfanas `apps/senda-live`, `investor-next/public/senda`): **no realizada**; depende de la consolidación de historias (P0 de gobernanza).

## 9. Riesgos y requisitos de validación física

| Riesgo | Tipo | Mitigación / requisito |
|---|---|---|
| Topología, tasas, energías y `p` por contacto son hipótesis | Físico | ≥ 2 Android + ≥ 2 LoRa EU868 homologados; ≥ 30 intentos fechados por escenario; medir PDR, RSSI/SNR, latencia p50/p95, energía |
| Ciclo de trabajo EU868 (1 % / 0,1 % / 10 % según sub-banda, ETSI EN 300 220) limita réplicas | Regulatorio | Presupuesto de tiempo en el aire por nodo como restricción dura del planificador (hoy solo bandera por contacto) |
| El conjunto de peligro puede estar sesgado | Modelo | Publicar siempre cotas y calibración; H2 (asimilación) |
| Planes estáticos: un relé caído pierde la réplica | Algorítmico | H3 (replanificación por custodio) |
| Coste exponencial en K | Computacional | K ≤ 6 impuesto; medido |
| Lectura comercial excesiva | Reputacional | Ninguna cifra de este trabajo es tasa de entrega real |

## 10. Propiedad intelectual (evaluación honesta)

- **No hay base para afirmar novedad científica.** Mezclas de causa común, SAA, inclusión–exclusión, submodularidad, CVaR, CGR y spray-and-wait son conocimiento publicado. Existe literatura específica sobre enrutado DTN con contactos inciertos (p. ej. RUCoP, citado en `SENDA_SCIENTIFIC_GAPS_20261117.md`); no se ha hecho una búsqueda de anterioridades profesional.
- **Patentabilidad:** baja a incierta para el algoritmo en sí (métodos matemáticos; en Europa exigiría efecto técnico demostrado sobre un sistema de comunicaciones real). No recomendar gasto en patentes antes de tener datos de campo.
- **Lo que sí es difícil de replicar:** (1) el banco de pruebas reproducible con perímetros observados y protocolo prerregistrado; (2) recibos firmados de campo que calibren `p` y los pesos del conjunto; (3) la disciplina de etiquetado y fallo cerrado ya auditada por tests. Encaja mejor como **secreto industrial + datos + publicación abierta revisada** (workshop DTN/IoT) que como patente. Compatible con la licencia MIT del repositorio.

## 11. Hoja de ruta

**P0**
1. Decidir la consolidación de historias Git (`master` frente a ramas `packages/senda`). Sin ella cada motor nuevo se duplica.
2. H2: asimilación de perímetros observados en los pesos del conjunto; evaluar calibración en los tres incendios y añadir al menos uno europeo (EFFIS) retenido.
3. Ensayo físico mínimo (2 Android + 2 LoRa): medir `p` por contacto y sustituir los perfiles hipotéticos.
4. Restricción dura de tiempo en el aire por nodo (EU868) dentro de ARR.

**P1**
5. H3: replanificación por custodio; medir brecha frente al techo epidémico y transmisiones.
6. Intervalos conformales para la probabilidad de entrega a partir de recibos (H5).
7. Peldaños 1–2 de la escalera satelital con OMM + SGP4 (dependencia `satellite.js`, MIT) y test de veracidad.
8. Conectar ARR al visualizador 4D una vez consolidado el repositorio.

**P2**
9. H4: campaña de señales de oportunidad (C/N0 GNSS, RSSI propio) frente a ITU-R P.1812.
10. RIS físicas y reflectores pasivos: solo con hardware, permiso y medida.
11. Revisión externa y búsqueda de anterioridades antes de cualquier afirmación de originalidad.
