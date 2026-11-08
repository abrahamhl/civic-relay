# INNOVACIÓN Y LÍNEAS DE INVESTIGACIÓN — SENDA LIVE

Este documento detalla las tres líneas prioritarias de investigación del producto y su análisis preliminar frente al estado del arte.

---

## 1. Evidence-Aware Social Incident Graph (EASIG)
- **Concepto:** Grafo dinámico donde las publicaciones no compiten por engagement adictivo, sino que se vinculan como observaciones a un nodo de acontecimiento persistente. El nivel de confianza se calcula mediante la independencia estricta de las fuentes (diferente dominio, autor y entidad emisora).
- **Antecedentes:** Twitter Crisis Informatics, USGS Did You Feel It, Waze incident reports.
- **Novedad:** Separación formal e irreversible entre popularidad (reacciones/likes) y verificación de hechos, con encadenamiento de evidencias criptográficas estilo PCI v0.2.

---

## 2. Event-to-DTN Bridge
- **Concepto:** Transformación selectiva y compacta de publicaciones sociales relevantes en sobres sellados de extremo a extremo SENDA v2 (`@senda/core` envelope.mjs).
- **Antecedentes:** RFC 5050 (Bundle Protocol), Serval Project, Briar.
- **Novedad:** Gobernanza por prioridades y reserva estricta de ancho de banda (`priority-lanes.mjs`) que garantiza que los reportes civiles jamás canibalicen la capacidad de red de los mensajes SOS o las alertas institucionales en condiciones de desconexión.

---

## 3. Consent-Aware Territorial Notification
- **Concepto:** Mecanismo de difusión de avisos y alertas críticas dirigido por polígonos geográficos y suscripciones explícitas a acontecimientos, prescindiendo por completo del rastreo y almacenamiento de ubicaciones precisas en tiempo real.
- **Antecedentes:** EU-Alert, CAP (Common Alerting Protocol).
- **Novedad:** Modelo federado que cruza subscripciones voluntarias de radio (~1 km) con alertas institucionales firmadas, sin revelar la identidad ni la posición exacta de las personas vulnerables al servidor.
