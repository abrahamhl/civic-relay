# /goal · SENDA a calidad de misión crítica (para el agente principal de Antigravity)

Redactado el 25-11-2026 a partir del estado real del repositorio (rama `ccr-f7e46a00-mxvkgd`, PR #100).

```
/goal Llevar el repositorio abrahamhl/civic-relay (SENDA) a calidad de software de misión crítica,
auditable por UME, FCSE y comités de emergencia, sin romper nada de lo que funciona y sin inventar un solo dato.

LEE PRIMERO (obligatorio, en este orden):
1) CLAUDE.md (veracidad: jamás se inventa un dato; toda simulación se rotula; un parámetro sin fuente no lleva valor por defecto;
   lo no verificable se marca «no verificado»).
2) .claude/skills/senda-cinematic-web/SKILL.md (toda página web sigue esa dirección).
3) docs/continuity/SENDA_SESSION_HANDOFF.md, docs/CUMPLIMIENTO.md y docs/validacion/DOSSIER_VALIDACION.md.

LÍNEAS ROJAS (si alguna se cruza, se revierte):
- Ninguna cifra, precio, cliente o resultado sin «medido», «calculado por este código» o «fuente X».
- El aviso público (N5 / canPublicWarn) solo lo firma una persona con autoridad. Nunca automático.
- La bóveda de defensa (packages/senda/src/defense) sigue separada de las superficies civiles.
- Sin secretos en el código ni en el chat; sin APIs ni servicios de pago nuevos; sin datos personales.
- No se salta, desactiva ni pone en cuarentena ninguna prueba para obtener verde.
- Rama propia desde master; PR en borrador; nada directo a master.

MISIÓN (8 frentes; cada uno con criterio de aceptación comprobable):

F1 · CI fiable y rápido
  - Encontrar la causa raíz del cuelgue intermitente de «build (24.x) › Run tests» (Node 24; en 22.x pasa).
    Pista: busca servidores, temporizadores, sockets o fetch keep-alive que no se cierran (node --test
    --test-timeout, why-is-node-running). Arreglo en la causa, no un timeout que lo tape.
  - timeout-minutes en todos los jobs; caché de pnpm/Gradle; CI completo < 10 min.
  Aceptación: 10 ejecuciones seguidas en verde con 22.x y 24.x (pégalas en el informe).

F2 · Pruebas que de verdad prueban
  - Pruebas de propiedades (fast-check o generador propio sin dependencias) para: erasure/Reed-Solomon,
    heading-fusion (ángulos circulares), mmwave-radar (lector de tramas con bytes aleatorios), shallow-water
    (conservación de masa y lago en reposo), rail-reconstruct.
  - Pruebas de mutación (Stryker) en esos 5 módulos: puntuación ≥ 80 % o lista de mutantes vivos justificada.
  - Cobertura con c8 del núcleo packages/senda/src: ≥ 90 % de líneas en módulos de cálculo; informe en CI.
  Aceptación: informes de mutación y cobertura en evidence/quality/ con huella SHA-256.

F3 · Contratos y tipos
  - JSDoc + // @ts-check (o .d.ts) en todo packages/senda/src; tsc --noEmit sin errores en CI.
  - Esquemas JSON (Ajv) para todo dato de entrada: telemetría, conectores, cronologías, reportes ciudadanos,
    tramas del radar exportadas. Cada esquema obliga a «fuente» y «zona horaria» donde aplique.
  Aceptación: un dato sin fuente o con hora ambigua se rechaza en una prueba.

F4 · Ciencia validada contra la realidad (lo que hoy está flojo, dicho sin adornos)
  - DANA: el motor 2D da CSI 0,235–0,2516 frente a Copernicus y la onda viaja a ≈1 m/s cuando CEDEX
    estima 14 m/s. Objetivo: explicar y reducir esa brecha con física (no con ajuste a ciegas):
    resolución, condición de entrada, rugosidad por uso del suelo (CORINE/SIOSE con fuente).
    Validación cruzada: calibrar en una parte, medir en otra. Informe con sobreajuste vigilado.
  - Incendio (Rothermel) y tren (ETCS/Adamuz/Angrois): cada parámetro con cita literal o «no verificado».
  Aceptación: tabla «antes/después» en el dossier con la métrica, el dato de referencia y su fuente.

F5 · Radar de personas mmWave (nuevo, /senda/personas, mmwave-radar.mjs)
  - Puente nativo Android USB-OTG → la misma API de bytes (hoy Web Serial solo va en Chrome/Edge de escritorio).
    Comprobar la licencia de la librería que se use antes de añadirla.
  - Grabaciones de referencia reales (cuando haya hardware) en data/mmwave/ con SHA-256 y protocolo de
    medida (cinta métrica, rumbo conocido). Sin grabación real NO se publica precisión.
  - Prueba de regresión: reproducir cada grabación y comparar trazas con tolerancias declaradas.
  Aceptación: la APK lista un puerto USB y alimenta createFrameParser; pruebas instrumentadas o de unidad.

F6 · Seguridad y privacidad
  - Escaneo de secretos (gitleaks) y de dependencias (pnpm audit / osv-scanner) en CI; cero críticos.
  - CSP estricta en todas las páginas de investor-next (sin inline donde se pueda), cabeceras de seguridad
    en vercel.json, y revisión de la allowlist NetAllow de Android.
  - Modelo de amenazas (STRIDE) de reportes ciudadanos y del servidor de referencia en docs/seguridad/.
  Aceptación: informe con hallazgos, cada uno «corregido» o «aceptado con motivo».

F7 · Rendimiento y accesibilidad
  - Presupuestos: LCP < 2,5 s en 4G simulado para /senda/, /senda/conducir, /senda/personas; JS inicial < 300 KB.
  - Lighthouse CI y axe en CI; WCAG 2.2 AA en las páginas públicas; prefers-reduced-motion respetado.
  Aceptación: informes en evidence/quality/ y fallo de CI si se rompe un presupuesto.

F8 · Reproducibilidad y traspaso
  - `node scripts/prove.mjs` ampliado con las afirmaciones nuevas (radar, F4); sigue en verde.
  - Un único comando `pnpm verify` que ejecute núcleo, web, escritorio, prove, cobertura y esquemas.
  - Actualizar DOSSIER_VALIDACION.md, CUMPLIMIENTO.md (hora UTC real + hash del commit, nunca estimada)
    y SENDA_SESSION_HANDOFF.md.

FORMA DE TRABAJAR:
- Orden: F1 → F2 → F3 → F6 → F4 → F5 → F7 → F8. Un PR por frente, pequeño y revisable.
- Antes de cada PR: pruebas del núcleo, de la web y del escritorio + tsc + prove en verde.
- Si algo no se puede (red, hardware, licencia), se escribe «bloqueado: motivo» y se sigue con el siguiente.

INFORME FINAL (en español, corto):
1) Qué frentes se cumplieron, con el enlace a la PR y la métrica de aceptación.
2) Qué no y por qué.
3) Cifras nuevas con su origen (medido / calculado por X / fuente Y).
4) Riesgos abiertos.
5) Confianza 0–100 %.
```

## Por qué este orden
- **F1 primero**: hoy la PR #100 está bloqueada por el cuelgue intermitente de Node 24. Sin CI fiable, nada de lo demás se puede demostrar.
- **F2 y F3** convierten «1161 pruebas en verde» en una garantía: las pruebas de mutación detectan pruebas que no comprueban nada.
- **F4** es lo que más pesa ante UME y FCSE: la brecha entre el modelo y la realidad ya se ha medido y está escrita.
- **F5** depende de tener hardware real. Hasta entonces, solo se puede hacer el puente nativo y las pruebas.
