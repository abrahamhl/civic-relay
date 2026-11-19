# SENDA — MATRIZ DE VALIDACIÓN DE ENLACES RADIOELÉCTRICOS (RF VALIDATION MATRIX)

**Documento:** `docs/telecom/SENDA_RF_VALIDATION_MATRIX.md`  
**Autor:** Agente A3 (Radio Propagation Specialist) + Principal Scientific Architect  
**Fecha:** 2026-11-09  
**Normativas de Referencia:**  
- **ITU-R P.525-4:** *Calculation of free-space attenuation*  
- **ITU-R P.526-15:** *Propagation by diffraction (Knife-edge & Deygout)*  
- **ITU-R P.838-3:** *Specific attenuation model for rain for use in prediction methods*  
- **ITU-R P.676-13:** *Attenuation by atmospheric gases and related effects*  
- **ETSI EN 300 220-2 / ETSI EN 300 328 / ETSI EN 301 893**  
- **Código Fuente Relacionado:**  
  - [`telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs)  
  - [`relay-geometry.mjs`](file:///c:/Users/2fabr/civic-relay/apps/senda-live/web/src/science/relay-geometry.mjs)  
  - [`physics-aware-emergency-network.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/physics-aware-emergency-network.mjs)

---

## 1. FUNDAMENTO FÍSICO Y ECUACIÓN DE BALANCE DE ENLACE

Para cualquier enlace radioeléctrico en el sistema SENDA, la potencia recibida $P_{\text{rx}}$ (en dBm) y el margen de desvanecimiento $M_{\text{fade}}$ (en dB) se calculan mediante la función `computeCompleteLinkBudget()` implementada en [`telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs#L406-L496):

$$P_{\text{rx}} = P_{\text{tx}} + G_{\text{tx}} - L_{\text{tx\_loss}} - \text{FSPL} - A_{\text{diff}} - A_{\text{rain}} - A_{\text{gas}} + G_{\text{rx}} - L_{\text{rx\_loss}}$$

$$M_{\text{fade}} = P_{\text{rx}} - S_{\text{rx}}$$

Donde:
1. **$P_{\text{tx}}$**: Potencia de transmisión en bornes del transmisor (dBm).
2. **$G_{\text{tx}}, G_{\text{rx}}$**: Ganancias de antena transmisora y receptora respecto a radiador isótropo (dBi).
3. **$L_{\text{tx\_loss}}, L_{\text{rx\_loss}}$**: Pérdidas por cableado coaxial, conectores y duplexor (dB).
4. **$\text{FSPL}$**: Pérdida básica de propagación en espacio libre (ITU-R P.525-4):
   $$\text{FSPL}(\text{dB}) = 32.44 + 20 \log_{10}(d_{\text{km}}) + 20 \log_{10}(f_{\text{MHz}})$$
5. **$A_{\text{diff}}$**: Atenuación por difracción en obstáculos topográficos mediante el método Deygout con factor de corrección empírico $C$ (ITU-R P.526-15 §4.3):
   $$v = h \sqrt{\frac{2}{\lambda} \left(\frac{1}{d_1} + \frac{1}{d_2}\right)}$$
   $$J(v) = 6.9 + 20 \log_{10}\left(\sqrt{(v - 0.1)^2 + 1} + v - 0.1\right)$$
   $$A_{\text{diff}} = J(v_{\text{main}}) + \sum_{i} \left[ J(v_i) - C_i \right]$$
6. **$A_{\text{rain}}$**: Atenuación específica por lluvia (ITU-R P.838-3) integrada en la longitud efectiva $d_{\text{eff}}$:
   $$\gamma_R = k \cdot R^{\alpha} \quad [\text{dB/km}]$$
   $$A_{\text{rain}} = \gamma_R \cdot d_{\text{eff}} \quad [\text{dB}]$$
7. **$A_{\text{gas}}$**: Absorción por gases atmosféricos (oxígeno y vapor de agua) según ITU-R P.676-13.
8. **$S_{\text{rx}}$**: Sensibilidad umbral del receptor a la tasa de error objetivo (dBm):
   $$S_{\text{rx}} = N_0 + 10 \log_{10}(B_{\text{Hz}}) + \text{NF} + \text{SNR}_{\text{req}}$$
   Donde $N_0 = -174\text{ dBm/Hz}$ (densidad espectral de ruido térmico a $T_0 = 290\text{ K}$), $B$ es el ancho de banda del canal, $\text{NF}$ es la figura de ruido del receptor, y $\text{SNR}_{\text{req}}$ es la relación señal/ruido mínima requerida por la modulación.

### Criterio de Viabilidad de Enlace
En misiones de emergencia SENDA, un enlace se declara técnicamente **VIABLE** si y solo si:
$$M_{\text{fade}} \ge M_{\text{req}} = 10.0\text{ dB} \quad \text{y} \quad \text{isRegulatoryCompliant} = \text{true}$$
Cualquier margen $0\text{ dB} \le M_{\text{fade}} < 10\text{ dB}$ se cataloga como **MARGINAL**. Si $M_{\text{fade}} < 0\text{ dB}$, el enlace se marca **OUTAGE (Bloqueado / Inviable)**.

---

## 2. PARÁMETROS TÉCNICOS POR BANDA Y LÍMITES REGULATORIOS

| Banda / Servicio | Frecuencia ($f_0$) | Ancho de Banda ($B$) | Potencia Tx Máx. (Regulatoria) | Norma Reguladora | Sensibilidad $S_{\text{rx}}$ típica | Ganancia Tx/Rx ($G$) | NF típica | Aplicación SENDA |
|---|---|---|---|---|---|---|---|---|
| **VHF Satélite (NOAA APT)** | 137.5 MHz | 34 kHz | N/A (Satélite LEO ~5W) | UIT-R Satélite Meteorológico | $-120\text{ dBm}$ (FM analógica) | 0 dBi / 3 dBi (Turnstile) | 3.5 dB | Recepción directa de imágenes de satélites meteorológicos LEO. |
| **UHF ISM (Telemetry / Voice)** | 433.05–434.79 MHz | 25 kHz | 10 mW ERP (+10 dBm), 10% DC | ETSI EN 300 220-2 (Anexo B) | $-118\text{ dBm}$ (FSK 9.6 kbps) | 2.15 dBi / 2.15 dBi | 5.0 dB | Sensores ambientales remotos, balizas de emergencia COTS. |
| **LoRa EU868 Standard** | 868.0–868.6 MHz | 125 kHz | 25 mW ERP (+14 dBm / 16.15 dBm EIRP) | ETSI EN 300 220-2 (Banda g) | $-130\text{ dBm}$ (SF10, CR 4/5) | 2.15 dBi / 3.0 dBi | 4.0 dB | Nodos de campo, balizas de brigadas y pasarelas vehiculares. |
| **LoRa EU869 High Power** | 869.4–869.65 MHz | 125 kHz | 500 mW ERP (+27 dBm / 29.15 dBm EIRP) | ETSI EN 300 220-2 (Banda g3) | $-130\text{ dBm}$ (SF10, CR 4/5) | 5.0 dBi / 6.0 dBi | 3.5 dB | Repetidores de cresta, nodos tácticos en torres y mástiles. |
| **L-Band Satélite (Iridium / Globalstar)** | 1616.0–1626.5 MHz | 41.67 kHz | 2 W (+33 dBm pico) | FCC Part 25 / ETSI EN 301 441 | $-116\text{ dBm}$ (QPSK) | 1.5 dBi / 2.0 dBi (Patch) | 4.0 dB | Enlace satelital de socorro cuando colapsa la infraestructura terrestre. |
| **2.4 GHz Wi-Fi / BLE (IEEE 802.11b/g/n)** | 2412–2472 MHz | 20 MHz | 100 mW EIRP (+20 dBm) | ETSI EN 300 328 | $-85\text{ dBm}$ (OFDM 12 Mbps) | 3.0 dBi / 3.0 dBi | 6.0 dB | Red de área de incidente, intercambio directo P2P entre smartphones. |
| **5.8 GHz Backbone P2P (IEEE 802.11ac)** | 5725–5875 MHz | 40 MHz | 1 W EIRP (+30 dBm) | ETSI EN 301 893 (Banda C / SRD) | $-78\text{ dBm}$ (256-QAM) | 18 dBi / 18 dBi (Directivas) | 5.0 dB | Troncal de alta capacidad para Puesto de Mando Avanzado (PMA). |
| **10 GHz Banda X (Radar de Emergencia)** | 9.4 GHz | 100 MHz | 10 W (+40 dBm pico) | UIT-R Radiodeterminación | $-95\text{ dBm}$ | 30 dBi / 30 dBi (Parabólica) | 3.0 dB | Detección de frentes de humo denso, lluvia torrencial e inundaciones. |

---

## 3. CURVAS COMPARATIVAS Y DISCONTINUIDADES RESUELTAS

### 3.1 Atenuación Específica por Lluvia ITU-R P.838-3 (Polarización Vertical)
Con la formulación continua normativa en [`telecom-mathematical-physics.mjs`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs#L315-L375), se eliminó la discontinuidad histórica a 6 GHz. Los valores exactos generados por el motor para polarización vertical son:

| Frecuencia | $R = 5\text{ mm/h}$ (Moderada) | $R = 20\text{ mm/h}$ (Fuerte) | $R = 50\text{ mm/h}$ (Torrencial) | $R = 100\text{ mm/h}$ (Extrema) | Estado Físico |
|---|:---:|:---:|:---:|:---:|---|
| **137.5 MHz** | $< 0.00001\text{ dB/km}$ | $0.00001\text{ dB/km}$ | $0.00002\text{ dB/km}$ | $0.00003\text{ dB/km}$ | Despreciable |
| **433 MHz** | $0.00002\text{ dB/km}$ | $0.00008\text{ dB/km}$ | $0.00017\text{ dB/km}$ | $0.00030\text{ dB/km}$ | Despreciable |
| **868 MHz** | $0.00009\text{ dB/km}$ | $0.00030\text{ dB/km}$ | $0.00067\text{ dB/km}$ | $0.00121\text{ dB/km}$ | Inmune a lluvia |
| **1.6 GHz** | $0.00028\text{ dB/km}$ | $0.00098\text{ dB/km}$ | $0.00225\text{ dB/km}$ | $0.00421\text{ dB/km}$ | Despreciable |
| **2.4 GHz** | $0.00068\text{ dB/km}$ | $0.00271\text{ dB/km}$ | $0.00675\text{ dB/km}$ | $0.01347\text{ dB/km}$ | Bajo |
| **5.8 GHz** | $0.00514\text{ dB/km}$ | $0.04623\text{ dB/km}$ | $0.19757\text{ dB/km}$ | $0.59278\text{ dB/km}$ | Apreciable en distancias largas |
| **10.0 GHz** | $0.07989\text{ dB/km}$ | $0.43088\text{ dB/km}$ | $1.31253\text{ dB/km}$ | $3.04829\text{ dB/km}$ | **Atenuación severa** |

*Verificación de Continuidad:* A $R = 20\text{ mm/h}$, a 5.99 GHz $\gamma_R = 0.05383\text{ dB/km}$; a 6.00 GHz $\gamma_R = 0.05426\text{ dB/km}$; a 6.01 GHz $\gamma_R = 0.05469\text{ dB/km}$. Continuidad diferenciable $\Delta < 0.0005\text{ dB/km}$.

### 3.2 Difracción en Filo de Cuchillo y Deygout ITU-R P.526-15
Valores calculados por `computeKnifeEdgeLossDb(v)`:
- $v < -0.7$: Despeje total ($J(v) = 0.00\text{ dB}$, espacio libre).
- $v = 0$: Rayo rasante al obstáculo ($J(0) = 6.03\text{ dB}$).
- $v = 1.0$: Obstrucción moderada ($J(1.0) = 13.93\text{ dB}$).
- $v = 2.0$: Obstrucción profunda ($J(2.0) = 19.04\text{ dB}$).
- $v = 3.0$: Sombra profunda ($J(3.0) = 22.42\text{ dB}$).

Para múltiples obstáculos, el método Deygout aplica la corrección:
$$C = 10.0 + 0.042 \times \frac{d_1 \cdot d_2}{d_1 + d_2}$$

---

## 4. ESCENARIOS TOPOGRÁFICOS DE ENSAYO NUMÉRICO REPRODUCIBLES

### Escenario 1: Enlace Sierra de Bejís (Castellón) — Cresta Montañosa (LoRa 869.5 MHz vs 5.8 GHz)
- **Geometría:** Distancia total $d = 8.5\text{ km}$.
  - Transmisor: Puesto de Mando (PMA) en Bejís ($h_{\text{tx}} = 800\text{ m}$ s.n.m.).
  - Receptor: Relé en Peña Escabia ($h_{\text{rx}} = 1330\text{ m}$ s.n.m.).
  - Obstáculo intermedio: Cresta rocosa a $d_1 = 3.5\text{ km}$, $d_2 = 5.0\text{ km}$ ($v \approx 1.15$). Pérdida difracción estimada: LoRa $= 14.2\text{ dB}$, 5.8 GHz $= 21.5\text{ dB}$.
  - Condiciones: Sin lluvia ($R = 0\text{ mm/h}$), atmósfera estándar.

*Resultados reproducibles con `computeCompleteLinkBudget()`:*

| Parámetro | LoRa 869.5 MHz (Conforme ETSI) | Backbone 5.8 GHz (Conforme ETSI) | Justificación Física |
|---|---|---|---|
| Potencia Tx ($P_{\text{tx}}$) | $+25.0\text{ dBm}$ (316 mW) | $+13.0\text{ dBm}$ (20 mW conducida) | Ajustada para cumplir límite ETSI |
| Ganancia Antena Tx ($G_{\text{tx}}$) | $+5.0\text{ dBi}$ | $+18.0\text{ dBi}$ (Directiva) | Antenas COTS |
| Pérdida Cable Tx ($L_{\text{tx}}$) | $1.0\text{ dB}$ | $1.75\text{ dB}$ | Coaxial y conectores |
| **PIRE Calculada (EIRP)** | **$29.0\text{ dBm}$** | **$29.25\text{ dBm}$** | Ambas dentro de la ley |
| **Límite Regulatorio ETSI** | **$29.15\text{ dBm}$** ($500\text{ mW ERP}$) | **$30.0\text{ dBm}$** ($1\text{ W EIRP}$) | Cumplimiento regulatorio estricto |
| **Conformidad Regulatoria** | **TRUE ✓** | **TRUE ✓** | `isRegulatoryCompliant: true` |
| Ganancia Antena Rx ($G_{\text{rx}}$) | $+6.0\text{ dBi}$ | $+18.0\text{ dBi}$ | Ganancia en estación receptora |
| Pérdida Cable Rx ($L_{\text{rx}}$) | $1.0\text{ dB}$ | $1.75\text{ dB}$ | Coaxial receptor |
| Pérdida Espacio Libre ($\text{FSPL}$) | $109.82\text{ dB}$ | $126.30\text{ dB}$ | Relación $\lambda / 4\pi d$ |
| Pérdida Difracción ($A_{\text{diff}}$) | $14.20\text{ dB}$ | $21.50\text{ dB}$ | $v \propto \sqrt{f}$, mayor sombra en 5.8 GHz |
| Absorción Gaseosa ($A_{\text{gas}}$) | $0.09\text{ dB}$ | $0.09\text{ dB}$ | ITU-R P.676-13 |
| **Pérdida Total de Trayecto** | **$124.11\text{ dB}$** | **$147.89\text{ dB}$** | Atenuación acumulada |
| **Potencia Recibida ($P_{\text{rx}}$)** | **$-90.11\text{ dBm}$** | **$-102.39\text{ dBm}$** | Potencia en bornes de receptor |
| Suelo de Ruido Térmico ($N$) | $-117.03\text{ dBm}$ ($B=125\text{ kHz}$) | $-91.98\text{ dBm}$ ($B=40\text{ MHz}$) | Ruido térmico a 290 K + NF 6 dB |
| Relación Señal/Ruido (SNR) | $+26.92\text{ dB}$ | $-10.41\text{ dB}$ | SNR en el demodulador |
| Sensibilidad Receptor ($S_{\text{rx}}$) | $-130.00\text{ dBm}$ (SF10) | $-78.00\text{ dBm}$ (MCS7) | Umbral de decodificación |
| **Margen de Desvanecimiento ($M_{\text{fade}}$)** | **$+39.89\text{ dB}$** | **$-24.39\text{ dB}$** | Margen de disponibilidad |
| **Estado del Enlace** | **VIABLE ✓** | **OUTAGE (Bloqueado)** | LoRa opera con holgura; 5.8 GHz cortado |

---

### Escenario 2: Enlace Urbano con Lluvia Extrema (Valencia / Campanar)
- **Geometría:** Distancia $d = 2.4\text{ km}$ en entorno periurbano.
  - Sensor en cauce nuevo del río ($h_{\text{tx}} = 3\text{ m}$) a estación receptora en azotea ($h_{\text{rx}} = 45\text{ m}$).
  - Obstrucción parcial: vegetación y vano de puente ($A_{\text{diff}} = 8.0\text{ dB}$ LoRa / $12.4\text{ dB}$ 2.4 GHz).
  - Lluvia torrencial convectiva extrema: $R = 85\text{ mm/h}$.

*Resultados reproducibles con `computeCompleteLinkBudget()`:*

| Parámetro | LoRa EU868 (868.1 MHz) | Wi-Fi 2.4 GHz (2437 MHz / Ch 6) | Dictamen Técnico |
|---|---|---|---|
| Potencia Tx ($P_{\text{tx}}$) | $+14.0\text{ dBm}$ (25 mW) | $+17.0\text{ dBm}$ (50 mW) | Potencia legal |
| Ganancia Antenas ($G_{\text{tx}} / G_{\text{rx}}$) | $+2.15\text{ dBi} / +3.0\text{ dBi}$ | $+3.0\text{ dBi} / +3.0\text{ dBi}$ | Omnidireccionales estándar |
| Pérdidas en cableado ($L_{\text{tx}} / L_{\text{rx}}$) | $0.5\text{ dB} / 0.5\text{ dB}$ | $1.0\text{ dB} / 1.0\text{ dB}$ | Cables coaxiales cortos |
| **PIRE (EIRP)** | **$15.65\text{ dBm}$** ($\le 16.15\text{ dBm}$) | **$19.00\text{ dBm}$** ($\le 20.00\text{ dBm}$) | **Ambos conformes a ETSI** |
| Espacio Libre ($\text{FSPL}$) | $98.82\text{ dB}$ | $107.79\text{ dB}$ | Dispersión geométrica |
| Difracción ($A_{\text{diff}}$) | $8.00\text{ dB}$ | $12.40\text{ dB}$ | Obstrucción urbana |
| Atenuación Lluvia ($A_{\text{rain}}$) | $0.00\text{ dB}$ ($< 0.002\text{ dB}$) | $0.02\text{ dB}$ | Lluvia $85\text{ mm/h}$ en $2.4\text{ km}$ |
| Absorción Gaseosa ($A_{\text{gas}}$) | $0.02\text{ dB}$ | $0.02\text{ dB}$ | ITU-R P.676-13 |
| **Pérdida Total de Trayecto** | **$106.84\text{ dB}$** | **$120.23\text{ dB}$** | Pérdidas acumuladas |
| **Potencia Recibida ($P_{\text{rx}}$)** | **$-88.70\text{ dBm}$** | **$-99.23\text{ dBm}$** | Señal en antena receptora |
| Suelo de Ruido Térmico ($N$) | $-117.03\text{ dBm}$ ($125\text{ kHz}$) | $-94.99\text{ dBm}$ ($20\text{ MHz}$) | Ruido térmico |
| SNR | $+28.33\text{ dB}$ | $-4.24\text{ dB}$ | SNR insuficiente en Wi-Fi |
| Sensibilidad ($S_{\text{rx}}$) | $-130.00\text{ dBm}$ | $-85.00\text{ dBm}$ | Umbral de recepción |
| **Margen de Desvanecimiento ($M_{\text{fade}}$)** | **$+41.30\text{ dB}$** | **$-14.23\text{ dB}$** | **LoRa viable, Wi-Fi bloqueado** |
| **Estado del Enlace** | **VIABLE ✓** | **OUTAGE (Caída completa)** | Tráfico conmutado a malla LoRa |

---

### Escenario 3: Trayecto Oblicuo de Satélite LEO (137.5 MHz vs 1.6 GHz)
- **Geometría:** Satélite LEO a altitud $h = 750\text{ km}$, ángulo de elevación topocéntrico $\epsilon = 15^\circ$, distancia oblicua (*slant range*) $d_{\text{slant}} \approx 1850\text{ km}$.
- **Nota Física Fundamental sobre Absorción Gaseosa:** El modelo horizontal terrestre $A_{\text{gas}} = \gamma \cdot d$ **no debe aplicarse ciegamente a trayectos oblicuos espaciales**, ya que la masa de aire atmosférica está concentrada en los primeros $10\text{ km}$ de altitud (escala barométrica $H \approx 7-8\text{ km}$). La atenuación gaseosa cenital a 137 MHz y 1.6 GHz es inferior a $0.08\text{ dB}$, y al proyectarse por el factor de cosecante $\frac{1}{\sin 15^\circ} \approx 3.86$, no supera los $0.35\text{ dB}$ totales.

| Parámetro | NOAA APT (137.5 MHz) | Iridium SBD (1621.25 MHz) | Física del Trayecto Oblicuo |
|---|---|---|---|
| Potencia Tx ($P_{\text{tx}}$) | $+37.0\text{ dBm}$ (5 W satélite) | $+33.0\text{ dBm}$ (2 W terminal uplink) | Potencia de emisión |
| Ganancia Tx / Rx | $+4.0\text{ dBi} / +3.0\text{ dBi}$ | $+2.0\text{ dBi} / +24.0\text{ dBi}$ | Antenas directivas y parches |
| Pérdida Espacio Libre Slant ($1850\text{ km}$) | $140.54\text{ dB}$ | $161.99\text{ dB}$ | $\text{FSPL}$ a $1850\text{ km}$ |
| Absorción Troposférica Oblicua | $0.30\text{ dB}$ | $0.35\text{ dB}$ | Integrada en columna atmosférica |
| Pérdidas Ionosféricas y Faraday | $1.20\text{ dB}$ | $0.15\text{ dB}$ | Mayor rotación en VHF |
| Margen Desapuntamiento y Polarización | $2.50\text{ dB}$ | $2.50\text{ dB}$ | Polarización circular RHCP |
| **Potencia Recibida ($P_{\text{rx}}$)** | **$-100.54\text{ dBm}$** | **$-105.99\text{ dBm}$** | Nivel de señal en antena |
| Sensibilidad ($S_{\text{rx}}$) | $-120.00\text{ dBm}$ | $-116.00\text{ dBm}$ | Límite del receptor |
| **Margen de Desvanecimiento ($M_{\text{fade}}$)** | **$+19.46\text{ dB}$** | **$+10.01\text{ dB}$** | **Ambos enlaces viables con margen** |

---

## 5. REGLA DE AUDITORÍA PERMANENTE EN EL REPOSITORIO

1. **Función Canónica de Balance de Enlace:** Toda evaluación debe utilizar la función exportada [`computeCompleteLinkBudget()`](file:///c:/Users/2fabr/civic-relay/packages/senda/src/telecom-mathematical-physics.mjs#L406-L496).
2. **Conformidad Regulatoria Obligatoria:** Si `isRegulatoryCompliant` es falso (la PIRE supera los límites ETSI/FCC), el enlace no puede marcarse como válido para despliegues reales, impidiendo simulaciones con potencias ficticias ilegales.
3. **Continuidad Normativa Verificada:** La atenuación por lluvia y difracción en filo de cuchillo no presenta discontinuidades ni asíntotas artificiales.
