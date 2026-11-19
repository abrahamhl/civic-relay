# SISTEMA DE DISEÑO UNIFICADO SENDA (SENDA DESIGN SYSTEM)
**Versión:** 1.0.0-DesignSystem  
**Fecha:** 2026-11-08  
**Autor:** UX Director & Frontend Architecture Lead  

---

## 1. PRINCIPIOS DE EXPERIENCIA Y ACCESIBILIDAD

El sistema de diseño de **SENDA** está concebido bajo una premisa innegociable: **Claridad operativa extrema bajo condiciones de estrés crítico, deslumbramiento solar o baja visibilidad nocturna.**

### Principios Fundamentales:
1. **Contraste de Alto Rendimiento:** Cumplimiento riguroso de WCAG 2.2 Nivel AA como estándar general y Nivel AAA (ratio $> 7:1$) en alertas de emergencia, textos de evacuación y métricas de seguridad vital.
2. **Epistémica Visual Honesta (Trust Badges):** Los datos jamás se presentan sin su grado de certeza. El usuario civil o el operador de emergencias siempre sabe de un vistazo si un dato es una observación directa (`OBSERVED`), un cálculo físico (`CALCULATED`), una confirmación multi-fuente (`CORROBORATED`) o una estimación sintética (`SYNTHETIC`).
3. **Resiliencia al Tacto y Guantes de Emergencia:** Objetivos táctiles mínimos de $48 \times 48\,\text{px}$ en móvil, con espaciado preventivo de pulsaciones accidentales para bomberos o rescatistas con guantes o pantallas mojadas.
4. **Modo Oscuro Operativo Por Defecto:** Paleta oscura (`#0B0F19` base) optimizada para conservar batería en dispositivos OLED durante apagones y evitar el deslumbramiento en centros de control nocturnos.

---

## 2. MATRIZ DE BREAKPOINTS Y ADAPTACIÓN MULTIDISPOSITIVO

| Breakpoint | Ancho (px) | Dispositivos Clave | Modo Primario Recomendado | Comportamiento del Layout |
| :--- | :---: | :--- | :--- | :--- |
| **`xs`** | `360` | Android COTS compacto, radios LTE | Ciudadano (SOS Simplificado) | Monocolumna estricta, botones full-width |
| **`sm`** | `390` | iPhone estándar, Pixel COTS | Ciudadano (Feed + Mapa) | Barra inferior fija, tarjetas compactas |
| **`md`** | `768` | Tablets en vehículos de mando / DGT | Mando Táctico / Lab Mobile | Drawer lateral colapsable, vista dividida |
| **`lg`** | `1024` | Laptops de campo, puestos móviles | Incident Command / Lab | Layout de dos columnas (Mapa + Timeline) |
| **`xl`** | `1440` | Pantallas de escritorio, monitores 2K | Incident Command Completo | Tres columnas (KPIs, Canvas/Map, Intel) |
| **`2xl`** | `1920` | Videowalls de centros 112 / DGT | Videowall Multi-Cámara / Mando | Rejilla de alta densidad con CCTV en vivo |

---

## 3. PALETA DE COLORES Y TOKENS SEMÁNTICOS

```css
:root {
  /* Fondos y Superficies */
  --senda-bg-primary: #0b0f19;      /* Fondo base de la aplicación */
  --senda-bg-card: #151c2d;         /* Tarjetas operativas y paneles */
  --senda-bg-card-hover: #1c253b;   /* Hover en elementos interactivos */
  --senda-border: #243048;          /* Bordes de baja distracción */

  /* Tipografía y Textos */
  --senda-text-primary: #f8fafc;    /* Texto principal (alto contraste) */
  --senda-text-secondary: #94a3b8;  /* Metadatos y explicaciones */
  --senda-text-muted: #64748b;      /* Timestamps y pies de firma */

  /* Estados y Severidad */
  --senda-emergency-red: #ef4444;   /* SOS, peligro inminente, fuego descontrolado */
  --senda-warning-amber: #f59e0b;   /* Humo, baja visibilidad, congestión */
  --senda-success-emerald: #10b981; /* Enlace activo, paquete entregado, ruta segura */
  --senda-info-cyan: #06b6d4;       /* Enlace DTN, baliza detectada, radar */
  --senda-brand-accent: #3b82f6;    /* Navegación y acciones primarias */
}
```

---

## 4. SISTEMA DE BADGES Y CREDIBILIDAD EPISTÉMICA

Para evitar la desinformación en situaciones de pánico, SENDA codifica visualmente la procedencia y seguridad de cada elemento:

1. **Badge de Cifrado y Transporte:**
   - `🚨 SOS Cifrado (Ed25519 E2EE)`: Paquete sellado criptográficamente en el terminal del usuario; ningún intermediario o relé puede leerlo.
   - `💬 Chat Servidor (Sin E2EE)`: Mensaje social estándar almacenado en base de datos; legible por moderación comunitaria.
   - `📡 Malla DTN Asíncrona`: Paquete transmitido mediante saltos multicanal sin conexión a Internet.

2. **Badge de Certificación de Hechos:**
   - `🟢 OBSERVADO (CÁMARA / SENSOR)`: Evidencia directa de hardware calibrado con firma temporal.
   - `🔵 CALCULADO (MODELO FÍSICO)`: Salida de simulación matemática (Rothermel / LWR) sujeta a banda de incertidumbre.
   - `🟡 CORROBORADO (MULTI-FUENTE)`: Dos o más fuentes ciudadanas e institucionales independientes coinciden en el hecho.
   - `⚪ SINTÉTICO (LABORATORIO)`: Datos generados para entrenamiento o benchmarking táctico.

---

## 5. COMPONENTES CLAVE Y MICROINTERACCIONES

- **Botón Permanente SOS:** Siempre visible en la esquina superior derecha (`#ef4444`, pulso suave `1.5s`), emite sobre cifrado de emergencia con coordenadas GPS y telemetría de batería en 1 toque.
- **Canvas de Simulación Científica:** Renderizado a 60 FPS con escalado de coordenadas geográficas a píxeles de pantalla, mostrando el avance elíptico del fuego, la pluma de dispersión y los vehículos en tiempo real.
- **Selector de Modo de Tres Vías:** Alternancia instantánea entre **Modo Ciudadano**, **Incident Command** y **Scientific Lab**, preservando el estado de memoria sin recargas completas de página.
