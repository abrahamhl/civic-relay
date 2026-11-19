/**
 * Persistencia SENDA LIVE: SQLite embebido (node:sqlite, Node ≥ 22.13) con migraciones
 * versionadas y verificadas por checksum. Sin dependencias externas: el mismo binario de
 * Node que ejecuta el núcleo SENDA ejecuta el backend social.
 *
 * Decisión (ver docs/architecture/SENDA_SOCIAL_ARCHITECTURE.md §Persistencia):
 *  - MVP / piloto / despliegue en un único nodo: SQLite WAL (coste ≈ 0, backup = copiar fichero).
 *  - Escala multi-nodo: PostgreSQL + PostGIS. El SQL está escrito para que la traducción sea
 *    mecánica (TEXT ids, INTEGER epoch ms → TIMESTAMPTZ, bbox JSON → geometry).
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function openDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  return wrap(db);
}

function wrap(db) {
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = db.prepare(sql); cache.set(sql, s); }
    return s;
  };
  let depth = 0;
  return {
    raw: db,
    get: (sql, ...p) => stmt(sql).get(...p),
    all: (sql, ...p) => stmt(sql).all(...p),
    run: (sql, ...p) => stmt(sql).run(...p),
    exec: (sql) => db.exec(sql),
    /** Transacción con anidamiento por SAVEPOINT. */
    tx(fn) {
      const name = `sp${depth}`;
      if (depth === 0) db.exec('BEGIN IMMEDIATE'); else db.exec(`SAVEPOINT ${name}`);
      depth++;
      try {
        const out = fn();
        depth--;
        if (depth === 0) db.exec('COMMIT'); else db.exec(`RELEASE ${name}`);
        return out;
      } catch (err) {
        depth--;
        if (depth === 0) db.exec('ROLLBACK'); else db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
        throw err;
      }
    },
    close: () => db.close(),
  };
}

export function listMigrations() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort().map((f) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    return { version: Number(f.slice(0, 3)), name: f, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
}

/** Aplica migraciones pendientes. Falla (fail-closed) si una migración aplicada cambió. */
export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  const applied = new Map(db.all('SELECT version, checksum, name FROM schema_migrations').map((r) => [r.version, r]));
  const done = [];
  for (const m of listMigrations()) {
    const prev = applied.get(m.version);
    if (prev) {
      if (prev.checksum !== m.checksum) throw new Error(`MIGRATION_CHECKSUM_MISMATCH ${m.name}`);
      continue;
    }
    db.tx(() => {
      db.exec(m.sql);
      db.run('INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?,?,?,?)', m.version, m.name, m.checksum, Date.now());
    });
    done.push(m.name);
  }
  return done;
}
