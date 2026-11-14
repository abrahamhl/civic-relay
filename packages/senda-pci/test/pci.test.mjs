import test from "node:test";
import assert from "node:assert/strict";

import {
  PCI_VERSION,
  PCIError,
  canonicalize,
  checkDisplay,
  claimSetDigest,
  createClaim,
  generateKeyPair,
  sealClaim,
  sha256Hex,
  signClaim,
  validateClaimShape,
  verifyClaim,
  verifyClaimSignature
} from "../src/index.mjs";

const DIGEST = `sha256:${"a".repeat(64)}`;

function baseClaim(overrides = {}) {
  return {
    pci: PCI_VERSION,
    claimId: "seir-mass-error.demo",
    model: {
      id: "senda.seir",
      version: "1.0.0",
      reference: "investor-next/lib/precision-lab.mjs"
    },
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
    limitations: ["Raw error varies by runtime; the displayed bound is the contract."],
    reproduce: { command: "node examples/verify-claim.mjs" },
    ...overrides
  };
}

async function sealed(overrides = {}) {
  return sealClaim(baseClaim(overrides));
}

test("canonicalization sorts keys, normalizes Unicode, and normalizes -0", () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalize({ value: "e\u0301" }), canonicalize({ value: "\u00e9" }));
  assert.equal(canonicalize({ zero: -0 }), '{"zero":0}');
  assert.equal(canonicalize([1, "x", true, null]), '[1,"x",true,null]');
});

test("canonicalization rejects non-JSON and cyclic values", () => {
  assert.throws(() => canonicalize({ value: NaN }), (error) => error.code === "NON_FINITE_NUMBER");
  assert.throws(
    () => canonicalize({ value: Infinity }),
    (error) => error.code === "NON_FINITE_NUMBER"
  );
  assert.throws(() => canonicalize({ value: new Date() }), (error) => error.code === "NON_PLAIN_OBJECT");
  assert.throws(
    () => canonicalize({ value: () => 1 }),
    (error) => error.code === "UNSUPPORTED_TYPE"
  );
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalize(cyclic), (error) => error.code === "CYCLIC_VALUE");
});

test("canonicalization rejects keys that collide after NFC normalization", () => {
  const collision = {};
  collision["e\u0301"] = 1;
  collision["\u00e9"] = 2;
  assert.throws(() => canonicalize(collision), (error) => error.code === "DUPLICATE_KEY");
});

test("a sealed claim verifies at L3 with three digests", async () => {
  const claim = await sealed();
  const result = await verifyClaim(claim);
  assert.equal(result.ok, true);
  assert.equal(result.level, 3);
  assert.equal(result.signature, "absent");
  assert.match(result.digests.payloadDigest, /^[0-9a-f]{64}$/);
  assert.match(claim.integrity.inputsDigest, /^[0-9a-f]{64}$/);
});

test("sealing is idempotent", async () => {
  const first = await sealed();
  const second = await sealClaim(first);
  assert.equal(first.integrity.payloadDigest, second.integrity.payloadDigest);
  assert.deepEqual(first.integrity, second.integrity);
});

test("tampering inputs or result is detected by integrity checks", async () => {
  const claim = await sealed();
  const inputTamper = { ...claim, inputs: { ...claim.inputs, beta: 0.6 } };
  const inputResult = await verifyClaim(inputTamper);
  assert.equal(inputResult.ok, false);
  assert.equal(inputResult.level, 0);
  assert.ok(inputResult.errors.some((entry) => entry.code === "INTEGRITY_MISMATCH"));

  const resultTamper = { ...claim, result: { ...claim.result, value: 0 } };
  const resultResult = await verifyClaim(resultTamper);
  assert.equal(resultResult.ok, false);
  assert.ok(resultResult.errors.some((entry) => entry.code === "INTEGRITY_MISMATCH"));
});

test("display rules are checked independently of the seal", async () => {
  const claim = await sealClaim(
    baseClaim({
      result: {
        value: 1.8e-12,
        display: { text: "1.8e-12", rule: "upper-bound", bound: 1e-9 }
      }
    })
  );
  const result = await verifyClaim(claim);
  assert.equal(result.ok, false);
  assert.equal(result.level, 1);
  assert.ok(result.errors.some((entry) => entry.code === "DISPLAY_BOUND_SYMBOL"));
});

test("fixed displays support scales and suffixes", async () => {
  const claim = await sealed({
    claimId: "calibration.probability.demo",
    result: {
      value: 0.99749,
      display: { text: "99.749%", rule: "fixed:3", scale: 100, suffix: "%" }
    }
  });
  const result = await verifyClaim(claim);
  assert.equal(result.ok, true);
  assert.equal(result.level, 3);
});

test("upper bounds are strict and inclusive when declared", async () => {
  const strict = await sealed({
    result: {
      value: 1e-9,
      display: { text: "< 1e-9", rule: "upper-bound", bound: 1e-9 }
    }
  });
  const strictResult = await verifyClaim(strict);
  assert.equal(strictResult.ok, false);
  assert.ok(strictResult.errors.some((entry) => entry.code === "DISPLAY_BOUND_EXCEEDED"));

  const inclusive = await sealed({
    result: {
      value: 1e-9,
      display: { text: "≤ 1e-9", rule: "upper-bound", bound: 1e-9 }
    }
  });
  const inclusiveResult = await verifyClaim(inclusive);
  assert.equal(inclusiveResult.ok, true);
});

test("exact-integer refuses fractional values", async () => {
  const claim = await sealed({
    result: {
      value: 42.5,
      display: { text: "42.5", rule: "exact-integer" }
    }
  });
  const result = await verifyClaim(claim);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === "DISPLAY_NOT_INTEGER"));
});

test("EXERCISE requires a disclaimer and FIELD requires a source digest", () => {
  const exercise = baseClaim({
    provenance: { class: "EXERCISE" }
  });
  const exerciseErrors = validateClaimShape(exercise);
  assert.ok(exerciseErrors.some((entry) => entry.code === "EXERCISE_NOTE_REQUIRED"));

  const field = baseClaim({
    provenance: { class: "FIELD", source: "trial-001" }
  });
  const fieldErrors = validateClaimShape(field);
  assert.ok(fieldErrors.some((entry) => entry.code === "PROVENANCE_DIGEST_REQUIRED"));

  const validField = baseClaim({
    provenance: { class: "FIELD", source: "trial-001", sourceDigest: DIGEST }
  });
  assert.deepEqual(validateClaimShape(validField), []);
});

test("DERIVED claims require at least one parent", () => {
  const derived = baseClaim({
    provenance: { class: "DERIVED", parents: ["claim.a", "claim.b"] }
  });
  assert.deepEqual(validateClaimShape(derived), []);
  const invalid = baseClaim({ provenance: { class: "DERIVED", parents: [] } });
  assert.ok(validateClaimShape(invalid).some((entry) => entry.code === "PROVENANCE_PARENTS_REQUIRED"));
});

test("createClaim forces the current version and seals the payload", async () => {
  const spec = baseClaim({ pci: "senda-pci/9.9", integrity: undefined });
  const claim = await createClaim(spec);
  assert.equal(claim.pci, PCI_VERSION);
  assert.match(claim.integrity.payloadDigest, /^[0-9a-f]{64}$/);
});

test("signatures verify at L4 and fail after tampering", async () => {
  const pair = await generateKeyPair();
  const claim = await sealed();
  const signed = await signClaim(claim, pair.privateKeyJwk, { keyId: "senda-demo-2026" });

  const valid = await verifyClaim(signed, { publicKeyJwk: pair.publicKeyJwk });
  assert.equal(valid.ok, true);
  assert.equal(valid.level, 4);
  assert.equal(valid.signature, "valid");

  const unverified = await verifyClaim(signed);
  assert.equal(unverified.ok, true);
  assert.equal(unverified.level, 3);
  assert.equal(unverified.signature, "unverified");
  assert.ok(unverified.warnings.some((entry) => entry.code === "SIGNATURE_NOT_VERIFIED"));

  const tampered = {
    ...signed,
    signature: { ...signed.signature, value: signed.signature.value.slice(0, -2) + "AA" }
  };
  assert.equal(await verifyClaimSignature(tampered, pair.publicKeyJwk), false);
  const invalid = await verifyClaim(tampered, { publicKeyJwk: pair.publicKeyJwk });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.signature, "invalid");
});

test("claim set digests are order independent and reject duplicates", async () => {
  const first = await sealed({ claimId: "claim.alpha" });
  const second = await sealed({ claimId: "claim.beta" });
  const left = await claimSetDigest([first, second]);
  const right = await claimSetDigest([second, first]);
  assert.equal(left, right);
  await assert.rejects(
    () => claimSetDigest([first, first]),
    (error) => error instanceof PCIError && error.code === "CLAIM_SET_DUPLICATE"
  );
});

test("NFC-equivalent strings produce the same digest", async () => {
  const composed = await sealed({
    claimId: "unicode.demo",
    model: { id: "caf\u00e9", version: "1.0.0" }
  });
  const decomposed = await sealed({
    claimId: "unicode.demo",
    model: { id: "cafe\u0301", version: "1.0.0" }
  });
  assert.equal(composed.integrity.payloadDigest, decomposed.integrity.payloadDigest);
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("checkDisplay is usable without sealing", () => {
  assert.deepEqual(
    checkDisplay({
      value: 0.5,
      display: { text: "50.0%", rule: "fixed:1", scale: 100, suffix: "%" }
    }),
    []
  );
});
