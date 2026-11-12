# Cumplimiento de los compromisos con el fundador

Se revisa cada hora mientras haya trabajo abierto. Estados: ✅ hecho y probado · 🔧 en curso · ⏳ pendiente · ⚠️ bloqueado (con motivo).
Regla de base: `CLAUDE.md` §1 (nada inventado; simulaciones declaradas).

| # | Compromiso | Estado | Evidencia / siguiente paso |
|---|---|---|---|
| 0 | Auditoría de veracidad: quitar valores inventados y etiquetar simulaciones | 🔧 | courier (disponibilidades sin fuente → `null`), cifra 199/200 de la película, precios de `docs/hardware` |
| 1 | Mensaje al hermano sin red ES→NL (multivía, satélite, cola, pasarelas legales) | 🔧 | `courier.mjs` + pruebas; falta pantalla en la app |
| 2 | Red de avisos ciudadanos (zonas, ver y reportar peligros, medir el río) | 🔧 | `hazard-reports.mjs` + pruebas; falta pantalla |
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
| 13 | Película: corregir afirmaciones (199/200 con canal no disponible en ES/NL; «recibos firmados») | 🔧 | recalcular con canales disponibles en España |

## Registro de revisiones horarias

| Fecha y hora (UTC) | Revisado | Avance | Problemas |
|---|---|---|---|
| 2026-11-12 23:4x | Lista creada | Regla de veracidad en `CLAUDE.md` | — |
