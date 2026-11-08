# SENDA · Novedad, prior art y estrategia de PI

Fecha: 2026-11-08  
Estado: búsqueda exploratoria, no sistemática; no es una opinión legal.  
Conclusión corta: hay contribuciones de ingeniería defendibles, pero **no se afirma novedad ni patentabilidad**.

## 1. Candidatos de contribución

1. **EAOR (Energy-Aware Opportunistic Routing)** para DTN de emergencia: planificación de hasta `k` rutas edge-disjoint con confianza de contacto, deadline, presupuesto de energía y reapertura de contactos a mitad de ventana.
2. **Integración fuego–cámaras–comunicaciones**: propagación de incendio, ensemble, triangulación de columna por cámaras y planificación de pérdida de comunicaciones en un mismo pipeline reproducible.
3. **Paquete de evidencia reproducible**: manifiesto de release con huella de árbol, lockfile, artefacto y benchmark v2 con bootstrap por grafos independientes.
4. **PCI v0.2** (pendiente): recibos firmados, cadena de custodia y verificación fail-closed.

La contribución 1 es la más cercana a una innovación técnica. La 2 es una integración de sistemas. La 3 es ingeniería de reproducibilidad. La 4 aún no existe.

## 2. Prior art consultado (muestra)

Búsquedas realizadas en Crossref el 2026-11-08. No es una revisión sistemática ni exhaustiva.

### DTN y routing

- Vahdat & Becker, *Epidemic Routing for Partially-Connected Ad Hoc Networks*, 2000. Base de `epidemic`.
- Spyropoulos et al., *Spray and Wait*, 2005. Base de `spray`.
- Lindgren et al., *Probabilistic Routing in Intermittently Connected Networks* (PRoPHET), 2003.
- Burleigh et al., CCSDS Bundle Protocol / Contact Graph Routing. Base conceptual de `earliest`.
- *Leveraging Probabilistic Contacts in Contact Graph Routing*, 2019, DOI `10.1109/globecom38437.2019.9014158`. Muy relevante: ya introduce contactos probabilísticos en CGR.
- *Assessing DTN Routing Performance in the Presence of Unreliable Contacts*, 2024, DOI `10.1109/globecom52923.2024.10901335`. Muy relevante: evalúa routing con contactos no fiables.
- *Energy-Aware Routing Protocol for Delay Tolerant Networks*, 2011, DOI `10.1201/b11309-4`.
- *Energy-aware geo-routing for delay tolerant networks in disaster areas*, 2013, DOI `10.1109/iccsnt.2013.6967206`.
- *Multipath Routing based Reliable Delay Tolerant Network*, 2016, DOI `10.17577/ijertv5is050782`.
- *On the Tractability of Yen’s Algorithm and Contact Graph Modeling in Contact Graph Routing*, 2023, DOI `10.1109/wisee58383.2023.10289594`.

### Incendios y cámaras

- Rothermel, *A Mathematical Model for Predicting Fire Spread in Wildland Fuels*, 1972. Base física.
- Finney, FARSITE, 1998. Referencia de propagación y ellipse de viento.
- *Wildfire Spread Prediction and Assimilation for FARSITE Using Ensemble Kalman Filtering*, 2016, DOI `10.1016/j.procs.2016.05.328`.
- *Fire‐EnSF: Data Assimilation for Wildfire Spread Models Using Ensemble Score Filter*, 2026, DOI `10.1029/2025jh001173`.
- *Detecting Wildfire Smoke Onset from Fixed View Camera Networks*, 2026, DOI `10.3390/s26196020`.
- *On triangulation algorithms in large scale camera network systems*, 2012, DOI `10.1109/acc.2012.6315278`.

### Comunicaciones de emergencia

- *Energy-aware geo-routing for delay tolerant networks in disaster areas*, 2013 (ya citado).
- *Reliability and Fault-Tolerant and Delay-Tolerant Routing*, 2017, DOI `10.1002/9781119114864.ch14`.

## 3. Evaluación de novedad

| Candidato | ¿Nuevo? | Evidencia | Riesgo |
|---|---|---|---|
| EAOR como concepto | Probablemente no | CGR probabilístico, routing multipath y energy-aware ya existen | Alto |
| EAOR como combinación concreta (confianza + deadline + energía + edge-disjoint + reapertura) | Posible combinación nueva, no probada | No se encontró una referencia idéntica en la muestra | Medio |
| Integración fuego–cámaras–comunicaciones | Probablemente nueva como sistema | No se encontró una referencia idéntica | Medio |
| Benchmark v2 con bootstrap por grafos | No | Práctica estadística estándar aplicada | Bajo |
| PCI v0.2 | No | Recibos firmados y cadenas de custodia son técnicas conocidas | Bajo |

Ninguna fila tiene `NOVELTY_VERIFIED`. Para ello haría falta una búsqueda sistemática en IEEE Xplore, ACM DL, Scopus, Web of Science y bases de patentes, con revisión por un experto independiente.

## 4. Qué se puede afirmar hoy

- «EAOR es una política de routing implementada y evaluada en simulación; mejora la entrega frente a `earliest` en el escenario `unreliable-contacts` con un coste de latencia y energía.»
- «La combinación de planificación de rutas, confianza, energía y reapertura de contactos está implementada en este repositorio.»
- «No se ha verificado que sea novedosa frente al estado del arte completo.»
- «No se ha evaluado su patentabilidad.»

No se puede afirmar:

- «EAOR es el primer sistema…»
- «Somos los únicos…»
- «Patente pendiente» sin solicitud real.
- «Supera a todos los métodos conocidos.»

## 5. Estrategia de protección

Dado que el código ya se publicó bajo MIT:

- No se puede revertir la licencia del código existente.
- Se puede proteger documentación, marcas, secretos industriales y mejoras no publicadas.
- Una patente sobre una invención ya divulgada puede tener problemas de novedad; se requiere revisión legal.
- La publicación defensiva es una opción para evitar que terceros patenten lo divulgado.
- Cualquier filing debe hacerse con abogado de PI y antes de nuevas divulgaciones.

### Opciones

1. **Open core**: mantener el núcleo MIT y reservar módulos de operación/seguridad.
2. **Patente defensiva**: solo si la búsqueda y el abogado lo justifican.
3. **Secreto industrial**: para calibraciones, datos de campo y modelos no publicados.
4. **Publicación defensiva**: registrar fecha y contenido de las contribuciones.

## 6. Registro de divulgaciones

| Fecha | Divulgación | Estado |
|---|---|---|
| 2026-11-07 | Benchmark DTN v1 y evidencia | Público en repo |
| 2026-11-08 | EAOR y benchmark v2 | En revisión interna, pendiente de commit |
| 2026-11-08 | Documentos de misión | En revisión interna |

Antes de publicar EAOR en un canal externo, decidir: publicación defensiva, solicitud de patente o secreto. No publicar posibles invenciones sin esa decisión.

## 7. Próximos pasos

1. Búsqueda sistemática con consultas y criterios de inclusión/exclusión.
2. Revisión de patentes en USPTO, EPO, WIPO y OEPM.
3. Entrevista con abogado de PI.
4. FTO (freedom to operate) antes de comercializar.
5. Actualizar este documento con resultados; no borrar intentos fallidos.
