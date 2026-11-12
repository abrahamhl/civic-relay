# Cumplimiento de los compromisos con el fundador

Se revisa cada hora mientras haya trabajo abierto. Estados: ✅ hecho y probado · 🔧 en curso · ⏳ pendiente · ⚠️ bloqueado (con motivo).
Regla de base: `CLAUDE.md` §1 (nada inventado; simulaciones declaradas).

| # | Compromiso | Estado | Evidencia / siguiente paso |
|---|---|---|---|
| 0 | Auditoría de veracidad: quitar valores inventados y etiquetar simulaciones | ✅ (seguir vigilando) | courier: sin valores por defecto sin fuente, escenario de ejemplo etiquetado; película: «simulación», 198/200 con portadores disponibles en España, «recibos anónimos»; guía de hardware marcada como no verificada; evaluaciones con `basis` |
| 1 | Mensaje al hermano sin red ES→NL (multivía, satélite, cola, pasarelas legales) | ✅ | `courier.mjs` + pruebas; pantalla `/senda/mensaje` probada en Chromium con dos móviles (emparejar, número de seguridad, 1 línea de 147 caracteres, repetición, alteración, mensaje largo con una línea perdida y desordenado) |
| 2 | Red de avisos ciudadanos (zonas, ver y reportar peligros, medir el río) | 🔧 | `hazard-reports.mjs` + pruebas; pantalla `/senda/avisos` probada (medida 2,00→2,25 m = 2,50 cm/min; consejo 112; agrupación). Falta: envío real de reportes entre móviles y al organismo |
| 3 | Aliviar el 112: agrupar, contrastar fuentes públicas, priorizar por gravedad | 🔧 | `triageQueue`, `assessIncident`; falta conexión con fuentes reales |
| 4 | Aviso a la población solo con confirmación oficial; zona de reconocimiento previa | ✅ | regla `canPublicWarn` + `reconZone`, con pruebas |
| 5 | Cámaras públicas cercanas (Madrid, DGT) para ciudadanos y emergencias | ⏳ | datasets abiertos identificados (`docs/research/FUENTES_CAMARAS_RIOS_FUEGO_2026-11.md`); conector pendiente; la red de la sesión bloquea los dominios |
| 6 | «Nube termográfica» del fuego: expansión, densidad, combustible por satélite | ⏳ | fuentes: EFFIS, MFE25, FIRMS; integrar en el modelo de fuego |
| 7 | Conexión multisoftware / interoperabilidad (CAP, EMSI, DATEX II) | 🔧 | existentes en `interop.mjs`; ampliar |
| 8 | Módulos COTS (térmica, micrófonos, cámaras, dashcam): Vigía | ✅ | `vigia.mjs` (consenso físico) + pruebas; precios sin verificar |
| 9 | Compras públicas ES/NL/UE: qué funciones pagan los organismos | ✅ | `docs/research/COMPRAS_SOFTWARE_EMERGENCIAS_ES_NL_UE_2026-11.md` (confianza media) |
| 10 | Drones (trayectorias) y bóveda de defensa: estado real y presentación aparte | ⏳ | revisar `drone.mjs` y `defense/` |
| 11 | Renders/visualizaciones de las funciones (ver a través del humo, etc.) | ⏳ | tras las pantallas |
| 12 | App sencilla para la ciudadanía y para los organismos | 🔧 | app Android + Centro; añadir correo y avisos |
| 13 | Película: corregir afirmaciones (199/200 con canal no disponible en ES/NL; «recibos firmados») | 🔧 | guion corregido y verificado (19/19); render en curso |

## Registro de revisiones horarias

| Fecha y hora (UTC) | Revisado | Avance | Problemas |
|---|---|---|---|
| 2026-11-12 23:4x | Lista creada | Regla de veracidad en `CLAUDE.md` | — |
| 2026-11-13 00:4x | Punto 2 | Pantalla de avisos | Detectadas y quitadas 3 frases que prometían integración con el 112 o envío por red que aún no existen |
| 2026-11-13 00:2x | Puntos 0, 1, 13 | Auditoría de veracidad; pantalla de mensaje sin red; guion corregido | La prueba de navegador leía el resultado antes de tiempo (fallo de la prueba, no de la app): corregido |
