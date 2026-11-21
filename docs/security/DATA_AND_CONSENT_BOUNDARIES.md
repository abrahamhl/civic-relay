# Data, Privacy, and Consent Boundaries — OEP / Civic Relay

**Document Status:** `IMPLEMENTED` / `AUTOMATED_TESTED`  
**Regulatory Alignment Target:** EU GDPR data-minimization principles & voluntary civic participation ethics.

---

## 1. Core Privacy & Consent Principles

1. **Explicit Opt-In Participation Only:**
   - In the simulation engine (`investor-next/lib/emergency-routing.mjs`), non-participating devices (`participating: false`) never receive status prompts, never generate messages, and never act as relay hops.
   - In the store-and-forward engine (`investor-next/lib/store-forward.mjs`), `enqueue()` throws `Error('Explicit consent required')` unless `consented === true`.
   - In the Android Nearby lab (`experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/MainActivity.java`), radio advertisement/discovery and payload transmission are blocked until the operator explicitly checks the laboratory consent box and confirms the Nearby authentication digits.

2. **No Silent Casualty or Location Inference (`UNKNOWN !== INJURED`):**
   - Device silence or lack of connectivity is recorded strictly as `UNKNOWN` or `NO_CONTACT`.
   - OEP never infers human injury, entrapment, or safety from non-response (`investor-next/lib/emergency-policy.mjs` → `humanStatusOutcome()`).
   - Building floor and `(x, y)` coordinates in the 3D scenario are normalized synthetic topology units (`0.02..0.98`), never GPS or indoor triangulation measurements.

3. **Zero Server-Side Personal Data Collection:**
   - The investor and research web application (`investor-next/`) is compiled as a static export (`output: 'export'`).
   - All scenario adjustments, human check-in sandbox actions (`human-safety-panel.tsx`), and store-and-forward queue operations (`transport-sandbox.tsx`) execute 100% locally in browser memory.
   - Exporting evidence (`exportSyntheticEvidence()`) generates a local browser download containing only deterministic synthetic scenario parameters and seeded model outputs (`kind: 'OEP_SYNTHETIC_EVIDENCE_EXPORT'`).

4. **Bounded Retention, Revocation & Complete Purge:**
   - Every queued exercise message requires an explicit integer `ttlSeconds` ($1..86400\text{ s}$).
   - When a message reaches `ACK_SYNTHETIC`, `EXPIRED`, `REVOKED`, or `EXHAUSTED`, its `envelope` payload is immediately cleared (`r.envelope = null`).
   - Calling `purge(id)` in `store-forward.mjs` wipes the payload, deletes the record, and removes all audit entries for that message ID.
   - In the Android Nearby lab, tapping `STOP & CLEAR` invokes the STOP handler in `MainActivity.java`, stops all Nearby endpoints, clears the in-memory CSV trial rows, and wipes the on-screen log.

---

## 2. Data Boundary Summary Table

| Subsystem | Data Processed | Storage Location | Retention | User Revocation Mechanism |
|---|---|---|---|---|
| **3D Scenario Simulator (`coordination-lab.tsx`)** | Seeded virtual node counts, synthetic sliders | Browser RAM (React state) | Session only | `RESET EXPERIMENT` button or page reload |
| **Human Check-In Sandbox (`human-safety-panel.tsx`)** | Voluntary synthetic button click (`SAFE`, `SOS_EXPLICIT`, `OTHERS_AFFECTED`, `CANNOT_DETERMINE`) | Browser RAM (React state) | Session / TTL | `REVOKE / CLEAR` button in panel |
| **Store-and-Forward Sandbox (`transport-sandbox.tsx`)** | Fictional `EXERCISE_0001` envelopes (`payload: { fictionalNode: true }`) | Browser RAM (`Map` capped at 20 entries in UI, 1000 in engine) | Until TTL (60s) or clear | `CLEAR LAB DATA` (`engine.purge(id)`) |
| **Android Nearby Lab (`MainActivity.java`)** | Synthetic `EXPERIMENT_PING` / `EXPERIMENT_ACK`, RSSI/battery/latency metadata | App RAM; optional operator-initiated `ACTION_CREATE_DOCUMENT` CSV export | Session only unless operator saves CSV | `STOP & CLEAR` button wipes memory & increments epoch |
