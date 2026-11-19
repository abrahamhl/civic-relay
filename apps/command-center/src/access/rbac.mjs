// Role-based access control and entity (organisation) model.
//
// This is a FRONTEND simulation. There is no authentication server, no session
// store and no persistence: every account, entity and permission here is
// synthetic demo data, labelled SIMULATOR. Wiring real identities requires an
// identity provider, signed sessions and an audit log; until that exists the UI
// must keep saying so.

export const RBAC_PROVENANCE = 'SIMULATOR';

/**
 * @typedef {'super_admin'|'entity_admin'|'coordinator'|'operator'|'field_unit'|'analyst'|'observer'} RoleId
 */

/**
 * @typedef {Object} Permission
 * @property {string} id
 * @property {string} label
 * @property {string} group
 * @property {string} description
 */

/** @type {readonly RoleId[]} */
export const ROLE_IDS = [
  'super_admin',
  'entity_admin',
  'coordinator',
  'operator',
  'field_unit',
  'analyst',
  'observer',
];

/** @type {readonly Permission[]} */
export const PERMISSIONS = Object.freeze([
  { id: 'org.manage', label: 'Gestionar entidades', group: 'Organización', description: 'Crear, editar y desactivar entidades y sus sedes.' },
  { id: 'org.view', label: 'Ver entidades', group: 'Organización', description: 'Consultar el directorio de entidades y su estado.' },
  { id: 'user.manage', label: 'Gestionar usuarios', group: 'Identidad', description: 'Invitar, asignar roles y suspender cuentas.' },
  { id: 'user.view', label: 'Ver usuarios', group: 'Identidad', description: 'Consultar el directorio de personas y sus roles.' },
  { id: 'role.manage', label: 'Gestionar roles', group: 'Identidad', description: 'Editar la matriz de permisos por rol.' },
  { id: 'resource.dispatch', label: 'Despachar recursos', group: 'Operación', description: 'Asignar medios y unidades a una incidencia.' },
  { id: 'incident.command', label: 'Comandar incidencias', group: 'Operación', description: 'Abrir, escalar y cerrar incidencias.' },
  { id: 'incident.view', label: 'Ver incidencias', group: 'Operación', description: 'Consultar el tablero de incidencias activas.' },
  { id: 'sensor.view', label: 'Ver sensores', group: 'Datos', description: 'Consultar cámaras, fuentes y telemetría.' },
  { id: 'sensor.configure', label: 'Configurar sensores', group: 'Datos', description: 'Alta, calibración y baja de sensores.' },
  { id: 'evidence.view', label: 'Ver evidencia', group: 'Datos', description: 'Acceder a la evidencia forense y sus hashes.' },
  { id: 'evidence.export', label: 'Exportar evidencia', group: 'Datos', description: 'Generar paquetes firmados de evidencia.' },
  { id: 'audit.view', label: 'Ver auditoría', group: 'Gobierno', description: 'Consultar el registro de acciones.' },
  { id: 'settings.manage', label: 'Gestionar ajustes', group: 'Gobierno', description: 'Cambiar la configuración global de la plataforma.' },
]);

export const PERMISSION_IDS = PERMISSIONS.map((p) => p.id);

/**
 * @typedef {Object} Role
 * @property {RoleId} id
 * @property {string} label
 * @property {'global'|'entity'|'unit'} scope
 * @property {string} description
 * @property {string[]} permissions
 */

/** @type {readonly Role[]} */
export const ROLES = Object.freeze([
  {
    id: 'super_admin',
    label: 'Superadministrador',
    scope: 'global',
    description: 'Control total de la plataforma y de todas las entidades.',
    permissions: [...PERMISSION_IDS],
  },
  {
    id: 'entity_admin',
    label: 'Administrador de entidad',
    scope: 'entity',
    description: 'Gestiona su entidad, sus usuarios y su operación, sin tocar otras entidades.',
    permissions: [
      'org.manage', 'org.view', 'user.manage', 'user.view', 'role.manage',
      'resource.dispatch', 'incident.command', 'incident.view',
      'sensor.view', 'sensor.configure', 'evidence.view', 'audit.view', 'settings.manage',
    ],
  },
  {
    id: 'coordinator',
    label: 'Coordinador de emergencia',
    scope: 'entity',
    description: 'Dirige la respuesta entre entidades y abre incidencias.',
    permissions: [
      'org.view', 'user.view', 'resource.dispatch', 'incident.command',
      'incident.view', 'sensor.view', 'evidence.view', 'audit.view',
    ],
  },
  {
    id: 'operator',
    label: 'Operador de sala',
    scope: 'entity',
    description: 'Monitoriza sensores y despacha recursos asignados.',
    permissions: ['incident.view', 'resource.dispatch', 'sensor.view'],
  },
  {
    id: 'field_unit',
    label: 'Unidad de campo',
    scope: 'unit',
    description: 'Recibe asignaciones y reporta desde el terreno.',
    permissions: ['incident.view', 'sensor.view'],
  },
  {
    id: 'analyst',
    label: 'Analista',
    scope: 'entity',
    description: 'Analiza datos, sensores y evidencia sin poder operarlos.',
    permissions: ['sensor.view', 'evidence.view', 'evidence.export', 'incident.view', 'audit.view'],
  },
  {
    id: 'observer',
    label: 'Observador',
    scope: 'global',
    description: 'Acceso de solo lectura a la información pública.',
    permissions: ['org.view', 'incident.view', 'sensor.view'],
  },
]);

export const ROLE_BY_ID = Object.fromEntries(
  ROLES.map((role) => [role.id, role]),
);

/**
 * @param {RoleId} roleId
 * @returns {string[]}
 */
export function permissionsForRole(roleId) {
  return ROLE_BY_ID[roleId]?.permissions ?? [];
}

/**
 * @param {RoleId[]} roleIds
 * @param {string} permission
 * @returns {boolean}
 */
export function can(roleIds, permission) {
  return roleIds.some((roleId) => permissionsForRole(roleId).includes(permission));
}

/**
 * @param {RoleId[]} roleIds
 * @returns {Permission[]}
 */
export function permissionGaps(roleIds) {
  return PERMISSIONS.filter((permission) => !can(roleIds, permission.id));
}
