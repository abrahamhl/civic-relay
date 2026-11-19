# CONFIANZA, PRIVACIDAD, RGPD Y MARCO DSA EN SENDA LIVE

## 1. Cumplimiento RGPD (Privacidad desde el Diseño)

- **Consentimiento Granular (Art. 7 RGPD):** Registro inmutable en `consent_receipts` con finalidad específica (`TERMS`, `FOLLOWED_EVENT_NOTIFICATIONS`, `OFFICIAL_ALERT_NOTIFICATIONS`, `COARSE_LOCATION`, `DTN_RELAY`). Retirable en cualquier momento.
- **Minimización de Datos (Art. 5 RGPD):** Las coordenadas se guardan truncadas a 2 decimales (~1.1 km).
- **Derecho de Acceso y Portabilidad (Art. 20 RGPD):** Endpoint `/api/auth/export` genera un volcado JSON íntegro de la actividad del usuario.
- **Derecho de Supresión (Art. 17 RGPD):** Endpoint `/api/auth/account` anonimiza publicaciones, borra suscripciones y revoca sesiones.

---

## 2. Marco DSA (Reglamento de Servicios Digitales)

- **Notificación y Acción (Notice & Action):** Los usuarios pueden reportar contenido mediante el modal `/api/moderation/report` categorizando el motivo (desinformación, imágenes de víctimas, contenido manipulado, etc.).
- **Motivación Obligatoria:** Toda resolución de moderación genera una notificación al autor del contenido con la base jurídica y motivos técnicos.
- **Derecho de Apelación Interno:** Los autores pueden recurrir la decisión mediante `/api/moderation/cases/:id/appeal`, revisado por analistas de confianza o administradores.

---

## 3. Seguridad Técnica y Prevención de Abuso

- **Protección contra Inyección:** Todas las consultas SQL utilizan prepared statements nativos con parámetros vinculados.
- **Contraseñas:** Algoritmo `scrypt` con parámetros resistentes a GPU/ASIC (`N=16384`, `r=8`, `p=1`) y comparación `timingSafeEqual`.
- **Sesiones:** Token aleatorio de 32 bytes con almacenamiento exclusivo del hash SHA-256 en base de datos.
- **Protección CSRF:** Cabecera `X-Senda-Request: 1` obligatoria en toda mutación (POST/PUT/PATCH/DELETE).
- **Auditoría Append-Only:** Triggers nativos impiden la modificación o borrado de registros en `audit_records`. Las direcciones IP se registran mediante HMAC salado de longitud reducida para preservar la privacidad mientras se permite la detección de ataques de fuerza bruta.
