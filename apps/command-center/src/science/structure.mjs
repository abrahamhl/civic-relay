// Structure-aware propagation and a presence-likelihood simulator.
//
// This module fuses a floor plan (walls with material and thickness) with the
// RF model to answer a narrow question: "given these consented sensor readings,
// which cells of this floor are more consistent with a device being present?"
//
// It is a SIMULATOR. It does not see through walls, does not identify anyone,
// and does not produce a location fix. The output is a coarse likelihood field
// with a declared model, meant for planning and research.

import { freeSpacePathLossDb, materialAttenuationDb } from './rf.mjs';

export const STRUCTURE_PROVENANCE = 'SIMULATOR';

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Wall
 * @property {string} id
 * @property {Point} a
 * @property {Point} b
 * @property {string} material
 * @property {number} thicknessM
 */

/**
 * @typedef {Object} Sensor
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} txPowerDbm
 * @property {number} rssiDbm
 */

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

export function segmentIntersection(p1, p2, p3, p4) {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = p4.x - p3.x;
  const sy = p4.y - p3.y;
  const denom = cross(rx, ry, sx, sy);
  if (Math.abs(denom) < 1e-12) return null;

  const qpx = p3.x - p1.x;
  const qpy = p3.y - p1.y;
  const t = cross(qpx, qpy, sx, sy) / denom;
  const u = cross(qpx, qpy, rx, ry) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return { t, u, point: { x: p1.x + t * rx, y: p1.y + t * ry } };
}

/**
 * @param {{from: Point, to: Point, walls?: Wall[]}} options
 */
export function wallCrossings({ from, to, walls = [] }) {
  const crossings = [];
  for (const wall of walls) {
    const hit = segmentIntersection(from, to, wall.a, wall.b);
    if (hit) crossings.push({ wall, t: hit.t, point: hit.point });
  }
  return crossings.sort((a, b) => a.t - b.t);
}

/**
 * @param {{from: Point, to: Point, walls?: Wall[], freqHz: number}} options
 */
export function pathLossThroughBuilding({ from, to, walls = [], freqHz }) {
  // Clamp to 5 cm: the far-field model is not valid at zero distance, and a
  // grid cell can land exactly on a sensor. This is a numerical floor, not a
  // physical claim about near-field behaviour.
  const distanceM = Math.max(0.05, Math.hypot(to.x - from.x, to.y - from.y));
  const crossings = wallCrossings({ from, to, walls });
  const wallsDb = crossings.reduce(
    (sum, crossing) =>
      sum +
      materialAttenuationDb({
        material: crossing.wall.material,
        thicknessM: crossing.wall.thicknessM,
        freqHz,
      }),
    0,
  );
  const freeSpaceDb = freeSpacePathLossDb(distanceM, freqHz);
  return {
    distanceM,
    crossings: crossings.map((crossing) => ({
      wallId: crossing.wall.id,
      material: crossing.wall.material,
      thicknessM: crossing.wall.thicknessM,
      t: crossing.t,
    })),
    freeSpaceDb,
    wallsDb,
    totalDb: freeSpaceDb + wallsDb,
  };
}

/**
 * Naive-Bayes style likelihood over a grid. Each sensor contributes a Gaussian
 * log-likelihood of its observed RSSI given the predicted RSSI at the cell.
 * Values are normalised to the peak cell, so they are relative, not absolute
 * probabilities.
 */
/**
 * @param {{
 *   bounds: {minX: number, minY: number, maxX: number, maxY: number},
 *   resolution?: number,
 *   sensors: Sensor[],
 *   walls?: Wall[],
 *   freqHz?: number,
 *   shadowingSigmaDb?: number,
 * }} options
 */
export function presenceHeatmap({
  bounds,
  resolution = 28,
  sensors,
  walls = [],
  freqHz = 2.4e9,
  shadowingSigmaDb = 6,
}) {
  if (!bounds) throw new TypeError('bounds is required');
  if (!Array.isArray(sensors) || sensors.length === 0) throw new TypeError('sensors required');
  if (!(shadowingSigmaDb > 0)) throw new RangeError('shadowingSigmaDb must be positive');

  const widthM = bounds.maxX - bounds.minX;
  const heightM = bounds.maxY - bounds.minY;
  if (!(widthM > 0) || !(heightM > 0)) throw new RangeError('invalid bounds');

  const cols = Math.max(2, Math.round(resolution));
  const rows = Math.max(2, Math.round((resolution * heightM) / widthM));
  const cellW = widthM / cols;
  const cellH = heightM / rows;

  const logLik = new Float64Array(cols * rows);
  let maxLogLik = -Infinity;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = bounds.minX + (col + 0.5) * cellW;
      const y = bounds.minY + (row + 0.5) * cellH;
      let sum = 0;
      for (const sensor of sensors) {
        const loss = pathLossThroughBuilding({
          from: { x: sensor.x, y: sensor.y },
          to: { x, y },
          walls,
          freqHz,
        });
        const predictedDbm = sensor.txPowerDbm - loss.totalDb;
        const z = (sensor.rssiDbm - predictedDbm) / shadowingSigmaDb;
        sum += -0.5 * z * z;
      }
      logLik[row * cols + col] = sum;
      if (sum > maxLogLik) maxLogLik = sum;
    }
  }

  const values = new Float64Array(cols * rows);
  let peak = { value: -Infinity, col: 0, row: 0, x: bounds.minX, y: bounds.minY };
  let total = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = Math.exp(logLik[row * cols + col] - maxLogLik);
      values[row * cols + col] = value;
      total += value;
      if (value > peak.value) {
        peak = {
          value,
          col,
          row,
          x: bounds.minX + (col + 0.5) * cellW,
          y: bounds.minY + (row + 0.5) * cellH,
        };
      }
    }
  }

  return {
    schema: 'senda-presence-heatmap/v1',
    provenance: STRUCTURE_PROVENANCE,
    note: 'Campo de verosimilitud relativo. No es una localización ni una detección de vida.',
    bounds,
    cols,
    rows,
    cellW,
    cellH,
    values,
    peak,
    mean: total / values.length,
    sensorCount: sensors.length,
    freqHz,
    shadowingSigmaDb,
  };
}

export function summarizeHeatmap(heatmap) {
  const { values, peak, mean } = heatmap;
  let aboveHalf = 0;
  for (const value of values) if (value >= 0.5) aboveHalf += 1;
  return {
    peak,
    mean,
    cells: values.length,
    cellsAboveHalf: aboveHalf,
    fractionAboveHalf: aboveHalf / values.length,
  };
}

/**
 * A synthetic floor used by the UI. It is explicitly not a real building.
 * Coordinates are metres in a local frame.
 */
export const DEMO_FLOOR = Object.freeze({
  id: 'demo-floor-01',
  provenance: STRUCTURE_PROVENANCE,
  label: 'Planta sintética 20 × 12 m',
  bounds: { minX: 0, minY: 0, maxX: 20, maxY: 12 },
  walls: [
    { id: 'outer-n', a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, material: 'concrete', thicknessM: 0.2 },
    { id: 'outer-s', a: { x: 0, y: 12 }, b: { x: 20, y: 12 }, material: 'concrete', thicknessM: 0.2 },
    { id: 'outer-w', a: { x: 0, y: 0 }, b: { x: 0, y: 12 }, material: 'concrete', thicknessM: 0.2 },
    { id: 'outer-e', a: { x: 20, y: 0 }, b: { x: 20, y: 12 }, material: 'concrete', thicknessM: 0.2 },
    { id: 'inner-v1', a: { x: 8, y: 0 }, b: { x: 8, y: 7 }, material: 'drywall', thicknessM: 0.0127 },
    { id: 'inner-v2', a: { x: 8, y: 9 }, b: { x: 8, y: 12 }, material: 'brick', thicknessM: 0.1 },
    { id: 'inner-h1', a: { x: 8, y: 6 }, b: { x: 14, y: 6 }, material: 'drywall', thicknessM: 0.0127 },
    { id: 'inner-h2', a: { x: 15.5, y: 6 }, b: { x: 20, y: 6 }, material: 'drywall', thicknessM: 0.0127 },
    { id: 'inner-v3', a: { x: 14, y: 0 }, b: { x: 14, y: 6 }, material: 'brick', thicknessM: 0.1 },
  ],
  sensors: [
    { id: 'S1', x: 3, y: 3, txPowerDbm: 0, rssiDbm: -62 },
    { id: 'S2', x: 17, y: 9, txPowerDbm: 0, rssiDbm: -70 },
  ],
});
