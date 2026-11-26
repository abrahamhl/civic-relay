// @ts-check
/**
 * SENDA · F3 Validador Ajv (JSON Schema Draft 2020-12) para contratos de entrada:
 *   - telemetry       (telemetría y casos con fuentes y zona horaria)
 *   - connectorSeries (series importadas en data-connectors con fuente y TZ explícita)
 *   - chronology      (cronologías de incidentes con fuentes y zona horaria)
 *   - citizenReport   (sobres firmados Ed25519 de citizen-report.mjs, canPublicWarn === false)
 *   - mmwaveExport    (grabaciones/trazas del radar mmWave con procedencia, TZ y SHA-256)
 */
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** @type {any} */
const AjvCtor = /** @type {any} */ (Ajv2020).default ?? Ajv2020;
/** @type {any} */
const applyFormats = /** @type {any} */ (addFormats).default ?? addFormats;

const ajv = new AjvCtor({ allErrors: true, strict: false });
applyFormats(ajv);

const SCHEMA_FILES = Object.freeze({
  telemetry: 'telemetry.schema.json',
  connectorSeries: 'connector-series.schema.json',
  chronology: 'chronology.schema.json',
  citizenReport: 'citizen-report.schema.json',
  mmwaveExport: 'mmwave-export.schema.json',
});

/** @type {Record<string, any>} */
const validators = {};
for (const [key, filename] of Object.entries(SCHEMA_FILES)) {
  const schema = JSON.parse(readFileSync(resolve(HERE, filename), 'utf8'));
  validators[key] = ajv.compile(schema);
}

/**
 * Valida un dato contra uno de los esquemas contractuales de SENDA.
 * Además de JSON Schema, verifica coherencia referencial (p. ej. que cada `evento.fuente`
 * exista en `fuentes` cuando `fuentes` está presente).
 *
 * @param {'telemetry'|'connectorSeries'|'chronology'|'citizenReport'|'mmwaveExport'} schemaName
 * @param {any} data
 * @returns {{ ok: boolean, schema: string, errors: Array<{ path: string, message: string }> }}
 */
export function validateContract(schemaName, data) {
  const fn = validators[schemaName];
  if (!fn) {
    return {
      ok: false,
      schema: String(schemaName),
      errors: [{ path: '', message: `esquema desconocido: ${schemaName}` }],
    };
  }
  const ok = Boolean(fn(data));
  /** @type {Array<{ path: string, message: string }>} */
  const errors = (fn.errors ?? []).map((e) => ({
    path: e.instancePath || '/',
    message: e.message || 'error de esquema',
  }));

  // Validación referencial de fuentes en telemetría y cronologías
  if (ok && (schemaName === 'telemetry' || schemaName === 'chronology') && data?.fuentes && Array.isArray(data.eventos)) {
    const known = new Set(Object.keys(data.fuentes));
    data.eventos.forEach((ev, idx) => {
      if (!known.has(ev.fuente)) {
        errors.push({ path: `/eventos/${idx}/fuente`, message: `fuente '${ev.fuente}' no declarada en 'fuentes'` });
      }
    });
  }

  return { ok: errors.length === 0, schema: schemaName, errors };
}

export const CONTRACT_SCHEMAS = Object.freeze(Object.keys(SCHEMA_FILES));
