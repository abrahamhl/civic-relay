# SENDA PCI v0.1 — Proof-Carrying Inference

**Status:** public working draft · 07-11-2026  
**Editors:** Abraham Haddioui  
**License:** MIT  
**Reference implementation:** `@senda/pci` 0.1.0

## Abstract

PCI is a small JSON envelope for numerical claims produced by software that may
run offline. It binds a displayed number to its inputs, method, tolerances,
provenance class, limitations, and a SHA-256 digest. A verifier can reject a
claim whose inputs, result, display, provenance, or signature have changed.

The word *proof* is used in the engineering sense: a machine-checkable evidence
bundle. PCI is **not** a zero-knowledge proof, a proof of computational
integrity, or a substitute for independent scientific review.

## 1. Conventions and terminology

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119.

- **Claim** — one numerical statement and its evidence envelope.
- **Producer** — software that creates and seals a claim.
- **Verifier** — software that checks a claim without trusting the producer.
- **Raw value** — the finite IEEE-754 double in `result.value`.
- **Display** — the exact text shown to a human and the rule that maps the raw
  value to that text.
- **Seal** — the SHA-256 digests in `integrity`.
- **Provenance class** — the epistemic status of the claim.

## 2. Canonical JSON

A claim MUST be representable as JSON without loss. The canonical form is:

1. UTF-8, no byte-order mark.
2. Strings normalized to Unicode NFC.
3. Object keys sorted lexicographically by their NFC-normalized form. Keys that
   collide after normalization MUST be rejected.
4. No insignificant whitespace. `,` and `:` are the only separators.
5. Numbers MUST be finite and serialized by the ECMAScript `JSON.stringify`
   algorithm. `-0` MUST be serialized as `0`.
6. `NaN`, `Infinity`, `undefined`, functions, symbols, big integers, dates,
   class instances, and cyclic structures MUST be rejected.
7. Arrays preserve order. Object key order is not significant.

Test vector:

```text
input:       { "b": 1, "a": "é" }
canonical:   {"a":"é","b":1}
SHA-256:     aa58fba8483623bed37c1b02edfccbdd9a53123837c20bfa4cb4049993a2872e
```

The canonicalization identifier is `senda-pci-canonical/1`.

## 3. Envelope

A claim has the following members.

| Member | Type | Requirement |
|---|---|---|
| `pci` | string | MUST equal `senda-pci/0.1` |
| `claimId` | string | 3–96 chars: letters, digits, `.`, `_`, `:`, `-` |
| `model` | object | `id`, `version`; optional `reference` |
| `inputs` | object | All numeric and categorical inputs |
| `method` | object | `name`, `exact`; optional `tolerances`, `seed` |
| `result` | object | `value`, optional `unit`, required `display` |
| `provenance` | object | `class` plus class-specific evidence |
| `limitations` | array | At least one non-empty string |
| `reproduce` | object | At least a `command` |
| `integrity` | object | Added by the sealer |
| `signature` | object | Optional ECDSA P-256 profile |

Example:

```json
{
  "pci": "senda-pci/0.1",
  "claimId": "seir.mass-error.example",
  "model": {
    "id": "senda.seir",
    "version": "1.0.0",
    "reference": "investor-next/lib/precision-lab.mjs"
  },
  "inputs": {
    "population": 1000,
    "beta": 0.5,
    "gamma": 0.2,
    "days": 30,
    "step": 0.25
  },
  "method": {
    "name": "Dormand-Prince RK45",
    "exact": false,
    "tolerances": { "relative": 1e-9, "absolute": 1e-12 }
  },
  "result": {
    "value": 1.8e-12,
    "unit": "dimensionless",
    "display": { "text": "< 1e-9", "rule": "upper-bound", "bound": 1e-9 }
  },
  "provenance": {
    "class": "SIMULATED",
    "note": "Numerical mass conservation error; not a field measurement."
  },
  "limitations": [
    "The raw error varies by JavaScript runtime; the display bound is the contract."
  ],
  "reproduce": { "command": "node examples/verify-claim.mjs" },
  "integrity": {
    "algorithm": "SHA-256",
    "canonical": "senda-pci-canonical/1",
    "payloadDigest": "<64 hex>",
    "inputsDigest": "<64 hex>",
    "resultDigest": "<64 hex>"
  }
}
```

## 4. Integrity

The **payload** is the claim with `integrity` and `signature` removed.

The sealer MUST compute:

```text
payloadDigest = SHA-256(canonical(payload))
inputsDigest  = SHA-256(canonical(inputs))
resultDigest  = SHA-256(canonical(result))
```

All three digests MUST be lowercase hexadecimal, without a `sha256:` prefix,
inside `integrity`. A verifier MUST recompute all three and reject any mismatch.

Sealing is idempotent: re-sealing a sealed claim produces the same three
digests because `integrity` and `signature` are outside the payload.

A digest detects accidental or at-rest modification. It does **not** prove that
the producer executed the declared method, and it does not protect against a
compromised runtime that lies before sealing.

## 5. Display rules

`result.display.text` is the exact human-visible string. `result.display.rule`
declares how the raw value maps to that string. A verifier MUST recompute the
expected text and require byte-for-byte equality, including suffix.

Optional `display.scale` (finite, default `1`) multiplies the raw value before
formatting. Optional `display.suffix` is appended verbatim.

### 5.1 `fixed:N`

Format `(value × scale)` with ECMAScript `Number.prototype.toFixed(N)`, where
`N` is 0–12. Append the suffix. Example: value `0.99749`, scale `100`,
suffix `%`, rule `fixed:3` → `99.749%`.

### 5.2 `significant:N`

Format `(value × scale)` with ECMAScript `Number.prototype.toPrecision(N)`,
where `N` is 1–15. Append the suffix.

### 5.3 `upper-bound`

The raw value is an error or uncertainty that is bounded above. `display.bound`
is a finite non-negative number in raw units. The text MUST be exactly:

```text
< BOUND[suffix]     (strict; value < bound)
≤ BOUND[suffix]     (inclusive; value ≤ bound)
```

`BOUND` is the ECMAScript `String(bound)` form. Example: bound `1e-9` with raw
value `1.8e-12` → `< 1e-9`.

### 5.4 `exact-integer`

The raw value MUST be an integer. The text MUST be `String(value) + suffix`.
`scale` MUST be `1`.

### 5.5 Cross-runtime rule

If the raw value can differ across JavaScript engines, the claim MUST use an
`upper-bound` (or a future interval rule), not `fixed` or `significant`. A
display rule is a contract about text, not a promise that floating-point results
are bit-identical.

## 6. Provenance classes

| Class | Meaning | Required evidence |
|---|---|---|
| `EXERCISE` | Declared exercise range; not a measurement | `note` disclaiming field status; limitations |
| `SIMULATED` | Output of a model or simulation | Method, tolerances, limitations |
| `FIELD` | Traceable field observation | `source`, `sourceDigest` |
| `VALIDATED` | Independently contrasted observation | `source`, `sourceDigest` |
| `DERIVED` | Computed from other claims | Non-empty `parents` array |

`sourceDigest` MUST be `sha256:<64 lowercase hex>`. A verifier MUST reject a
`FIELD` or `VALIDATED` claim without it. A verifier MUST reject an `EXERCISE`
claim without a disclaimer in `provenance.note`.

A `DERIVED` claim’s `parents` are claim IDs. PCI v0.1 does not define a
transitive closure format; a claim set verifier MAY resolve parents and SHOULD
report unresolved parents.

## 7. Verification levels

A verifier returns `ok`, `level`, `errors`, `warnings`, `signature`, and any
computed digests.

| Level | Checks | Failure effect |
|---|---|---|
| L0 | Structure and types | `ok: false`, `level: 0` |
| L1 | Three digests | `ok: false`, `level: 0` |
| L2 | Display text matches rule | `ok: false`, `level: 1` |
| L3 | Provenance evidence | `ok: false`, `level: 2` |
| L4 | ECDSA signature | `ok: false` if a key was supplied and failed |

Rules:

- A verifier MUST NOT report L2 if L1 failed.
- A verifier MAY report L3 for an unsigned claim.
- If a signature is present and no public key is supplied, the verifier MUST
  warn (`SIGNATURE_NOT_VERIFIED`) and MUST NOT report L4.
- A verifier MUST use constant-time comparisons for signature verification and
  SHOULD avoid leaking which digest failed when operating against an adversary.

## 8. Signature profile

The optional profile is ECDSA over P-256 with SHA-256.

- Signature input: the UTF-8 bytes of `integrity.payloadDigest`.
- `signature.alg` MUST be `ECDSA-P256-SHA256`.
- `signature.value` MUST be base64url without padding, encoding the raw
  `r || s` signature (IEEE P1363), as produced by Web Crypto.
- `signature.keyId` is an opaque string for key selection.

The signature does not cover `signature` itself. The payload digest covers all
claim content except `integrity` and `signature`.

Key distribution, revocation, and trust anchors are outside PCI v0.1. A
signature proves possession of a private key, not the truth of the claim.

## 9. Claim sets

A claim set is an array of sealed claims with unique `claimId` values. The set
digest is:

```text
SHA-256(canonical({
  "pci": "senda-pci/0.1",
  "claims": [
    { "claimId": "...", "payloadDigest": "..." },
    ...
  ]
}))
```

Entries are sorted by `claimId` using code-unit order. Duplicate or unsealed
claims MUST be rejected. The set digest binds membership and order-independent
identity; it is not a Merkle tree and does not support inclusion proofs in v0.1.

## 10. Security considerations

**Threat model.** PCI targets tampering at rest or in transit, accidental drift
between releases, and mislabeling of a number’s epistemic status. It does not
target a compromised browser, a malicious producer that fabricates inputs, or a
side channel in the verifier.

- Hashes are not signatures. Anyone can re-seal a modified claim.
- A valid signature means the signer approved the payload, not that the payload
  is true.
- `EXERCISE` claims are not field evidence, even when signed.
- A verifier MUST NOT execute `reproduce.command` automatically.
- Inputs may contain personal or operational data; PCI does not define
  redaction. Producers SHOULD minimize inputs and SHOULD hash sensitive values
  when the method permits.
- SHA-256 and ECDSA P-256 are used as widely deployed primitives. PCI v0.1 does
  not define post-quantum signatures.

## 11. Prior art and scope

PCI is informed by, and does not replace:

- W3C PROV for provenance graphs;
- in-toto and SLSA for supply-chain attestations;
- C2PA for content provenance;
- RO-Crate for research objects;
- model cards and datasheets for dataset/model documentation;
- proof-carrying data and verifiable computation for cryptographic integrity;
- unit and round-trip testing for display formatting.

The specific combination in PCI is: a **numeric display claim** with an explicit
formatting contract, a provenance class, reproducibility metadata, and an
offline verifier in one small envelope. That combination is the contribution of
this draft. No claim of priority over unrelated attestation formats is made.

## 12. Versioning

PCI uses `senda-pci/MAJOR.MINOR`. A verifier MUST reject an unknown major
version. A minor version MUST be backward compatible: new optional members may
be added; existing required semantics MUST NOT change. The canonicalization
identifier changes only if the byte-level encoding changes.

## 13. Conformance

A conforming implementation MUST:

1. produce canonical JSON per Section 2;
2. seal and verify all three digests;
3. enforce the display rule in Section 5;
4. enforce provenance requirements in Section 6;
5. report verification levels in Section 7;
6. reject invalid claims rather than silently repairing them.

The reference test suite is `test/pci.test.mjs`. Independent implementations are
encouraged; the test vectors in this document are normative only where marked.

## Appendix A — Minimal verify

```js
import { verifyClaim } from "@senda/pci";

const result = await verifyClaim(JSON.parse(claimJson), { publicKeyJwk });
if (!result.ok) {
  console.error(result.errors);
  process.exit(1);
}
console.log(`verified at L${result.level}`);
```

## Appendix B — Non-claims

PCI v0.1 does **not**:

- prove that a floating-point computation is correct;
- prove that a model is scientifically valid;
- certify an emergency response;
- replace peer review, field trials, or a security audit;
- make an `EXERCISE` prior into evidence.
