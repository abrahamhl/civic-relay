// Entity (organisation) and user directory model. Synthetic demo data only.
//
// Everything here is illustrative: names, contacts and counts are invented and
// must not be presented as a real registry. The lifecycle rules (active,
// invited, suspended) are real logic so the UI behaves correctly once a backend
// is wired in.

import { RBAC_PROVENANCE } from './rbac.mjs';

export const DIRECTORY_PROVENANCE = RBAC_PROVENANCE;

/**
 * @typedef {'emergency'|'municipal'|'health'|'security'|'utility'|'ngo'|'press'|'research'} OrgType
 * @typedef {'active'|'limited'|'suspended'} OrgStatus
 * @typedef {'active'|'invited'|'suspended'} UserStatus
 * @typedef {import('./rbac.mjs').RoleId} RoleId
 */

/**
 * @typedef {Object} Org
 * @property {string} id
 * @property {string} name
 * @property {string} short
 * @property {OrgType} type
 * @property {OrgStatus} status
 * @property {string} country
 * @property {string} region
 * @property {number} reach
 * @property {string} contactName
 * @property {string} contactEmail
 * @property {string} createdAtUTC
 */

/**
 * @typedef {Object} DirectoryUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} orgId
 * @property {RoleId[]} roles
 * @property {UserStatus} status
 * @property {string | null} lastSeenUTC
 * @property {string} createdAtUTC
 * @property {boolean} mfa
 */

/** Higher number wins when several roles are held at once. @type {Record<RoleId, number>} */
export const ROLE_RANK = {
  super_admin: 7,
  entity_admin: 6,
  coordinator: 5,
  operator: 4,
  analyst: 3,
  field_unit: 2,
  observer: 1,
};

/**
 * @param {RoleId[]} roles
 * @returns {RoleId | null}
 */
export function highestRole(roles) {
  if (!roles.length) return null;
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

/** @type {Record<OrgType, string>} */
export const ORG_TYPE_LABEL = {
  emergency: 'Emergencias',
  municipal: 'Administración local',
  health: 'Sanidad',
  security: 'Seguridad',
  utility: 'Servicios esenciales',
  ngo: 'ONG / voluntariado',
  press: 'Prensa',
  research: 'Investigación',
};

export const ORG_STATUS_LABEL = {
  active: 'Activa',
  limited: 'Acceso limitado',
  suspended: 'Suspendida',
};

export const USER_STATUS_LABEL = {
  active: 'Activa',
  invited: 'Invitada',
  suspended: 'Suspendida',
};

/** @type {readonly Org[]} */
export const DEMO_ORGS = Object.freeze([
  { id: 'org-emergency-01', name: 'Centro Coordinador de Emergencias', short: 'CCE', type: 'emergency', status: 'active', country: 'ES', region: 'Madrid', reach: 412, contactName: 'Marta Ruiz', contactEmail: 'm.ruiz@cce.example', createdAtUTC: '2024-02-11T09:00:00Z' },
  { id: 'org-municipal-01', name: 'Ayuntamiento de la Ribera', short: 'AYR', type: 'municipal', status: 'active', country: 'ES', region: 'Valencia', reach: 96, contactName: 'Iván Cerdá', contactEmail: 'i.cerda@ayr.example', createdAtUTC: '2024-03-02T08:30:00Z' },
  { id: 'org-health-01', name: 'Red Sanitaria de Urgencias', short: 'RSU', type: 'health', status: 'active', country: 'ES', region: 'Cataluña', reach: 288, contactName: 'Nadia Prat', contactEmail: 'n.prat@rsu.example', createdAtUTC: '2023-11-20T07:15:00Z' },
  { id: 'org-security-01', name: 'Unidad de Seguridad Ciudadana', short: 'USC', type: 'security', status: 'limited', country: 'ES', region: 'Madrid', reach: 173, contactName: 'Diego Sanz', contactEmail: 'd.sanz@usc.example', createdAtUTC: '2024-01-09T10:45:00Z' },
  { id: 'org-utility-01', name: 'Consorcio de Servicios Esenciales', short: 'CSE', type: 'utility', status: 'active', country: 'ES', region: 'Andalucía', reach: 64, contactName: 'Lucía Pons', contactEmail: 'l.pons@cse.example', createdAtUTC: '2023-09-14T12:00:00Z' },
  { id: 'org-ngo-01', name: 'Cruz Voluntaria', short: 'CVO', type: 'ngo', status: 'active', country: 'ES', region: 'Nacional', reach: 530, contactName: 'Tomás Iglesias', contactEmail: 't.iglesias@cvo.example', createdAtUTC: '2023-06-30T15:20:00Z' },
  { id: 'org-press-01', name: 'Agencia Noticias Alfa', short: 'ANA', type: 'press', status: 'limited', country: 'ES', region: 'Nacional', reach: 41, contactName: 'Rocío Vega', contactEmail: 'r.vega@ana.example', createdAtUTC: '2024-04-18T11:10:00Z' },
  { id: 'org-research-01', name: 'Laboratorio de Resiliencia', short: 'LDR', type: 'research', status: 'suspended', country: 'ES', region: 'País Vasco', reach: 22, contactName: 'Aitor Beltrán', contactEmail: 'a.beltran@ldr.example', createdAtUTC: '2024-05-27T13:40:00Z' },
]);

/** @type {readonly DirectoryUser[]} */
export const DEMO_USERS = Object.freeze([
  { id: 'usr-0001', name: 'Elena Vargas', email: 'e.vargas@cce.example', orgId: 'org-emergency-01', roles: ['super_admin'], status: 'active', lastSeenUTC: '2026-11-06T08:12:00Z', createdAtUTC: '2024-02-11T09:05:00Z', mfa: true },
  { id: 'usr-0002', name: 'Marta Ruiz', email: 'm.ruiz@cce.example', orgId: 'org-emergency-01', roles: ['entity_admin'], status: 'active', lastSeenUTC: '2026-11-06T07:58:00Z', createdAtUTC: '2024-02-12T10:00:00Z', mfa: true },
  { id: 'usr-0003', name: 'Javier Nogueira', email: 'j.nogueira@cce.example', orgId: 'org-emergency-01', roles: ['coordinator'], status: 'active', lastSeenUTC: '2026-11-06T07:40:00Z', createdAtUTC: '2024-02-15T09:20:00Z', mfa: true },
  { id: 'usr-0004', name: 'Sara Molina', email: 's.molina@cce.example', orgId: 'org-emergency-01', roles: ['operator'], status: 'active', lastSeenUTC: '2026-11-06T08:05:00Z', createdAtUTC: '2024-02-20T08:00:00Z', mfa: false },
  { id: 'usr-0005', name: 'Pablo Hierro', email: 'p.hierro@cce.example', orgId: 'org-emergency-01', roles: ['field_unit'], status: 'active', lastSeenUTC: '2026-11-05T19:22:00Z', createdAtUTC: '2024-03-01T16:10:00Z', mfa: false },
  { id: 'usr-0006', name: 'Iván Cerdá', email: 'i.cerda@ayr.example', orgId: 'org-municipal-01', roles: ['entity_admin'], status: 'active', lastSeenUTC: '2026-11-06T07:15:00Z', createdAtUTC: '2024-03-02T08:35:00Z', mfa: true },
  { id: 'usr-0007', name: 'Noa Serra', email: 'n.serra@ayr.example', orgId: 'org-municipal-01', roles: ['operator', 'analyst'], status: 'active', lastSeenUTC: '2026-11-05T22:01:00Z', createdAtUTC: '2024-03-05T09:00:00Z', mfa: false },
  { id: 'usr-0008', name: 'Hugo Ferrán', email: 'h.ferran@ayr.example', orgId: 'org-municipal-01', roles: ['field_unit'], status: 'invited', lastSeenUTC: null, createdAtUTC: '2026-11-01T11:30:00Z', mfa: false },
  { id: 'usr-0009', name: 'Nadia Prat', email: 'n.prat@rsu.example', orgId: 'org-health-01', roles: ['entity_admin'], status: 'active', lastSeenUTC: '2026-11-06T06:50:00Z', createdAtUTC: '2023-11-20T07:20:00Z', mfa: true },
  { id: 'usr-0010', name: 'Omar Casal', email: 'o.casal@rsu.example', orgId: 'org-health-01', roles: ['coordinator'], status: 'active', lastSeenUTC: '2026-11-06T07:33:00Z', createdAtUTC: '2023-12-01T10:00:00Z', mfa: true },
  { id: 'usr-0011', name: 'Carla Duarte', email: 'c.duarte@rsu.example', orgId: 'org-health-01', roles: ['analyst'], status: 'active', lastSeenUTC: '2026-11-05T18:12:00Z', createdAtUTC: '2024-01-14T09:00:00Z', mfa: false },
  { id: 'usr-0012', name: 'Diego Sanz', email: 'd.sanz@usc.example', orgId: 'org-security-01', roles: ['entity_admin'], status: 'active', lastSeenUTC: '2026-11-06T07:05:00Z', createdAtUTC: '2024-01-09T10:50:00Z', mfa: true },
  { id: 'usr-0013', name: 'Irene Lobo', email: 'i.lobo@usc.example', orgId: 'org-security-01', roles: ['operator'], status: 'suspended', lastSeenUTC: '2026-10-28T14:44:00Z', createdAtUTC: '2024-01-20T08:00:00Z', mfa: false },
  { id: 'usr-0014', name: 'Bruno Alcázar', email: 'b.alcazar@usc.example', orgId: 'org-security-01', roles: ['field_unit'], status: 'active', lastSeenUTC: '2026-11-06T05:30:00Z', createdAtUTC: '2024-02-02T07:45:00Z', mfa: false },
  { id: 'usr-0015', name: 'Lucía Pons', email: 'l.pons@cse.example', orgId: 'org-utility-01', roles: ['entity_admin'], status: 'active', lastSeenUTC: '2026-11-05T20:19:00Z', createdAtUTC: '2023-09-14T12:05:00Z', mfa: true },
  { id: 'usr-0016', name: 'Gael Requena', email: 'g.requena@cse.example', orgId: 'org-utility-01', roles: ['operator'], status: 'active', lastSeenUTC: '2026-11-05T23:47:00Z', createdAtUTC: '2023-10-01T09:00:00Z', mfa: false },
  { id: 'usr-0017', name: 'Tomás Iglesias', email: 't.iglesias@cvo.example', orgId: 'org-ngo-01', roles: ['coordinator'], status: 'active', lastSeenUTC: '2026-11-06T07:48:00Z', createdAtUTC: '2023-06-30T15:25:00Z', mfa: true },
  { id: 'usr-0018', name: 'Vera Aritzeta', email: 'v.aritzeta@cvo.example', orgId: 'org-ngo-01', roles: ['field_unit'], status: 'active', lastSeenUTC: '2026-11-05T21:11:00Z', createdAtUTC: '2023-07-10T09:00:00Z', mfa: false },
  { id: 'usr-0019', name: 'Álex Sáez', email: 'a.saez@cvo.example', orgId: 'org-ngo-01', roles: ['field_unit'], status: 'invited', lastSeenUTC: null, createdAtUTC: '2026-11-03T10:00:00Z', mfa: false },
  { id: 'usr-0020', name: 'Rocío Vega', email: 'r.vega@ana.example', orgId: 'org-press-01', roles: ['observer'], status: 'active', lastSeenUTC: '2026-11-04T16:05:00Z', createdAtUTC: '2024-04-18T11:15:00Z', mfa: false },
  { id: 'usr-0021', name: 'Aitor Beltrán', email: 'a.beltran@ldr.example', orgId: 'org-research-01', roles: ['analyst'], status: 'suspended', lastSeenUTC: '2026-10-30T09:33:00Z', createdAtUTC: '2024-05-27T13:45:00Z', mfa: true },
  { id: 'usr-0022', name: 'Mireia Bosch', email: 'm.bosch@rsu.example', orgId: 'org-health-01', roles: ['observer'], status: 'active', lastSeenUTC: '2026-11-05T12:00:00Z', createdAtUTC: '2024-06-01T09:00:00Z', mfa: false },
]);

/**
 * @typedef {Object} DirectoryStats
 * @property {number} orgs
 * @property {Record<OrgType, number>} orgsByType
 * @property {Record<OrgStatus, number>} orgsByStatus
 * @property {number} users
 * @property {Record<UserStatus, number>} usersByStatus
 * @property {Record<string, number>} usersByRole
 * @property {number} mfaCoverage
 * @property {number} multiRoleUsers
 */

/**
 * @param {readonly Org[]} orgs
 * @param {readonly DirectoryUser[]} users
 * @returns {DirectoryStats}
 */
export function aggregateDirectory(orgs, users) {
  /** @type {Record<OrgType, number>} */
  const orgsByType = Object.fromEntries(
    Object.keys(ORG_TYPE_LABEL).map((type) => [type, 0]),
  );
  /** @type {Record<OrgStatus, number>} */
  const orgsByStatus = { active: 0, limited: 0, suspended: 0 };
  for (const org of orgs) {
    orgsByType[org.type] += 1;
    orgsByStatus[org.status] += 1;
  }

  /** @type {Record<UserStatus, number>} */
  const usersByStatus = { active: 0, invited: 0, suspended: 0 };
  /** @type {Record<string, number>} */
  const usersByRole = {};
  let mfaCount = 0;
  let multiRoleUsers = 0;
  for (const user of users) {
    usersByStatus[user.status] += 1;
    if (user.mfa) mfaCount += 1;
    if (user.roles.length > 1) multiRoleUsers += 1;
    for (const role of user.roles) usersByRole[role] = (usersByRole[role] ?? 0) + 1;
  }

  return {
    orgs: orgs.length,
    orgsByType,
    orgsByStatus,
    users: users.length,
    usersByStatus,
    usersByRole,
    mfaCoverage: users.length ? mfaCount / users.length : 0,
    multiRoleUsers,
  };
}
