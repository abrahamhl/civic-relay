#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

import {
  PCI_VERSION,
  claimSetDigest,
  generateKeyPair,
  sealClaim,
  sha256Hex,
  signClaim,
  verifyClaim
} from "../src/index.mjs";

const HELP = `pci 0.1.0 — Proof-Carrying Inference

Usage:
  pci keygen [--private <path>] [--public <path>]
  pci seal <claim.json> [--out <path>]
  pci verify <claim.json> [--public-key <path>]
  pci sign <claim.json> --private-key <path> [--key-id <id>] [--out <path>]
  pci digest <file>
  pci set <claim.json> [claim.json ...]
  pci version

Exit codes: 0 ok, 1 verification failed, 2 usage or I/O error.`;

function parseArgs(argv) {
  const flags = new Map();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry.startsWith("--")) {
      const name = entry.slice(2);
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        flags.set(name, true);
      } else {
        flags.set(name, value);
        index += 1;
      }
    } else {
      positional.push(entry);
    }
  }
  return { flags, positional };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value, mode) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
}

function fail(message) {
  console.error(message);
  process.exitCode = 2;
}

const [command, ...rest] = process.argv.slice(2);
const { flags, positional } = parseArgs(rest);

try {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
  } else if (command === "version" || command === "--version") {
    console.log(PCI_VERSION);
  } else if (command === "keygen") {
    const pair = await generateKeyPair();
    const privatePath = flags.get("private") || "private.pci.jwk.json";
    const publicPath = flags.get("public") || "public.pci.jwk.json";
    await writeJson(privatePath, pair.privateKeyJwk, 0o600);
    await writeJson(publicPath, pair.publicKeyJwk, 0o644);
    console.log(JSON.stringify({ privatePath, publicPath }, null, 2));
  } else if (command === "seal") {
    if (!positional[0]) {
      fail("pci seal requires a claim.json path.");
    } else {
      const claim = await readJson(positional[0]);
      const sealed = await sealClaim(claim);
      const out = flags.get("out");
      if (typeof out === "string") {
        await writeJson(out, sealed);
        console.log(JSON.stringify({ out, payloadDigest: sealed.integrity.payloadDigest }));
      } else {
        console.log(JSON.stringify(sealed, null, 2));
      }
    }
  } else if (command === "verify") {
    if (!positional[0]) {
      fail("pci verify requires a claim.json path.");
    } else {
      const claim = await readJson(positional[0]);
      const publicKeyPath = flags.get("public-key");
      const options =
        typeof publicKeyPath === "string"
          ? { publicKeyJwk: await readJson(publicKeyPath) }
          : {};
      const result = await verifyClaim(claim, options);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
    }
  } else if (command === "sign") {
    const privateKeyPath = flags.get("private-key");
    if (!positional[0] || typeof privateKeyPath !== "string") {
      fail("pci sign requires a claim path and --private-key <path>.");
    } else {
      const claim = await readJson(positional[0]);
      const privateKeyJwk = await readJson(privateKeyPath);
      const signed = await signClaim(claim, privateKeyJwk, {
        keyId: typeof flags.get("key-id") === "string" ? flags.get("key-id") : ""
      });
      const out = flags.get("out");
      if (typeof out === "string") {
        await writeJson(out, signed);
        console.log(JSON.stringify({ out, keyId: signed.signature.keyId }));
      } else {
        console.log(JSON.stringify(signed, null, 2));
      }
    }
  } else if (command === "digest") {
    if (!positional[0]) {
      fail("pci digest requires a file path.");
    } else {
      const bytes = await readFile(positional[0]);
      console.log(`sha256:${await sha256Hex(new Uint8Array(bytes))}`);
    }
  } else if (command === "set") {
    if (positional.length === 0) {
      fail("pci set requires at least one claim path.");
    } else {
      const claims = [];
      for (const path of positional) claims.push(await readJson(path));
      console.log(await claimSetDigest(claims));
    }
  } else {
    fail(`Unknown command: ${command}\n\n${HELP}`);
  }
} catch (error) {
  fail(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}
