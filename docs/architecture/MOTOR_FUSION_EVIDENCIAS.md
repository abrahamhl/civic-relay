# Motor de fusión de evidencias y visión por capas

> v0.7 · 04-11-2026 · Módulos: `occupancy.mjs`, `rescue-scenario.mjs`, `sensor-fabric.mjs`,
> `vision-layers.mjs`, `rail-watch.mjs`, `rail-watch-scenario.mjs`. Pantallas:
> `/senda/edificios` (pestaña «Visión por capas») y `/senda/via`.

## 1. De «no existe una cámara que vea a través de las paredes» a algo que sí funciona

Ninguna cámara de móvil ve a través de un muro, y SENDA no lo finge. Lo que sí se puede hacer es
**reconstruir, con probabilidades calibradas, dónde es probable que haya una persona**, juntando
todo lo que se mide alrededor de ella, y **pintarlo encima de la cámara** como capas que dicen
qué son y qué no son.

```
  Respuestas a alertas ─┐
  Teléfono: BLE, Wi-Fi RTT,│      ┌──────────────────────┐     ┌────────────────────┐
  barómetro diferencial ───┼────▶ │ occupancy.mjs        │ ──▶ │ vision-layers.mjs  │ ──▶ cámara
  Wi-Fi CSI (respiración) ─┤      │ Bayes por persona +  │     │ probabilidad ·     │
  Golpes / voz ────────────┤      │ OR ruidoso por celda │     │ espectro · alambre │
  Cámara térmica real ─────┤      │ intervalos · traza   │     │ topografía · térmica│
  Búsqueda sin hallazgo ───┘      └──────────┬───────────┘     └────────────────────┘
                                             │
                                  sensor-fabric.mjs: ¿qué medir después? (bits por minuto)
```

## 2. El modelo, sin cajas negras

**Nivel persona.** Cada residente registrado tiene una distribución sobre las viviendas y «fuera».
- Sin noticias: en casa con `pHome`.
- Su teléfono emite y no responde: mezcla `ρ·G + (1−ρ)·prior`, con G la gaussiana de la posición
  del teléfono (el barómetro afina la altura) y ρ la probabilidad de que la persona esté junto
  a su teléfono. **No se cuenta la señal del teléfono como si fuera la persona.**
- «Atrapado» o «necesito ayuda» en la vivienda X: fiabilidad de la respuesta en X.
- «A salvo» o «fuera»: se retira del cálculo.

**Nivel celda.** `P = 1 − (1 − u)·Π(1 − Lᵢ)`, con `u` = ocupantes no registrados.
Después, cada sensor sin identidad (CSI, sonido, térmica, búsqueda) con el modelo de **OR ruidoso**:
`P(detecta) = 1 − (1 − Pfa)·Π(1 − Pd·wⱼ·ocupadaⱼ)`. Para cada celda se usa la verosimilitud
**marginal** (las vecinas con su probabilidad actual).

> **Error encontrado y corregido durante el desarrollo:** la primera versión aplicaba la razón de
> verosimilitud completa de un sensor a cada celda que cubría. Una detección compartida por 3
> viviendas contaba como 3 pruebas. El motor quedó **peor** que no usar evidencias
> (Brier 0,187 frente a 0,123). Con el OR ruidoso marginal pasa a 0,107 frente a 0,124.
> Medir antes de presumir.

**Intervalo.** Cada parámetro tiene [central, mínimo, máximo]. El motor recalcula en las 16
esquinas de los parámetros escalares, con Pd/Pfa en el extremo que baja o sube la posterior,
y publica `[lo, hi]`.

**«≥ 98 %».** Solo si `lo ≥ 0,98` **y** lo sostienen **dos familias independientes** de evidencia
(p. ej., respuesta + respiración por CSI). Una sola fuente nunca basta.

**Traza.** Cada vivienda lista sus evidencias con su peso en **decibanes** (10·log₁₀ de la razón
de verosimilitud): el bombero ve *por qué* el sistema dice lo que dice.

**Prioridad.** `P(persona) × riesgo de la zona` (daño EMS-98 de la planta). La capa de
probabilidad atenúa las zonas sin daño para no desviar la atención.

## 3. Validación (reproducible: `node packages/senda/scripts/run-fusion-rail.mjs`)

200 edificios simulados de 8 plantas × 4 viviendas con verdad conocida (`evidence/senda/fusion-calibration.json`):

| | Motor | Referencia (solo registro) | Insignia «≥98 %» acertada | Cota inferior ≥ 0,9 acertada |
|---|---|---|---|---|
| Parámetros correctos | Brier **0,107** | 0,124 (−13 %) | **1.149 / 1.149** (100 %) | 99,1 % de 1.892 |
| Realidad distinta del motor | Brier **0,158** | 0,179 (−12 %) | **619 / 619** (100 %) | 97,6 % de 1.312 |

**Qué demuestra y qué no:** demuestra coherencia interna, calibración y robustez a parámetros
erróneos **en simulación**. No demuestra exactitud de campo: el generador comparte la forma del
modelo. La calibración real exige pilotos con protección civil (ver § 6).

## 4. Capas sobre la cámara (`vision-layers.mjs`)

| Capa | Qué es | Qué NO es |
|---|---|---|
| Probabilidad | P(persona) por vivienda en falsa color (rampa perceptual tipo «magma»), rotulada solo en las 5 más prioritarias, con intervalo | No es imagen térmica |
| Espectro | Routers (puntos), teléfonos, CSI, sonido: cada familia con su color y su incertidumbre; discontinuo = no detectó | No es contenido de comunicaciones |
| Estructura | Alambre «Matrix» de forjados y aristas; plantas dañadas en rojo | No es un escaneo real (hasta integrar LiDAR/RoomPlan o ARCore Depth) |
| Topografía | Malla del terreno; con red, MDT del IGN | — |
| Térmica real | Puntos calientes en el rango de piel de una cámara térmica USB-C (`thermalHotspots`) | Ve a través del humo, **no** de las paredes |

## 5. Tejido de sensores (`sensor-fabric.mjs`)

- **Catálogo** de 17 dispositivos de uso común con capacidad, API, permiso legal
  (propio / consentimiento / convenio / no permitido), papel de pasarela y estado. Lo no
  permitido (TETRA, eCall, altavoces inteligentes) queda fuera por diseño.
- **Barometría diferencial**: altura por la ecuación hipsométrica restando el barómetro de un
  teléfono de referencia a pie de calle; se cancela la deriva meteorológica. (Las pruebas CTIA
  «Stage Z» sitúan a los mejores proveedores dentro de 5 m vertical en el 80 % de los casos;
  la compensación del sensor es la mayor fuente de error: [RCR Wireless](https://rcrwireless.com/?p=198556).)
- **Wi-Fi RTT**: objetivo AOSP para 802.11mc en el percentil 90: 2 m a 80 MHz, 4 m a 40 MHz,
  8 m a 20 MHz ([AOSP](https://source.android.com/docs/core/connect/wifi-rtt)). Por integrar en la app Android.
- **Planificador**: ordena las acciones posibles (otro accesorio CSI, escucha, perro, dron) por
  **bits de información esperados por minuto**, ponderados por el riesgo.

### Interoperabilidad, no descompilación

La estrategia es integrar por interfaces abiertas y por convenio. El art. 6 de la
Directiva 2009/24/CE solo permite descompilar lo **indispensable para la interoperabilidad** de un
programa creado de forma independiente, por quien tiene derecho a usar la copia, si la
información no estaba disponible, sin otros usos ni cesión a terceros
([texto](https://www.legislation.gov.uk/eudr/2009/24/article/6)). Cada caso exige revisión
jurídica (agente A4). Pedir la interfaz al operador es más rápido, legal y vendible.

## 6. Hoja de ruta para pasar de simulación a campo

1. **Piloto de calibración** con bomberos o UME: edificio de entrenamiento, figurantes con y sin
   teléfono, accesorios CSI, escucha. Ajustar `pHome`, ρ, Pd y Pfa por sensor con datos reales.
2. **App Android**: Wi-Fi RTT, presión en la baliza BLE (campo de planta ya existe), UWB donde haya.
3. **Cámara térmica USB-C** (UVC) en la app nativa → capa «Térmica real».
4. **Escaneo de estancia** con RoomPlan (iOS LiDAR) o ARCore Depth → capa «Estructura» real.
5. **Ojo de SENDA 3D** (`docs/handoff/03`): las mismas primitivas sobre CesiumJS.

**Confianza: 85 %** en la corrección del motor y de sus pruebas; **pendiente** la calibración de
campo, sin la cual ninguna cifra de probabilidad debe usarse para decidir un rescate real.
