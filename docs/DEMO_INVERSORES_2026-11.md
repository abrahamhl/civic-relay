# Demostración para inversores · guion de 15 minutos (noviembre de 2026)

Solo incluye lo que está **implementado y probado** en el repositorio a fecha 13-11-2026 (núcleo 496/496, 19/19 afirmaciones de la película verificadas con `node scripts/prove.mjs`). Cada paso dice qué demuestra y **qué no hay que afirmar**. Regla de base: `CLAUDE.md` §1.

Preparación: app Android (APK de la CI) o la web en `/senda`, dos móviles, el Centro en un portátil (`/senda/centro`). Antes de la reunión: `node scripts/prove.mjs` y `node packages/senda/scripts/build-status-page.mjs`.

| # | Qué enseñar (dónde) | Qué demuestra | Qué NO decir |
|---|---|---|---|
| 1 | Película v5 (3 min de extracto) | El problema y el enfoque | Que las escenas de malla o fuego son grabaciones: son **simulaciones** calculadas por el núcleo |
| 2 | **Mensaje sin red** (`/senda/mensaje`) entre los dos móviles: emparejar, comparar el número de seguridad, cifrar, pasar la línea (copiar o por sonido) y abrir | Cifrado de extremo a extremo real; un mensaje corto cabe en **una línea de 160 caracteres** que acepta un SMS o un mensajero satelital; rechaza mensajes alterados y repetidos | Que llega a Holanda sin nada: entre países hace falta una vía real (mensajero satelital en cada lado, o que vuelva la red). El satélite directo al móvil **no existe hoy en España ni en Países Bajos** |
| 3 | **Avisos** (`/senda/avisos`): reportar «calle inundada», medir el nivel con una foto, generar la línea firmada | Reporte firmado (Ed25519) en 160 caracteres; la medida es geometría reproducible | Que hay IA que «ve» el río: es medida por toques. Que SENDA avisa a la población: **no**, solo el organismo oficial |
| 4 | **Centro** (`/senda/centro`) → «Reportes ciudadanos»: pegar las líneas de varios móviles | Verificación de firmas, rechazo de falsos y repetidos, agrupación en incidentes, priorización (atrapados primero) y parte **CAP 1.2** restringido | Que está conectado a una sala 112: **no hay convenio**; el CAP sale marcado como ejercicio |
| 5 | Centro → incendio con antenas que caen, plan de entrega con física de lluvia (ITU-R P.838) y «Emitir orden firmada» | Orden firmada por un coordinador acreditado; los teléfonos rechazan órdenes falsificadas; auditoría encadenada; aprendizaje de fiabilidad por canal y pueblo | Que las probabilidades son medidas de campo: son de **catálogo y simulación** hasta hacer pruebas reales |
| 6 | Incendio 3D (`/senda/fuego3d`) | Terreno Copernicus, Sentinel-2 y meteorología GFS reales; viento 3D, pluma y humo | Que predice bien: sin calibrar es **peor que un círculo**, y el ajuste con la cicatriz no es una validación independiente (lo dice la propia página) |
| 7 | Estado (`/senda/estado`) | Pruebas automáticas a la vista | Que las 49 pruebas de extremo a extremo son de hoy: son de una ejecución guardada del 10-11-2026 |
| 8 | Vigía (documento `docs/product/SENDA_VIGIA_2026-11-12.md`) | Consenso físico entre sensores baratos: simulación Monte Carlo reproducible | Precios de hardware o rendimiento en campo: **sin cotizar y sin medir** |

## Preguntas difíciles que conviene llevar respondidas

- **¿Ha funcionado ya en campo?** No: falta la prueba con radios y teléfonos reales (protocolo en `docs/field/PILOT_PROTOCOL_2026-11.md`). Es el siguiente hito.
- **¿Quién lo compra?** Ver `docs/research/COMPRAS_SOFTWARE_EMERGENCIAS_ES_NL_UE_2026-11.md`: los organismos pagan sobre todo radio crítica y mantenimiento de plataformas 112; SENDA encaja como **complemento** (canal de respaldo, reportes ciudadanos estructurados, CAP), no como sustituto. Cifras con confianza media: verificarlas antes de citarlas.
- **¿Los 164 M€?** La cifra existe, pero corresponde al sistema de señalización ERTMS del Ourense–Santiago (ADIF, 2010–2011), **no** a un sistema de emergencias. Contarlo así o no contarlo.
- **¿Qué pasa con la parte de defensa?** Está separada del producto civil. Contiene funciones (identificaciones de dron falsas, destellos contra cámaras) que necesitan **revisión jurídica** antes de enseñarse.

— Preparado en la revisión horaria del 13-11-2026 · Claude Code (sesión cloud).
