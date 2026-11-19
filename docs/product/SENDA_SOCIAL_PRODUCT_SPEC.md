# SENDA LIVE / SENDA SOCIAL — ESPECIFICACIÓN DE PRODUCTO

**Versión:** 0.1.0 (Noviembre 2026)  
**Estado:** IMPLEMENTED / UNIT_TESTED / E2E_TESTED  
**Audiencia:** Usuarios generales, periodistas, coordinadores de protección civil, servicios de emergencia.

---

## 1. Misión y Propuesta de Valor

SENDA LIVE transforma la experiencia de una red social moderna en un sistema de resiliencia civil y conocimiento territorial en tiempo real. 

### Diferenciador Estratégico
Cualquier publicación relevante (enlace externo de TikTok/YouTube/X/Bluesky, noticia, observación vecinal) puede vincularse a un **Acontecimiento Verificable (Event Hub)**. La credibilidad no depende de likes ni algoritmos adictivos: se calcula de forma auditable mediante concurrencia de fuentes independientes y acreditación institucional criptográfica.

---

## 2. Los Tres Dominios Funcionales

### DOMINIO A — SOCIAL
- Perfiles de usuario y gestión de sesiones reales con tokens criptográficos.
- Publicación de enlaces (Link First), vídeos autorizados, noticias y observaciones.
- Historias verticales efímeras (24 h).
- Feed con pestañas: Para ti, Siguiendo, Cerca, Noticias y En directo.
- Reacciones, comentarios y marcadores.
- **Invariante:** Un LIKE jamás autoriza el seguimiento de un suceso ni emite alertas dirigidas.

### DOMINIO B — ACONTECIMIENTOS Y EVIDENCIAS (EVENT HUB)
- El acontecimiento es una entidad persistente con identificador único (ej: `EVENT-VALENCIA-FLOOD-001`).
- Agrupa observaciones, noticias y alertas oficiales vinculadas.
- Cadena de procedencia inspirada en PCI v0.2: hash de los datos propios + prev_hash.
- Estados de verificación: `UNVERIFIED_REPORT`, `SOURCE_IDENTIFIED`, `CORROBORATED`, `OFFICIAL_SOURCE_CONFIRMED`, `DISPUTED`, `RETRACTED`, `EXPIRED`.
- Suscripción explícita con consentimiento granular.

### DOMINIO C — COORDINACIÓN Y RESILIENCIA (DTN)
- Emisión de alertas oficiales verificadas por operadores institucionales con credenciales ECDSA P-256.
- Custodia de sobres SENDA v2 en gateway (`IN_CUSTODY`).
- Doble check real condicionado al acuse de recibo del destinatario (`VERIFIED`).
- Cola de prioridad con reserva garantizada para tráfico crítico (SOS / emergencias).
- Aviso explícito: SENDA es un canal complementario y nunca sustituye al 112.

---

## 3. Navegación en 5 Secciones

1. **INICIO (Feed):** Navegación fluida entre pestañas sin perder posición.
2. **MAPA:** Capas temáticas (inundaciones, incendios, tráfico, cortes, alertas oficiales). Coordenadas aproximadas a ~1 km por defecto.
3. **PUBLICAR (+):** Flujo guiado de 5 pasos con extracción legal de metadatos y propuesta de hipótesis.
4. **MENSAJES:** Chats directos, grupos y canales con estados de entrega inequívocos.
5. **ALERTAS:** Centro de avisos oficiales, gestión de zonas voluntarias y botón SOS de acceso permanente.
