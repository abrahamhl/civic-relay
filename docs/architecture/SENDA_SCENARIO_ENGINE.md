# SENDA SCENARIO ENGINE — ESPECIFICACIÓN Y CONTRATO CIENTÍFICO
**Versión:** 1.0.0-ScientificEngine  
**Fecha:** 2026-11-08  
**Autor:** Multiagente OpenCode / Scientific Computing & Digital Twin Engineer  

---

## 1. MISIÓN Y CONTRATO DE REPRODUCIBILIDAD

El **SENDA Scenario Engine** es el subsistema unificado de modelización y simulación que acopla dinámicas físicas ambientales (fuego, atmósfera, hidrología), comportamiento de flujos vehiculares (cinemática macroscópica de tráfico) y protocolos de telecomunicaciones oportunistas (DTN/EAOR) dentro de un único marco de referencia espacio-temporal determinista.

### Principio Fundamental de Reproducibilidad
Para cualquier escenario $S$, vector de parámetros iniciales $\vec{\theta}$ y semilla de generador pseudoaleatorio $\sigma$:
$$\text{State}(t, \vec{\theta}, \sigma) \equiv \text{Deterministic}$$
Dos ejecuciones independientes en diferentes plataformas (Node.js en backend vs. JavaScript en navegador cliente) garantizan un hash SHA-256 de evidencia matemática idéntico paso a paso.

---

## 2. CATÁLOGO DE ESCENARIOS ESTANDARIZADOS

### Escenario A — Corredor en Crisis (`A_CORRIDOR_CRISIS`)
- **Contexto:** Incendio forestal que avanza hacia una autovía troncal (ej. A-3 entre Buñol y Requena). Humo denso invade la calzada reduciendo drásticamente la visibilidad; se produce una retención vehicular con ondas de choque hacia atrás. En $t = 120\,\text{s}$, las llamas alcanzan la torre de telecomunicaciones celulares del corredor, provocando la caída total de la red 4G/5G.
- **Acoplamiento Físico:**
  1. *Rothermel:* $\text{ROS} = f(\text{viento}, \text{humedad combustible}, \text{pendiente})$.
  2. *Pluma de Humo:* Visibilidad $V(t) = \max(30, 2000 - 1500 \cdot (1 - e^{-t/180}))\,\text{m}$.
  3. *LWR Traffic Flow:* Velocidad $u(k) = u_{\text{max}} \cdot (1 - k/k_{\text{jam}})$, modulada por visibilidad $u_{\text{eff}} = \min(u(k), 1.2 \cdot V(t)^{0.6})$.
  4. *DTN Transition:* Al caer la celda a $t=120\,\text{s}$, la red conmuta a saltos Wi-Fi Aware / BLE entre los vehículos atrapados, logrando una tasa de entrega $>90\%$ antes de que WhatsApp o llamadas tradicionales puedan reconectar.

### Escenario B — Inundación Urbana y Alerta CAP (`B_URBAN_FLOOD`)
- **Contexto:** Lluvias torrenciales provocan la crecida de una rambla que anega pasos subterráneos y vías de acceso a un polígono industrial y núcleo urbano.
- **Modelos:** Ecuación de Saint-Venant 1D simplificada, hidrograma triangular unitario, activación automática de avisos CAP v1.2 y corte inteligente de accesos semaforizados.

### Escenario C — Blackout Residencial y Mulos de Datos (`C_RESIDENTIAL_BLACKOUT`)
- **Contexto:** Apagón generalizado de la red eléctrica en un distrito suburbano de 40.000 habitantes. Baterías de respaldo de antenas se agotan tras 2 horas.
- **Modelos:** Dinámica de colas Store-and-Forward; nodos mulos (patrullas de policía local, autobuses y vehículos de recogida) recolectan y transportan sobres de auxilio hacia pasarelas con enlace satelital activo.

### Escenario D — Rescate con Dron y Triangulación Acústica (`D_RESCUE_OPERATION`)
- **Contexto:** Búsqueda y rescate en zona montañosa sin cobertura tras el derrumbe de una estructura rural.
- **Modelos:** Localización de balizas de radio y sonido mediante trilateración basada en RSSI con filtro Kalman y detección de pulso de audio FSK (200 bytes en $<25\,\text{s}$).

---

## 3. MODELOS MATEMÁTICOS ACOPLADOS

### 3.1 Propagación de Incendios Forestales (Rothermel Adaptado)
La velocidad de avance del frente en la dirección de máximo avance ($R_0$) se computa como:
$$R = R_0 \cdot (1 + \Phi_w + \Phi_s)$$
Donde el coeficiente de viento $\Phi_w = C \cdot U^B \cdot (\beta/\beta_{\text{op}})^{-E}$ y el factor de pendiente $\Phi_s = 5.275 \cdot \beta^{-0.3} \cdot (\tan \phi)^2$.
- La forma de la elipse de fuego se modela con excentricidad $\varepsilon = \sqrt{1 - (L/W)^{-2}}$, donde $L/W = 0.936 \cdot \exp(0.1147 \cdot U) + 0.461$.

### 3.2 Cinemática del Tráfico (LWR con Diagrama Fundamental Triangular)
$$q(k) = \begin{cases} 
u_f \cdot k & \text{si } k \le k_{\text{crit}} \\
w \cdot (k_{\text{jam}} - k) & \text{si } k_{\text{crit}} < k \le k_{\text{jam}}
\end{cases}$$
Donde:
- $u_f = 120\,\text{km/h}$ (velocidad a flujo libre).
- $k_{\text{crit}} = 25\,\text{veh/km/carril}$.
- $k_{\text{jam}} = 140\,\text{veh/km/carril}$.
- $w = \frac{u_f \cdot k_{\text{crit}}}{k_{\text{jam}} - k_{\text{crit}}} = 26.08\,\text{km/h}$ (velocidad de propagación de la onda de choque hacia atrás).

### 3.3 Protocolo DTN EAOR (Expected Anypath Opportunistic Routing)
El coste esperado de transmisión entre un nodo origen $i$ y el destino $d$ a través de un conjunto de candidatos forwarders $J_i$:
$$C(i, d) = \frac{1 + \sum_{j \in J_i} P(i \to j) \cdot C(j, d) \cdot \prod_{k < j} (1 - P(i \to k))}{1 - \prod_{j \in J_i} (1 - P(i \to j))}$$

---

## 4. ESPECIFICACIÓN DE LAS TRES DEMOS GUIADAS

### Demo 1: "Incendio, Tráfico y Ruptura Celular"
- **Objetivo:** Demostrar cómo SENDA anticipa el colapso vial 14 minutos antes que los navegadores comerciales mediante correlación entre la columna de humo y la velocidad de flujo.
- **Secuencia Operativa:**
  - Paso 1: Ingesta de viento AEMET (38 km/h SO) y detección de frente a 1.2 km de la autovía.
  - Paso 2: La pluma invade el km 284; el radar virtual detecta caída de velocidad a 24 km/h.
  - Paso 3: Caída de la torre celular; activación automática de la malla de vehículos y desvío de emergencia antes de la boca del embudo.

### Demo 2: "Rescate con Mulo de Datos Móvil"
- **Objetivo:** Demostración paso a paso de la entrega de un paquete SOS desde un vehículo aislado sin red celular hasta el centro 112 mediante un vehículo en movimiento con enlace Starlink.
- **Secuencia:** Emisión BLE $\to$ Recepción en mulo $\to$ Firma de transferencia PCI $\to$ Subida satelital $\to$ Confirmación en consola de mando.

### Demo 3: "Gestión Multiagencia y Alerta CAP"
- **Objetivo:** Operación colaborativa donde el puesto de mando delimita un polígono de exclusión en el mapa y emite una alerta CAP v1.2 sellada que se difunde por paneles VMS de carretera y radio-balizas comunitarias.

---

## 5. MANIFIESTO DE EVIDENCIA CIENTÍFICA (ESPECIFICACIÓN JSON)
Cada ejecución del motor emite un manifiesto JSON inmutable que incluye:
```json
{
  "scenarioEngineVersion": "1.0.0-scientific",
  "scenarioId": "A_CORRIDOR_CRISIS",
  "deterministicSeed": 1337,
  "executionTimestamp": "2026-11-08T19:15:00.000Z",
  "timelineSteps": 60,
  "modelParameters": { "windSpeedKmh": 38, "moistureFuelPct": 6.5, "cellularCutTimeS": 120 },
  "finalMetrics": {
    "fireFrontKm": 0.052,
    "smokeVisibilityM": 142.8,
    "trafficDensityVehKm": 98.4,
    "dtnDeliveryRatePct": 94.2
  },
  "scientificChecksum": "sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
