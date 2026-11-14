export const PCI_VERSION = "senda-pci/0.1";
export const PCI_CANONICAL = "senda-pci-canonical/1";
export const PCI_ALGORITHM = "SHA-256";

export const PROVENANCE_CLASSES = Object.freeze([
  "EXERCISE",
  "SIMULATED",
  "FIELD",
  "VALIDATED",
  "DERIVED"
]);

const CLAIM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const DISPLAY_RULE = /^(fixed|significant):(\d{1,2})$|^upper-bound$|^exact-integer$/;

export class PCIError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PCIError";
    this.code = code;
    this.details = details;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalizeValue(value, seen) {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value.normalize("NFC"));
    case "number": {
      if (!Number.isFinite(value)) {
        throw new PCIError("NON_FINITE_NUMBER", "PCI does not permit NaN or Infinity.");
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    case "object": {
      if (seen.has(value)) {
        throw new PCIError("CYCLIC_VALUE", "PCI does not permit cyclic structures.");
      }
      seen.add(value);
      try {
        if (Array.isArray(value)) {
          return `[${value.map((entry) => canonicalizeValue(entry, seen)).join(",")}]`;
        }
        if (!isPlainObject(value)) {
          throw new PCIError(
            "NON_PLAIN_OBJECT",
            "PCI only permits plain objects; convert dates and class instances to strings."
          );
        }
        const keys = Object.keys(value)
          .filter((key) => value[key] !== undefined)
          .map((key) => key.normalize("NFC"))
          .sort();
        for (let index = 1; index < keys.length; index += 1) {
          if (keys[index] === keys[index - 1]) {
            throw new PCIError(
              "DUPLICATE_KEY",
              `Two keys collide after NFC normalization: ${keys[index]}`
            );
          }
        }
        const entries = keys.map((key) => {
          const originalKey = Object.keys(value).find(
            (candidate) => candidate.normalize("NFC") === key
          );
          return `${JSON.stringify(key)}:${canonicalizeValue(value[originalKey], seen)}`;
        });
        return `{${entries.join(",")}}`;
      } finally {
        seen.delete(value);
      }
    }
    default:
      throw new PCIError(
        "UNSUPPORTED_TYPE",
        `PCI does not permit values of type ${typeof value}.`
      );
  }
}

export function canonicalize(value) {
  return canonicalizeValue(value, new Set());
}

function toUtf8Bytes(value) {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return value;
  throw new PCIError("INVALID_BYTES", "Expected a string or Uint8Array.");
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new PCIError(
      "WEB_CRYPTO_UNAVAILABLE",
      "Web Crypto is required. Use Node.js 20+ or a modern browser."
    );
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", toUtf8Bytes(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function push(errors, code, path, message) {
  errors.push({ code, path, message });
}

function validateDisplay(display, errors) {
  if (!isPlainObject(display)) {
    push(errors, "DISPLAY_NOT_OBJECT", "result.display", "Display must be a plain object.");
    return;
  }
  if (typeof display.text !== "string" || display.text.length === 0) {
    push(errors, "DISPLAY_TEXT_MISSING", "result.display.text", "Display text is required.");
  }
  if (typeof display.rule !== "string" || !DISPLAY_RULE.test(display.rule)) {
    push(
      errors,
      "DISPLAY_RULE_INVALID",
      "result.display.rule",
      "Rule must be fixed:N, significant:N, upper-bound, or exact-integer."
    );
    return;
  }
  if (display.scale !== undefined && !Number.isFinite(display.scale)) {
    push(errors, "DISPLAY_SCALE_INVALID", "result.display.scale", "Scale must be finite.");
  }
  if (display.suffix !== undefined && typeof display.suffix !== "string") {
    push(errors, "DISPLAY_SUFFIX_INVALID", "result.display.suffix", "Suffix must be a string.");
  }
  if (display.rule === "upper-bound") {
    if (!Number.isFinite(display.bound) || display.bound < 0) {
      push(
        errors,
        "DISPLAY_BOUND_INVALID",
        "result.display.bound",
        "Upper-bound displays require a finite, non-negative bound."
      );
    }
    if (display.scale !== undefined) {
      push(
        errors,
        "DISPLAY_SCALE_NOT_ALLOWED",
        "result.display.scale",
        "Upper-bound displays do not accept a scale."
      );
    }
  }
  if (display.rule.startsWith("fixed:")) {
    const digits = Number(display.rule.slice("fixed:".length));
    if (digits > 12) {
      push(errors, "DISPLAY_DIGITS_TOO_LARGE", "result.display.rule", "fixed supports 0..12 digits.");
    }
  }
  if (display.rule.startsWith("significant:")) {
    const digits = Number(display.rule.slice("significant:".length));
    if (digits < 1 || digits > 15) {
      push(
        errors,
        "DISPLAY_DIGITS_INVALID",
        "result.display.rule",
        "significant supports 1..15 digits."
      );
    }
  }
}

function validateProvenance(claim, errors) {
  const provenance = claim.provenance;
  if (!isPlainObject(provenance)) {
    push(errors, "PROVENANCE_NOT_OBJECT", "provenance", "Provenance must be a plain object.");
    return;
  }
  if (!PROVENANCE_CLASSES.includes(provenance.class)) {
    push(
      errors,
      "PROVENANCE_CLASS_INVALID",
      "provenance.class",
      `Class must be one of ${PROVENANCE_CLASSES.join(", ")}.`
    );
  }
  if (provenance.note !== undefined && typeof provenance.note !== "string") {
    push(errors, "PROVENANCE_NOTE_INVALID", "provenance.note", "Note must be a string.");
  }
  if (provenance.class === "EXERCISE") {
    if (typeof provenance.note !== "string" || provenance.note.trim().length === 0) {
      push(
        errors,
        "EXERCISE_NOTE_REQUIRED",
        "provenance.note",
        "EXERCISE claims must say they are not field measurements."
      );
    }
  }
  if (provenance.class === "FIELD" || provenance.class === "VALIDATED") {
    if (typeof provenance.source !== "string" || provenance.source.trim().length === 0) {
      push(errors, "PROVENANCE_SOURCE_REQUIRED", "provenance.source", "Source is required.");
    }
    if (typeof provenance.sourceDigest !== "string" || !DIGEST.test(provenance.sourceDigest)) {
      push(
        errors,
        "PROVENANCE_DIGEST_REQUIRED",
        "provenance.sourceDigest",
        "A lowercase sha256:<64 hex> source digest is required."
      );
    }
  }
  if (provenance.class === "DERIVED") {
    if (
      !Array.isArray(provenance.parents) ||
      provenance.parents.length === 0 ||
      provenance.parents.some((parent) => typeof parent !== "string" || parent.length === 0)
    ) {
      push(
        errors,
        "PROVENANCE_PARENTS_REQUIRED",
        "provenance.parents",
        "DERIVED claims require a non-empty array of parent claim IDs."
      );
    }
  }
}

export function validateClaimShape(claim) {
  const errors = [];
  if (!isPlainObject(claim)) {
    push(errors, "CLAIM_NOT_OBJECT", "", "Claim must be a plain object.");
    return errors;
  }
  if (claim.pci !== PCI_VERSION) {
    push(errors, "VERSION_INVALID", "pci", `Expected ${PCI_VERSION}.`);
  }
  if (typeof claim.claimId !== "string" || !CLAIM_ID.test(claim.claimId)) {
    push(
      errors,
      "CLAIM_ID_INVALID",
      "claimId",
      "Use 3..96 characters: letters, digits, dot, underscore, colon, or hyphen."
    );
  }
  if (!isPlainObject(claim.model)) {
    push(errors, "MODEL_NOT_OBJECT", "model", "Model must be an object.");
  } else {
    if (typeof claim.model.id !== "string" || claim.model.id.length === 0) {
      push(errors, "MODEL_ID_REQUIRED", "model.id", "Model ID is required.");
    }
    if (typeof claim.model.version !== "string" || claim.model.version.length === 0) {
      push(errors, "MODEL_VERSION_REQUIRED", "model.version", "Model version is required.");
    }
    if (claim.model.reference !== undefined && typeof claim.model.reference !== "string") {
      push(errors, "MODEL_REFERENCE_INVALID", "model.reference", "Reference must be a string.");
    }
  }
  if (!isPlainObject(claim.inputs)) {
    push(errors, "INPUTS_NOT_OBJECT", "inputs", "Inputs must be a plain object.");
  }
  if (!isPlainObject(claim.method)) {
    push(errors, "METHOD_NOT_OBJECT", "method", "Method must be an object.");
  } else {
    if (typeof claim.method.name !== "string" || claim.method.name.length === 0) {
      push(errors, "METHOD_NAME_REQUIRED", "method.name", "Method name is required.");
    }
    if (typeof claim.method.exact !== "boolean") {
      push(errors, "METHOD_EXACT_REQUIRED", "method.exact", "Method.exact must be boolean.");
    }
    if (claim.method.tolerances !== undefined && !isPlainObject(claim.method.tolerances)) {
      push(
        errors,
        "METHOD_TOLERANCES_INVALID",
        "method.tolerances",
        "Tolerances must be a plain object."
      );
    }
  }
  if (!isPlainObject(claim.result)) {
    push(errors, "RESULT_NOT_OBJECT", "result", "Result must be an object.");
  } else {
    if (!Number.isFinite(claim.result.value)) {
      push(errors, "RESULT_VALUE_INVALID", "result.value", "Result value must be finite.");
    }
    if (claim.result.unit !== undefined && typeof claim.result.unit !== "string") {
      push(errors, "RESULT_UNIT_INVALID", "result.unit", "Unit must be a string.");
    }
    validateDisplay(claim.result.display, errors);
  }
  validateProvenance(claim, errors);
  if (
    !Array.isArray(claim.limitations) ||
    claim.limitations.length === 0 ||
    claim.limitations.some((entry) => typeof entry !== "string" || entry.trim().length === 0)
  ) {
    push(
      errors,
      "LIMITATIONS_REQUIRED",
      "limitations",
      "At least one non-empty limitation is required."
    );
  }
  if (!isPlainObject(claim.reproduce)) {
    push(errors, "REPRODUCE_NOT_OBJECT", "reproduce", "Reproduce must be an object.");
  } else if (typeof claim.reproduce.command !== "string" || claim.reproduce.command.length === 0) {
    push(errors, "REPRODUCE_COMMAND_REQUIRED", "reproduce.command", "A command is required.");
  }
  if (claim.integrity !== undefined && !isPlainObject(claim.integrity)) {
    push(errors, "INTEGRITY_NOT_OBJECT", "integrity", "Integrity must be an object.");
  }
  if (claim.signature !== undefined && !isPlainObject(claim.signature)) {
    push(errors, "SIGNATURE_NOT_OBJECT", "signature", "Signature must be an object.");
  }
  return errors;
}

function payloadOf(claim) {
  const { integrity: _integrity, signature: _signature, ...payload } = claim;
  return payload;
}

function numberText(value) {
  return Number.isFinite(value) ? String(Object.is(value, -0) ? 0 : value) : "NaN";
}

export function checkDisplay(result) {
  const errors = [];
  if (!isPlainObject(result) || !isPlainObject(result.display)) {
    push(errors, "DISPLAY_NOT_OBJECT", "result.display", "Display must be an object.");
    return errors;
  }
  const display = result.display;
  if (!Number.isFinite(result.value)) {
    push(errors, "RESULT_VALUE_INVALID", "result.value", "Result value must be finite.");
    return errors;
  }
  const scale = display.scale === undefined ? 1 : display.scale;
  const suffix = display.suffix === undefined ? "" : display.suffix;
  if (!Number.isFinite(scale)) {
    push(errors, "DISPLAY_SCALE_INVALID", "result.display.scale", "Scale must be finite.");
    return errors;
  }

  if (display.rule === "upper-bound") {
    if (!Number.isFinite(display.bound) || display.bound < 0) {
      push(errors, "DISPLAY_BOUND_INVALID", "result.display.bound", "Bound must be finite.");
      return errors;
    }
    const strict = display.text.startsWith("< ");
    const inclusive = display.text.startsWith("≤ ");
    if (!strict && !inclusive) {
      push(
        errors,
        "DISPLAY_BOUND_SYMBOL",
        "result.display.text",
        "Upper-bound text must start with '< ' or '≤ '."
      );
      return errors;
    }
    if (strict && !(result.value < display.bound)) {
      push(
        errors,
        "DISPLAY_BOUND_EXCEEDED",
        "result.value",
        `Value ${numberText(result.value)} is not strictly below ${numberText(display.bound)}.`
      );
    }
    if (inclusive && !(result.value <= display.bound)) {
      push(
        errors,
        "DISPLAY_BOUND_EXCEEDED",
        "result.value",
        `Value ${numberText(result.value)} exceeds ${numberText(display.bound)}.`
      );
    }
    const expected = `${strict ? "<" : "≤"} ${numberText(display.bound)}${suffix}`;
    if (display.text !== expected) {
      push(
        errors,
        "DISPLAY_MISMATCH",
        "result.display.text",
        `Expected "${expected}" but got "${display.text}".`
      );
    }
    return errors;
  }

  if (display.rule === "exact-integer") {
    if (!Number.isInteger(result.value)) {
      push(
        errors,
        "DISPLAY_NOT_INTEGER",
        "result.value",
        "exact-integer requires an integer value."
      );
    }
    if (scale !== 1) {
      push(
        errors,
        "DISPLAY_SCALE_NOT_ALLOWED",
        "result.display.scale",
        "exact-integer does not accept a scale."
      );
    }
    const expected = `${numberText(result.value)}${suffix}`;
    if (display.text !== expected) {
      push(
        errors,
        "DISPLAY_MISMATCH",
        "result.display.text",
        `Expected "${expected}" but got "${display.text}".`
      );
    }
    return errors;
  }

  const [rule, digitsText] = display.rule.split(":");
  const digits = Number(digitsText);
  if (rule === "fixed" && (digits < 0 || digits > 12)) {
    push(errors, "DISPLAY_DIGITS_INVALID", "result.display.rule", "fixed supports 0..12.");
    return errors;
  }
  if (rule === "significant" && (digits < 1 || digits > 15)) {
    push(
      errors,
      "DISPLAY_DIGITS_INVALID",
      "result.display.rule",
      "significant supports 1..15."
    );
    return errors;
  }
  const scaled = result.value * scale;
  const expected = `${
    rule === "fixed" ? scaled.toFixed(digits) : scaled.toPrecision(digits)
  }${suffix}`;
  if (display.text !== expected) {
    push(
      errors,
      "DISPLAY_MISMATCH",
      "result.display.text",
      `Expected "${expected}" but got "${display.text}".`
    );
  }
  return errors;
}

export function checkProvenance(claim) {
  const errors = [];
  validateProvenance(claim, errors);
  return errors;
}

function assertIntegrityShape(claim) {
  const errors = [];
  if (!isPlainObject(claim.integrity)) {
    push(errors, "MISSING_INTEGRITY", "integrity", "Claim is not sealed.");
    return errors;
  }
  if (claim.integrity.algorithm !== PCI_ALGORITHM) {
    push(errors, "INTEGRITY_ALGORITHM_INVALID", "integrity.algorithm", "Expected SHA-256.");
  }
  if (claim.integrity.canonical !== PCI_CANONICAL) {
    push(
      errors,
      "INTEGRITY_CANONICAL_INVALID",
      "integrity.canonical",
      `Expected ${PCI_CANONICAL}.`
    );
  }
  for (const key of ["payloadDigest", "inputsDigest", "resultDigest"]) {
    if (typeof claim.integrity[key] !== "string" || !/^[0-9a-f]{64}$/.test(claim.integrity[key])) {
      push(
        errors,
        "INTEGRITY_DIGEST_INVALID",
        `integrity.${key}`,
        "Expected 64 lowercase hexadecimal characters."
      );
    }
  }
  return errors;
}

export async function sealClaim(claim) {
  const errors = validateClaimShape(claim);
  if (errors.length > 0) {
    throw new PCIError("INVALID_CLAIM", "Cannot seal an invalid claim.", { errors });
  }
  const payloadDigest = await sha256Hex(canonicalize(payloadOf(claim)));
  const inputsDigest = await sha256Hex(canonicalize(claim.inputs));
  const resultDigest = await sha256Hex(canonicalize(claim.result));
  return {
    ...claim,
    integrity: {
      algorithm: PCI_ALGORITHM,
      canonical: PCI_CANONICAL,
      payloadDigest,
      inputsDigest,
      resultDigest
    }
  };
}

export async function createClaim(spec) {
  if (!isPlainObject(spec)) {
    throw new PCIError("INVALID_CLAIM", "Claim specification must be a plain object.");
  }
  return sealClaim({ ...spec, pci: PCI_VERSION });
}

export async function verifyClaim(claim, options = {}) {
  const shapeErrors = validateClaimShape(claim);
  if (shapeErrors.length > 0) {
    return {
      ok: false,
      level: 0,
      errors: shapeErrors,
      warnings: [],
      signature: "not-checked",
      digests: {}
    };
  }

  const errors = [];
  const warnings = [];
  const integrityErrors = assertIntegrityShape(claim);
  if (integrityErrors.length > 0) {
    return {
      ok: false,
      level: 0,
      errors: integrityErrors,
      warnings,
      signature: "not-checked",
      digests: {}
    };
  }

  const digests = {
    payloadDigest: await sha256Hex(canonicalize(payloadOf(claim))),
    inputsDigest: await sha256Hex(canonicalize(claim.inputs)),
    resultDigest: await sha256Hex(canonicalize(claim.result))
  };

  for (const key of ["payloadDigest", "inputsDigest", "resultDigest"]) {
    if (claim.integrity[key] !== digests[key]) {
      push(
        errors,
        "INTEGRITY_MISMATCH",
        `integrity.${key}`,
        `Expected ${digests[key]} but found ${claim.integrity[key]}.`
      );
    }
  }
  if (errors.length > 0) {
    return { ok: false, level: 0, errors, warnings, signature: "not-checked", digests };
  }

  let level = 1;
  const displayErrors = checkDisplay(claim.result);
  if (displayErrors.length > 0) errors.push(...displayErrors);
  else level = 2;

  const provenanceErrors = checkProvenance(claim);
  if (provenanceErrors.length > 0) errors.push(...provenanceErrors);
  else if (level >= 2) level = 3;

  let signature = "absent";
  if (claim.signature !== undefined) {
    if (!isPlainObject(options.publicKeyJwk)) {
      warnings.push({
        code: "SIGNATURE_NOT_VERIFIED",
        path: "signature",
        message: "A signature is present but no publicKeyJwk was supplied."
      });
      signature = "unverified";
    } else {
      const valid = await verifyClaimSignature(claim, options.publicKeyJwk);
      signature = valid ? "valid" : "invalid";
      if (valid) {
        if (level >= 3) level = 4;
      } else {
        push(errors, "SIGNATURE_INVALID", "signature", "ECDSA signature verification failed.");
      }
    }
  }

  return { ok: errors.length === 0, level, errors, warnings, signature, digests };
}

export async function generateKeyPair() {
  if (!globalThis.crypto?.subtle) {
    throw new PCIError("WEB_CRYPTO_UNAVAILABLE", "Web Crypto is required.");
  }
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  return {
    privateKeyJwk: await globalThis.crypto.subtle.exportKey("jwk", pair.privateKey),
    publicKeyJwk: await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey)
  };
}

export async function signClaim(claim, privateKeyJwk, options = {}) {
  const verification = await verifyClaim(claim);
  if (!verification.ok || verification.level < 3) {
    throw new PCIError("CLAIM_NOT_SIGNABLE", "Only sealed, valid claims can be signed.", {
      verification
    });
  }
  if (!globalThis.crypto?.subtle) {
    throw new PCIError("WEB_CRYPTO_UNAVAILABLE", "Web Crypto is required.");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const data = new TextEncoder().encode(claim.integrity.payloadDigest);
  const signature = await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    data
  );
  return {
    ...claim,
    signature: {
      alg: "ECDSA-P256-SHA256",
      keyId: typeof options.keyId === "string" ? options.keyId : "",
      value: bytesToBase64Url(new Uint8Array(signature))
    }
  };
}

export async function verifyClaimSignature(claim, publicKeyJwk) {
  try {
    if (
      typeof claim?.signature?.value !== "string" ||
      claim.signature.alg !== "ECDSA-P256-SHA256" ||
      typeof claim?.integrity?.payloadDigest !== "string"
    ) {
      return false;
    }
    const key = await globalThis.crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    return await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlToBytes(claim.signature.value),
      new TextEncoder().encode(claim.integrity.payloadDigest)
    );
  } catch {
    return false;
  }
}

export async function claimSetDigest(claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    throw new PCIError("CLAIM_SET_EMPTY", "A claim set needs at least one claim.");
  }
  const seen = new Set();
  const entries = claims.map((claim) => {
    if (!isPlainObject(claim) || typeof claim.claimId !== "string") {
      throw new PCIError("CLAIM_SET_INVALID", "Every claim needs a claimId.");
    }
    if (seen.has(claim.claimId)) {
      throw new PCIError("CLAIM_SET_DUPLICATE", `Duplicate claimId: ${claim.claimId}`);
    }
    seen.add(claim.claimId);
    if (typeof claim.integrity?.payloadDigest !== "string") {
      throw new PCIError("CLAIM_SET_UNSEALED", `Claim ${claim.claimId} is not sealed.`);
    }
    return { claimId: claim.claimId, payloadDigest: claim.integrity.payloadDigest };
  });
  entries.sort((left, right) => (left.claimId < right.claimId ? -1 : 1));
  return sha256Hex(canonicalize({ pci: PCI_VERSION, claims: entries }));
}
