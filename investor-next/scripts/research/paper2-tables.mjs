import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRECISION_PROVENANCE,
  binomialCcdf,
  dtnDelivery,
  erasureDelivery,
  poissonBinomialCcdf
} from "../../lib/precision-lab.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../public/research/data");
const outFile = path.join(outDir, "tr-2026-02-erasure-tails-dtn-bounds.json");

const sig = (value) => {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1e-4 && Math.abs(value) < 1e6) {
    return Number(value.toPrecision(6)).toString();
  }
  const [mantissa, exponent] = value.toExponential(5).split("e");
  return `${mantissa}e${Number(exponent)}`;
};

const fixed = (value, digits) => value.toFixed(digits);
const kl = (a, p) => a * Math.log(a / p) + (1 - a) * Math.log((1 - a) / (1 - p));

const homogeneous = [8, 10, 12, 14, 16, 20].map((k) => {
  const exact = binomialCcdf(k, 32, 0.2);
  const a = k / 32;
  const chernoff = Math.exp(-32 * kl(a, 0.2));
  const hoeffding = Math.exp(-2 * 32 * (a - 0.2) ** 2);
  return {
    k,
    n: 32,
    p: 0.2,
    exact,
    chernoff,
    hoeffding,
    display: {
      exact: sig(exact),
      chernoff: sig(chernoff),
      hoeffding: sig(hoeffding)
    },
    ratios: {
      chernoffOverExact: chernoff / exact,
      hoeffdingOverExact: hoeffding / exact
    }
  };
});

const heterogeneousProbabilities = Array.from({ length: 32 }, (_, index) => 0.15 + 0.01 * index);
const heterogeneous = [10, 12, 14, 16, 18, 20].map((k) => {
  const exact = poissonBinomialCcdf(heterogeneousProbabilities, k);
  return {
    k,
    n: 32,
    exact,
    display: { exact: sig(exact) }
  };
});

const delay = [];
for (const copies of [1, 2, 3, 5]) {
  for (const horizonHours of [6, 12, 24, 48]) {
    const result = dtnDelivery({ contactRatePerHour: 0.2, copies, horizonHours });
    delay.push({
      copies,
      horizonHours,
      probability: result.probability,
      expectedDelayHours: result.expectedDelayHours,
      p50: result.p50,
      p90: result.p90,
      p99: result.p99,
      display: {
        probability: sig(result.probability),
        expectedDelayHours: fixed(result.expectedDelayHours, 3),
        p50: fixed(result.p50, 3),
        p90: fixed(result.p90, 3),
        p99: fixed(result.p99, 3)
      }
    });
  }
}

const overhead = [
  { k: 8, n: 12, p: 0.4 },
  { k: 8, n: 12, p: 0.6 },
  { k: 8, n: 12, p: 0.8 },
  { k: 12, n: 18, p: 0.6 },
  { k: 16, n: 24, p: 0.6 }
].map((row) => {
  const result = erasureDelivery({ k: row.k, n: row.n, perShard: row.p });
  return {
    ...row,
    probability: result.probability,
    expectedReceived: result.expectedReceived,
    overhead: result.overhead,
    display: {
      probability: sig(result.probability),
      expectedReceived: sig(result.expectedReceived)
    }
  };
});

const artifact = {
  schema: "senda-research-data/1",
  report: "SENDA-TR-2026-02",
  generatedBy: "scripts/research/paper2-tables.mjs",
  provenance: PRECISION_PROVENANCE,
  assumptions: [
    "A1: shard delivery indicators are independent Bernoulli variables",
    "A2: the homogeneous case uses one p; the heterogeneous case uses p_i",
    "A3: contact times are Poisson with rate lambda; copies are independent",
    "A4: no retransmission and no correlation across copies"
  ],
  doesNotContain: [
    "field measurements",
    "radio measurements",
    "a claim that the model parameters match a real deployment"
  ],
  parameters: {
    homogeneous: { n: 32, p: 0.2 },
    heterogeneous: {
      n: 32,
      probabilities: heterogeneousProbabilities
    },
    delay: { contactRatePerHour: 0.2 },
    overhead: { ratio: 1.5 }
  },
  tables: {
    homogeneous,
    heterogeneous,
    delay,
    overhead
  }
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

console.log("Homogeneous: n=32 p=0.2");
for (const row of homogeneous) {
  console.log(`k=${row.k} exact=${row.display.exact} chernoff=${row.display.chernoff} hoeffding=${row.display.hoeffding}`);
}
console.log("Heterogeneous: n=32 p_i=0.15+0.01(i-1)");
for (const row of heterogeneous) {
  console.log(`k=${row.k} exact=${row.display.exact}`);
}
console.log("Delay: lambda=0.2");
for (const row of delay) {
  console.log(
    `m=${row.copies} t=${row.horizonHours} P=${row.display.probability} mean=${row.display.expectedDelayHours} p50=${row.display.p50} p90=${row.display.p90} p99=${row.display.p99}`
  );
}
console.log("Overhead: n/k=1.5");
for (const row of overhead) {
  console.log(`k=${row.k} n=${row.n} p=${row.p} P=${row.display.probability} E=${row.display.expectedReceived}`);
}
console.log(`wrote ${outFile}`);
