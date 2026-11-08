/**
 * CLI de herramientas para SENDA LIVE.
 * Uso:
 *   node server/cli.mjs migrate
 *   node server/cli.mjs seed
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, migrate } from './db.mjs';
import { createAuditor } from './audit.mjs';
import { createRealtimeHub } from './realtime.mjs';
import { createNotifier } from './services/notify.mjs';
import { createAuthService } from './services/auth.mjs';
import { createMessagingService } from './services/messaging.mjs';
import { createAdminService } from './services/admin.mjs';
import { createEmergencyService } from './services/emergency.mjs';
import { createOrganization } from '@senda/core/src/roles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = process.env.DATABASE_FILE || join(__dirname, '../data/senda-live.db');

const cmd = process.argv[2] || 'help';

const db = openDatabase(DB_PATH);

if (cmd === 'migrate') {
  console.log('Aplicando migraciones...');
  const applied = migrate(db);
  console.log(`Migraciones completadas: ${applied.length} aplicadas.`);
  process.exit(0);
}

if (cmd === 'seed') {
  console.log('Sembrando datos base...');
  migrate(db);
  const audit = createAuditor(db, { ipSalt: 'cli-seed-salt' });
  const auth = createAuthService(db, audit);
  const rt = createRealtimeHub(db);
  const notifier = createNotifier(db, rt);
  const emergency = createEmergencyService(db, { rt, notifier, audit });
  const messaging = createMessagingService(db, { rt, notifier, emergency, audit });
  const admin = createAdminService(db, { rt, emergency, audit });

  // Crear usuario admin
  let adminUser;
  try {
    const reg = auth.register({
      email: 'admin@senda.live',
      password: 'password12345',
      handle: 'admin',
      displayName: 'Administrador SENDA'
    });
    adminUser = reg.user;
    console.log('Usuario administrador creado: admin@senda.live');
  } catch (e) {
    adminUser = db.get("SELECT id FROM profiles WHERE handle = 'admin'");
    console.log('Usuario administrador ya existía.');
  }

  // Asignar rol PLATFORM_ADMIN
  db.run(
    `INSERT OR IGNORE INTO role_assignments(id, user_id, role, granted_by, created_at)
     VALUES ('role-admin-1', ?, 'PLATFORM_ADMIN', ?, ?)`,
    adminUser.id, adminUser.id, Date.now()
  );

  // Sembrar canales por defecto
  messaging.ensureDefaultChannels(adminUser.id);
  console.log('Canales por defecto configurados.');

  console.log('Base sembrada exitosamente.');
  process.exit(0);
}

console.log(`Comandos:
  node server/cli.mjs migrate
  node server/cli.mjs seed`);
process.exit(0);
