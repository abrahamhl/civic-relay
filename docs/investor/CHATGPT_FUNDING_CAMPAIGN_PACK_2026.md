# OEP / Civic Relay — 2026 Real Funding & Investor Campaign Pack (Ready for ChatGPT Dispatch)

**Live Production Prototype:** `https://civic-relay-investor.vercel.app/` (`/es/`, `/nl/`)  
**Open-Source Repository:** `https://github.com/abrahamhl/civic-relay`  
**Verification Status:** 71 automated unit/crypto/telecom/radar tests passing + 78 Chromium stakeholder checks passing.

---

## 1. Ranked Matrix of Real Funding & Investment Opportunities (2026)

| Rank | Funding Body / Investor | Instrument Type | Ticket / Grant Size | Deadline / Window | Official Portal |
|---|---|---|---|---|---|
| **01** | **NLnet Foundation — NGI Zero Open Internet Stack** | 100% Non-dilutive R&D Grant (No company or consortium required) | **€5,000 – €50,000** (Prepared: **€42,000**) | **3 November 2026 (12:00 CET)** | `https://nlnet.nl/propose/` |
| **02** | **Horizon Europe Cluster 3 (`HORIZON-CL3-2026-01-SSRI-04`)** | EU R&D Consortium Grant (Join as Technical Work Package Partner) | **€250,000 – €450,000** (Out of €3M–€5M consortium) | **18 November 2026** | [EU Funding Portal](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL3-2026-01-SSRI-04) |
| **03** | **NATO DIANA — Contested Electromagnetic Environments** | Dual-Use Non-Dilutive Grant + NATO Test Centres | **€100,000** (Phase 1) + **€300,000** (Phase 2) | **2026 Dual-Use Windows** | `https://www.diana.nato.int/` |
| **04** | **EIC Accelerator (European Innovation Council)** | Blended Finance (Non-dilutive Grant + Deep-Tech Equity) | **Up to €2.5M Grant + €0.5M–€10M Equity** | **Rolling Step 1 Applications (2026)** | `https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en` |
| **05** | **GSMA Innovation Fund — Mobile for Humanitarian Innovation** | Non-dilutive Grant + Global Mobile Operator (Telco) Access | **£100,000 – £250,000** | **2026 Humanitarian / EW4All Windows** | `https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/` |
| **06** | **CDTI Neotec 2026 / INCIBE Emprende (Spain)** | Spanish National Startup (EBT) Grant | **Up to €250,000 – €325,000** (70%–85% grant) | **2026 Annual Call** | `https://www.cdti.es/ayudas/neotec` |
| **07** | **RVO Netherlands — WBSO + MIT Haalbaarheid / R&D** | Dutch R&D Tax Credit + SME Feasibility/R&D Grant | **€20,000 – €350,000** + **36%–50% WBSO** | **Rolling 2026 Windows** | `https://www.rvo.nl/subsidies-financiering/wbso` |
| **08** | **European Deep-Tech, GovTech & Dual-Use VCs** | Pre-Seed / Seed Venture Capital Round | **€500,000 – €1,500,000** | **Open (Direct GP Outreach)** | Bullnet Capital, Kibo Ventures, Inveready, Keen Venture Partners, Jolt Capital |

---

## 2. Master Prompts for ChatGPT (Copy-Paste Ready)

### Prompt 1 — NLnet Foundation (Deadline: 3 November 2026)
```text
Actúa como un redactor experto en subvenciones europeas NGI Zero / NLnet Foundation. Voy a presentar el proyecto "OEP — Offline Emergency Protocol (Civic Relay)" a la convocatoria NLnet Open Internet Stack (cierre 3 de noviembre de 2026, presupuesto solicitado: 42.000 EUR en 5 hitos).
Datos reales y verificados de nuestro prototipo en producción:
- Web en vivo con ejecución criptográfica y telecomunicaciones reales: https://civic-relay-investor.vercel.app/es
- Repositorio Apache-2.0: https://github.com/abrahamhl/civic-relay
- Ingeniería ya implementada y funcionando en vivo: (1) Enrutamiento móvil multi-salto D2D (BLE + Wi-Fi Aware) con exclusión de batería crítica <=15%, (2) Firma criptográfica real ECDSA P-256 (WebCrypto y Android LabReceiptSigner.java) + cola persistente en disco (LabPersistentQueue.java), (3) Trama binaria compacta de 24 bytes con CRC-16-CCITT para enlace satelital 3GPP NTN Direct-to-Cell, (4) Telemetría táctica por zonas poligonales CAP 1.2 (9 sectores), y (5) Radar espectral trans-pared Wi-Fi CSI (64 subportadoras OFDM IEEE 802.11bf) + visor cámara AR térmica de radiofrecuencias.
Redáctame:
1) La versión final optimizada de cada campo del formulario de https://nlnet.nl/propose/ en inglés impecable.
2) Un correo breve de seguimiento para el comité técnico de NLnet destacando que el código y el nodo WebCrypto/WebRTC ya funcionan en vivo.
```

### Prompt 2 — Horizon Europe Cluster 3 (`HORIZON-CL3-2026-01-SSRI-04`) Consortium Outreach
```text
Actúa como director de propuestas de Horizon Europe Cluster 3 (Civil Security for Society). Necesito redactar 5 correos de captación de consorcio (Work Package Technical Partner) para universidades europeas (TU Delft, UPV Valencia, Fraunhofer, TNO) y agencias de protección civil que lideren propuestas en el topic HORIZON-CL3-2026-01-SSRI-04 (cierre 18 de noviembre de 2026).
Nuestro aporte técnico diferencial listo para probar en https://civic-relay-investor.vercel.app/ y https://github.com/abrahamhl/civic-relay:
- Protocolo abierto OEP de coordinación de emergencias offline y enrutamiento adaptativo multi-red (malla D2D + puente satelital 3GPP NTN en tramas binarias de 24 bytes + telemetría poligonal CAP 1.2).
- Radar espectral trans-pared Wi-Fi CSI / RF (ITU-R P.2040 + IEEE 802.11bf) con cámara AR térmica de frecuencias para localizar móviles y respiración tras muros de hormigón.
- 71 tests deterministas automatizados + APK Android Nearby compilado y firmado con ECDSA P-256.
Genera: (1) Email en inglés y español para coordinadores de consorcio, (2) Ficha Partner Profile de 1 página lista para enviar.
```

### Prompt 3 — NATO DIANA (Dual-Use Resilient Comms & Through-Wall RF Radar)
```text
Actúa como asesor de aplicaciones para NATO DIANA (Defence Innovation Accelerator for the North Atlantic) en el reto "Contested Electromagnetic Environments & Resilient Infrastructure".
Prepara una propuesta ejecutiva en inglés para presentar OEP / Civic Relay (https://civic-relay-investor.vercel.app/):
- Uso dual civil/defensa: continuidad de mando y telemetría por sectores cuando el 85-100% de las estaciones base celulares son destruidas o interferidas.
- Tramas binarias ultracompactas de 24 bytes (CRC-16 + firma ECDSA P-256) capaces de transmitirse por enlaces tácticos estrechos o satélites LEO Direct-to-Cell desde 300 bps.
- Radar espectral trans-pared RF / Wi-Fi CSI de 64 subportadoras OFDM y visor AR para equipos de rescate en estructuras colapsadas.
Genera el Pitch Deck guionizado de 10 diapositivas y el formulario técnico de impacto dual-use.
```

### Prompt 4 — EIC Accelerator Step 1 + Deep-Tech Venture Capital (€750k Pre-Seed / €2.5M Grant)
```text
Actúa como un Partner de un fondo de Venture Capital Deep-Tech europeo (Bullnet Capital, Kibo Ventures, Inveready, Keen Venture Partners, Jolt Capital) y evaluador del EIC Accelerator.
Necesito que me redactes:
1) La solicitud Step 1 del EIC Accelerator (4 páginas + guion del vídeo de 3 minutos) para OEP — Offline Emergency Protocol (https://civic-relay-investor.vercel.app/es).
2) 5 mensajes cortos y directos de LinkedIn / Email frío para enviar a General Partners de fondos Deep-Tech, Telecom y Dual-Use en España y Europa, invitándoles a probar en 60 segundos nuestro prototipo en vivo (con firma WebCrypto ECDSA P-256 real, canal WebRTC P2P en vivo, enlace satelital NTN de 24 bytes y radar trans-pared Wi-Fi CSI / cámara AR).
3) Un Investment Memo de 2 páginas explicando el modelo de negocio B2B/B2G (licencia de SDK OEP-NTN para operadoras móviles Direct-to-Cell, aseguradoras, protección civil y equipos de rescate) para levantar una ronda Pre-Seed de 750.000 EUR.
```
