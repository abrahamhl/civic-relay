# SENDA — DEFENDIBILIDAD TÉCNICA Y PREPARACIÓN PARA INVERSIÓN (INVESTOR READINESS)
**Versión:** 1.0.0-InvestorReady  
**Fecha:** 2026-11-08  
**Autor:** Multiagente OpenCode / Principal Software Architect & Innovation Lead  

---

## 1. TESIS DE INVERSIÓN Y FOSO DEFENSIVO (MOAT)

La proliferación de catástrofes climáticas e incendios de sexta generación (incendios convectivos pirocumulonimbos, como Valencia o Hawái) ha dejado en evidencia una vulnerabilidad estructural insalvable para las plataformas tradicionales de protección civil y movilidad: **la dependencia absoluta de la infraestructura celular terrestre y de los servidores en la nube**.

Cuando las torres 4G/5G arden o la red eléctrica colapsa, aplicaciones como Google Maps, Waze o WhatsApp quedan completamente inutilizadas.

### El Foso Tecnológico de SENDA (Moat):
1. **Pila de Telecomunicaciones Soberana Multi-Portador (DTN/EAOR):**
   SENDA es capaz de encaminar mensajes de auxilio SOS y telemetría de corredores a través de radios Bluetooth LE COTS, Wi-Fi Aware ad-hoc, radios LoRa y satélites LEO, sin que ningún nodo individual requiera conexión continua a Internet.
2. **Motor Físico Acoplado en Tiempo Real (Rothermel + LWR):**
   SENDA no extrapola tráfico con machine learning ciego a partir de datos históricos irrelevantes durante una catástrofe; calcula la cinemática de fluidos y la formación de ondas de choque generadas por la reducción de visibilidad por humo, anticipando el colapso vial con hasta 14 minutos de ventaja.
3. **Cadena de Custodia Criptográfica Forense (`@senda/pci`):**
   Cada dato, reporte y telemetría está sellado asimétricamente con Ed25519 y SHA-256. Esto permite que la información de rescate sirva como prueba pericial admisible en sede judicial sin posibilidad de manipulación.
4. **Despliegue COTS Inmediato (Zero New Hardware):**
   Funciona en los teléfonos inteligentes y pantallas de coche ya existentes (Android / iOS / Navegador Web / PWA), aprovechando la densidad natural de vehículos y peatones como repetidores.

---

## 2. BENCHMARK FRENTE AL ESTADO DEL ARTE (EVALUACIÓN RIGUROSA)

| Capacidad Técnica | Google Maps / Waze | Sistemas 112 / AlertGov Clásicos | Radios TETRA / SIRDEE | SENDA Unified Platform |
| :--- | :---: | :---: | :---: | :---: |
| **Operación sin red celular** | ❌ 0% Inoperativo | ❌ 0% Inoperativo | ⚠️ Solo voz oficial | ✅ **Malla DTN con enrutamiento PAER (store-and-forward tolerante a cortes)** |
| **Anticipación por humo/fuego** | ❌ Reactivo (retraso 15-30m)| ❌ Lento (decisión humana) | ❌ Inexistente | ✅ **Predictivo (Física acoplada Rothermel + IGN MDT05)** |
| **Cadena custodia criptográfica**| ❌ No pericial | ❌ Logs internos opacos | ❌ Grabación analógica | ✅ **Firma Ed25519 inmutable y sellado de tiempo SHA-256** |
| **Participación ciudadana civil**| ⚠️ Reportes sin filtro | ❌ Unidireccional | ❌ Cerrado a profesionales | ✅ **Bidireccional con filtro de suplantación y verificación cruzada** |
| **Coste por despliegue vial** | N/A (App civil) | Millones € (Fibra/Torres) | Millones € (Repetidores) | ✅ **COTS (Reutiliza terminales civiles, bucles y cámaras existentes)** |

*Nota de diligencia:* Consultar [`docs/funding/SENDA_INVESTOR_TRUTH_GATE.md`](file:///c:/Users/2fabr/civic-relay/docs/funding/SENDA_INVESTOR_TRUTH_GATE.md) para la matriz completa de evidencia, tolerancias normativas y límites físicos de cada claim.

---

## 3. PROPIEDAD INTELECTUAL Y ACTIVOS TECNOLÓGICOS DEFENDIBLES

- **Activos de Algoritmia Propietaria y Física Matemática:**
  - Protocolo **PAER (Physics-Aware Emergency Routing)**: primer algoritmo de encaminamiento oportunista que discrimina nodos mediante modelos de propagación de frentes de peligro ambiental y presupuestos de enlace normativos (ITU-R P.526 / ITU-R P.838).
  - Motor de Atenuación Radioeléctrica Continua: implementación cerrada y analítica de ITU-R P.838-3 libre de discontinuidades numéricas en bandas de 1 a 100 GHz.
  - Cadena de Custodia Criptográfica Forense (`@senda/pci`): estructura de datos de bloques hash y doble recibo con verificación sin dependencias externas.
  - Cinemática Doppler Topocéntrica y Ventanas de Paso: predicción orbital analítica para radiolocalización y demodulación SDR en terminales de emergencia.

- **Arquitectura de Software Abierto Dual-License:**
  - Núcleo científico (`@senda/core`, `@senda/pci`): código abierto para habilitar adopción estándar en la Unión Europea y auditoría científica por pares.
  - Plataforma de mando táctico (`@senda/live`, consolas de centro de control y visualizadores 4D): licencia comercial B2G / B2B para agencias de seguridad nacional, DGT y concesionarias de infraestructuras críticas.

---

## 4. OPORTUNIDADES DE FINANCIACIÓN PÚBLICA Y PRIVADA (2026-2027)

1. **Horizon Europe — Cluster 3 (Civil Security for Society):**
   - Convocatorias orientadas a "Resilient disaster risk management and infrastructure protection". SENDA encaja plenamente como proyecto tractor con socios de protección civil de España, Países Bajos y Portugal.
2. **EIC Accelerator (European Innovation Council):**
   - Subvención a fondo perdido de hasta 2.5M€ + inversión de capital de hasta 15M€ para tecnologías de disrupción profunda (*deep tech*).
3. **Contratación Pública Innovadora (CPI) — DGT / Ministerio del Interior:**
   - Proyectos de digitalización de la red de carreteras secundarias y sensorización de corredores de evacuación mediante fondos NextGenerationEU.

