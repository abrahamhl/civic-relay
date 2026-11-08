# SISTEMA DE DISEÑO Y NAVEGACIÓN SENDA LIVE

## 1. Principios de Interfaz

1. **Familiaridad sin Adicción:** Adopción de patrones estándar de navegación (feed vertical, pestañas superiores, barra de navegación inferior móvil, barra lateral en escritorio) sin algoritmos adictivos de retención artificial.
2. **Claridad Visual de Verificación:**
   - Amarillo / Ámbar: `UNVERIFIED_REPORT` (Reporte sin verificar)
   - Azul: `SOURCE_IDENTIFIED` (Medio o autor identificado)
   - Verde: `CORROBORATED` (Corroborado por ≥2 fuentes independientes)
   - Rojo con escudo: `OFFICIAL_SOURCE_CONFIRMED` (Confirmado por alerta institucional activa)
   - Púrpura: `DISPUTED` (En disputa / versiones contradictorias)
   - Tachado rojo: `RETRACTED` (Alerta o noticia desmentida y archivada públicamente)
3. **Privacidad por Defecto:**
   - La ubicación se solicita sólo con acción explícita del usuario y se trunca a 2 decimales (~1.1 km).
   - No se publican pines con domicilios exactos o identidades de víctimas.

---

## 2. Puntos de Quiebre (Breakpoints) Probados

- **360 px / 390 px (Móvil):** Oculta paneles laterales; activa barra inferior de 5 accesos directos (Inicio, Mapa, Publicar, Mensajes, Alertas).
- **768 px (Tablet):** Vista limpia con feed ampliado y cabecera condensada.
- **1024 px / 1440 px (Escritorio):** Distribución simétrica en 3 columnas:
  - Izquierda: Navegación, accesos directos y perfil.
  - Centro: Feed, historias, mapas o conversación según pestaña activa.
  - Derecha: Estado de red/DTN, sucesos activos, advertencia complementaria 112 y transparencia DSA.
