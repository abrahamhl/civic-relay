import { PciError } from './errors.mjs';

const MAX_DEPTH = 256;

function wellFormed(value) {
  if (typeof value.isWellFormed === 'function') return value.isWellFormed();
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function encode(value, depth, seen) {
  if (depth > MAX_DEPTH) throw new PciError('CANONICAL_DEPTH', `profundidad mayor que ${MAX_DEPTH}`);
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string') {
    if (!wellFormed(value)) throw new PciError('CANONICAL_STRING', 'cadena con surrogate suelto');
    return JSON.stringify(value);
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new PciError('CANONICAL_NUMBER', 'número no finito');
    return JSON.stringify(value === 0 ? 0 : value);
  }
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type !== 'object') throw new PciError('CANONICAL_TYPE', `tipo no canónico: ${type}`);
  if (seen.has(value)) throw new PciError('CANONICAL_CYCLE', 'referencia circular');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const parts = [];
      for (let i = 0; i < value.length; i++) {
        if (!(i in value)) throw new PciError('CANONICAL_ARRAY_HOLE', 'array disperso');
        parts.push(encode(value[i], depth + 1, seen));
      }
      return `[${parts.join(',')}]`;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new PciError('CANONICAL_PROTOTYPE', 'objeto no plano');
    }
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (typeof key !== 'string') throw new PciError('CANONICAL_SYMBOL', 'clave símbolo');
    }
    keys.sort();
    const parts = [];
    for (const key of keys) {
      if (!wellFormed(key)) throw new PciError('CANONICAL_STRING', 'clave con surrogate suelto');
      parts.push(`${JSON.stringify(key)}:${encode(value[key], depth + 1, seen)}`);
    }
    return `{${parts.join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

/** JSON canónico determinista (claves ordenadas, sin tipos ambiguos). */
export function canonicalize(value) {
  return encode(value, 0, new Set());
}

export function canonicalBytes(value) {
  return new TextEncoder().encode(canonicalize(value));
}
