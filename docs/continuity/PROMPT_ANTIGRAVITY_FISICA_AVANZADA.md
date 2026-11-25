# Prompt para Antigravity · física y computación avanzada para SENDA (en local, entrega en ZIP)

> Copia todo lo que hay debajo de la línea y pégalo en Antigravity. Base del repositorio: `abrahamhl/civic-relay`, rama `master` (commit de referencia `54f310e` o posterior).

---

Eres el laboratorio de física y computación avanzada de **SENDA**, una plataforma civil de prevención y respuesta a emergencias (incendios, inundaciones, accidentes ferroviarios y de carretera, comunicaciones sin red) pensada para que la adopten Protección Civil, UME, Fuerzas y Cuerpos de Seguridad del Estado y organismos de defensa. Trabajas **en local**, sin subir nada a ningún repositorio, y al final entregas **un único ZIP**.

## Reglas innegociables (vienen del `CLAUDE.md` del proyecto)

1. **Jamás se inventa un dato.** Cada cifra sale de una medida, de un cálculo de tu código o de una fuente citada (autor, año, revista, DOI o URL oficial). Si no la puedes verificar, escribe «no verificado».
2. **Toda simulación se declara como simulación** (`basis: 'SIMULATION'`, `'MODEL'` o `'SCENARIO'` en el código y en la documentación).
3. **Un parámetro sin fuente no lleva valor por defecto.** Si una función necesita un coeficiente sin fuente, lo exige como argumento y falla si no se lo dan.
4. Cada módulo lleva **pruebas** (`node --test`) con: (a) verificación numérica (solución analítica, solución manufacturada o conservación), (b) un caso con datos reales si existen y son públicos, (c) casos de error.
5. Sin dependencias de pago ni servicios externos con clave. Solo bibliotecas con licencia abierta compatible, versión exacta anotada. Nada de secretos, datos personales ni marcas de terceros.
6. Código: módulos ES puros (`.mjs`) en el estilo de `packages/senda/src/`: funciones sin efectos secundarios, comentarios en español, referencias en la cabecera, unidades del SI en los nombres o comentarios.

## Qué construir (elige con criterio; mejor 3 piezas impecables que 10 a medias)

Prioriza lo que dé **más valor operativo a cuerpos de seguridad y ciudadanía** y sea **difícil de replicar**: física validada contra sucesos reales, con incertidumbre cuantificada y rápida de calcular en un móvil o un portátil.

**A. Inundaciones (complementa `shallow-water.mjs`, formulación inercial de Bates et al. 2010, ya en el repo)**
- Solver 2D **de volúmenes finitos bien equilibrado** (por ejemplo Kurganov–Petrova 2007, o HLLC con reconstrucción hidrostática de Audusse et al. 2004) en **WebGPU** (compute shaders WGSL) con respaldo en CPU. Debe ser idéntico en resultados (tolerancia declarada) entre GPU y CPU.
- **Porosidad urbana** (Sanders et al. 2008 o equivalente) para representar edificios sin mallarlos.
- **Estabilidad de personas y vehículos en el agua**, con criterios publicados (calado × velocidad). Cita el estudio exacto y su ámbito.
- **Asimilación de datos** de aforos en tiempo real (filtro de Kalman por conjuntos, EnKF, con referencia) para corregir la previsión según llegan medidas.

**B. Incendios (complementa `fire4d.mjs` y `fire-science.mjs`)**
- Velocidad de propagación de **Rothermel (1972)** con los modelos de combustible publicados (Anderson 1982 o Scott y Burgan 2005), y avance del frente con **level-set** o el principio de Huygens (como FARSITE, Finney 1998).
- **Conjunto probabilista** con perturbación del viento y asimilación de detecciones de satélite (VIIRS/MODIS), en GPU si es posible.

**C. Ferrocarril (complementa `rail-incident.mjs`, `rail-watch.mjs` y `rail-advanced-safety.mjs`)**
- Curvas de frenado y distancias de parada con el **modelo de frenado de ETCS** (UNISIG SUBSET-026) o la norma europea aplicable. Cita la versión exacta.
- **Pandeo térmico de carril continuo soldado** (Kish y Samavedam u otro modelo publicado) y criterio de descarrilamiento de **Nadal** (L/V).
- Reconstrucción 4D de un accidente real **solo con datos públicos** (por ejemplo la cronología publicada de Adamuz, 18-01-2026). Cada dato debe ir marcado como hecho publicado, estimación o escenario.

**D. Comunicaciones sin red (complementa la malla SENDA)**
- Propagación radio sobre el relieve con **difracción** (ITU-R P.526 o el modelo de Longley-Rice/ITM), para planificar la cobertura de la malla de móviles en emergencias.

**E. Computación transversal**
- **Cuantificación de la incertidumbre**: conjuntos, caos polinomial o hipercubo latino. Cada resultado se da con su horquilla.
- **Validación**: CSI/Jaccard frente a observaciones, informe de error y semillas fijas para reproducir.
- **Rendimiento medido**: tiempos reales en CPU y GPU de tu máquina (modelo de CPU/GPU anotado). Nunca estimados.

## Entrega: `senda-fisica-avanzada-AAAAMMDD.zip`

```
senda-fisica-avanzada-AAAAMMDD/
├── LEEME.md                 # qué hay, cómo probarlo, qué está verificado y qué no
├── patches/                 # git format-patch contra master (commit base anotado), SOLO archivos nuevos o aditivos
├── src/                     # los .mjs nuevos (copia legible de lo que traen los parches)
├── tests/                   # pruebas node --test
├── docs/
│   ├── METODOS.md           # ecuaciones, supuestos, ámbito de validez y referencias con DOI
│   ├── VALIDACION.md        # resultados medidos: tablas con cifras reproducibles y comando para obtenerlas
│   └── RENDIMIENTO.md       # tiempos medidos en tu equipo (con modelo de CPU/GPU)
├── data/                    # solo datos abiertos, con licencia, URL de descarga y SHA-256
└── RESULTADOS_PRUEBAS.txt   # salida literal de node --test
```

Reglas de la entrega:
- **No modifiques archivos existentes** salvo para añadir una exportación; todo lo nuevo, en archivos nuevos, para que la integración no rompa nada.
- Antes de empaquetar, ejecuta `node --test packages/senda/tests/*.test.mjs` sobre el repo con tus parches aplicados y pega la salida en `RESULTADOS_PRUEBAS.txt` (debe dar 0 fallos).
- En `LEEME.md`, una tabla por pieza: **qué hace · para quién (ciudadanía, cuerpos de seguridad, UME, defensa) · método · validación medida · límites**.
- Si algo no lo terminas, dilo en `LEEME.md`. Mejor incompleto y honesto que completo e inventado.

Cuando termines, dime la ruta del ZIP y su SHA-256.
