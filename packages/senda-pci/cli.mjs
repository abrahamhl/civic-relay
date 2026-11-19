#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  createLedger,
  describeFile,
  exportLedger,
  exportPrivateJwk,
  generateCustodian,
  importLedger,
  importPrivateJwk,
  ledgerDigest,
  receiveCustody,
  sealLedger,
  transferCustody,
  verifyLedger,
  verifyReceipt,
} from './src/index.mjs';

function usage() {
  return `SENDA PCI v0.2

  node cli.mjs keygen --name "Ana" --org "SENDA" --out ana.key.json
  node cli.mjs pub --key ana.key.json --out ana.pub.json
  node cli.mjs register --file evidence.bin --key ana.key.json [--custodians registry.json] --out ledger.json
  node cli.mjs transfer --ledger ledger.json --key ana.key.json --to bruno.pub.json --out ledger.2.json
  node cli.mjs receive --ledger ledger.2.json --key bruno.key.json --out ledger.3.json
  node cli.mjs seal --ledger ledger.3.json --key bruno.key.json --out ledger.sealed.json
  node cli.mjs verify --ledger ledger.sealed.json --registry registry.json [--file evidence.bin] [--sealed]
  node cli.mjs receipt --ledger ledger.sealed.json --registry registry.json --transfer <hash>
  node cli.mjs digest --ledger ledger.sealed.json

Opciones: --at <ISO-8601> --notes <texto> --name <nombre> --media-type <tipo> --now <ISO-8601>
`;
}

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const [rawKey, rawValue] = arg.slice(2).split('=', 2);
    if (rawValue !== undefined) {
      out[rawKey] = rawValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[rawKey] = argv[++i];
    } else {
      out[rawKey] = true;
    }
  }
  return out;
}

function need(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`falta --${name}`);
  return value;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`no se pudo leer ${path}: ${error.message}`);
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeLedger(path, ledger) {
  writeFileSync(path, `${exportLedger(ledger)}\n`, 'utf8');
}

function keyMaterial(path) {
  const value = readJson(path);
  if (!value.custodian || !value.privateKey) throw new Error(`${path} no es un fichero de clave PCI`);
  return value;
}

function registryFrom(path) {
  const value = readJson(path);
  const list = Array.isArray(value) ? value : value.custodians;
  if (!Array.isArray(list)) throw new Error(`${path} no contiene una lista de custodios`);
  return list;
}

function time(value) {
  if (value === undefined) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`--at/--now inválido: ${value}`);
  return ms;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parse(rest);
  if (!command || command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }
  const now = time(args.now) ?? Date.now();
  if (command === 'keygen') {
    const generated = await generateCustodian({ name: need(args, 'name'), org: args.org ?? '' });
    const out = need(args, 'out');
    writeJson(out, { custodian: generated.custodian, privateKey: await exportPrivateJwk(generated.privateKey) });
    console.log(`clave escrita en ${out}; protégela y no la publiques`);
    return;
  }
  if (command === 'pub') {
    const key = keyMaterial(need(args, 'key'));
    writeJson(need(args, 'out'), key.custodian);
    return;
  }
  if (command === 'register') {
    const key = keyMaterial(need(args, 'key'));
    const privateKey = await importPrivateJwk(key.privateKey);
    const file = need(args, 'file');
    const evidence = await describeFile(file, { name: args.name ?? basename(file), mediaType: args['media-type'] ?? 'application/octet-stream' });
    const custodians = args.custodians ? registryFrom(args.custodians) : [];
    const ledger = await createLedger({
      evidence,
      collector: { custodian: key.custodian, privateKey },
      custodians,
      at: args.at,
      notes: args.notes ?? '',
      now,
    });
    writeLedger(need(args, 'out'), ledger);
    console.log(`ledger escrito en ${args.out}`);
    return;
  }
  if (command === 'transfer') {
    const key = keyMaterial(need(args, 'key'));
    const privateKey = await importPrivateJwk(key.privateKey);
    const to = readJson(need(args, 'to'));
    const ledger = importLedger(readFileSync(need(args, 'ledger'), 'utf8'));
    const next = await transferCustody({
      ledger,
      from: { custodian: key.custodian, privateKey },
      to: to.custodian ?? to,
      at: args.at,
      notes: args.notes ?? '',
      now,
    });
    writeLedger(need(args, 'out'), next);
    return;
  }
  if (command === 'receive') {
    const key = keyMaterial(need(args, 'key'));
    const privateKey = await importPrivateJwk(key.privateKey);
    const ledger = importLedger(readFileSync(need(args, 'ledger'), 'utf8'));
    const next = await receiveCustody({
      ledger,
      actor: { custodian: key.custodian, privateKey },
      at: args.at,
      notes: args.notes ?? '',
      now,
    });
    writeLedger(need(args, 'out'), next);
    return;
  }
  if (command === 'seal') {
    const key = keyMaterial(need(args, 'key'));
    const privateKey = await importPrivateJwk(key.privateKey);
    const ledger = importLedger(readFileSync(need(args, 'ledger'), 'utf8'));
    const next = await sealLedger({
      ledger,
      actor: { custodian: key.custodian, privateKey },
      at: args.at,
      notes: args.notes ?? '',
      now,
    });
    writeLedger(need(args, 'out'), next);
    return;
  }
  if (command === 'verify') {
    const ledger = importLedger(readFileSync(need(args, 'ledger'), 'utf8'));
    const trustedKeys = registryFrom(need(args, 'registry'));
    const evidenceBytes = args.file ? readFileSync(args.file) : null;
    const result = await verifyLedger({
      ledger,
      trustedKeys,
      evidenceBytes,
      now,
      requireSealed: Boolean(args.sealed),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'receipt') {
    const ledger = importLedger(readFileSync(need(args, 'ledger'), 'utf8'));
    const trustedKeys = registryFrom(need(args, 'registry'));
    const result = await verifyReceipt({
      ledger,
      trustedKeys,
      transferHash: need(args, 'transfer'),
      now,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'digest') {
    const ledger = importLedger(readFileSync(need(args, 'ledger'), 'utf8'));
    console.log(ledgerDigest(ledger));
    return;
  }
  throw new Error(`comando desconocido: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
