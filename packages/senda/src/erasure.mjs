/**
 * SENDA · Codificación por borrado k-de-n (Reed-Solomon sistemático sobre GF(2^8)).
 *
 * Idea transgresora: un mismo mensaje cifrado se trocea en k fragmentos de datos + m de
 * paridad y CADA fragmento viaja por un portador distinto (satélite directo al móvil, LoRa,
 * Iridium, SMS, Bluetooth, sonido, mula…). Basta con que lleguen k cualesquiera para
 * reconstruirlo. Ningún portador individual lleva el mensaje entero (ni puede descifrarlo).
 *
 * Construcción: matriz de Cauchy sobre GF(256) con polinomio 0x11d. Cualquier submatriz
 * cuadrada de una matriz de Cauchy es invertible → cualquier k fragmentos bastan (MDS).
 */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
export const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
export const gfInv = (a) => { if (a === 0) throw new Error('inverso de 0'); return EXP[255 - LOG[a]]; };

/** Fila i de la matriz generadora (n×k): identidad para i<k, Cauchy 1/(x_i ⊕ y_j) para paridad. */
function genRow(i, k) {
  const row = new Uint8Array(k);
  if (i < k) { row[i] = 1; return row; }
  for (let j = 0; j < k; j++) row[j] = gfInv(i ^ j); // x_i = i (i ≥ k), y_j = j (j < k): conjuntos disjuntos → nunca 0
  return row;
}

function invert(M, k) {
  const A = M.map((r) => Uint8Array.from(r)), I = Array.from({ length: k }, (_, i) => { const r = new Uint8Array(k); r[i] = 1; return r; });
  for (let c = 0; c < k; c++) {
    let p = c; while (p < k && A[p][c] === 0) p++;
    if (p === k) throw new Error('matriz singular');
    [A[c], A[p]] = [A[p], A[c]]; [I[c], I[p]] = [I[p], I[c]];
    const inv = gfInv(A[c][c]);
    for (let j = 0; j < k; j++) { A[c][j] = gfMul(A[c][j], inv); I[c][j] = gfMul(I[c][j], inv); }
    for (let r = 0; r < k; r++) if (r !== c && A[r][c]) { const f = A[r][c]; for (let j = 0; j < k; j++) { A[r][j] ^= gfMul(f, A[c][j]); I[r][j] ^= gfMul(f, I[c][j]); } }
  }
  return I;
}

/**
 * @param {Uint8Array} data · @param {number} k fragmentos de datos · @param {number} n total (n ≤ 255)
 * @returns {{k,n,len,shardSize,shards:Uint8Array[]}}
 */
export function encodeShards(data, k, n) {
  if (!(k >= 1 && n >= k && n <= 255)) throw new Error('requiere 1 ≤ k ≤ n ≤ 255');
  const shardSize = Math.max(1, Math.ceil(data.length / k));
  const padded = new Uint8Array(shardSize * k); padded.set(data);
  const dataShards = Array.from({ length: k }, (_, j) => padded.subarray(j * shardSize, (j + 1) * shardSize));
  const shards = [];
  for (let i = 0; i < n; i++) {
    if (i < k) { shards.push(Uint8Array.from(dataShards[i])); continue; }
    const row = genRow(i, k), out = new Uint8Array(shardSize);
    for (let j = 0; j < k; j++) { const c = row[j]; if (!c) continue; const s = dataShards[j]; for (let b = 0; b < shardSize; b++) out[b] ^= gfMul(c, s[b]); }
    shards.push(out);
  }
  return { k, n, len: data.length, shardSize, shards };
}

/** @param {Array<{index:number, data:Uint8Array}>} received al menos k fragmentos distintos */
export function decodeShards(received, { k, len }) {
  const uniq = [...new Map(received.map((r) => [r.index, r])).values()].slice(0, k);
  if (uniq.length < k) throw new Error(`faltan fragmentos: ${uniq.length}/${k}`);
  const shardSize = uniq[0].data.length;
  const inv = invert(uniq.map((r) => genRow(r.index, k)), k);
  const out = new Uint8Array(shardSize * k);
  for (let j = 0; j < k; j++) for (let r = 0; r < k; r++) { const c = inv[j][r]; if (!c) continue; const s = uniq[r].data; for (let b = 0; b < shardSize; b++) out[j * shardSize + b] ^= gfMul(c, s[b]); }
  return out.subarray(0, len);
}

/**
 * Fragmento autodescriptivo para cualquier portador: 'S','F', ver, k, n, índice, id(8), len(2), crc8 + datos.
 * Así un receptor que solo oye fragmentos sueltos (por LoRa, SMS o satélite) sabe agruparlos.
 */
export const SHARD_HEADER = 16;
export function packShard({ id, k, n, len, index, data }) {
  const out = new Uint8Array(SHARD_HEADER + data.length);
  out[0] = 0x53; out[1] = 0x46; out[2] = 1; out[3] = k; out[4] = n; out[5] = index;
  out.set(id.subarray(0, 8), 6); out[14] = (len >> 8) & 0xff; out[15] = len & 0xff;
  out.set(data, SHARD_HEADER);
  return out;
}
export function unpackShard(b) {
  if (b.length < SHARD_HEADER || b[0] !== 0x53 || b[1] !== 0x46 || b[2] !== 1) return null;
  const id = b.subarray(6, 14);
  return { id: [...id].map((x) => x.toString(16).padStart(2, '0')).join(''), k: b[3], n: b[4], index: b[5], len: (b[14] << 8) | b[15], data: b.subarray(SHARD_HEADER) };
}

/** Reensamblador: acumula fragmentos de muchos portadores y entrega cada mensaje al completarse. */
export function createReassembler() {
  const groups = new Map();
  return {
    add(bytes, via = '?') {
      const s = unpackShard(bytes); if (!s) return null;
      const g = groups.get(s.id) ?? { k: s.k, n: s.n, len: s.len, got: new Map(), vias: new Set(), done: false };
      groups.set(s.id, g);
      if (g.done) return null;
      g.got.set(s.index, { index: s.index, data: Uint8Array.from(s.data) }); g.vias.add(via);
      if (g.got.size < g.k) return null;
      g.done = true;
      return { id: s.id, data: decodeShards([...g.got.values()], g), via: [...g.vias] };
    },
    pending: () => [...groups.entries()].filter(([, g]) => !g.done).map(([id, g]) => ({ id, have: g.got.size, need: g.k })),
  };
}
