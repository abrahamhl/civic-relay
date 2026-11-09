# SENDA · Estrategia de protección tecnológica

Fecha: 2026-11-08  
Estado: borrador estratégico; no es asesoramiento legal.  
Documento relacionado: `docs/research/SENDA_NOVELTY_AND_PRIOR_ART.md`.

## 1. Punto de partida

- El código ya publicado está bajo licencia MIT. No se puede revocar esa licencia para las versiones ya distribuidas.
- No hay patentes solicitadas ni concedidas.
- No hay búsqueda sistemática de prior art ni análisis de libertad de operación (FTO).
- No se ha verificado la novedad de EAOR ni de la integración fuego–cámaras–comunicaciones.

## 2. Activos a proteger

1. **Código**: ya abierto; la protección es la licencia, la marca y la comunidad.
2. **Documentación y protocolos**: derechos de autor; se pueden divulgar defensivamente.
3. **Datos de campo y calibraciones**: secretos industriales si no se publican.
4. **Marcas y nombres**: registrar «SENDA» si no hay conflicto.
5. **Mejoras no publicadas**: posibles invenciones; requieren decisión antes de divulgar.
6. **Relaciones institucionales y permisos**: activos comerciales, no de PI.

## 3. Opciones

### A. Open source con open core

- Núcleo MIT; módulos de operación, certificación y soporte bajo licencia comercial.
- Ventaja: adopción y confianza.
- Riesgo: competidores pueden reutilizar el núcleo.

### B. Publicación defensiva

- Publicar con fecha y hash para evitar que terceros patenten lo divulgado.
- Bajo coste; no protege la explotación.
- Requiere decidir antes de publicar.

### C. Secreto industrial

- Mantener calibraciones, datos de campo y modelos no publicados.
- Requiere control de acceso, contratos y trazabilidad.
- Difícil si el equipo es pequeño y abierto.

### D. Patente

- Solo con búsqueda sistemática, abogado y presupuesto.
- La divulgación previa puede destruir la novedad en muchas jurisdicciones.
- Un software puro puede no ser patentable en algunas jurisdicciones.
- No presentar una solicitud sin revisión legal.

### E. Marca

- Registrar el nombre y el logotipo en las clases relevantes.
- Verificar disponibilidad y conflictos.

## 4. Recomendación

1. **No publicar EAOR en un canal externo** hasta decidir entre publicación defensiva y patente.
2. Mantener el núcleo actual en MIT; no intentar relicenciar versiones pasadas.
3. Redactar un **invention disclosure** interno con fecha, autores, problema, solución y evidencia.
4. Encargar una **búsqueda sistemática** de prior art y patentes.
5. Consultar a un abogado de PI antes de cualquier filing o divulgación adicional.
6. Registrar la marca si el proyecto va a operar comercialmente.
7. Separar datos de campo y calibraciones en un repositorio privado con control de acceso.

## 5. Registro de invenciones (borrador)

| ID | Título | Autores | Fecha | Estado | Divulgado |
|---|---|---|---|---|---|
| INV-001 | EAOR: routing oportunista con confianza, energía, deadline y rutas edge-disjoint | Equipo SENDA | 2026-11-08 | Borrador | Interno |
| INV-002 | Integración fuego–cámaras–pérdida de comunicaciones | Equipo SENDA | 2026-11-08 | Borrador | Interno |
| INV-003 | Paquete de evidencia reproducible con manifiesto de árbol y benchmark por grafos | Equipo SENDA | 2026-11-08 | Borrador | Interno |

Este registro no afirma novedad ni patentabilidad. Es solo una traza interna.

## 6. Libertad de operación (FTO)

Antes de comercializar:

- Identificar patentes vigentes en las jurisdicciones de despliegue.
- Revisar licencias de datos (Copernicus, GFS, cámaras, mapas).
- Revisar licencias de dependencias.
- Revisar obligaciones de atribución.
- Documentar conclusiones con abogado.

## 7. Riesgos

- Divulgación accidental de una invención antes de decidir.
- Uso de datos sin licencia.
- Conflicto de marca.
- Dependencia de una licencia de terceros.
- Afirmaciones públicas de novedad sin evidencia.

## 8. Próximos pasos

- [ ] Búsqueda sistemática de prior art.
- [ ] Búsqueda de patentes.
- [ ] Reunión con abogado de PI.
- [ ] Decisión sobre EAOR.
- [ ] Registro de marca.
- [ ] Política de datos de campo.
- [ ] Revisión de licencias de datos y dependencias.
