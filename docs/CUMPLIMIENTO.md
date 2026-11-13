# Cumplimiento de los compromisos con el fundador

Se revisa cada hora mientras haya trabajo abierto. Estados: ✅ hecho y probado · 🔧 en curso · ⏳ pendiente · ⚠️ bloqueado (con motivo).
Regla de base: `CLAUDE.md` §1 (nada inventado; simulaciones declaradas).

| # | Compromiso | Estado | Evidencia / siguiente paso |
|---|---|---|---|
| 0 | Auditoría de veracidad: quitar valores inventados y etiquetar simulaciones | ✅ (seguir vigilando) | courier: sin valores por defecto sin fuente, escenario de ejemplo etiquetado; película: «simulación», 198/200 con portadores disponibles en España, «recibos anónimos»; guía de hardware marcada como no verificada; evaluaciones con `basis` |
| 1 | Mensaje al hermano sin red ES→NL (multivía, satélite, cola, pasarelas legales) | ✅ | `courier.mjs` + pruebas; pantalla `/senda/mensaje` probada en Chromium con dos móviles (emparejar, número de seguridad, 1 línea de 147 caracteres, repetición, alteración, mensaje largo con una línea perdida y desordenado) |
| 2 | Red de avisos ciudadanos (zonas, ver y reportar peligros, medir el río) | ✅ (falta red automática) | `/senda/avisos`: medida por foto, reporte firmado Ed25519 en una línea de 160 caracteres que viaja por cualquier vía y se importa verificado (probado con 4 móviles: 3 nuevos, 1 repetido, 1 falsificado rechazado). Pendiente: difusión automática por malla/LoRa y conexión con organismo (convenio) |
| 3 | Aliviar el 112: agrupar, contrastar fuentes públicas, priorizar por gravedad | 🔧 | `triageQueue`, `assessIncident`; falta conexión con fuentes reales |
| 4 | Aviso a la población solo con confirmación oficial; zona de reconocimiento previa | ✅ | regla `canPublicWarn` + `reconZone`, con pruebas |
| 5 | Cámaras públicas cercanas (Madrid, DGT) para ciudadanos y emergencias | ⏳ | datasets abiertos identificados (`docs/research/FUENTES_CAMARAS_RIOS_FUEGO_2026-11.md`); conector pendiente; la red de la sesión bloquea los dominios |
| 6 | «Nube termográfica» del fuego: expansión, densidad, combustible por satélite | 🔧 revisado | Ya existe y funciona (probado en Chromium sin errores): `/senda/fuego3d` con terreno Copernicus 30 m, Sentinel-2, meteorología GFS del 23-07-2026, densidad del aire, pluma de Briggs, viento 3D con conservación de masa, humo y pavesas (`atmos3d.mjs`). Declara que sin calibrar el modelo es peor que un círculo y que el ajuste no es validación independiente. Falta: mapas de combustible reales (MFE25/EFFIS; red de la sesión bloqueada) y validar con otro incendio |
| 7 | Conexión multisoftware / interoperabilidad (CAP, EMSI, DATEX II) | 🔧 | `incidentToCap`: incidente ciudadano → CAP 1.2 restringido (nunca público), descargable desde `/senda/avisos`; marcado como ejercicio hasta que exista un convenio con un organismo. Pendiente: EMSI, DATEX II de cámaras |
| 8 | Módulos COTS (térmica, micrófonos, cámaras, dashcam): Vigía | ✅ | `vigia.mjs` (consenso físico) + pruebas; precios sin verificar |
| 9 | Compras públicas ES/NL/UE: qué funciones pagan los organismos | ✅ | `docs/research/COMPRAS_SOFTWARE_EMERGENCIAS_ES_NL_UE_2026-11.md` (confianza media) |
| 10 | Drones (trayectorias) y bóveda de defensa: estado real y presentación aparte | 🔧 revisado | **Civil** (`drone.mjs`): Remote ID ASTM F3411 (codificar/decodificar, «validar con capturas reales» según su propio encabezado), misión de barrido de fachadas y dron mula. **Bóveda** (`src/defense/`, 4 módulos, 22 pruebas, aislada del índice civil por prueba): radar acústico TDoA, A2G/enjambres, radar pasivo y Remote ID, cámara acústica. ⚠️ Contiene generación de **señuelos de Remote ID falsos** y **destellos para cegar cámaras de drones**: emitir identificaciones falsas o interferir aeronaves puede ser ilegal en la UE y en España; requiere revisión jurídica antes de presentarlo a nadie. 6 cifras de precio en € sin fuente en la bóveda |
| 11 | Renders/visualizaciones de las funciones (ver a través del humo, etc.) | ⏳ | tras las pantallas |
| 12 | App sencilla para la ciudadanía y para los organismos | 🔧 | Ciudadanía: `/senda/mensaje`, `/senda/avisos`. Organismo: el Centro importa reportes firmados SND3 → verifica, agrupa, prioriza y exporta CAP (probado con 4 móviles: 5 válidas, 1 repetida, 1 falsa rechazada, atrapados primero). Pendiente: difusión automática por malla/LoRa |
| 13 | Película: corregir afirmaciones (199/200 con canal no disponible en ES/NL; «recibos firmados») | ✅ | v4 renderizada y entregada (12:35, 292 MB): «simulación de 200 envíos… 198», «recibos anónimos»; subtítulos comprobados |

## Registro de revisiones horarias

| Fecha y hora (UTC) | Revisado | Avance | Problemas |
|---|---|---|---|
| 2026-11-12 23:4x | Lista creada | Regla de veracidad en `CLAUDE.md` | — |
| 2026-11-13 03:35 (revisión 4) | Todos | 496/496; cola de reportes ciudadanos en el Centro (flujo ciudadano → organismo de punta a punta) | Las fuentes abiertas (datos.madrid.es, nap.dgt.es, AEMET, Rijkswaterstaat) siguen inaccesibles desde la sesión. Quitada la palabra «malla» de una pantalla porque esa difusión aún no existe |
| 2026-11-13 02:35 (revisión 3) | Todos | 496/496; película v4 entregada; punto 6 revisado contra la app (ya implementado, con límites declarados) | Sin cifras nuevas sin fuente en la hora. Combustible real y validación independiente siguen bloqueados por datos |
| 2026-11-13 01:35 (revisión 2) | Todos | 496/496; sin trabajo nuevo de código en la hora (render en curso, 69 %); revisado el punto 10 (drones y bóveda) | Riesgo legal detectado en la bóveda (señuelos de Remote ID, destellos contra cámaras): no se amplía ni se presenta sin revisión jurídica |
| 2026-11-13 00:4x (revisión 1) | Todos | 495/495; quitada una afirmación sin fuente (versiones de navegador para Ed25519); CAP 1.2 restringido para incidentes | El contenedor se reinició (render + pruebas sin memoria): render relanzado con menos procesos |
| 2026-11-13 01:0x | Punto 2 | Reportes firmados que viajan entre móviles | Mi comentario decía 121 caracteres con P-256: era falso (204); cambiado a Ed25519 = 160 exactos y probado |
| 2026-11-13 00:4x | Punto 2 | Pantalla de avisos | Detectadas y quitadas 3 frases que prometían integración con el 112 o envío por red que aún no existen |
| 2026-11-13 00:2x | Puntos 0, 1, 13 | Auditoría de veracidad; pantalla de mensaje sin red; guion corregido | La prueba de navegador leía el resultado antes de tiempo (fallo de la prueba, no de la app): corregido |
