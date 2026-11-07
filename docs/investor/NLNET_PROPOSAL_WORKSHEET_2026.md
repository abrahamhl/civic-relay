# NLnet (Open Internet Stack) Proposal Worksheet & 10-Day Funding Execution Kit

**Target Call:** NLnet Foundation — Open Internet Stack (Restack Fund / General Open Call)  
**Submission Portal:** `https://nlnet.nl/propose/`  
**Next Official Deadline:** **3 November 2026 at 12:00 CET (noon)**  
**Recommended Grant Request:** **€35,000** (Pure non-dilutive R&D grant, MIT License)

> **CRITICAL NLNET POLICY RULE:** NLnet strictly prohibits submitting proposals written entirely by generative AI and requires transparency regarding AI usage. **Do NOT copy-paste this worksheet verbatim into the NLnet form.** Use the factual structure, milestone numbers, and repository links below to write the final form answers in your own voice, and include the AI transparency disclosure in Section 6.

---

## 1. Exact Form Field Preparation (`nlnet.nl/propose`)

### Field A — Project Name
`OEP (Offline Emergency Protocol) — Verifiable Store-and-Forward & AOSP Local Transport`

### Field B — Website / Repository URL
- Website: `https://civic-relay-investor.vercel.app`
- Repository: `https://github.com/abrahamhl/civic-relay`

### Field C — Abstract (Write in your own words, ~120–150 words)
*Key points to cover in your own words:*
- During power blackouts or natural disasters, conventional cellular networks fail and citizen communication apps either fail silently or make dangerous assumptions (treating silence as injury or treating "packet sent" as "person rescued").
- OEP is an MIT-licensed, transport-agnostic store-and-forward coordination engine and receipt verification protocol.
- What already exists today: a zero-dependency deterministic JavaScript core (`investor-next/lib/store-forward.mjs`, `emergency-routing.mjs`, `emergency-policy.mjs`) tested across 810 seeded blackout scenarios, plus an experimental two-phone Android Nearby laboratory app (`experimental/android-nearby/`).
- What this grant funds: removing the proprietary Google Play Services (`play-services-nearby`) dependency by building an open **AOSP Bluetooth LE + Wi-Fi Aware / Wi-Fi Direct `TransportAdapter`**, adding **Ed25519 cryptographic receiver receipts** and **SQLite/Room persistent store-and-forward queues** on Android, and publishing an open 30+ trial hardware benchmark dataset.

### Field D — Compare with Existing Solutions
- **Briar / Manyverse / Meshtastic:** Excellent for general peer-to-peer chat or LoRa radio enthusiasts, but they do not implement structured crisis check-in state machines (`SAFE`, `SOS_EXPLICIT`, `OTHERS_AFFECTED`, `UNKNOWN !== INJURED`), CAP 1.2 alert boundary gates, or transport-agnostic receipt guards that strictly separate `QUEUED`, `FORWARDED_UNCONFIRMED`, and `RECEIVER_ACK`.
- **Google Play Services Nearby Connections:** Currently used in our `experimental/android-nearby/` prototype (`19.5.1`), which is proprietary and closed-source. A core goal of this NLnet project is replacing Play Services Nearby with a 100% open-source AOSP BLE + Wi-Fi Direct transport module usable on de-Googled Android (GrapheneOS, LineageOS, /e/OS) and F-Droid builds.

---

## 2. Concrete Milestone Breakdown (€35,000 Total)

| Milestone | Deliverable | Verification Criteria | Budget | Timeline |
|---|---|---|---|---|
| **M1 — Two-Handset Baseline Benchmark & Unified Core Specification** | Execute the 30-trial physical two-phone baseline (`experimental/android-nearby/PILOT_ACCEPTANCE.md`), publish raw CSV/video dataset, and unify `packages/core` + `investor-next/lib` into a single versioned specification. | Published 30-trial CSV dataset + reproducible test suite passing in CI. | **€6,000** | Month 1 |
| **M2 — Open AOSP BLE + Wi-Fi Direct Transport Adapter (De-Googled Android)** | Replace proprietary `com.google.android.gms:play-services-nearby` with an open-source AOSP BLE discovery + Wi-Fi Direct socket transport module compatible with F-Droid / GrapheneOS / LineageOS. | APK builds without Google Play Services; passes 30-trial 2-phone offline transfer benchmark. | **€12,000** | Months 2–3 |
| **M3 — Persistent Store-and-Forward Queue & Ed25519 Signed Receipts** | Add bounded SQLite/Room queue persistence surviving app/OS restarts, dual-clock TTL expiration, tombstone replay protection, and Ed25519 challenge-response receipts. | Unit + instrumented tests proving zero replay acceptance and survival across process kill/reboot. | **€9,000** | Month 4 |
| **M4 — 3-Node Multi-Hop Relay Benchmark & Independent Security Review** | Validate 3-device offline store-and-forward relay (Phone A $\rightarrow$ Relay Phone B $\rightarrow$ Gateway Phone C), publish latency/battery mAh measurements, and remediate findings from an external security/privacy review. | Public benchmark report, 3-phone video proof, and F-Droid-ready reproducible release. | **€8,000** | Months 5–6 |

---

## 3. Mandatory AI Transparency Disclosure (Include in NLnet Notes)

> *"Transparency disclosure on AI usage: I am the human author and architect of the project and wrote this grant application myself. During development of the existing prototype (`abrahamhl/civic-relay` and `abrahamhl/buyer-arena`), I used AI coding assistants (GitHub Copilot / Claude / Gemini) for code generation, test scaffolding, multilingual UI translation (EN/ES/NL), and documentation drafting, with all architectural decisions, safety invariants, and physical device testing directed and verified by me."*

---

## 4. Outbound Partner Outreach Templates (Send 10 Emails This Week)

### Template 1 — University RF / Distributed Systems Labs (TU Delft, TNO, UPM, etc.)
**Subject:** Open-source offline emergency store-and-forward benchmark — 20-min research exchange?

> Dear Prof. / Dr. [Last Name],
>
> I am developing **OEP (Offline Emergency Protocol)** (`https://github.com/abrahamhl/civic-relay`), an MIT-licensed research prototype investigating opt-in store-and-forward coordination and explicit receiver acknowledgments (`QUEUED` vs `FORWARDED_UNCONFIRMED` vs `ACK`, and `UNKNOWN !== INJURED`) during cellular blackouts.
>
> We have a deterministic 20–100 node simulator (810 scenario sweeps in CI) and an experimental two-phone Android lab APK (`https://civic-relay-investor.vercel.app`). We are now executing our 30-trial physical handset benchmark (`experimental/android-nearby/PILOT_ACCEPTANCE.md`) ahead of an NLnet / Horizon Europe research submission.
>
> Would you or a doctoral researcher in your group be open to a 20-minute call next week to review our two-phone measurement protocol and explore a lightweight academic letter of interest for field validation?
>
> Best regards,  
> Abraham Haddioui

### Template 2 — Municipal Civil Protection / Safety Regions (*Veiligheidsregio* / *Protección Civil*)
**Subject:** Investigación open-source en coordinación ciudadana sin cobertura (OEP) — consulta breve de 15 min

> Estimado/a equipo de [Protección Civil / Veiligheidsregio],
>
> Estoy desarrollando en abierto **OEP — Offline Emergency Protocol** (`https://civic-relay-investor.vercel.app/es`), un prototipo de investigación (licencia MIT) que estudia cómo separar de forma segura estados ciudadanos explícitos (`ESTOY BIEN` vs `SOS EXPLÍCITO`) del silencio de red (`UNKNOWN !== herido`) y cómo encolar mensajes con caducidad (TTL) cuando cae la red móvil.
>
> **No es un producto comercial ni un canal conectado al 112**, sino un banco de pruebas abierto que estamos preparando para convocatorias europeas de I+D. ¿Sería posible mantener una breve conversación de 15 minutos con un responsable técnico o de ejercicios para validar que nuestras hipótesis de triaje y no-inferencia se ajustan a vuestros criterios operativos?
>
> Un cordial saludo,  
> Abraham Haddioui
