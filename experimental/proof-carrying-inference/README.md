# @senda/pci

**Proof-Carrying Inference** — a checkable evidence envelope for offline numeric
claims. Part of the SENDA precision stack.

- **Status:** 0.1.0 working draft, not peer reviewed.
- **License:** MIT.
- **Runtime:** Node.js 20+ or a modern browser with Web Crypto.
- **Dependencies:** none.

## Why

A number on a screen is usually not reproducible. You get the number, maybe a
chart, and no way to know which inputs, method, tolerance, or rounding rule
produced it.

PCI wraps the number in a small JSON envelope and seals it with SHA-256. A
verifier checks the structure, the digests, the display rule, the provenance
class, and an optional ECDSA P-256 signature. The whole check works offline.

PCI is an **evidence envelope**, not a cryptographic proof of execution. It does
not prove that the producer ran the declared method, and it does not replace
peer review or a security audit.

## Install

The package is not published to npm yet. Use it from this repository:

```bash
cd packages/senda-pci
node --test "test/*.test.mjs"
```

When published, the intended install is `npm install @senda/pci`.

## Quick start

```js
import { createClaim, verifyClaim } from "./src/index.mjs";

const claim = await createClaim({
  claimId: "seir.mass-error.example",
  model: { id: "senda.seir", version: "1.0.0" },
  inputs: { population: 1000, beta: 0.5, gamma: 0.2, days: 30, step: 0.25 },
  method: {
    name: "Dormand-Prince RK45",
    exact: false,
    tolerances: { relative: 1e-9, absolute: 1e-12 }
  },
  result: {
    value: 1.8e-12,
    unit: "dimensionless",
    display: { text: "< 1e-9", rule: "upper-bound", bound: 1e-9 }
  },
  provenance: {
    class: "SIMULATED",
    note: "Numerical mass conservation error; not a field measurement."
  },
  limitations: [
    "The raw error varies by JavaScript runtime; the display bound is the contract."
  ],
  reproduce: { command: "node examples/verify-claim.mjs" }
});

const result = await verifyClaim(claim);
console.log(result.ok, result.level);
```

A valid unsigned claim reaches **L3**. Add a signature to reach **L4**:

```js
import { generateKeyPair, signClaim, verifyClaim } from "./src/index.mjs";

const pair = await generateKeyPair();
const signed = await signClaim(claim, pair.privateKeyJwk, { keyId: "demo-2026" });
const checked = await verifyClaim(signed, { publicKeyJwk: pair.publicKeyJwk });
console.log(checked.level); // 4
```

## CLI

```bash
node bin/pci.mjs keygen --private private.jwk.json --public public.jwk.json
node bin/pci.mjs seal claim.json --out claim.sealed.json
node bin/pci.mjs verify claim.sealed.json --public-key public.jwk.json
node bin/pci.mjs sign claim.sealed.json --private-key private.jwk.json --key-id demo
node bin/pci.mjs digest paper.pdf
node bin/pci.mjs set claim-a.json claim-b.json
```

Exit codes: `0` ok, `1` verification failed, `2` usage or I/O error.

## Verification levels

| Level | Check |
|---|---|
| L0 | Shape and types |
| L1 | Payload, inputs, result digests |
| L2 | Display text matches the declared rule |
| L3 | Provenance evidence |
| L4 | ECDSA P-256 signature (when a public key is supplied) |

## Display rules

- `fixed:N` — `toFixed(N)`, optional `scale` and `suffix`.
- `significant:N` — `toPrecision(N)`, optional `scale` and `suffix`.
- `upper-bound` — text must be `< bound` or `≤ bound`.
- `exact-integer` — text must be the integer plus optional suffix.

If a raw value can change between JavaScript engines, use `upper-bound`; do not
pretend that `fixed` output is a cross-runtime guarantee.

## Provenance

`EXERCISE`, `SIMULATED`, `FIELD`, `VALIDATED`, `DERIVED`.

`EXERCISE` requires a disclaimer. `FIELD` and `VALIDATED` require a source and a
`sha256:<64 hex>` source digest. `DERIVED` requires parent claim IDs.

## Security

- A hash is not a signature; anyone can re-seal a modified claim.
- A signature is not truth; it only binds a key to a payload.
- PCI does not protect against a compromised runtime.
- Do not execute `reproduce.command` automatically.
- Key distribution and revocation are outside v0.1.

Read [SPEC.md](./SPEC.md) for the normative details and the non-claims.

## Papers

The standard is accompanied by three technical reports:

1. **SENDA-TR-2026-01** — Proof-Carrying Inference for Offline Emergency Software.
2. **SENDA-TR-2026-02** — Exact Erasure Tails and Delay Bounds for
   Store-Carry-Forward Emergency Messaging.
3. **SENDA-TR-2026-03** — Display Determinism Across JavaScript Runtimes for
   Adaptive ODE Solvers.

They are published at `/research` on the SENDA site. They are technical reports,
not peer-reviewed publications.

## Development

```bash
node --test "test/*.test.mjs"
node examples/verify-claim.mjs
```

## License

MIT. See [LICENSE](./LICENSE).
