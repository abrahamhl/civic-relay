// Deterministic JSON serialization for signatures and hashing.
//
// SJSON-1: object keys sorted by UTF-16 code unit order, -0 normalised to 0,
// undefined object members dropped (JSON semantics), non-finite numbers,
// bigints, functions, symbols and cycles rejected.
//
// The signature is only as strong as the bytes. Two peers that disagree on
// serialization will disagree on every signature, so this module is the single
// source of truth for "what exactly was signed".

export function canonicalize(value) {
  return JSON.stringify(sortValue(value, new Set()));
}

export function canonicalBytes(value) {
  return new TextEncoder().encode(canonicalize(value));
}

function sortValue(value, seen) {
  if (value === null) return null;

  const type = typeof value;

  if (type === 'string' || type === 'boolean') return value;

  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('SJSON: non-finite number is not canonical');
    return Object.is(value, -0) ? 0 : value;
  }

  if (type === 'undefined' || type === 'function' || type === 'symbol' || type === 'bigint') {
    throw new TypeError(`SJSON: ${type} is not a canonical JSON value`);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item, seen));
  }

  if (type === 'object') {
    if (seen.has(value)) throw new TypeError('SJSON: cyclic reference');
    seen.add(value);
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue;
      out[key] = sortValue(value[key], seen);
    }
    seen.delete(value);
    return out;
  }

  throw new TypeError(`SJSON: unsupported value of type ${type}`);
}
