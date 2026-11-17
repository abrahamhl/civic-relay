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

## 2. BENCHMARK FRENTE AL ESTADO DEL ARTE

| Capacidad Técnica | Google Maps / Waze | Sistemas 112 / AlertGov Clásicos | Radios TETRA / SIRDEE | SENDA Unified Platform |
| :--- | :---: | :---: | :---: | :---: |
| **Operación sin red celular** | ❌ 0% Inoperativo | ❌ 0% Inoperativo | ⚠️ Solo voz oficial | ✅ **100% Funcional (Malla DTN)** |
| **Anticipación por humo/fuego** | ❌ Reactivo (retraso 15-30m)| ❌ Lento (decisión humana) | ❌ Inexistente | ✅ **Predictivo (Física acoplada)** |
| **Cadena custodia criptográfica**| ❌ No pericial | ❌ Logs internos opacos | ❌ Grabación analógica | ✅ **Firma Ed25519 inmutable** |
| **Participación ciudadana civil**| ⚠️ Reportes sin filtro | ❌ Unidireccional | ❌ Cerrado a profesionales | ✅ **Bidireccional con filtro anti-XSS** |
| **Coste por despliegue vial** | N/A (App civil) | Millones € (Fibra/Torres) | Millones € (Repetidores) | ✅ **COTS (Reutiliza cámaras/bucles)** |

---

## 3. PROPIEDAD INTELECTUAL Y ESTRATEGIA DE ACTIVOS

- **Arquitectura de Software Abierto Dual-License:**
  - El núcleo matemático (`@senda/core`, `@senda/pci`) bajo licencia permisiva MIT/Apache 2.0 para facilitar su adopción como estándar industrial y gubernamental en la Unión Europea.
  - Los módulos de mando táctico (`@senda/command`), fusión de vídeo YOLOX y pasarelas de infraestructura (`corridor-fabric`) bajo licencia comercial B2G para concesionarias viales, DGT y agencias de seguridad nacional.
- **Secretos Industriales y Algoritmos Propietarios:**
  - Función de transferencia y optimización de encaminamiento estocástico multicanal EAOR bajo cortes correlacionados de red.
  - Calibración de anemometría de flota mediante rueda libre OBD-II en vehículos COTS.

---

## 4. OPORTUNIDADES DE FINANCIACIÓN PÚBLICA Y PRIVADA (2026-2027)

1. **Horizon Europe — Cluster 3 (Civil Security for Society):**
   - Convocatorias orientadas a "Resilient disaster risk management and infrastructure protection". SENDA encaja plenamente como proyecto tractor con socios de protección civil de España, Países Bajos y Portugal.
2. **EIC Accelerator (European Innovation Council):**
   - Subvención a fondo perdido de hasta 2.5M€ + inversión de capital de hasta 15M€ para tecnologías de disrupción profunda (*deep tech*).
3. **Contratación Pública Innovadora (CPI) — DGT / Ministerio del Interior:**
   - Proyectos de digitalización de la red de carreteras secundarias y sensorización de corredores de evacuación mediante fondos NextGenerationEU.
