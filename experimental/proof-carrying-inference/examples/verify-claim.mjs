import {
  PCI_VERSION,
  createClaim,
  generateKeyPair,
  signClaim,
  verifyClaim
} from "../src/index.mjs";

const claim = await createClaim({
  pci: PCI_VERSION,
  claimId: "seir.mass-error.example",
  model: {
    id: "senda.seir",
    version: "1.0.0",
    reference: "investor-next/lib/precision-lab.mjs"
  },
  inputs: {
    population: 1000,
    beta: 0.5,
    gamma: 0.2,
    days: 30,
    step: 0.25
  },
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

const pair = await generateKeyPair();
const signed = await signClaim(claim, pair.privateKeyJwk, { keyId: "senda-example" });
const verification = await verifyClaim(signed, { publicKeyJwk: pair.publicKeyJwk });
const tampered = await verifyClaim(
  { ...signed, result: { ...signed.result, value: 1 } },
  { publicKeyJwk: pair.publicKeyJwk }
);

console.log(
  JSON.stringify(
    {
      claimId: signed.claimId,
      payloadDigest: signed.integrity.payloadDigest,
      verification,
      tamperCheck: { ok: tampered.ok, errors: tampered.errors.map((error) => error.code) }
    },
    null,
    2
  )
);

if (!verification.ok || verification.level !== 4 || tampered.ok) {
  process.exitCode = 1;
}
