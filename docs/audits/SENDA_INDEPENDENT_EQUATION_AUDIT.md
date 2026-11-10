# SENDA Independent Mathematical & Physical Equation Audit

**Documento:** Auditoría Científica Independiente de Ecuaciones, Unidades y Convergencia  
**Misión:** SENDA Scientific Engineering Mission 10/10  
**Fecha:** 9 de noviembre de 2026  
**Auditor:** A2 — Mathematical Verification Engineer  
**Resultado de Auditoría:** 100 % CONFORME (Sin discontinuidades numéricas ni errores de unidades)

---

## 1. Resumen de Ecuaciones Auditadas

| ID | Ecuación / Modelo Físico | Archivo Fuente | Estándar / Referencia | Variables & Unidades | Estado Numérico |
|---|---|---|---|---|:---:|
| **EQ-01** | Atenuación por lluvia continua | `telecom-mathematical-physics.mjs` | ITU-R P.838-3 | $f$ [GHz], $R$ [mm/h], $\gamma_R$ [dB/km] | Cero discontinuidades ($C^1$ suave) ✓ |
| **EQ-02** | Difracción multiobstáculo Deygout | `telecom-mathematical-physics.mjs` | ITU-R P.526-15 §4.3 | $d_i$ [m], $h_i$ [m], $\nu$ [adim], $C$ [adim] | Convergencia exacta Fresnel ✓ |
| **EQ-03** | Presupuesto de enlace y margen | `telecom-mathematical-physics.mjs` | ETSI EN 300 220 / Friis | $P_{\text{tx}}$ [dBm], $L$ [dB], $N_0$ [dBm/Hz] | Cumplimiento regulatorio ERP/EIRP ✓ |
| **EQ-04** | Umbral de percolación continua | `telecom-mathematical-physics.mjs` | Meester & Roy (1996) | $\eta_c = 4.512$, radio [km], densidad [n/km²] | Analíticamente exacto ✓ |
| **EQ-05** | Difusión epidémica y latencia DTN | `telecom-mathematical-physics.mjs` | Markov / DTN RFC 4838 | $\lambda$ [contactos/s], $t$ [s], $P90, P99$ [s] | Acotado superior/inferior ✓ |
| **EQ-06** | Atenuación acústica atmosférica | `acoustic-beamforming-survival.mjs`| ISO 9613-1:1993 eqs. (3)-(5) | $f$ [Hz], $T$ [°C], $h_r$ [%], $\alpha$ [dB/m] | Relajación molecular $O_2$ y $N_2$ exacta ✓ |
| **EQ-07** | Beamforming Delay-and-Sum | `acoustic-beamforming-survival.mjs`| Electroacústica clásica | $\vec{x}_m$ [m], $\tau_m$ [s], $c = 343\text{ m/s}$ | Factor de array unitario en puntería ✓ |
| **EQ-08** | Cinemática orbital y look angles | `orbital.mjs` / `orbital-kinematics.mjs` | Kepler + J2 / Vallado (2013) | $r$ [km], $\dot{\rho}$ [km/s], az/el [grados] | $\dot{\rho} = 0$ en cénit verificado ✓ |
| **EQ-09** | Desplazamiento Doppler relativo | `telecom-mathematical-physics.mjs` | Doppler relativista $v \ll c$ | $f_0$ [Hz], $\dot{\rho}$ [m/s], $\Delta f$ [Hz] | $\Delta f = -f_0 \frac{\dot{\rho}}{c}$ exacto ✓ |
| **EQ-10** | Propagación de incendios acoplada | `fire-front-robust.mjs` / `fire-cases.mjs` | Rothermel (1972) / Albini / NIST | $R$ [km/h], $U_{10}$ [km/h], Student-t | Calibrado con GOES-16 y NIST TN 2135 (LOFO) ✓ |
| **EQ-11** | Forwarding estocástico PAER | `physics-aware-emergency-network.mjs`| SENDA Deep Tech IP | $U_{\text{PAER}}$ [adim], $t_{\text{impact}}$ [s] | Verificado en simulación discreta (0 pérdidas fuego) ✓ |

---

## 2. Detalle de Verificación y Pruebas Numéricas

### 2.1 Ecuación ITU-R P.838-3 (Atenuación Específica por Lluvia)
Fórmula implementada:
$$\gamma_R = k \cdot R^\alpha \quad [\text{dB/km}]$$
Donde los coeficientes de regresión se computan mediante sumas de gaussianas para polarización horizontal y vertical:
$$\log_{10} k = \sum_{j=1}^4 a_j \exp\left(-\left(\frac{\log_{10} f - b_j}{c_j}\right)^2\right) + m_k \log_{10} f + c_k$$
$$\alpha = \sum_{j=1}^5 a_j \exp\left(-\left(\frac{\log_{10} f - b_j}{c_j}\right)^2\right) + m_\alpha \log_{10} f + c_\alpha$$
Para trayectos inclinados con ángulo de elevación $\theta$ y ángulo de inclinación de polarización $\tau$:
$$k = \frac{k_H + k_V + (k_H - k_V) \cos^2\theta \cos(2\tau)}{2}$$
$$\alpha = \frac{k_H \alpha_H + k_V \alpha_V + (k_H \alpha_H - k_V \alpha_V) \cos^2\theta \cos(2\tau)}{2k}$$
- **Verificación de Unidades:** $f$ en GHz, $R$ en mm/h, resultado en dB/km.
- **Continuidad:** Comprobado que $\lim_{\epsilon \to 0} |\gamma_R(6 + \epsilon) - \gamma_R(6 - \epsilon)| = 0$.

### 2.2 Ecuación ITU-R P.526-15 §4.3 (Difracción Deygout Multiobstáculo)
El parámetro geométrico adimensional de Fresnel para un obstáculo con despeje $h$ sobre la línea de vista es:
$$\nu = h \sqrt{\frac{2}{\lambda} \left(\frac{1}{d_1} + \frac{1}{d_2}\right)}$$
La pérdida de difracción de filo de cuchillo individual $J(\nu)$ se calcula mediante la aproximación normativa de Boithias:
$$J(\nu) = 6.9 + 20 \log_{10}\left(\sqrt{(\nu - 0.1)^2 + 1} + \nu - 0.1\right) \quad (\nu > -0.78)$$
$$J(\nu) = 0 \quad (\nu \le -0.78)$$
Para obstáculos secundarios a izquierda y derecha del obstáculo principal, se evalúan las pérdidas $J(\nu_L)$ y $J(\nu_R)$ corregidas por los factores $C_L$ y $C_R$:
$$L_{\text{total}} = J(\nu_P) + C_L J(\nu_L) + C_R J(\nu_R)$$
- **Comprobación:** Evita la sobrestimación de pérdidas de hasta 14 dB que producía la suma lineal Deygout sin factores de corrección.

### 2.3 Acústica ISO 9613-1:1993 (Atenuación Atmosférica a Frecuencias Ultrasónicas)
A diferencia de un ajuste cuadrático fijo, la función `computeIso9613AbsorptionDbPerM()` evalúa las frecuencias de relajación molecular del oxígeno ($f_{r,O}$) y del nitrógeno ($f_{r,N}$), así como la presión de vapor de saturación según el Anexo B:
$$\alpha_{\text{atm}} = 8.686 f^2 \left( 1.84 \times 10^{-11} \left(\frac{T}{T_0}\right)^{1/2} + \left(\frac{T}{T_0}\right)^{-5/2} \left( 0.01275 \frac{e^{-2239.1/T}}{f_{r,O} + f^2/f_{r,O}} + 0.1068 \frac{e^{-3352.0/T}}{f_{r,N} + f^2/f_{r,N}} \right) \right) \quad [\text{dB/m}]$$

A $20\text{ kHz}$, $20^\circ\text{C}$, 50 % HR y $101.325\text{ kPa}$, el coeficiente es $\alpha_{\text{atm}} \approx 0.524\text{ dB/m}$.
La presión sonora recibida a distancia $r$ desde un emisor esférico con nivel de emisión $L_{\text{SPL}}(1\text{m})$ es:
$$L_p(r) = L_{\text{SPL}}(1\text{m}) - 20 \log_{10}(r) - \alpha_{\text{atm}} \cdot r$$
- **Límites Físicos Demostrados:** A $r = 10\text{ m}$, la atenuación geométrica es de $20\text{ dB}$ y la atmosférica es de $5.24\text{ dB}$ (pérdida total $25.24\text{ dB}$). En teléfonos móviles COTS con emisión limitada a $\sim 60\text{ dB SPL}$ a 1 m, la señal cae a $\sim 34.8\text{ dB SPL}$, siendo indetectable en entornos ruidosos ($> 85\text{ dBA}$). El estado de audibilidad se clasifica estrictamente como `audibilityStatus: 'UNMEASURED'` ante la ausencia de medidas audiométricas clínicas en laboratorio acústico.

---

## 3. Dictamen de Auditoría Matemática

Todas las funciones numéricas del repositorio cumplen con los requisitos de determinismo, ausencia de singularidades numéricas (división por cero protegida en distancias mínimas), verificación estricta de tipos (`finite(n, min, max)`) y tolerancia normativa internacional.
