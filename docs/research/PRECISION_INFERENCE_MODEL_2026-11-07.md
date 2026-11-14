# SENDA · Modelo de precisión e inferencia offline

**Fecha:** 07-11-2026  
**Ámbito:** `investor-next` (sitio inversor, export estático)  
**Módulo:** `lib/precision-lab.mjs` + `app/precision-lab.tsx`  
**Datos:** `public/data/inference-priors.v1.json`  
**Producción:** https://civic-relay-investor.vercel.app/#precision-lab

## 1. Qué resuelve

La sección *Precision & Inference Lab* demuestra, con matemática exacta o numérica
controlada, cinco piezas de la capa offline de SENDA:

1. fiabilidad de cada portador actualizada con evidencia local (Beta-Binomial);
2. probabilidad exacta de reconstruir un mensaje troceado k-de-n;
3. retardo de entrega tolerante a desconexión (DTN) con réplicas;
4. distancia y cota de error a partir de RSSI;
5. propagación epidémica SEIR integrada con control de error.

Además incluye un libro de observaciones que vive solo en el navegador y un sello
SHA-256 de la base de priors. La sección no hace peticiones de red: los priors van
empaquetados en el bundle, la matemática corre en el cliente y el libro persiste en
`localStorage`.

**Límite explícito:** los priors son *rangos de ejercicio declarados*, no mediciones
de campo. El propio JSON lo declara (`EXERCISE_RANGE_PRIORS`) y la interfaz lo repite.
Las observaciones locales estrechan la posterior, pero no sustituyen ensayos.

## 2. Por qué es distinto de una simulación de escaparate

- No hay datos inventados presentados como evidencia: cada valor numérico sale de una
  fórmula o de un integrador, y la procedencia viaja en la respuesta (`provenance`).
- Las colas de entrega son exactas (suma binomial o programación dinámica
  Poisson-binomial), no Monte Carlo.
- El sello de integridad se verifica en el navegador con WebCrypto; cualquier cambio
  en el JSON empaquetado rompe el sello.
- El libro es local, exportable y versionado; no se envía a ningún servidor.

## 3. Base de priors sellada

Archivo: `public/data/inference-priors.v1.json`  
Esquema: `senda-inference-priors/1` · versión `1.0.0` · actualizado `2026-11-07`

| Portador | α | β | Media previa | Latencia declarada |
|---|---:|---:|---:|---:|
| Phone mesh (BLE / Wi-Fi Direct / sound) | 2,4 | 1,6 | 0,60 | 600 s |
| Cellular data (if a cell survives) | 2,0 | 2,0 | 0,50 | 2 s |
| SMS (2G / weak signal) | 2,2 | 1,8 | 0,55 | 15 s |
| Satellite direct-to-cell SMS | 2,8 | 1,2 | 0,70 | 120 s |
| LoRa Meshtastic 868 MHz | 3,0 | 1,0 | 0,75 | 30 s |
| Iridium SBD (RockBLOCK) | 3,6 | 0,4 | 0,90 | 60 s |
| Drone mule (store and forward) | 3,2 | 0,8 | 0,80 | 900 s |
| Neighbour SENDA relay over Internet | 2,4 | 1,6 | 0,60 | 5 s |

Valores por defecto del laboratorio:

- erasure: `k = 8`, `n = 12`;
- DTN: `contactRatePerHour = 0,2`, `copies = 3`;
- RSSI: `Ptx = 0 dBm`, `RSSI = −70 dBm`, `n = 3`, `σ = 6 dB`, `d0 = 1 m`,
  `PL0 = 40 dB`;
- SEIR: `N = 1000`, `contactsPerDay = 8`, `β = 0,15`, latencia 3 días,
  infectious 5 días, horizonte 90 días.

### Sello

- Algoritmo: SHA-256.
- Canonicalización: claves ordenadas recursivamente, sin espacios, excluyendo el
  campo `integrity`.
- Digest actual: `f8b5c53514a03c917efb6e6fb49f18b0a8fe9b8a551bec66eeb2406c1fcc8ca3`.
- Regeneración: `node scripts/seal-inference-priors.mjs` (idempotente).
- Verificación: WebCrypto en el navegador; la insignia muestra
  `SEAL VERIFIED` / `SELLO VERIFICADO` / `ZEGEL GEVERIFIEERD`.

## 4. Formulaciones

### 4.1 Beta-Binomial conjugada

Prior `p ~ Beta(α, β)`. Con `s` éxitos y `f` fallos:

```
α' = α + s
β' = β + f
media = α' / (α' + β')
varianza = α'β' / ((α' + β')² (α' + β' + 1))
IC 95 % = [Q(0,025; α', β'), Q(0,975; α', β')]
probabilidad del próximo éxito = E[p] = media
```

La cola Beta se calcula con la beta incompleta regularizada `I_x(a,b)` mediante la
fracción continuada de Lentz; el cuantil se obtiene por bisección (140 iteraciones,
tolerancia 1e-15). Gamma se evalúa con la aproximación de Lanczos.

Con el prior por defecto de Meshtastic (3, 1) y sin observaciones:
media 0,7500 · IC 95 % [0,292, 0,992] · próximo éxito 75,00 %.

### 4.2 Entrega con erasure k-de-n

Un mensaje se divide en `n` fragmentos; cualesquiera `k` lo reconstruyen (matriz de
Cauchy sobre GF(2^8)). Si cada fragmento llega con probabilidad `p`:

```
P(entrega) = P(X ≥ k), X ~ Bin(n, p)
           = Σ_{i=k}^{n} C(n,i) p^i (1-p)^(n-i)
```

Si cada fragmento tiene `p_i` distinto, se usa la Poisson-binomial exacta por
programación dinámica O(n²). Métricas mostradas:

```
overhead   = n / k
redundancia = (n - k) / k
```

Con `k = 8`, `n = 12`: overhead 1,50×, redundancia 50 %, 12 fragmentos enviados.

### 4.3 DTN con réplicas

Contactos Poisson de tasa `λ` por hora. Con `c` copias independientes, el tiempo
hasta la primera entrega es `T ~ Exp(cλ)`:

```
P(entrega antes de H) = 1 − exp(−cλH)
E[T] = 1 / (cλ)
Q(q) = −ln(1 − q) / (cλ)
```

Con `λ = 0,2/h` y `c = 3`: tasa efectiva 0,6/h, `E[T] ≈ 1,667 h`,
`Q(0,5) ≈ 1,155 h`, `Q(0,9) ≈ 3,838 h`, `Q(0,99) ≈ 7,675 h`.

El modelo asume contactos independientes y memoria nula; es una referencia
Spray-and-Wait, no una predicción de una red concreta.

### 4.4 Rango por RSSI y cota de Cramér-Rao

Pérdida log-distancia:

```
PL(d) = PL0 + 10 n log10(d / d0)
RSSI  = Ptx − PL(d)
```

Inversión exacta:

```
d = d0 · 10^((Ptx − RSSI − PL0) / (10 n))
```

Con ruido gaussiano `σ_dB` en RSSI, la cota CRLB de la desviación en distancia:

```
σ_d = ln(10) · σ_dB · d / (10 n)
```

Con los valores por defecto: `PL = 70 dB`, `d = 10 m`,
`σ_d ≈ 4,605 m`, error relativo ≈ 46,05 %.

### 4.5 SEIR con Dormand-Prince RK45

```
dS/dt = −β c S I / N
dE/dt =  β c S I / N − σ E
dI/dt =  σ E − γ I
dR/dt =  γ I
σ = 1 / latencia,  γ = 1 / infectious,  R0 = β c / γ
```

Integrador Dormand-Prince de orden 5(4), paso adaptativo con tolerancias
`rtol = 1e-7`, `atol = 1e-9`, `dtMax = 0,5` días. Se muestrea a días enteros y se
comprueba la conservación de masa `S + E + I + R = N`.

Con los valores por defecto: `R0 = 6,00`, pico ≈ 314 infectados en el día 22,
ataque final 99,749 %, 233 pasos aceptados.

**Nota de implementación:** la interfaz muestra la cota `< 1e-9` cuando el error de
conservación está por debajo de ese umbral. El módulo devuelve el error bruto; la
cota evita que diferencias de último bit entre el render del servidor y el navegador
produzcan un desajuste de hidratación. El valor mostrado sigue siendo verificable a
partir de la tolerancia del integrador.

### 4.6 Libro local y recomendación

- Clave: `senda.precision.ledger.v1`.
- Versión de esquema: 1.
- Cada observación: `{ bearer, successes, failures, at }`.
- Se conservan las últimas 400 observaciones.
- La posterior se recalcula sumando éxitos y fallos por portador.
- Recomendación: una muestra Beta por portador (Thompson sampling), generador
  determinista `mulberry32(7 + nº de observaciones)`; se propone la muestra mayor.
  No hay aleatoriedad oculta ni llamada de red.

## 5. Verificación

### Pruebas automáticas

- `node --test "tests/*.test.mjs"` → **123/123** pruebas.
- `tests/precision-lab.test.mjs` → 12 pruebas del núcleo: Gamma/Beta, colas
  binomiales, Poisson-binomial, erasure, DTN, RSSI, SEIR, ledger, canonicalización
  y sello.
- `npm run build` → 12 páginas estáticas, TypeScript correcto, locales `es`/`nl`
  con `html lang` correcto.

### Navegador real (Playwright, producción)

Comprobado en 390 px (DPR 1) y 1440 px (DPR 2), con la red desactivada:

- 5 canvas con backing store exacto (`css × DPR`);
- 12 deslizadores;
- registro de éxito/fallo → 2 observaciones persistidas tras recarga;
- tercera observación con red desactivada → 3;
- exportación `senda-inference-ledger-*.json` sin red;
- reinicio → 0 observaciones;
- sin desbordamiento horizontal, sin objetivos táctiles menores de 24 px;
- **0 errores de consola, 0 errores de página, 0 respuestas 4xx/5xx**;
- tres locales con título, enlace de navegación y sello verificados.

Los únicos eventos de red abortados son los vídeos de la portada que el navegador
cancela al desplazarse; no pertenecen a esta sección.

## 6. Límites y siguientes pasos

1. **Sustituir priors por evidencia de ensayo.** El sello protege la integridad, no
   la verdad del valor. Cada α/β debe provenance de una prueba documentada.
2. **Calibrar λ y las correlaciones de contacto.** El modelo DTN supone
   independencia; en campo habrá contactos correlacionados y particiones.
3. **Medir RSSI con calibración por dispositivo.** La cota CRLB es un suelo teórico;
   el multitrayecto y el cuerpo humano añaden sesgo.
4. **Validar SEIR contra datos.** Los parámetros son de ejercicio; no deben citarse
   como predicción operativa.
5. **Offline real de la página.** La sección funciona sin red una vez cargada; no es
   una aplicación instalada. Un service worker podría cachear el documento completo,
   pero exigiría una política de actualización y pruebas adicionales.
6. **Sincronización del libro.** Hoy es local y exportable. Un transporte P2P
   firmado sería el siguiente paso para llevar la evidencia entre teléfonos.

## 7. Reproducir

```powershell
cd investor-next
node scripts/seal-inference-priors.mjs
node --test "tests/*.test.mjs"
npm run build
```

El build deja el sitio estático en `out/`. El despliegue de producción se hace desde
la raíz del repositorio con el proyecto Vercel `civic-relay-investor`.

## 8. Referencias

- Gelman, A. et al. *Bayesian Data Analysis*. Beta-Binomial conjugada.
- Wang, Y. H. (1993). On the number of successes in independent trials.
- Chen, S. X. & Liu, J. S. (1997). Statistical applications of the Poisson-binomial
  and conditional Bernoulli distributions.
- Reed, I. S. & Solomon, G. (1960). Polynomial codes over certain finite fields.
- Vahdat, A. & Becker, D. (2000). Epidemic routing for partially connected ad hoc
  networks.
- Spyropoulos, T., Psounis, K. & Raghavendra, C. S. (2005). Spray and wait.
- Rappaport, T. S. *Wireless Communications: Principles and Practice*.
- Kay, S. M. (1993). *Fundamentals of Statistical Signal Processing: Estimation
  Theory* (CRLB).
- Dormand, J. R. & Prince, P. J. (1980). A family of embedded Runge-Kutta formulae.
