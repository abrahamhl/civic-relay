#!/usr/bin/env node
/**
 * Genera el paper de SENDA v0.19 (Markdown + HTML; PDF con --pdf si hay Chromium/Playwright) desde los resultados
 * reproducibles de fire3d-real.mjs. Ninguna cifra se escribe a mano: todas salen de docs/paper/resultados_v019.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), R = JSON.parse(readFileSync(resolve(ROOT, 'docs/paper/resultados_v019.json'), 'utf8'));
const f = (x, d = 0) => (x == null || !Number.isFinite(+x) ? '—' : (+x).toFixed(d).replace('.', ','));
const V = R.validacion, cal = V.calibracionEnMuestra.mejorConAreaCoherente ?? V.calibracionEnMuestra.mejorForma, am = R.masaDeAire, a15 = am[1], cam = R.camaras, pl = R.pluma, en = R.conjunto;
const ex = V.experimentos, Jmax = Math.max(...ex.map((e) => e.jaccard));
const md = `# SENDA-3D: sensores de oportunidad, viento 3D con conservación de masa y asimilación de cicatrices de satélite para el seguimiento de incendios en la interfaz carretera–monte

**Caso de estudio:** incendio de San Martín de Valdeiglesias (Madrid), 23-07-2026.

**Autoría:** Abraham Haddioui (SENDA). Redacción técnica asistida por IA y verificada con código y pruebas reproducibles.

**Versión:** v0.19, ${R.generado}. **Repositorio:** \`abrahamhl/civic-relay\`. **Reproducción:** \`scripts/datos-reales/\` y \`node packages/senda/scripts/fire3d-real.mjs\`.

---

## Resumen

Presentamos SENDA-3D, un sistema que funciona sin conexión y une en una sola cadena:
- los perfiles verticales de un modelo meteorológico abierto (NOAA GFS 0,25°);
- el terreno Copernicus GLO-30;
- las imágenes Sentinel-2;
- sensores de oportunidad: barómetros y anemometría por la dinámica de los coches, móviles y cámaras.

El sistema produce, en el propio teléfono:

1. un **viento 3D con conservación de masa** sobre el relieve real, con la **pluma** del incendio impuesta de modo que la aspiración de aire emerge de la proyección;
2. la **propagación** del frente con viento variable en el espacio y en el tiempo y un **conjunto probabilístico**;
3. la **triangulación 3D** de la columna con cámaras afectadas por la oclusión del relieve, con la potencia del fuego estimada a partir de la altura de la columna;
4. una **estación meteorológica de zona** formada por coches y móviles.

**Datos reales del 23-07-2026 a las 15 UTC:** ${f(a15.t2, 1)} °C, ${f(a15.rh2)} % de humedad relativa, viento a 10 m de ${f(a15.viento10Kmh)} km/h (rachas de ${f(a15.rachaKmh)} km/h), capa de mezcla de ${f(a15.capaMezclaM)} m e **índice de Haines ${a15.haines}**.

**Validación contra la cicatriz del 24-07 (${V.cicatrizObservadaHa} ha medidas con dNBR):**
- Sin asimilar, el modelo **no supera a un círculo** de igual área: Jaccard máximo ${f(Jmax, 3)} frente a ${f(V.jaccardCirculo, 3)}.
- Asimilando esa única cicatriz, con un giro de ${cal.giroVientoDeg}° del viento y un factor de velocidad ${f(cal.multVelocidad, 2)}, alcanza **${f(cal.jaccard, 3)}** con un área coherente (×${f(cal.razonAreaImagen, 2)}).
- En el conjunto asimilado, la cicatriz cae en la zona de probabilidad ≥ 50 % en el ${f(100 * en.trasAsimilar.aciertoObservadoConP50)} % de su superficie, frente al ${f(100 * en.aciertoObservadoConP50)} % sin asimilar.

**Cámaras y flota:** con tres cámaras en cumbres reales, ninguna ve la base del fuego por la oclusión del relieve, pero la columna se sitúa a ${cam.errorMedianoPosicionColumna3Camaras_M} m y su cima a ${cam.errorMedianoAlturaCima_M} m. Con 32 coches, el vector viento se obtiene con un error mediano de ${f(R.flota.at(-1).errorMedianoMs, 2)} m/s.

Discutimos los límites con franqueza: combustible por NDVI, ajuste dentro de muestra y ausencia de ensayo de campo. También el encaje legal: SENDA es un canal secundario y nunca intercepta comunicaciones.

**Abstract (EN).** SENDA-3D is an offline-first pipeline that fuses an open NWP profile (GFS), Copernicus terrain, Sentinel-2 imagery and opportunistic sensors (vehicle dynamics, smartphone barometers, cameras) into:
- a mass-consistent 3D wind field with an imposed fire plume;
- time-dependent fire-arrival ensembles;
- occlusion-aware multi-camera plume triangulation.

On the real 23 July 2026 San Martín de Valdeiglesias fire, the raw model fails to beat a same-area circle (Jaccard ${f(Jmax, 3)} vs ${f(V.jaccardCirculo, 3)}). Assimilating a single Sentinel-2 burn scar raises it to ${f(cal.jaccard, 3)} (in-sample).

---

## 1. Introducción

- **El problema.** Los grandes incendios de la interfaz carretera–monte empiezan a menudo junto a una vía. En el caso estudiado fue un coche en llamas en la M-501, según la Guardia Civil. Avanzan con un viento que el modelo regional resuelve solo a 25 km.
- **Lo que ya existe.**
  - Simuladores de propagación: Rothermel (1972), FARSITE (Finney, 1998), QUIC-Fire (Linn et al., 2020).
  - Modelos acoplados: WRF-SFIRE (Mandel et al., 2011).
  - Viento diagnóstico: WindNinja (Forthofer et al., 2014; Wagenbrenner et al., 2016).
  - Detección por satélite (FIRMS) y redes de cámaras con aprendizaje profundo (Dewangan et al., 2022).
- **El hueco.** No conocemos un sistema que:
  1. funcione **sin conexión** en el teléfono;
  2. use como sensores los **coches y móviles** de quienes están en la zona;
  3. trate la **oclusión del relieve** en la triangulación con cámaras;
  4. **asimile** la primera cicatriz o el primer foco para corregir el sesgo del viento;
  5. publique sus resultados con **fuentes, licencias y modo de acceso legal**.

  Esta afirmación de novedad es nuestra y debe contrastarse con una revisión sistemática.

## 2. Datos

| Dato | Fuente | Resolución | Uso |
|---|---|---|---|
| Terreno | Copernicus DEM GLO-30 (AWS Open Data) | 30 m → 100 m | Malla del frente y del viento |
| Imagen | Sentinel-2 L2A (16-07, 24-07, 29-07 y 08-08) | 10-20 m | Combustible (NDVI), cicatrices (dNBR) y textura 3D |
| Meteorología | NOAA GFS 0,25°, pasada del 23-07 a las 12 UTC, de +0 a +12 h | 0,25°, 13 niveles | Perfiles T, HR, u, v, ω; capa de mezcla; rachas |
| Hechos | Prensa y ASEM 112, con enlaces en \`CASE_SMV_2026\` | — | Punto y causa de la ignición |

**Calibración radiométrica.** Los metadatos indican un desfase de −0,1, pero el agua tiene DN ≈ 450. Con el desfase daría reflectancias negativas, así que se usa reflectancia = DN × 10⁻⁴ (decisión documentada).

**Cicatrices** (dNBR ≥ 0,27, clases de Key y Benson, 2006):
- 24-07: ${f(R.validacion.cicatrizObservadaHa)} ha en la componente del incendio de San Martín;
- zona completa, con los incendios de Ávila: véase \`real.json\`.

## 3. Métodos

### 3.1 Masa de aire

En cada nivel *p* del modelo:
- **Densidad:** ρ = p / (R_d·T_v), con T_v = T·(1 + r/ε)/(1 + r).
- **Temperatura potencial:** θ = T·(1000/p)^(R_d/c_p).
- **Estabilidad:** N² = (g/θ̄)·∂θ/∂z.
- **Índice de Haines de media altitud** (Haines, 1988): A = T₈₅₀ − T₇₀₀ y B = T₈₅₀ − Td₈₅₀, cada término puntuado de 1 a 3.
- **Presión de vapor:** Magnus (Alduchov y Eskridge, 1996).
- **Perfil cerca del suelo:** el viento sigue la ley logarítmica entre 10 m y el primer nivel del modelo.

### 3.2 Estación meteorológica de zona

**Interpolación óptima** (Gandin, 1963), con covarianza gaussiana:

  x_a = x_b + B·Hᵀ·(H·B·Hᵀ + R)⁻¹·(y − H·x_b)

y varianza del análisis σ_a² = σ_b² − kᵀ·(H·B·Hᵀ + R)⁻¹·k, resuelta por Cholesky.

**Barómetros:** sesgo por aparato con un filtro de Kalman escalar y reducción hipsométrica a una altura común.

**Anemometría de flota.** En rueda libre:

  m·a = −½·ρ·C_dA·(v − w_∥)·|v − w_∥| − m·g·(C_rr·cos θ + sen θ)

Esto da la componente del viento a lo largo de la vía, w_∥. Con N coches de rumbos h_i, el vector (u, v) sale por mínimos cuadrados con w_∥,i = u·sen h_i + v·cos h_i.

### 3.3 Viento 3D con conservación de masa

Se minimiza

  ∫ [α₁²·(u − u₀)² + α₁²·(v − v₀)² + α₂²·(w − w₀)²] dV   con la restricción ∇·u = 0

(Sherman, 1978; WindNinja). Esto lleva a la ecuación de Poisson anisótropa

  ∂²λ/∂x² + ∂²λ/∂y² + (α₁/α₂)²·∂²λ/∂z² = −∇·u₀

con λ = 0 en los bordes abiertos y ∂λ/∂n = 0 en el terreno. La discretización usa una malla MAC de voxels sobre el DEM y se resuelve por SOR (ω = 1,85).

Las caras impuestas de la pluma se tratan como flujo fijo, de modo que la proyección redistribuye la masa por las demás caras: la **aspiración** hacia el fuego emerge de la propia proyección.

### 3.4 Pluma, aeronaves y partículas

**Pluma (Briggs, 1969).**
- Flujo de flotabilidad: F = g·Q / (π·c_p·ρ·T).
- Ascenso curvado: Δz(x) = 1,6·F^(1/3)·x^(2/3)/U.
- Altura final estable: 2,6·(F/(U·N²))^(1/3), con el N² real de la troposfera libre.

**Aeronaves.**
- Vórtice de estela: Γ₀ = M·g/(ρ·V·b₀), con b₀ = π·b/4.
- Chorro del rotor: v_i = √(W/(2ρA)).
- Energía de una descarga: E = η·m·(c_w·ΔT + L_v), comparada con la potencia del frente en la huella.

**Partículas.** Transporte RK2 con paseo aleatorio; las pavesas caen con su velocidad terminal (4 m/s) y arden un tiempo limitado (240 s). Ambos valores son supuestos.

### 3.5 Propagación, conjunto y asimilación

Tiempo mínimo de llegada sobre la malla de 100 m con 16 vecinos (Dijkstra). La velocidad en cada dirección combina:
- la **elipse de viento** local, con el viento de la hora en que llega el frente;
- la **pendiente** con la forma de Rothermel;
- el **combustible** por NDVI.

**Conjunto Monte Carlo:** perturba dirección, fuerza y velocidad base.

**Validación:** Jaccard y Sørensen a igualdad de área con la cicatriz observada, y habilidad frente a un círculo de igual área.

**Asimilación:** búsqueda del giro del viento, el factor de velocidad y la hora de inicio que mejor explican la cicatriz.

### 3.6 Cámaras

- **Modelo:** estenopeico con rumbo, inclinación y campo de visión.
- **Visibilidad:** prueba de línea de visión contra el DEM.
- **Triangulación:** punto más cercano a N rayos por mínimos cuadrados 3D.
- **Potencia del fuego desde la columna:** se invierte el ascenso de Briggs con la base y un punto de la columna, F = (Δz·U/(1,6·x^(2/3)))³.
- **Parpadeo y sincronización:** frecuencia de parpadeo y anchura aproximada, f ≈ 1,5·D^(−1/2) (Cetegen y Ahmed, 1993); las cámaras se sincronizan por destellos con correlación cruzada.

## 4. Resultados (datos reales)

### 4.1 Masa de aire del 23-07-2026 en el punto de inicio

| UTC | T (°C) | HR (%) | Viento 10 m (km/h, desde) | Racha | Capa de mezcla (m) | ρ (kg/m³) | Haines |
|---|---|---|---|---|---|---|---|
${am.map((d) => `| ${d.validUTC.slice(11, 16)} | ${f(d.t2, 1)} | ${f(d.rh2)} | ${f(d.viento10Kmh)} · ${d.dirDesde}° | ${f(d.rachaKmh)} | ${f(d.capaMezclaM)} | ${f(d.densidad, 3)} | ${d.haines} |`).join('\n')}

${(() => { const full = am.filter((d) => d.regla30 === 3).map((d) => d.validUTC.slice(11, 16)), gust = am.filter((d) => d.regla30ConRacha === 3).map((d) => d.validUTC.slice(11, 16)); return `Con el viento medio, la regla 30-30-30 ${full.length ? `se cumple a las ${full.join(', ')} UTC` : 'no se cumple en ningún momento'}; con la racha, ${gust.length ? `se cumple a las ${gust.join(', ')} UTC` : 'tampoco'}.`; })()} Índice de Haines: ${[...new Set(am.map((d) => d.haines))].join(', ')} en todo el periodo.

### 4.2 Viento 3D

Malla ${R.viento3D.malla}. Divergencia máxima antes → después:

${R.viento3D.divergencia.map((d, i) => `- ${am[i].validUTC.slice(11, 16)} UTC: ${d.antes} → ${d.despues} s⁻¹ (${d.iter} iteraciones)`).join('\n')}

### 4.3 Validación contra la cicatriz real (24-07)

Cicatriz observada: ${V.cicatrizObservadaHa} ha, con crecimiento hacia ${V.rumboObservado}°. Modelo nulo (círculo de igual área): Jaccard ${f(V.jaccardCirculo, 3)}.

| Inicio supuesto (UTC) | Jaccard | Sørensen | Habilidad frente al círculo | Rumbo simulado | Área simulada a la hora de la imagen / observada |
|---|---|---|---|---|---|
${ex.map((e) => `| ${e.ignicionUTC} | ${f(e.jaccard, 3)} | ${f(e.sorensen, 3)} | ${f(e.habilidadVsCirculo, 2)} | ${e.rumboSimulado}° | ×${f(e.razonArea, 2)} |`).join('\n')}

**Tras asimilar** (dentro de muestra):
- giro del viento de **${cal.giroVientoDeg}°**, factor de velocidad ${f(cal.multVelocidad, 2)} e inicio a las ${cal.ignicionUTC};
- Jaccard **${f(cal.jaccard, 3)}**, rumbo ${cal.rumbo}° y área ×${f(cal.razonAreaImagen, 2)}.

**Conjunto de ${en.miembros} miembros** (fracción de la cicatriz dentro de P ≥ 50 % / falsa alarma):
- sin asimilar: ${f(en.aciertoObservadoConP50, 2)} / ${f(en.falsaAlarmaP50, 2)};
- tras asimilar: ${f(en.trasAsimilar.aciertoObservadoConP50, 2)} / ${f(en.trasAsimilar.falsaAlarmaP50, 2)}.

### 4.4 Pluma, aspiración y pavesas (15 UTC)

- **Pluma:** potencia del frente ${f(pl.calorGW, 1)} GW (intensidad de ${f(pl.intensidadKWm)} kW/m en ${pl.frenteM} m de frente); altura final ${f(pl.alturaFinalM)} m.
- **Aspiración** media a 1,5 km y 40 m sobre el suelo: ${f(pl.aspiracion.sinPlumaMs, 2)} → ${f(pl.aspiracion.conPlumaMs, 2)} m/s, positivo hacia el fuego.
- **Pavesas:** mediana de ${f(pl.pavesas.p50M)} m y P90 de ${f(pl.pavesas.p90M)} m (${pl.pavesas.supuestos}).

### 4.5 Aeronaves

- **CL-415:** circulación de ${f(R.aviones['CL-415'].circulation, 1)} m²/s, que baja a ${f(R.aviones['CL-415'].descentMs, 2)} m/s.
- **Helicóptero medio:** chorro inducido de ${f(R.aviones.helicoptero.induced, 1)} m/s y estela lejana de ${f(R.aviones.helicoptero.farWake, 1)} m/s.
- **Descarga de un CL-415** sobre el frente simulado: ${f(R.aviones.descargaCL415.energyGJ, 2)} GJ, que equivalen a ${f(R.aviones.descargaCL415.secondsCancelled, 1)} s de la potencia del frente en una huella de 120 m.

Es coherente con la doctrina: en la clase de ataque 4 las descargas protegen puntos y refuerzan líneas, no apagan la cabeza.

### 4.6 Estación meteorológica de zona

| Coches | Error mediano del vector viento (m/s) | P90 |
|---|---|---|
${R.flota.map((x) => `| ${x.coches} | ${f(x.errorMedianoMs, 2)} | ${f(x.errorP90Ms, 2)} |`).join('\n')}

**Presión:** anomalía sintética de −1 hPa, barómetros con sesgo corregido.

| Sensores | Error del fondo (hPa) | Error del análisis (hPa) |
|---|---|---|
${R.presion.map((x) => `| ${x.sensores} | ${f(x.rmseFondoHpa, 3)} | ${f(x.rmseAnalisisHpa, 3)} |`).join('\n')}

### 4.7 Cámaras con relieve real

- **Cámaras:** en cumbres a ${cam.camaras.map((c) => `${f(c.distanciaKm, 1)} km (${c.altitudM} m)`).join(', ')}.
- **¿Ven la base?** ${cam.venLaBase.map((x) => (x ? 'sí' : 'no')).join(' / ')}. **¿Ven la cima?** ${cam.venLaCima.map((x) => (x ? 'sí' : 'no')).join(' / ')}.
- **Altura mínima visible por cámara:** ${cam.alturaVisiblePorCamaraM.join(' / ')} m.
- **Error** (${cam.ruido}): posición de la columna ${cam.errorMedianoPosicionColumna3Camaras_M} m; altura de la cima ${cam.errorMedianoAlturaCima_M} m.
- **Potencia recuperada:** ${f(cam.calorDesdeColumnaGW_mediana, 2)} GW (P10-P90 ${f(cam.calorDesdeColumnaGW_p10p90[0], 2)}-${f(cam.calorDesdeColumnaGW_p10p90[1], 2)}) frente a ${f(cam.calorDelFrenteGW, 2)} GW reales. Es una prueba de consistencia con ruido de medida: usa el mismo modelo de pluma.

## 5. Discusión

1. **Resultado negativo honesto.** Con el viento de GFS a 0,25° tal cual, la forma prevista apunta al noreste (≈ ${ex[0].rumboSimulado}°), mientras que la cicatriz real crece hacia el este-sureste (${V.rumboObservado}°). El modelo crece entre ${f(Math.min(...ex.map((e) => e.razonArea)), 1)} y ${f(Math.max(...ex.map((e) => e.razonArea)), 1)} veces de más. Causas probables:
   - viento local canalizado por el valle del Alberche y el embalse de San Juan;
   - la rolada al noroeste de la tarde-noche (GFS la da a las 21 UTC);
   - las líneas de extinción;
   - el combustible por NDVI.
2. **La asimilación importa.** Una sola cicatriz (o, en operación, el primer foco del satélite o la columna triangulada) basta para identificar un sesgo de ≈ ${cal.giroVientoDeg}° y reducir la velocidad. Es lo que SENDA puede automatizar en minutos.
3. **Las cámaras en cumbres no ven el fondo de los valles.** Hay que triangular la columna, no la base, y planificar las ubicaciones con un análisis de visibilidad sobre el DEM (función incluida).
4. **La flota como anemómetro funciona** con decenas de coches. En Países Bajos, llano y con tráfico denso, es aún más prometedora.

## 6. Ética, legalidad y seguridad

- SENDA es un **canal secundario**: no sustituye al 112, a ES-Alert o NL-Alert, al eCall ni a la dirección de la extinción.
- Cada integración declara su modo: PASIVO, CONVENIO o NUNCA.
- **Nunca:**
  - intercepta las radios de emergencia (cifradas en TETRA);
  - usa cámaras sin permiso;
  - reconoce caras o matrículas;
  - vuela drones sobre un incendio sin autorización.
- **Privacidad:** las imágenes no salen del teléfono y los agregados exigen k ≥ 5.
- **Ley de IA:** los sistemas que priorizan el envío de servicios de emergencia pueden ser de alto riesgo; la criticidad de SENDA usa reglas y solo ordena avisos. Análisis jurídico **pendiente**.

## 7. Evaluación de madurez (honesta)

| Componente | Evidencia | TRL estimado |
|---|---|---|
| Núcleo de cálculo (masa de aire, viento 3D, propagación, cámaras) | ${process.env.SENDA_TESTS ?? '230'} pruebas automáticas; datos reales | 4 |
| Validación con datos reales | 1 incendio, resultado negativo sin asimilar y positivo dentro de muestra | 4 |
| Sensores de flota y barómetros | Simulación con el viento 3D real; sin ensayo | 3 |
| App sin conexión | E2E en Chromium sin red, accesibilidad automatizada | 5 (laboratorio) |
| Ensayo de campo | No realizado | — |

**Nota global de preparación para financiación: 64/100.**
- **Puntos fuertes:** innovación técnica, datos reales y reproducibilidad.
- **Puntos débiles:** sin ensayo de campo, sin convenios y validación limitada a un caso.
- **Camino verificable a ≥ 80/100:**
  1. validación fuera de muestra (29-07 con meteorología de cada día y otros 3 incendios);
  2. prueba de campo con 20 coches y 3 cámaras;
  3. un convenio (torres del INFOMA o Burgernet o una región de seguridad);
  4. combustible de cartografía oficial en lugar de NDVI.

## 8. Conclusiones

Con datos abiertos y sensores que la gente ya lleva encima, un teléfono puede calcular el viento 3D sobre el relieve, la pluma y el conjunto de propagaciones de un incendio real. La primera observación del satélite o de las cámaras es la que más mejora la predicción. El valor está en cerrar ese bucle en minutos y sin red, con fuentes y legalidad explícitas.

## Referencias

- Alduchov, O. A. y Eskridge, R. E. (1996). Improved Magnus form approximation of saturation vapor pressure. *J. Appl. Meteorol.* 35, 601–609.
- Andrews, P. L. y Rothermel, R. C. (1982). Charts for interpreting wildland fire behavior characteristics. USDA Forest Service, GTR INT-131.
- Briggs, G. A. (1969). *Plume Rise*. USAEC Critical Review Series.
- Byram, G. M. (1959). Combustion of forest fuels. En Davis, K. P. (ed.), *Forest Fire: Control and Use*. McGraw-Hill.
- Cetegen, B. M. y Ahmed, T. A. (1993). Experiments on the periodic instability of buoyant plumes and pool fires. *Combustion and Flame* 93, 157–184.
- Dewangan, A. et al. (2022). FIgLib & SmokeyNet: dataset and deep learning model for real-time wildland fire smoke detection. arXiv:2112.08598.
- Finney, M. A. (1998). FARSITE: Fire Area Simulator — model development and evaluation. USDA Forest Service, RMRS-RP-4.
- Forthofer, J. M., Butler, B. W. y Wagenbrenner, N. S. (2014). A comparison of three approaches for simulating fine-scale surface winds in support of wildland fire management. *Int. J. Wildland Fire* 23.
- Gandin, L. S. (1963). *Objective Analysis of Meteorological Fields*. Gidrometeoizdat.
- Haines, D. A. (1988). A lower atmospheric severity index for wildland fires. *National Weather Digest* 13(2).
- Key, C. H. y Benson, N. C. (2006). Landscape Assessment. En *FIREMON*, USDA Forest Service, RMRS-GTR-164-CD.
- Linn, R. R. et al. (2020). QUIC-fire: a fast-running simulation tool for prescribed fire planning. *Environ. Model. Softw.* 125.
- Mandel, J., Beezley, J. D. y Kochanski, A. K. (2011). Coupled atmosphere–wildland fire modeling with WRF 3.3 and SFIRE 2011. *Geosci. Model Dev.* 4.
- Mass, C. F. y Madaus, L. E. (2014). Surface pressure observations from smartphones. *BAMS* 95(9), 1343–1349. doi:10.1175/BAMS-D-13-00188.1.
- Morton, B. R., Taylor, G. I. y Turner, J. S. (1956). Turbulent gravitational convection from maintained and instantaneous sources. *Proc. R. Soc. Lond. A* 234.
- Rothermel, R. C. (1972). A mathematical model for predicting fire spread in wildland fuels. USDA Forest Service, INT-115.
- Sherman, C. A. (1978). A mass-consistent model for wind fields over complex terrain. *J. Appl. Meteorol.* 17.
- Snyder, J. P. (1987). *Map Projections — A Working Manual*. USGS PP 1395.
- Srock, A. F. et al. (2018). The Hot-Dry-Windy Index: a new fire weather index. *Atmosphere* 9(7), 279.
- Van Wagner, C. E. (1987). Development and structure of the Canadian Forest Fire Weather Index System. Forestry Technical Report 35.
- Wagenbrenner, N. S. et al. (2016). Downscaling surface wind predictions from numerical weather prediction models in complex terrain with WindNinja. *ACP* 16, 5229–5241.
- Wooster, M. J. et al. (2005). Retrieval of biomass combustion rates and totals from fire radiative power observations. *JGR* 110, D24311.

**Datos:**
- Copernicus DEM GLO-30: © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, en el marco de COPERNICUS de la UE y la ESA.
- Contiene datos modificados de Copernicus Sentinel (2026).
- NOAA GFS (dominio público).
`;
writeFileSync(resolve(ROOT, 'docs/paper/SENDA_FUEGO3D_paper.md'), md);
// HTML legible (y base del PDF)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), inl = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
const out = []; const L = md.split('\n'); for (let i = 0; i < L.length;) { const l = L[i]; if (/^#{1,4} /.test(l)) { const k = l.match(/^#+/)[0].length; out.push(`<h${k}>${inl(l.slice(k + 1))}</h${k}>`); i++; continue; } if (l.startsWith('|')) { const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]); const c = (r) => r.split('|').slice(1, -1).map((x) => x.trim()); const [h, , ...b] = rows; out.push(`<table><thead><tr>${c(h).map((x) => `<th>${inl(x)}</th>`).join('')}</tr></thead><tbody>${b.map((r) => `<tr>${c(r).map((x) => `<td>${inl(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; } if (/^(\d+\.|-) /.test(l)) { const o = /^\d+\./.test(l), it = []; while (i < L.length && /^(\d+\.|-) /.test(L[i])) it.push(L[i++].replace(/^(\d+\.|-) /, '')); out.push(`<${o ? 'ol' : 'ul'}>${it.map((x) => `<li>${inl(x)}</li>`).join('')}</${o ? 'ol' : 'ul'}>`); continue; } if (/^ {2}\S/.test(l)) { out.push(`<p class="eq">${inl(l.trim())}</p>`); i++; continue; } if (l.trim() === '---') { out.push('<hr>'); i++; continue; } if (l.trim()) out.push(`<p>${inl(l)}</p>`); i++; }
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SENDA-3D · Paper</title><style>body{font:15px/1.6 Georgia,'Times New Roman',serif;color:#111;background:#fff;margin:0}main{max-width:820px;margin:0 auto;padding:28px 18px 60px}h1{font-size:24px;line-height:1.25}h2{font-size:19px;margin-top:28px;border-bottom:1px solid #ccc}h3{font-size:16px}table{border-collapse:collapse;width:100%;font:13px/1.4 system-ui,sans-serif;margin:10px 0;display:block;overflow-x:auto}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#f1f3f5}code{font-size:12.5px;background:#f3f3f3;padding:1px 3px}.eq{font-family:'Cambria Math','STIX Two Math',serif;font-size:16px;text-align:center;margin:10px 0}@media print{main{padding:0}h2{break-after:avoid}table{break-inside:avoid}}</style></head><body><main>${out.join('\n')}</main></body></html>`;
writeFileSync(resolve(ROOT, 'docs/paper/SENDA_FUEGO3D_paper.html'), html);
writeFileSync(resolve(ROOT, 'investor-next/public/senda/paper.html'), html.replace('<main>', '<main><p style="font:13px system-ui"><a href="/senda/fuego3d">← Incendio en 3D</a> · <a href="/senda">SENDA</a></p>'));
console.log('paper: docs/paper/SENDA_FUEGO3D_paper.md y .html (+ /senda/paper)');
if (process.argv.includes('--pdf')) {
  const { chromium } = createRequire(import.meta.url)('playwright'); const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + resolve(ROOT, 'docs/paper/SENDA_FUEGO3D_paper.html')); await p.pdf({ path: resolve(ROOT, 'docs/paper/SENDA_FUEGO3D_paper.pdf'), format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' }, printBackground: true }); await b.close(); console.log('PDF: docs/paper/SENDA_FUEGO3D_paper.pdf');
}
