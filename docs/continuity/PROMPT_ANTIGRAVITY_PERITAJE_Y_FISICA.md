# Prompt para Antigravity · Peritaje ciudadano multimodal + física avanzada (sesión larga, entrega en ZIP)

**Modelo recomendado (verifícalo en el selector, porque la lista cambia):**
- **Orchestrator** (planificador + ejecutor) o **Gemini 4 Carbon** para la sesión larga.
- **Claude Opus 5.5** (si tu plan lo incluye) para la revisión final de la física y de las pruebas.

Según guías de noviembre de 2026, Gemini 4 Argon, Gemini 3.8 Flash y GPT-OSS 120B dejan de estar disponibles el 30-11-2026: no los uses para esto. No existe un ranking oficial; la recomendación sale de lo que publica cada modelo y de las guías de uso.

> Copia todo lo que hay bajo la línea. Base: repositorio `abrahamhl/civic-relay`, rama `master` (commit `786b3a6` o posterior). Trabaja en local y entrega un ZIP.

---

Eres el equipo de I+D de **SENDA**, plataforma civil de prevención y respuesta a emergencias destinada a Protección Civil, UME, Fuerzas y Cuerpos de Seguridad del Estado, comités de emergencias y ciudadanía. Tienes **varias horas**. Trabaja por fases, valida cada fase antes de pasar a la siguiente y **no pares hasta terminar o hasta que algo te bloquee de verdad** (entonces lo explicas y sigues con lo demás).

## 0. Reglas innegociables (del `CLAUDE.md` del proyecto)

1. **Jamás se inventa un dato.** Cada cifra sale de una medida, de tu código o de una fuente citada (autor, año, DOI o URL oficial). Si no lo puedes verificar: «no verificado».
2. **Toda simulación o estimación se etiqueta** (`basis: 'MEASURED' | 'OFFICIAL' | 'ESTIMATED' | 'MODEL' | 'SCENARIO' | 'CITIZEN'`).
3. **Un parámetro sin fuente no lleva valor por defecto**: la función lo exige y falla si falta.
4. **Ningún aviso público sale sin una persona con autoridad.** El motor puede peritar, puntuar y PRE-ALERTAR a un comité de forma automática, pero `canPublicWarn` solo lo activa una autoridad identificada. Esto ya es regla del repo: respétala y pruébala.
5. Privacidad: consentimiento explícito, mínimo dato, difuminado de caras y matrículas antes de compartir, nada de datos personales en registros ni en pruebas. Sin secretos en el código.
6. Sin servicios de pago ni claves. Solo bibliotecas abiertas con versión exacta y licencia anotada.
7. Estilo del repo: módulos ES puros (`.mjs`) en `packages/senda/src/`, comentarios en español, referencias en la cabecera, pruebas con `node --test` en `packages/senda/tests/`.

**Lee primero** (y construye encima, sin duplicar): `hazard-reports.mjs` (avisos, `assessIncident`, `triageQueue`, `incidentToCap`), `hazard-verify.mjs` (verificación con cámara de quien pasa), `hazard-belief.mjs` (filtro bayesiano), `hazard-share.mjs`, `cross-source.mjs` (independencia de fuentes), `evidence-contract.mjs`, `fusion.mjs`, `envelope.mjs` (cifrado), `courier.mjs`, `zones.mjs`, `osint-feeds.mjs`, `voice-report.mjs`, `flood-warning.mjs`, `hydro-estimates.mjs`, `data-connectors.mjs`, `shallow-water.mjs`, `fire-science.mjs`, `rail-*.mjs`, y `docs/validacion/DOSSIER_VALIDACION.md`.

## 1. Pieza principal: PERITAJE CIUDADANO MULTIMODAL («cualquiera avisa, la ciencia lo comprueba»)

Objetivo: que una vecina que ve subir el agua junto a una presa, un conductor que ve un desprendimiento o alguien que conoce un monte lleno de combustible pueda avisar **en 10 segundos, desde la app o desde la web sin instalar nada**, y que SENDA **perite** ese aviso con física, datos oficiales y satélite, le asigne un nivel y, si procede, **pre-alerte** al comité, siempre con un expediente que una persona pueda revisar.

### 1.1 Entrada (multimodal, un solo formato)
`citizen-report.mjs`: un sobre único y firmado (Ed25519, WebCrypto) para **foto, vídeo, audio, texto, ubicación, SOS y «compartir»**, con:
- hora con zona horaria, posición con su precisión, orientación de la cámara si existe y sensores del móvil (acelerómetro, barómetro);
- tipo de peligro (fuego, combustible, inundación, nivel de presa o río, desprendimiento, carretera, visibilidad, accidente, ferrocarril, otro);
- consentimiento y huella SHA-256 del contenido.

Funciona igual por web, por la app, por la malla Bluetooth o por fichero o QR (reutiliza `envelope`, `hazard-share` y `courier`).

### 1.2 Peritaje automático (cada prueba con su peso y su fuente)
`report-forensics.mjs`, de pruebas independientes a un **expediente**:
1. **Coherencia del dispositivo:** hora frente al reloj del sistema, posición frente al GPS, metadatos EXIF y C2PA si existen, reutilización de imágenes (hash perceptual), señales de manipulación. Nada de «detectores mágicos»: cada señal con su tasa de error publicada o medida.
2. **Contexto físico:** ¿es físicamente plausible? Ejemplos: subida del río frente a la lluvia (conectores y `hydro-estimates`); riesgo de incendio frente a combustible (`fire-science`), sequedad y viento; desprendimiento frente a pendiente (Horn) y lluvia acumulada.
3. **Satélite y fuentes oficiales:** próximo paso de satélite sobre el punto (órbitas TLE públicas, ya en `data/tle`) y qué podrá ver (Sentinel-2: NDVI, NDWI o NBR; Sentinel-1 radar a través de nubes), más las fuentes oficiales disponibles (Copernicus EMS, GDACS, avisos oficiales).
4. **Otros ciudadanos y cámaras:** concordancia con otros avisos **independientes** (`cross-source`; dos personas del mismo grupo no cuentan doble) y verificación de quien pasa (`hazard-verify`), pidiendo permiso.
5. **Fiabilidad de quien avisa:** modelo de fiabilidad con base publicada (por ejemplo Dawid y Skene, 1979) que aprende de aciertos y errores sin exponer su identidad.

### 1.3 Niveles y protocolo (con pruebas de cada transición)

| Nivel | Nombre | Cómo se llega | Quién |
|---|---|---|---|
| N0 | Recibido | Sobre válido y firmado | automático |
| N1 | Coherente | Pasa la coherencia del dispositivo y la física básica | automático |
| N2 | Corroborado | Fuentes independientes o fiabilidad alta | automático |
| N3 | Verificado por instrumento | Satélite, aforo, estación o cámara lo confirman | automático |
| N4 | Pre-alerta al comité | N2 o N3 con riesgo por encima de un umbral **con fuente** | automático: genera expediente y aviso CAP en borrador |
| N5 | Aviso a la población | Decisión humana de una autoridad identificada | **solo humano** (`canPublicWarn`) |

Cada nivel lleva su probabilidad con horquilla (bayesiana), el motivo en lenguaje claro y las pruebas a favor y en contra. Un aviso puede bajar de nivel. Salida estándar **CAP 1.2** (reutiliza `incidentToCap`).

### 1.4 Interfaz súper sencilla
- **Web sin app** (`investor-next/public/senda/reportar.html`): botón grande, foto, vídeo o audio, ubicación y «enviar». Pide permisos claros, funciona sin red y envía cuando hay red.
- **Vista de comité** (`comite.html`): cola de expedientes por nivel, mapa, línea del tiempo, pruebas, «pedir verificación a quien pasa» y «emitir aviso» (solo con identidad de autoridad).
- Accesible (contraste, tamaño, lector de pantalla) y en español, con textos que explican qué pasa con el aviso.

### 1.5 Transporte y servidor
- Cliente independiente del transporte. Implementa un **servidor de referencia local** en Node, sin coste de nube, con la API documentada (OpenAPI): recibir, consultar expediente y suscribirse.
- **No despliegues nada.** Dónde alojarlo lo decide el fundador.
- Sincronización con todos los canales de SENDA (web, app, escritorio, malla). Define el esquema y las pruebas de sincronización y de conflictos.

### 1.6 Que el campo mejore la simulación
Las fotos y medidas peritadas (N2 o superior) alimentan los modelos: marcas de agua frente a calado simulado (`shallow-water`), perímetro de fuego frente a modelo, etc. Implementa la **asimilación** (filtro de Kalman por conjuntos, Evensen 1994/2003, u otra con referencia) y demuestra con un caso que mejora el CSI, el error o la horquilla.

## 2. Física y computación avanzada (complemento)

Prioriza lo que mejore el peritaje y los simuladores 4D:
- **Inundación:** solver 2D de volúmenes finitos bien equilibrado (Kurganov y Petrova, 2007, o HLLC con reconstrucción hidrostática de Audusse et al., 2004) en **WebGPU** con respaldo en CPU y resultados iguales con tolerancia declarada. Añade porosidad urbana (Sanders et al., 2008) y estabilidad de personas y vehículos en el agua con criterio publicado. **Objetivo medible:** mejorar el CSI 0,235 y, sobre todo, los tiempos de llegada del caso del Poyo, que hoy no son fiables (`packages/senda/scripts/dana-swe.mjs`).
- **Incendio:** Rothermel (1972) con modelos de combustible de Scott y Burgan (2005) y frente por level-set o Huygens (Finney, 1998), en conjunto probabilista.
- **Ferrocarril:** frenado de ETCS (UNISIG SUBSET-026, versión citada), pandeo térmico de carril soldado y criterio de Nadal, encima de `rail-*.mjs`. Reconstrucción solo con datos públicos.
- **Radio de la malla:** difracción sobre el relieve (ITU-R P.526 o Longley-Rice/ITM).
- **Incertidumbre:** conjuntos o hipercubo latino; cada salida con su horquilla.

## 3. Forma de trabajar durante horas

1. Fases en este orden: 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 2. Al cerrar cada fase: pruebas en verde, commit local y una entrada en `WORKLOG.md` (hora real, qué hiciste, qué probaste, qué falta). **Nunca una hora estimada.**
2. Cada módulo lleva: verificación numérica (solución analítica, solución manufacturada o conservación), un caso real con datos públicos si existe y casos de error y abuso (aviso falso, hora manipulada, imagen reutilizada, inundación de avisos).
3. Si una idea no se puede validar, no la entregues como hecha: déjala en `IDEAS_NO_VALIDADAS.md` con lo que faltaría.
4. Mide rendimiento real en tu equipo (CPU y GPU anotadas) en un móvil de gama media si puedes y en portátil.

## 4. Entrega: `senda-peritaje-fisica-AAAAMMDD.zip`

```
senda-peritaje-fisica-AAAAMMDD/
├── LEEME.md            # tabla por pieza: qué hace · para quién · método · validación medida · límites
├── WORKLOG.md          # registro por fases con horas reales
├── patches/            # git format-patch contra master (commit base anotado); solo archivos NUEVOS o exportaciones añadidas
├── src/  tests/        # copia legible de lo nuevo
├── web/                # reportar.html, comite.html y sus .mjs
├── server/             # servidor de referencia local + OpenAPI
├── docs/
│   ├── METODOS.md      # ecuaciones, supuestos, ámbito y referencias con DOI
│   ├── VALIDACION.md   # tablas con cifras reproducibles y el comando que las produce
│   ├── PROTOCOLO_NIVELES.md   # N0–N5, pruebas de cada transición y quién decide
│   ├── PRIVACIDAD.md   # consentimiento, difuminado, retención y base jurídica a revisar por un jurista
│   └── RENDIMIENTO.md
├── data/               # solo datos abiertos con licencia, URL y SHA-256
└── RESULTADOS_PRUEBAS.txt  # salida literal de node --test con tus parches aplicados al repo (0 fallos)
```

No modifiques archivos existentes salvo para añadir exportaciones. Al terminar, dime la ruta del ZIP y su SHA-256.
