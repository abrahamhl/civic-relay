# Funding Opportunities — European Union & Netherlands (Verified 2026)

**Scope:** Non-dilutive public R&D grants, open-source fellowships, and deep-tech innovation instruments applicable to **OEP — Offline Emergency Protocol (`abrahamhl/civic-relay`)**.  
**Verification Note:** Re-checked on 2026-10-21 via web search of public sources. Earlier drafts listed the NGI Zero Commons Fund as open and mislabeled the Horizon topic; both corrected below. Always confirm on the official portal before applying.

---

## 1. European Union Instruments

### 1.1 Horizon Europe — Cluster 3: Civil Security for Society (call `HORIZON-CL3-2026-01`)
- **Relevant topics:** `HORIZON-CL3-2026-01-SSRI-04` — *"Development of ecosystem and next-generation capabilities for a secured European Critical Communication System in civil security"* — and Disaster-Resilient Society topics `HORIZON-CL3-2026-01-DRS-01…04`.
- **Official Source:** [REA — Disaster-Resilient Society](https://rea.ec.europa.eu/funding-and-grants/horizon-europe-cluster-3-civil-security-society/disaster-resilient-society-europe_en) and the EU Funding & Tenders Portal.
- **Deadline:** **5 November 2026, 17:00 Brussels time.**
- **Eligibility:** Multi-beneficiary consortia (typically ≥3 entities from ≥3 eligible countries) and, for most security topics, mandatory practitioner participation.
- **Honest fit:** SSRI-04 targets mission-critical communications for responders (EUCCS), not citizen check-in apps. OEP could at most contribute a narrow open-source work package. With ~15 days left, leading a proposal is not realistic; the only viable move is offering a small partner/subcontract role to an existing consortium.
- **Current Action Status:** Not submitted.

### 1.2 NLnet Foundation — Open Internet Stack funds (successor to NGI Zero)
- **Official Source:** [NLnet — Propose](https://nlnet.nl/propose/)
- **Status:** The NGI Zero Commons Fund closed its final call on **1 June 2026**. Current funds include the **Restack Fund** and **CodeSupply Fund**, plus a general proposal route. Deadlines fall on the **3rd of every odd month**; **next: 3 November 2026, 12:00 CET.**
- **Grant Range:** Typically **€5,000–€50,000** initial grants; open licenses required; European dimension required.
- **AI policy (critical, corrected 23 Oct 2026):** NLnet **v2.0 effective 20 Oct 2026** prohibits generative AI use for **any proposal writing, ideas, restructuring, shortening or LLM translation**, except declared accessibility support. During funded work, generative AI is permitted **read-only** for review, not to generate code, design or documentation; AI costs are ineligible. Existing AI-generated code must be disclosed and its acceptance is case-specific; a heavily agent-generated codebase is a material eligibility concern. **Do not copy AI-generated application prose from this document into NLnet's form.** Primary sources: https://nlnet.nl/foundation/policies/generativeAI/2.0/ and https://nlnet.nl/foundation/policies/generativeAI/faq/ .
- **Fit for OEP:** Best realistic first grant, *if* scoped as reusable open internet infrastructure (an open, transport-agnostic store-and-forward + verifiable-receipt library with an AOSP transport), not as an "emergency app".

### 1.3 Union Civil Protection Mechanism (UCPM) — KAPP (Knowledge for Action in Prevention & Preparedness)
- **Official Source:** [EU Civil Protection Knowledge Network — KAPP 2026 Call](https://civil-protection-knowledge-network.europa.eu/knowledge-action-prevention-preparedness-2026-call-proposals)
- **Call Status:** The 2026 call (`UCPM-2026-KAPP`) closed on **21 May 2026**.
- **Strategy:** Track the **2027 UCPM KAPP call** alongside municipal civil-protection partners to fund multi-agency field exercises (TRL 5–6).

### 1.4 EIC Accelerator / EIC Pathfinder (Horizon Europe Pillar III)
- **Official Source:** [European Innovation Council (EIC)](https://eic.ec.europa.eu/)
- **Fit & Timing:** EIC Pathfinder (TRL 1–4 consortium research) or EIC Accelerator (TRL 5–6+ deep-tech SME scaling, grants up to €2.5M + equity). OEP's independently substantiated TRL is UNKNOWN (simulations and Android source do not establish field TRL); EIC Accelerator should only be targeted after completing M1–M3 field validation and incorporating an operating SME.

---

## 2. Netherlands National & Regional Instruments (RVO / NWO)

| Program | Agency / Source | Mechanism & Size | Eligibility & OEP Fit |
|---|---|---|---|
| **WBSO (Wet Bevordering Speur- en Ontwikkelingswerk)** | [RVO.nl — WBSO](https://www.rvo.nl/subsidies-financiering/wbso) | Fiscal R&D wage-tax credit / deduction (36% up to €380k R&D wage base; fixed deduction for self-employed *zelfstandigen* logging $\ge 500$ R&D hours/year). | Directly applicable to technical software R&D on novel routing algorithms, store-and-forward protocols, and Android radio transport engineering in the Netherlands. |
| **MIT Regeling (Mkb-innovatiestimulering Regio en Topsectoren)** | [RVO.nl — MIT Haalbaarheidsprojecten & R&D-samenwerkingsprojecten](https://www.rvo.nl/subsidies-financiering/mit) | Feasibility study grants (up to 40% of costs, typically €20k) and SME R&D collaboration grants (€50k–€350k). | Ideal for funding a Dutch feasibility & field-validation study (TRL 4 $\rightarrow$ 5) with a regional safety partner. |
| **Innovatiekrediet** | [RVO.nl — Innovatiekrediet](https://www.rvo.nl/subsidies-financiering/innovatiekrediet) | Risk-bearing R&D loan (25–45% of project cost) for technical development with commercial perspective. | Relevant at TRL 5–6 once enterprise/institutional licensing pilots are signed. |
| **NWO Take-off (Phase 1 Feasibility)** | [NWO — Take-off](https://www.nwo.nl/onderzoeksprogrammas/take) | €40,000 feasibility study grant for academic/knowledge-institution spin-offs. | Applicable if partnering with a Dutch university lab (e.g., TU Delft, UT, TNO). |
